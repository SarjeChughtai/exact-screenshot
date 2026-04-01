import type { InsulationCostDataRecord, QuoteFileRecord, SteelCostDataRecord } from '@/types';

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

export function buildHistoricalQuoteFileSnapshot(input: {
  file: QuoteFileRecord;
  steelWarehouseEntry?: SteelCostDataRecord | null;
  insulationWarehouseEntry?: InsulationCostDataRecord | null;
}): HistoricalQuoteFileSnapshot {
  const { file, steelWarehouseEntry, insulationWarehouseEntry } = input;

  if (steelWarehouseEntry) {
    return {
      documentType: 'mbs',
      jobId: steelWarehouseEntry.jobId || file.jobId,
      clientName: file.clientName,
      clientId: file.clientId,
      width: steelWarehouseEntry.widthFt,
      length: steelWarehouseEntry.lengthFt,
      height: steelWarehouseEntry.eaveHeightFt,
      roofPitch: steelWarehouseEntry.roofSlope,
      province: steelWarehouseEntry.province,
      city: steelWarehouseEntry.city,
      weightLbs: steelWarehouseEntry.totalWeightLb,
      costPerLb: steelWarehouseEntry.pricePerLb,
      totalSupplierCost: steelWarehouseEntry.totalCost,
      components: (steelWarehouseEntry.components || []).map(component => ({
        name: String(component.name || 'Component'),
        weight: component.weight ? Number(component.weight) : undefined,
        cost: Number(component.cost || 0),
      })),
    };
  }

  if (insulationWarehouseEntry) {
    return {
      documentType: 'insulation',
      jobId: insulationWarehouseEntry.jobId || file.jobId,
      clientName: file.clientName,
      clientId: file.clientId,
      width: insulationWarehouseEntry.widthFt,
      length: insulationWarehouseEntry.lengthFt,
      height: insulationWarehouseEntry.eaveHeightFt,
      roofPitch: insulationWarehouseEntry.roofSlope,
      insulationGrade: insulationWarehouseEntry.grade,
      insulationTotal: insulationWarehouseEntry.totalCost,
    };
  }

  const fallback = (file.correctedData || file.aiOutput || {}) as Record<string, unknown>;
  return {
    documentType: file.fileType === 'insulation' ? 'insulation' : file.fileType === 'mbs' ? 'mbs' : 'unknown',
    jobId: String(fallback.job_id || file.jobId || ''),
    clientName: String(fallback.client_name || file.clientName || ''),
    clientId: String(fallback.client_id || file.clientId || ''),
    jobName: typeof fallback.job_name === 'string' ? fallback.job_name : null,
    width: fallback.width ? Number(fallback.width) : null,
    length: fallback.length ? Number(fallback.length) : null,
    height: fallback.height ? Number(fallback.height) : null,
    roofPitch: fallback.roof_pitch ? Number(fallback.roof_pitch) : null,
    province: typeof fallback.province === 'string' ? fallback.province : null,
    city: typeof fallback.city === 'string' ? fallback.city : null,
    postalCode: typeof fallback.postal_code === 'string' ? fallback.postal_code : null,
    insulationGrade: typeof fallback.insulation_grade === 'string' ? fallback.insulation_grade : null,
    insulationTotal: fallback.insulation_total ? Number(fallback.insulation_total) : null,
    weightLbs: fallback.weight ? Number(fallback.weight) : null,
    costPerLb: fallback.cost_per_lb ? Number(fallback.cost_per_lb) : null,
    totalSupplierCost: fallback.total_cost ? Number(fallback.total_cost) : null,
    components: Array.isArray(fallback.components)
      ? fallback.components.map(component => ({
          name: String((component as Record<string, unknown>).name || 'Component'),
          weight: (component as Record<string, unknown>).weight ? Number((component as Record<string, unknown>).weight) : undefined,
          cost: Number((component as Record<string, unknown>).cost || 0),
        }))
      : [],
  };
}
