import type { Deal, ProductionRecord, ProductionStage } from '@/types';

const CANONICAL_PRODUCTION_STAGES: ProductionStage[] = [
  'Submitted',
  'Acknowledged',
  'In Production',
  'QC Complete',
  'Ship Ready',
  'Shipped',
  'Delivered',
];

const STAGE_ALIASES: Record<string, ProductionStage> = {
  submitted: 'Submitted',
  'drawings to be signed': 'Submitted',
  acknowledged: 'Acknowledged',
  'mbs file requested': 'Acknowledged',
  'in production': 'In Production',
  'sent to engineering': 'In Production',
  'sent to production': 'In Production',
  'qc complete': 'QC Complete',
  'drawings stamped': 'QC Complete',
  'ship ready': 'Ship Ready',
  'ready for pickup': 'Ship Ready',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

function normalizeStageKey(stage: string) {
  return stage.trim().toLowerCase();
}

export function normalizeProductionStage(stage?: string | null): ProductionStage {
  const normalized = normalizeStageKey(stage || '');
  return STAGE_ALIASES[normalized] || 'Submitted';
}

export function buildProductionStageOptions(configuredStages: string[] = []) {
  const seen = new Set<ProductionStage>();
  const options: Array<{ value: ProductionStage; label: string }> = [];

  for (const configuredStage of configuredStages) {
    const value = normalizeProductionStage(configuredStage);
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: configuredStage });
  }

  for (const canonicalStage of CANONICAL_PRODUCTION_STAGES) {
    if (seen.has(canonicalStage)) continue;
    seen.add(canonicalStage);
    options.push({ value: canonicalStage, label: canonicalStage });
  }

  return options;
}

export function getProductionStageLabel(stage?: string | null, configuredStages: string[] = []) {
  const normalizedStage = normalizeProductionStage(stage);
  return buildProductionStageOptions(configuredStages).find(option => option.value === normalizedStage)?.label || stage || normalizedStage;
}

export function deriveDealProductionStatusFromRecord(record: ProductionRecord): ProductionStage {
  if (record.delivered) return 'Delivered';
  if (record.shipped) return 'Shipped';
  if (record.shipReady) return 'Ship Ready';
  if (record.qcComplete) return 'QC Complete';
  if (record.inProduction) return 'In Production';
  if (record.acknowledged) return 'Acknowledged';
  return 'Submitted';
}

export function buildProductionShadowRecord(input: Pick<Deal, 'jobId' | 'productionStatus' | 'insulationStatus'>): ProductionRecord {
  const normalizedStage = normalizeProductionStage(input.productionStatus);
  const stageIndex = CANONICAL_PRODUCTION_STAGES.indexOf(normalizedStage);

  return {
    jobId: input.jobId,
    submitted: stageIndex >= 0,
    acknowledged: stageIndex >= 1,
    inProduction: stageIndex >= 2,
    qcComplete: stageIndex >= 3,
    shipReady: stageIndex >= 4,
    shipped: stageIndex >= 5,
    delivered: stageIndex >= 6,
    drawingsStatus: input.productionStatus || normalizedStage,
    insulationStatus: input.insulationStatus || '',
  };
}

export function getProductionProgressPct(stage: string, configuredStages: string[] = []) {
  const configuredIndex = configuredStages.indexOf(stage);
  if (configuredIndex >= 0 && configuredStages.length > 0) {
    return Math.round(((configuredIndex + 1) / configuredStages.length) * 100);
  }

  const normalizedStage = normalizeProductionStage(stage);
  const stageIndex = CANONICAL_PRODUCTION_STAGES.indexOf(normalizedStage);
  if (stageIndex < 0) return 0;
  return Math.round(((stageIndex + 1) / CANONICAL_PRODUCTION_STAGES.length) * 100);
}
