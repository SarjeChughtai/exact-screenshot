import JSZip from 'jszip';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '@/integrations/supabase/client';
import {
  insulationCostDataFromRow,
  insulationCostDataToRow,
  steelCostDataFromRow,
  steelCostDataToRow,
  storedDocumentFromRow,
  storedDocumentToRow,
} from '@/lib/supabaseMappers';
import type {
  CostDocumentReviewStatus,
  InsulationCostDataRecord,
  SteelCostDataRecord,
  StoredDocument,
} from '@/types';
import {
  COST_PARSER_VERSION,
  extractTextFromPdf,
  parseCostDocumentFromPages,
  type ParsedCostDocument,
} from '@/lib/pdfParsers';
import { buildDuplicateDocumentGroupKey } from '@/lib/importReview';
import { resolveCanonicalJobId } from '@/lib/jobIds';
import { normalizeStructureType } from '@/lib/internalQuoteNormalization';

export interface CostDocumentImportContext {
  fileName: string;
  fileSize?: number | null;
  fileType?: string | null;
  storagePath?: string | null;
  quoteFileId?: string | null;
  documentId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  structureType?: StoredDocument['structureType'];
  clientId?: string | null;
  vendorId?: string | null;
  uploadedBy?: string | null;
  sourceType?: StoredDocument['sourceType'];
  reviewStatus?: CostDocumentReviewStatus;
  parseError?: string | null;
  parserName?: string;
  parserVersion?: string;
}

export interface ImportedCostDataSummary {
  storedDocuments: number;
  steelRows: number;
  insulationRows: number;
  skippedFiles: string[];
}

function safeNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeString(value: unknown): string | null {
  if (value == null) return null;
  const stringValue = String(value).trim();
  return stringValue ? stringValue : null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

export async function upsertStoredDocument(
  context: CostDocumentImportContext,
  parsedResult?: ParsedCostDocument | null,
): Promise<string | null> {
  const canonicalJobId = resolveCanonicalJobId(context.jobId, context.projectId);
  const structureType = normalizeStructureType(context.structureType || 'steel_building');
  const payload = storedDocumentToRow({
    quoteFileId: context.quoteFileId ?? null,
    documentId: context.documentId ?? null,
    jobId: canonicalJobId,
    projectId: context.projectId ?? null,
    clientId: context.clientId ?? null,
    vendorId: context.vendorId ?? null,
    structureType,
    sourceType: context.sourceType || 'uploaded',
    sourceFilename: context.fileName,
    sourceFileExtension: context.fileName.split('.').pop()?.toLowerCase() || null,
    fileName: context.fileName,
    fileSize: context.fileSize ?? null,
    fileType: context.fileType || 'unknown',
    storagePath: context.storagePath || '',
    extractedDocumentType: parsedResult?.type === 'unknown' ? null : parsedResult?.type || null,
    parserName: context.parserName || (parsedResult ? 'regex-pdf-parser' : null),
    parserVersion: context.parserVersion || COST_PARSER_VERSION,
    parseError: context.parseError ?? parsedResult?.parseError ?? null,
    duplicateGroupKey: buildDuplicateDocumentGroupKey({
      jobId: canonicalJobId,
      fileType: context.fileType || 'unknown',
      extractedDocumentType: parsedResult?.type === 'unknown' ? null : parsedResult?.type || null,
      documentId: context.documentId ?? null,
      buildingLabel: null,
      clientId: context.clientId ?? null,
    }),
    isPrimaryDocument: true,
    reviewStatus:
      context.reviewStatus
      || parsedResult?.reviewStatus
      || (parsedResult?.type === 'unknown' ? 'needs_review' : 'pending'),
    parsedData: parsedResult
      ? parsedResult.type === 'mbs'
        ? (parsedResult.steel as any)
        : parsedResult.type === 'insulation'
          ? (parsedResult.insulation as any)
          : { rawText: parsedResult.rawText }
      : null,
    metadata: { parserVersion: context.parserVersion || COST_PARSER_VERSION },
    parsedSuccessfully: parsedResult ? parsedResult.type !== 'unknown' : null,
    uploadedBy: context.uploadedBy ?? null,
    uploadedAt: new Date().toISOString(),
  });

  const existingQuery = context.quoteFileId
    ? (supabase.from as any)('stored_documents').select('id').eq('quote_file_id', context.quoteFileId).limit(1)
    : null;
  const existing = existingQuery ? await existingQuery.maybeSingle() : { data: null };

  if (existing.data?.id) {
    const { error } = await (supabase.from as any)('stored_documents')
      .update(payload)
      .eq('id', existing.data.id);
    if (error) throw error;
    return existing.data.id as string;
  }

  const { data, error } = await (supabase.from as any)('stored_documents')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data?.id || null;
}

export async function upsertSteelCostData(
  record: Partial<SteelCostDataRecord>,
  quoteFileId?: string | null,
): Promise<string | null> {
  const payload = steelCostDataToRow(record);
  const existingQuery = quoteFileId
    ? (supabase.from as any)('steel_cost_data').select('id').eq('quote_file_id', quoteFileId).limit(1)
    : null;
  const existing = existingQuery ? await existingQuery.maybeSingle() : { data: null };

  if (existing.data?.id) {
    const { error } = await (supabase.from as any)('steel_cost_data').update(payload).eq('id', existing.data.id);
    if (error) throw error;
    return existing.data.id as string;
  }

  const { data, error } = await (supabase.from as any)('steel_cost_data')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data?.id || null;
}

export async function upsertInsulationCostData(
  record: Partial<InsulationCostDataRecord>,
  quoteFileId?: string | null,
): Promise<string | null> {
  const payload = insulationCostDataToRow(record);
  const existingQuery = quoteFileId
    ? (supabase.from as any)('insulation_cost_data').select('id').eq('quote_file_id', quoteFileId).limit(1)
    : null;
  const existing = existingQuery ? await existingQuery.maybeSingle() : { data: null };

  if (existing.data?.id) {
    const { error } = await (supabase.from as any)('insulation_cost_data').update(payload).eq('id', existing.data.id);
    if (error) throw error;
    return existing.data.id as string;
  }

  const { data, error } = await (supabase.from as any)('insulation_cost_data')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data?.id || null;
}

export async function persistParsedCostDocument(
  context: CostDocumentImportContext,
  parsedResult: ParsedCostDocument | null,
): Promise<{ storedDocumentId: string | null; steelId: string | null; insulationId: string | null }> {
  const uploadedBy = context.uploadedBy ?? (await getCurrentUserId());
  const canonicalJobId = resolveCanonicalJobId(context.jobId, context.projectId);
  const structureType = normalizeStructureType(context.structureType || 'steel_building');
  const storedDocumentId = await upsertStoredDocument({ ...context, uploadedBy }, parsedResult);

  if (!parsedResult || parsedResult.type === 'unknown') {
    return { storedDocumentId, steelId: null, insulationId: null };
  }

  if (parsedResult.type === 'mbs') {
    const steel = parsedResult.steel;
    const steelId = await upsertSteelCostData({
      storedDocumentId,
      quoteFileId: context.quoteFileId ?? null,
      documentId: context.documentId ?? null,
      jobId: canonicalJobId ?? resolveCanonicalJobId(steel.projectId),
      projectId: context.projectId ?? steel.projectId ?? null,
      clientId: context.clientId ?? steel.clientId ?? null,
      vendorId: context.vendorId ?? null,
      structureType,
      widthFt: steel.widthFt,
      lengthFt: steel.lengthFt,
      eaveHeightFt: steel.eaveHeightFt,
      roofSlope: steel.roofSlope,
      floorAreaSqft: steel.floorAreaSqft,
      totalWeightLb: steel.totalWeightLb,
      totalCost: steel.totalCost,
      costPerSqft: steel.costPerSqft,
      weightPerSqft: steel.weightPerSqft,
      pricePerLb: steel.pricePerLb,
      snowLoadPsf: steel.snowLoadPsf,
      windLoadPsf: steel.windLoadPsf,
      windCode: steel.windCode,
      province: steel.province,
      city: steel.city,
      seismicCat: steel.seismicCat,
      dataSource: 'MBS Quote PDF',
      sourceType: context.sourceType || 'uploaded',
      sourceFileName: context.fileName,
      sourceFilePath: context.storagePath || null,
      reviewStatus: context.reviewStatus || parsedResult.reviewStatus || 'pending',
      parserVersion: context.parserVersion || COST_PARSER_VERSION,
      rawExtraction: steel as any,
      components: steel.components as any,
      addedBy: uploadedBy,
      dateAdded: todayIsoDate(),
    }, context.quoteFileId ?? null);
    return { storedDocumentId, steelId, insulationId: null };
  }

  const insulation = parsedResult.insulation;
  const insulationId = await upsertInsulationCostData({
    storedDocumentId,
    quoteFileId: context.quoteFileId ?? null,
    documentId: context.documentId ?? null,
    jobId: canonicalJobId ?? resolveCanonicalJobId(insulation.projectId),
    projectId: context.projectId ?? insulation.projectId ?? null,
    clientId: context.clientId ?? null,
    vendorId: context.vendorId ?? null,
    structureType,
    widthFt: insulation.widthFt,
    lengthFt: insulation.lengthFt,
    eaveHeightFt: insulation.eaveHeightFt,
    roofSlope: insulation.roofSlope,
    floorAreaSqft: insulation.floorAreaSqft,
    location: insulation.location,
    roofRValue: insulation.roofRValue,
    wallRValue: insulation.wallRValue,
    grade: insulation.grade,
    roofAreaSqft: insulation.roofAreaSqft,
    wallAreaSqft: insulation.wallAreaSqft,
    totalInsulatedSqft: insulation.totalInsulatedSqft,
    materialCost: insulation.materialCost,
    freightCost: insulation.freightCost,
    fuelSurcharge: insulation.fuelSurcharge,
    totalDelivery: insulation.totalDelivery,
    totalCost: insulation.totalCost,
    materialPerSqft: insulation.materialPerSqft,
    totalPerSqft: insulation.totalPerSqft,
    weightLb: insulation.weightLb,
    shipBranch: insulation.shipBranch,
    quoteNumber: insulation.quoteNumber,
    quoteDate: insulation.quoteDate,
    dataSource: 'Silvercote Quote PDF',
    sourceType: context.sourceType || 'uploaded',
    sourceFileName: context.fileName,
    sourceFilePath: context.storagePath || null,
    reviewStatus: context.reviewStatus || parsedResult.reviewStatus || 'pending',
    parserVersion: context.parserVersion || COST_PARSER_VERSION,
    rawExtraction: insulation as any,
    accessories: insulation.accessories as any,
    addedBy: uploadedBy,
    dateAdded: todayIsoDate(),
  }, context.quoteFileId ?? null);
  return { storedDocumentId, steelId: null, insulationId };
}

function mapSteelSeedRow(row: Record<string, unknown>): Partial<SteelCostDataRecord> {
  const canonicalJobId = resolveCanonicalJobId(row.job_id, row.project_id);
  return {
    projectId: safeString(row.project_id),
    jobId: canonicalJobId,
    structureType: normalizeStructureType(row.structure_type || 'steel_building'),
    widthFt: safeNumber(row.width_ft),
    lengthFt: safeNumber(row.length_ft),
    eaveHeightFt: safeNumber(row.eave_height_ft),
    roofSlope: safeNumber(row.roof_slope),
    floorAreaSqft: safeNumber(row.floor_area_sqft),
    totalWeightLb: safeNumber(row.total_weight_lb),
    totalCost: safeNumber(row.total_cost),
    costPerSqft: safeNumber(row.cost_per_sqft),
    weightPerSqft: safeNumber(row.weight_per_sqft),
    pricePerLb: safeNumber(row.price_per_lb),
    snowLoadPsf: safeNumber(row.snow_load_psf),
    windLoadPsf: safeNumber(row.wind_load_psf),
    windCode: safeString(row.wind_code),
    province: safeString(row.province),
    seismicCat: safeString(row.seismic_cat),
    dataSource: safeString(row.data_source),
    sourceType: 'seed_json',
    sourceFileName: null,
    sourceFilePath: null,
    reviewStatus: 'approved',
    dateAdded: safeString(row.date_added) || todayIsoDate(),
  };
}

function mapInsulationSeedRow(row: Record<string, unknown>): Partial<InsulationCostDataRecord> {
  const canonicalJobId = resolveCanonicalJobId(row.job_id, row.project_id);
  return {
    projectId: safeString(row.project_id),
    jobId: canonicalJobId,
    structureType: normalizeStructureType(row.structure_type || 'steel_building'),
    widthFt: safeNumber(row.width_ft),
    lengthFt: safeNumber(row.length_ft),
    eaveHeightFt: safeNumber(row.eave_height_ft),
    floorAreaSqft: safeNumber(row.floor_area_sqft),
    location: safeString(row.location),
    roofRValue: safeString(row.roof_r_value),
    wallRValue: safeString(row.wall_r_value),
    grade: safeString(row.grade),
    roofAreaSqft: safeNumber(row.roof_area_sqft),
    wallAreaSqft: safeNumber(row.wall_area_sqft),
    totalInsulatedSqft: safeNumber(row.total_insulated_sqft),
    materialCost: safeNumber(row.material_cost),
    freightCost: safeNumber(row.freight_cost),
    fuelSurcharge: safeNumber(row.fuel_surcharge),
    totalDelivery: safeNumber(row.total_delivery),
    totalCost: safeNumber(row.total_cost),
    materialPerSqft: safeNumber(row.material_per_sqft),
    totalPerSqft: safeNumber(row.total_per_sqft),
    weightLb: safeNumber(row.weight_lb),
    shipBranch: safeString(row.ship_branch),
    quoteNumber: safeString(row.quote_number),
    quoteDate: safeString(row.quote_date),
    dataSource: safeString(row.data_source),
    sourceType: 'seed_json',
    reviewStatus: 'approved',
    dateAdded: safeString(row.date_added) || todayIsoDate(),
  };
}

async function insertStoredSeedDocument(fileName: string, sourceType: StoredDocument['sourceType'], parsedData: unknown): Promise<void> {
  const uploadedBy = await getCurrentUserId();
  await upsertStoredDocument({
    fileName,
    fileType: 'seed',
    storagePath: '',
    uploadedBy,
    sourceType,
    reviewStatus: 'approved',
    parserName: 'seed-import',
    parserVersion: COST_PARSER_VERSION,
  }, {
    type: 'unknown',
    reviewStatus: 'approved',
    parseError: null as any,
    rawText: JSON.stringify(parsedData).slice(0, 2000),
  } as ParsedCostDocument);
}

export async function importSeedJsonObject(seedData: any, fileName = 'seed.json'): Promise<ImportedCostDataSummary> {
  const uploadedBy = await getCurrentUserId();
  const steelRows = Array.isArray(seedData?.steel_cost_data) ? seedData.steel_cost_data : [];
  const insulationRows = Array.isArray(seedData?.insulation_cost_data) ? seedData.insulation_cost_data : [];

  for (const row of steelRows) {
    await upsertSteelCostData({ ...mapSteelSeedRow(row), addedBy: uploadedBy, sourceType: 'seed_json', sourceFileName: fileName }, null);
  }
  for (const row of insulationRows) {
    await upsertInsulationCostData({ ...mapInsulationSeedRow(row), addedBy: uploadedBy, sourceType: 'seed_json', sourceFileName: fileName }, null);
  }
  await insertStoredSeedDocument(fileName, 'seed_json', {
    steelRows: steelRows.length,
    insulationRows: insulationRows.length,
  });

  return { storedDocuments: 1, steelRows: steelRows.length, insulationRows: insulationRows.length, skippedFiles: [] };
}

function rowsFromWorkbook(file: File, workbook: XLSX.WorkBook): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    rows.push(...(XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]));
  }
  return rows;
}

