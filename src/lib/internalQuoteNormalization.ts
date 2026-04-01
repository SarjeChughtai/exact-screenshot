import type { Quote, StructureType } from '@/types';

export const STRUCTURE_TYPE_OPTIONS: Array<{ value: StructureType; label: string }> = [
  { value: 'steel_building', label: 'Steel Building' },
  { value: 'container_cover', label: 'Container Cover' },
  { value: 'canopy', label: 'Canopy' },
  { value: 'other', label: 'Other' },
];

export interface InternalQuoteBreakdown {
  guttersDownspoutsTotal: number;
  roofLinerPanelsTotal: number;
  wallLinerPanelsTotal: number;
}

function safeNumber(value: unknown) {
  if (value == null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeComponentName(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getComponentCost(component: Record<string, unknown>) {
  return safeNumber(component.cost ?? component.total_cost ?? component.total ?? component.amount);
}

export function normalizeStructureType(value: unknown): StructureType {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'container_cover' || normalized === 'containercover') return 'container_cover';
  if (normalized === 'canopy') return 'canopy';
  if (normalized === 'other') return 'other';
  return 'steel_building';
}

export function summarizeInternalQuoteComponents(
  components: Array<Record<string, unknown>> | null | undefined,
): InternalQuoteBreakdown {
  return (components || []).reduce<InternalQuoteBreakdown>((totals, component) => {
    const name = normalizeComponentName(component.name ?? component.label ?? component.component);
    const cost = getComponentCost(component);

    if (!name || cost <= 0) return totals;

    if (/(gutter|downspout|down spout)/.test(name)) {
      totals.guttersDownspoutsTotal += cost;
      return totals;
    }

    if (/liner/.test(name) && /roof/.test(name)) {
      totals.roofLinerPanelsTotal += cost;
      return totals;
    }

    if (/liner/.test(name) && /wall/.test(name)) {
      totals.wallLinerPanelsTotal += cost;
      return totals;
    }

    return totals;
  }, {
    guttersDownspoutsTotal: 0,
    roofLinerPanelsTotal: 0,
    wallLinerPanelsTotal: 0,
  });
}

export function buildInternalQuoteBreakdownFromQuote(
  quote: Pick<Quote, 'gutters' | 'liners' | 'payload'>,
): InternalQuoteBreakdown {
  const payload = (quote.payload || {}) as Record<string, unknown>;
  const roofLinerPanelsTotal = safeNumber(payload.roofLinerPanelsTotal);
  const wallLinerPanelsTotal = payload.wallLinerPanelsTotal != null
    ? safeNumber(payload.wallLinerPanelsTotal)
    : roofLinerPanelsTotal > 0
      ? Math.max(quote.liners - roofLinerPanelsTotal, 0)
      : safeNumber(quote.liners);

  return {
    guttersDownspoutsTotal: payload.guttersDownspoutsTotal != null
      ? safeNumber(payload.guttersDownspoutsTotal)
      : safeNumber(quote.gutters),
    roofLinerPanelsTotal,
    wallLinerPanelsTotal,
  };
}

export function getCombinedLinerTotal(breakdown: InternalQuoteBreakdown) {
  return breakdown.roofLinerPanelsTotal + breakdown.wallLinerPanelsTotal;
}
