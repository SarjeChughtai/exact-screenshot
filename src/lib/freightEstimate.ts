import {
  normalizeProvinceCode,
  inferRemoteLevel,
  geocodeAndComputeDistance,
  estimateDistanceFromPostalCode,
  hasGoogleMapsKeyConfigured as _hasGoogleMapsKeyConfigured,
} from '@/lib/geoDistance';
import type { GeoLookupInput } from '@/lib/geoDistance';

const ORIGIN_COORDS = { lat: 44.0469, lng: -79.4599 };

export interface FreightEstimate {
  distanceKm: number;
  province: string;
  remote: string;
  method: 'postal_code' | 'city' | 'manual';
  distanceSource: 'heuristic' | 'maps';
}

export interface FreightLookupInput {
  postalCode?: string;
  city?: string;
  province?: string;
  address?: string;
  allowHeuristicFallback?: boolean;
}

function inferMethod(input: FreightLookupInput): FreightEstimate['method'] {
  if (input.postalCode?.trim()) return 'postal_code';
  if (input.city?.trim()) return 'city';
  return 'manual';
}

function buildLookupQuery(input: string | FreightLookupInput): FreightLookupInput {
  if (typeof input === 'string') {
    return {
      address: input,
      allowHeuristicFallback: false,
    };
  }

  return input;
}

export function hasGoogleMapsKeyConfigured() {
  return _hasGoogleMapsKeyConfigured();
}

export function buildFreightLookupLabel(input: FreightLookupInput) {
  return [input.postalCode?.trim(), input.city?.trim(), input.province?.trim(), input.address?.trim()]
    .filter(Boolean)
    .join(', ');
}

function estimateFreightFromLocationHeuristic(input: FreightLookupInput): FreightEstimate | null {
  const province = normalizeProvinceCode(input.province);
  const heuristic = estimateDistanceFromPostalCode(input.postalCode, input.province);

  if (heuristic) {
    return {
      distanceKm: heuristic.distanceKm,
      province: province || heuristic.province,
      remote: inferRemoteLevel(heuristic.distanceKm),
      method: 'postal_code',
      distanceSource: 'heuristic',
    };
  }

  return null;
}

export async function estimateFreightFromLocation(input: string | FreightLookupInput): Promise<FreightEstimate | null> {
  const normalizedInput = buildLookupQuery(input);
  const method = inferMethod(normalizedInput);

  try {
    const geoInput: GeoLookupInput = {
      postalCode: normalizedInput.postalCode,
      city: normalizedInput.city,
      province: normalizedInput.province,
      address: normalizedInput.address,
    };
    const googleResult = await geocodeAndComputeDistance(geoInput, ORIGIN_COORDS);
    if (googleResult) {
      const province = normalizeProvinceCode(normalizedInput.province) || googleResult.province;
      return {
        distanceKm: googleResult.distanceKm,
        province,
        remote: inferRemoteLevel(googleResult.distanceKm),
        method,
        distanceSource: 'maps',
      };
    }
  } catch {
    // Ignore lookup errors and fall through to the explicit fallback path.
  }

  if (normalizedInput.allowHeuristicFallback) {
    return estimateFreightFromLocationHeuristic(normalizedInput);
  }

  return null;
}