function detectDatasetType(rows: Record<string, unknown>[]): 'steel' | 'insulation' | 'average' | 'unknown' {
  const headers = Object.keys(rows[0] || {}).map((item) => item.toLowerCase());
  if (headers.includes('total_weight_lb') || headers.includes('price_per_lb')) return 'steel';
  if (headers.includes('roof_r_value') || headers.includes('total_insulated_sqft')) return 'insulation';
  if (headers.includes('avg_cost_sqft') || headers.includes('avg_total_per_sqft')) return 'average';
  return 'unknown';
}

async function importTabularRows(rows: Record<string, unknown>[], fileName: string, sourceType: StoredDocument['sourceType']): Promise<ImportedCostDataSummary> {
  const uploadedBy = await getCurrentUserId();
  const datasetType = detectDatasetType(rows);
  let steelCount = 0;
  let insulationCount = 0;
  if (datasetType === 'steel') {
    for (const row of rows) {
      await upsertSteelCostData({ ...mapSteelSeedRow(row), addedBy: uploadedBy, sourceType, sourceFileName: fileName }, null);
      steelCount += 1;
    }
  } else if (datasetType === 'insulation') {
    for (const row of rows) {
      await upsertInsulationCostData({ ...mapInsulationSeedRow(row), addedBy: uploadedBy, sourceType, sourceFileName: fileName }, null);
      insulationCount += 1;
    }
  }
  await insertStoredSeedDocument(fileName, sourceType, { rowCount: rows.length, datasetType });
  return {
    storedDocuments: 1,
    steelRows: steelCount,
    insulationRows: insulationCount,
    skippedFiles: datasetType === 'average' || datasetType === 'unknown' ? [fileName] : [],
  };
}

