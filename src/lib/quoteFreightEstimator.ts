/**
 * Route-and-history freight estimator for quote workflows.
 *
 * Replaces the old calcFreight(distance, weight, remoteLevel) approach in
 * Quick Estimator, Quote Builder, and Internal Quote Builder.
 * The old calcFreight function remains available in calculations.ts for
 * freight board / execution use.
 */

import {
  geocodeAndComputeDistance,
  estimateDistanceFromPostalCode,
  normalizeProvinceCode,
  inferRemoteLevel,
} from '@/lib/geoDistance';
import type { GeoOrigin, GeoLookupInput } from '@/lib/geoDistance';
import { calcFreight } from '@/lib/calculations';
import type { FreightRecord } from '@/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QuoteFreightInput {
  jobId: string;
  weight: number;
  province?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  moffettIncluded?: boolean;
  factoryOrigin: GeoOrigin & { label: string };
}

export interface QuoteFreightResult {
  distanceKm: number;
  estimatedFreight: number;
  confidence: 'high' | 'moderate' | 'low';
  comparableCount: number;
  basisNote: string;
  resolvedProvince: string;
  status: 'resolved' | 'manual_required';
}

// ---------------------------------------------------------------------------
// Scoring / matching internals
// ---------------------------------------------------------------------------

const WEIGHT_DISTANCE = 0.4;
const WEIGHT_WEIGHT = 0.3;
const WEIGHT_PROVINCE = 0.2;
const WEIGHT_MOFFETT = 0.1;

const COMPARABLE_THRESHOLD = 0.6;
const MIN_COMPARABLE_COUNT = 3;

interface ScoredRecord {
  record: FreightRecord;
  score: number;
}

function scoreRecord(
  record: FreightRecord,
  targetDistance: number,
  targetWeight: number,
  targetProvince: string,
  targetMoffett: boolean,
  maxDistance: number,
  maxWeight: number,
): number {
  const distScore = maxDistance > 0
    ? 1 - Math.abs(record.estDistance - targetDistance) / maxDistance
    : 1;

  const wtScore = maxWeight > 0
    ? 1 - Math.abs(record.weight - targetWeight) / maxWeight
    : 1;

  const provScore = normalizeProvinceCode(record.province) === targetProvince ? 1 : 0;
  const moffScore = (record.moffettIncluded ?? false) === targetMoffett ? 1 : 0.5;

  return (
    WEIGHT_DISTANCE * Math.max(0, distScore) +
    WEIGHT_WEIGHT * Math.max(0, wtScore) +
    WEIGHT_PROVINCE * provScore +
    WEIGHT_MOFFETT * moffScore
  );
}

function weightedMedian(values: number[], weights: number[]): number {
  const pairs = values.map((v, i) => ({ value: v, weight: weights[i] }));
  pairs.sort((a, b) => a.value - b.value);

  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  let cumulative = 0;
  for (const pair of pairs) {
    cumulative += pair.weight;
    if (cumulative >= totalWeight / 2) return pair.value;
  }
  return pairs[pairs.length - 1].value;
}

// ---------------------------------------------------------------------------
// Sparse-history linear fallback
// ---------------------------------------------------------------------------

function linearFallbackEstimate(
  records: FreightRecord[],
  targetDistance: number,
  targetWeight: number,
): number {
  // Simple weighted average of $/km from historical records, applied to target distance.
  // Weight contribution is proportional — heavier loads cost more.
  const usable = records.filter(r => r.estDistance > 0 && r.weight > 0);
  if (usable.length === 0) return 0;

  let sumRate = 0;
  let sumWeightFactor = 0;
  for (const r of usable) {
    const rate = r.actualFreight / r.estDistance;
    const wf = r.actualFreight / r.weight;
    sumRate += rate;
    sumWeightFactor += wf;
  }
  const avgRate = sumRate / usable.length;
  const avgWeightFactor = sumWeightFactor / usable.length;

  // Blend distance-based and weight-based estimates
  const distEstimate = avgRate * targetDistance;
  const weightEstimate = avgWeightFactor * targetWeight;
  return (distEstimate + weightEstimate) / 2;
}

// ---------------------------------------------------------------------------
// Main estimator
// ---------------------------------------------------------------------------

