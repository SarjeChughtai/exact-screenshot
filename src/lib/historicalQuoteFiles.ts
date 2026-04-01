import type { InsulationCostDataRecord, QuoteFileRecord, SteelCostDataRecord, StoredDocument } from '@/types';

export interface HistoricalQuoteFileSnapshot {
  documentType: 'mbs' | 'insulation' | 'unknown';
  jobId?: string | null;
  clientName?: string | null;
  clientId?: string | null;
  jobName?: string | null;
  width?: number | null;
  length?: number | null;
  height?: number | null;
  roofPitch?: number | null;
  province?: string | null;
  city?: string | null;
  postalCode?: string | null;
  insulationGrade?: string | null;
  insulationTotal?: number | null;
  weightLbs?: number | null;
  costPerLb?: number | null;
  totalSupplierCost?: number | null;
  components?: Array<{ name: string; weight?: number; cost: number }>;
}

function pickValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return undefined;
}

function pickString(source: Record<string, unknown>, keys: string[]) {
  const value = pickValue(source, keys);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]) {
  const value = pickValue(source, keys);
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseComponents(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map(component => {
    const record = (component || {}) as Record<string, unknown>;
    return {
      name: String(record.name || record.label || record.component || 'Component'),
      weight: record.weight != null ? Number(record.weight) : record.weight_lb != null ? Number(record.weight_lb) : undefined,
      cost: Number(record.cost || record.total_cost || record.amount || 0),
    };
  });
}

function firstNonNull<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function buildStructuredFallbackSnapshot(input: {
  file: QuoteFileRecord;
  storedDocument?: StoredDocument | null;
}) {
  const { file, storedDocument } = input;
  const fallback = (
    file.correctedData ||
    storedDocument?.parsedData ||
    file.aiOutput ||
    {}
  ) as Record<string, unknown>;

  const resolvedDocumentType = (
    pickString(fallback, ['document_type', 'documentType', 'file_type', 'fileType']) ||
    file.fileType
  )?.toLowerCase();

  return {
    documentType: resolvedDocumentType === 'insulation'
      ? 'insulation'
      : resolvedDocumentType === 'mbs'
      ? 'mbs'
      : file.fileType === 'insulation'
      ? 'insulation'
      : file.fileType === 'mbs'
      ? 'mbs'
      : 'unknown',
    jobId: pickString(fallback, ['job_id', 'jobId', 'project_id', 'projectId']) || file.jobId || null,
    clientName: pickString(fallback, ['client_name', 'clientName']) || file.clientName || null,
    clientId: pickString(fallback, ['client_id', 'clientId']) || file.clientId || null,
    jobName: pickString(fallback, ['job_name', 'jobName', 'project_name', 'projectName']),
    width: pickNumber(fallback, ['width', 'width_ft', 'widthFt']),
    length: pickNumber(fallback, ['length', 'length_ft', 'lengthFt']),
    height: pickNumber(fallback, ['height', 'height_ft', 'heightFt', 'eave_height_ft', 'eaveHeightFt']),
    roofPitch: pickNumber(fallback, ['roof_pitch', 'roofPitch', 'roof_slope', 'roofSlope']),
    province: pickString(fallback, ['province']),
    city: pickString(fallback, ['city']),
    postalCode: pickString(fallback, ['postal_code', 'postalCode']),
    insulationGrade: pickString(fallback, ['insulation_grade', 'insulationGrade', 'grade']),
    insulationTotal: pickNumber(fallback, ['insulation_total', 'insulationTotal', 'total_insulation_cost', 'totalCost']),
    weightLbs: pickNumber(fallback, ['weight', 'weight_lb', 'weightLbs', 'steel_weight_lbs', 'steelWeightLbs', 'total_weight_lb', 'totalWeightLb']),
    costPerLb: pickNumber(fallback, ['cost_per_lb', 'costPerLb', 'price_per_lb', 'pricePerLb', 'supplier_cost_per_lb', 'supplierCostPerLb']),
    totalSupplierCost: pickNumber(fallback, ['total_cost', 'totalCost', 'supplier_total_cost', 'supplierTotalCost']),
    components: parseComponents(pickValue(fallback, ['components', 'component_rows', 'componentRows'])),
  } satisfies HistoricalQuoteFileSnapshot;
}

export function buildHistoricalQuoteFileSnapshot(input: {
  file: QuoteFileRecord;
  steelWarehouseEntry?: SteelCostDataRecord | null;
  insulationWarehouseEntry?: InsulationCostDataRecord | null;
  storedDocument?: StoredDocument | null;
}): HistoricalQuoteFileSnapshot {
  const { file, steelWarehouseEntry, insulationWarehouseEntry, storedDocument } = input;
  const fallbackSnapshot = buildStructuredFallbackSnapshot({ file, storedDocument });

  if (steelWarehouseEntry) {
    const warehouseRaw = (steelWarehouseEntry.rawExtraction || {}) as Record<string, unknown>;
    const warehouseComponents = (steelWarehouseEntry.components || []).map(component => ({
      name: String(component.name || 'Component'),
      weight: component.weight ? Number(component.weight) : undefined,
      cost: Number(component.cost || 0),
    }));

    return {
      documentType: 'mbs',
      jobId: firstNonNull(steelWarehouseEntry.jobId, steelWarehouseEntry.projectId, fallbackSnapshot.jobId, file.jobId),
      clientName: firstNonNull(fallbackSnapshot.clientName, file.clientName),
      clientId: firstNonNull(fallbackSnapshot.clientId, file.clientId),
      jobName: firstNonNull(
        pickString(warehouseRaw, ['job_name', 'jobName', 'project_name', 'projectName']),
        fallbackSnapshot.jobName,
      ),
      width: firstNonNull(steelWarehouseEntry.widthFt, fallbackSnapshot.width),
      length: firstNonNull(steelWarehouseEntry.lengthFt, fallbackSnapshot.length),
      height: firstNonNull(steelWarehouseEntry.eaveHeightFt, fallbackSnapshot.height),
      roofPitch: firstNonNull(steelWarehouseEntry.roofSlope, fallbackSnapshot.roofPitch),
      province: firstNonNull(steelWarehouseEntry.province, fallbackSnapshot.province),
      city: firstNonNull(steelWarehouseEntry.city, fallbackSnapshot.city),
      postalCode: firstNonNull(
        pickString(warehouseRaw, ['postal_code', 'postalCode']),
        fallbackSnapshot.postalCode,
      ),
      weightLbs: firstNonNull(steelWarehouseEntry.totalWeightLb, fallbackSnapshot.weightLbs),
      costPerLb: firstNonNull(steelWarehouseEntry.pricePerLb, fallbackSnapshot.costPerLb),
      totalSupplierCost: firstNonNull(steelWarehouseEntry.totalCost, fallbackSnapshot.totalSupplierCost),
      components: warehouseComponents.length > 0 ? warehouseComponents : (fallbackSnapshot.components || []),
    };
  }

  if (insulationWarehouseEntry) {
    const warehouseRaw = (insulationWarehouseEntry.rawExtraction || {}) as Record<string, unknown>;

    return {
      documentType: 'insulation',
      jobId: firstNonNull(insulationWarehouseEntry.jobId, insulationWarehouseEntry.projectId, fallbackSnapshot.jobId, file.jobId),
      clientName: firstNonNull(fallbackSnapshot.clientName, file.clientName),
      clientId: firstNonNull(fallbackSnapshot.clientId, file.clientId),
      jobName: firstNonNull(
        pickString(warehouseRaw, ['job_name', 'jobName', 'project_name', 'projectName']),
        fallbackSnapshot.jobName,
      ),
      width: firstNonNull(insulationWarehouseEntry.widthFt, fallbackSnapshot.width),
      length: firstNonNull(insulationWarehouseEntry.lengthFt, fallbackSnapshot.length),
      height: firstNonNull(insulationWarehouseEntry.eaveHeightFt, fallbackSnapshot.height),
      roofPitch: firstNonNull(insulationWarehouseEntry.roofSlope, fallbackSnapshot.roofPitch),
      province: firstNonNull(pickString(warehouseRaw, ['province']), fallbackSnapshot.province),
      city: firstNonNull(pickString(warehouseRaw, ['city']), fallbackSnapshot.city),
      postalCode: firstNonNull(
        pickString(warehouseRaw, ['postal_code', 'postalCode']),
        fallbackSnapshot.postalCode,
      ),
      insulationGrade: firstNonNull(insulationWarehouseEntry.grade, fallbackSnapshot.insulationGrade),
      insulationTotal: firstNonNull(insulationWarehouseEntry.totalCost, fallbackSnapshot.insulationTotal),
    };
  }

  return fallbackSnapshot;
}