export async function importStructuredDataFile(file: File): Promise<ImportedCostDataSummary> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'json') {
    const text = await file.text();
    return importSeedJsonObject(JSON.parse(text), file.name);
  }

  if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    return importTabularRows(rowsFromWorkbook(file, workbook), file.name, extension === 'csv' ? 'seed_csv' : 'seed_xlsx');
  }

  if (extension === 'zip') {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const summary: ImportedCostDataSummary = { storedDocuments: 0, steelRows: 0, insulationRows: 0, skippedFiles: [] };
    const files = Object.values(zip.files).filter((entry) => !entry.dir);
    for (const entry of files) {
      const entryName = entry.name.split('/').pop() || entry.name;
      const ext = entryName.split('.').pop()?.toLowerCase();
      if (!ext) {
        summary.skippedFiles.push(entryName);
        continue;
      }
      const blob = await entry.async('blob');
      const nestedFile = new File([blob], entryName, { type: blob.type });
      if (ext === 'pdf') {
        const parsed = await parseUploadedCostFile(nestedFile);
        if (parsed.type !== 'unknown') {
          await persistParsedCostDocument({
            fileName: nestedFile.name,
            fileSize: nestedFile.size,
            fileType: nestedFile.type || 'application/pdf',
            sourceType: 'seed_zip',
            reviewStatus: parsed.reviewStatus || 'pending',
          }, parsed);
          summary.storedDocuments += 1;
          summary.steelRows += parsed.type === 'mbs' ? 1 : 0;
          summary.insulationRows += parsed.type === 'insulation' ? 1 : 0;
        } else {
          await upsertStoredDocument({
            fileName: nestedFile.name,
            fileSize: nestedFile.size,
            fileType: nestedFile.type || 'application/pdf',
            sourceType: 'seed_zip',
            reviewStatus: 'needs_review',
            parseError: parsed.parseError,
          }, parsed);
          summary.storedDocuments += 1;
          summary.skippedFiles.push(entryName);
        }
      } else if (ext === 'json' || ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
        const nestedSummary = await importStructuredDataFile(nestedFile);
        summary.storedDocuments += nestedSummary.storedDocuments;
        summary.steelRows += nestedSummary.steelRows;
        summary.insulationRows += nestedSummary.insulationRows;
        summary.skippedFiles.push(...nestedSummary.skippedFiles);
      } else {
        summary.skippedFiles.push(entryName);
      }
    }
    return summary;
  }

  throw new Error(`Unsupported structured import file: ${file.name}`);
}

export async function parseUploadedCostFile(file: File): Promise<ParsedCostDocument> {
  const pages = await extractTextFromPdf(file);
  return parseCostDocumentFromPages(file.name, pages);
}

export async function listStoredDocuments(): Promise<StoredDocument[]> {
  const { data, error } = await (supabase.from as any)('stored_documents')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => storedDocumentFromRow(row));
}

export async function listSteelCostData(): Promise<SteelCostDataRecord[]> {
  const { data, error } = await (supabase.from as any)('steel_cost_data')
    .select('*')
    .order('date_added', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => steelCostDataFromRow(row));
}

export async function listInsulationCostData(): Promise<InsulationCostDataRecord[]> {
  const { data, error } = await (supabase.from as any)('insulation_cost_data')
    .select('*')
    .order('date_added', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => insulationCostDataFromRow(row));
}