export async function estimateQuoteFreight(
  input: QuoteFreightInput,
  freightHistory: FreightRecord[],
): Promise<QuoteFreightResult> {
  const targetProvince = normalizeProvinceCode(input.province);
  const targetMoffett = input.moffettIncluded ?? false;

  // Stage 1: Route — compute driving distance
  let distanceKm = 0;
  let resolvedProvince = targetProvince;
  let routeResolved = false;

  const geoInput: GeoLookupInput = {
    postalCode: input.postalCode,
    city: input.city,
    province: input.province,
    address: input.address,
  };

  try {
    const geoResult = await geocodeAndComputeDistance(geoInput, input.factoryOrigin);
    if (geoResult) {
      distanceKm = geoResult.distanceKm;
      resolvedProvince = targetProvince || geoResult.province;
      routeResolved = true;
    }
  } catch {
    // Maps API failure — fall through to postal heuristic
  }

  if (!routeResolved) {
    const postalResult = estimateDistanceFromPostalCode(input.postalCode, input.province);
    if (postalResult) {
      distanceKm = postalResult.distanceKm;
      resolvedProvince = targetProvince || postalResult.province;
      routeResolved = true;
    }
  }

  if (!routeResolved) {
    return {
      distanceKm: 0,
      estimatedFreight: 0,
      confidence: 'low',
      comparableCount: 0,
      basisNote: 'Could not determine route — enter freight manually',
      resolvedProvince: resolvedProvince || '',
      status: 'manual_required',
    };
  }

  // Stage 2: Historical freight records with usable actual freight
  const usableHistory = freightHistory.filter(r => r.actualFreight > 0 && r.mode !== 'pre_sale');

  if (usableHistory.length === 0) {
    // Stage 4: No-history fallback — use existing formula
    const remoteLevel = inferRemoteLevel(distanceKm);
    const formulaFreight = calcFreight(distanceKm, input.weight, remoteLevel);
    return {
      distanceKm,
      estimatedFreight: Math.round(formulaFreight),
      confidence: 'low',
      comparableCount: 0,
      basisNote: 'Formula estimate — no freight history available',
      resolvedProvince,
      status: 'resolved',
    };
  }

  // Compute scoring bounds
  const maxDistance = Math.max(...usableHistory.map(r => r.estDistance), distanceKm);
  const maxWeight = Math.max(...usableHistory.map(r => r.weight), input.weight);

  // Score each historical record
  const scored: ScoredRecord[] = usableHistory.map(record => ({
    record,
    score: scoreRecord(record, distanceKm, input.weight, resolvedProvince, targetMoffett, maxDistance, maxWeight),
  }));

  // Stage 3a: Try exact moffett matches first
  let comparables = scored
    .filter(s => s.score >= COMPARABLE_THRESHOLD && (s.record.moffettIncluded ?? false) === targetMoffett)
    .sort((a, b) => b.score - a.score);

  // Fall back to mixed moffett matches if exact subset is too small
  if (comparables.length < MIN_COMPARABLE_COUNT) {
    comparables = scored
      .filter(s => s.score >= COMPARABLE_THRESHOLD)
      .sort((a, b) => b.score - a.score);
  }

  if (comparables.length >= MIN_COMPARABLE_COUNT) {
    const values = comparables.map(c => c.record.actualFreight);
    const weights = comparables.map(c => c.score);
    const estimate = weightedMedian(values, weights);

    return {
      distanceKm,
      estimatedFreight: Math.round(estimate),
      confidence: 'high',
      comparableCount: comparables.length,
      basisNote: `Based on ${comparables.length} comparable deliveries`,
      resolvedProvince,
      status: 'resolved',
    };
  }

  // Stage 3b: Sparse-history fallback — global linear model
  const linearEstimate = linearFallbackEstimate(usableHistory, distanceKm, input.weight);
  if (linearEstimate > 0) {
    return {
      distanceKm,
      estimatedFreight: Math.round(linearEstimate),
      confidence: 'moderate',
      comparableCount: usableHistory.length,
      basisNote: `Estimated from ${usableHistory.length} historical deliveries (global model)`,
      resolvedProvince,
      status: 'resolved',
    };
  }

  // Final fallback — formula
  const remoteLevel = inferRemoteLevel(distanceKm);
  const formulaFreight = calcFreight(distanceKm, input.weight, remoteLevel);
  return {
    distanceKm,
    estimatedFreight: Math.round(formulaFreight),
    confidence: 'low',
    comparableCount: 0,
    basisNote: 'Formula estimate — insufficient freight history',
    resolvedProvince,
    status: 'resolved',
  };
}
