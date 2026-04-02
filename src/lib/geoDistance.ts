/**
 * Shared geo-distance utilities for freight estimation.
 * Used by both the legacy freightEstimate module and the new quoteFreightEstimator.
 */

export const POSTAL_PREFIX_MAP: Record<string, { province: string; distanceKm: number; remote: string }> = {
  A: { province: 'NL', distanceKm: 2500, remote: 'remote' },
  B: { province: 'NS', distanceKm: 1500, remote: 'moderate' },
  C: { province: 'PE', distanceKm: 1600, remote: 'moderate' },
  E: { province: 'NB', distanceKm: 1200, remote: 'moderate' },
  G: { province: 'QC', distanceKm: 700, remote: 'none' },
  H: { province: 'QC', distanceKm: 550, remote: 'none' },
  J: { province: 'QC', distanceKm: 600, remote: 'none' },
  K: { province: 'ON', distanceKm: 300, remote: 'none' },
  L: { province: 'ON', distanceKm: 100, remote: 'none' },
  M: { province: 'ON', distanceKm: 80, remote: 'none' },
  N: { province: 'ON', distanceKm: 200, remote: 'none' },
  P: { province: 'ON', distanceKm: 500, remote: 'moderate' },
  R: { province: 'MB', distanceKm: 2200, remote: 'moderate' },
  S: { province: 'SK', distanceKm: 2800, remote: 'remote' },
  T: { province: 'AB', distanceKm: 3400, remote: 'remote' },
  V: { province: 'BC', distanceKm: 4400, remote: 'extreme' },
  X: { province: 'NT', distanceKm: 4500, remote: 'extreme' },
  Y: { province: 'YT', distanceKm: 5500, remote: 'extreme' },
};

export const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  alberta: 'AB',
  british_columbia: 'BC',
  manitoba: 'MB',
  new_brunswick: 'NB',
  newfoundland_and_labrador: 'NL',
  nova_scotia: 'NS',
  northwest_territories: 'NT',
  nunavut: 'NU',
  ontario: 'ON',
  prince_edward_island: 'PE',
  quebec: 'QC',
  saskatchewan: 'SK',
  yukon: 'YT',
};

export interface GeoOrigin {
  lat: number;
  lng: number;
}

export interface GeoDistanceResult {
  distanceKm: number;
  province: string;
}

export interface GeoLookupInput {
  postalCode?: string;
  city?: string;
  province?: string;
  address?: string;
}

export function normalizeProvinceCode(value: string | null | undefined): string {
  const normalized = (value || '').trim().toUpperCase();
  if (normalized.length === 2) return normalized;

  const lookupKey = (value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return PROVINCE_NAME_TO_CODE[lookupKey] || normalized;
}

export function inferRemoteLevel(distanceKm: number): string {
  if (distanceKm >= 4200) return 'extreme';
  if (distanceKm >= 2500) return 'remote';
  if (distanceKm >= 1200) return 'moderate';
  return 'none';
}

function roundDistance(distanceKm: number): number {
  return Math.round(distanceKm);
}

function buildLookupLabel(input: GeoLookupInput): string {
  return [input.postalCode?.trim(), input.city?.trim(), input.province?.trim(), input.address?.trim()]
    .filter(Boolean)
    .join(', ');
}

/**
 * Estimate distance from postal code prefix using the heuristic table.
 * Returns null if the postal code is missing or has no known prefix.
 */
export function estimateDistanceFromPostalCode(
  postalCode: string | undefined,
  province?: string,
): GeoDistanceResult | null {
  const code = (postalCode || '').trim().toUpperCase();
  if (!code) return null;

  const prefix = code[0];
  const entry = POSTAL_PREFIX_MAP[prefix];
  if (!entry) return null;

  return {
    distanceKm: entry.distanceKm,
    province: normalizeProvinceCode(province) || entry.province,
  };
}

/**
 * Geocode a destination and compute driving distance from a given origin
 * using the Google Maps Geocoding + Distance Matrix APIs.
 * Returns null if the Maps API key is not configured or the lookup fails.
 */
export async function geocodeAndComputeDistance(
  input: GeoLookupInput,
  origin: GeoOrigin,
): Promise<GeoDistanceResult | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
  if (!apiKey) return null;

  const query = buildLookupLabel(input);
  if (!query) return null;

  const geocodeUrl =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=ca&key=${encodeURIComponent(apiKey)}`;

  const geoRes = await fetch(geocodeUrl);
  const geoJson = await geoRes.json();
  const result = geoJson?.results?.[0];
  const location = result?.geometry?.location;
  if (!location?.lat || !location?.lng) return null;

  const provinceComponent = Array.isArray(result?.address_components)
    ? result.address_components.find((component: { types?: string[] }) =>
        Array.isArray(component.types) && component.types.includes('administrative_area_level_1'))
    : null;

  const detectedProvince = normalizeProvinceCode(
    provinceComponent?.short_name || provinceComponent?.long_name || '',
  );

  const origins = `${origin.lat},${origin.lng}`;
  const destinations = `${location.lat},${location.lng}`;
  const distanceUrl =
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}` +
    `&mode=driving&units=metric&key=${encodeURIComponent(apiKey)}`;

  const distanceRes = await fetch(distanceUrl);
  const distanceJson = await distanceRes.json();
  const meters = distanceJson?.rows?.[0]?.elements?.[0]?.distance?.value;
  if (!meters || typeof meters !== 'number') return null;

  const distanceKm = meters / 1000;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;

  return {
    distanceKm: roundDistance(distanceKm),
    province: detectedProvince,
  };
}

export function hasGoogleMapsKeyConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_KEY);
}
