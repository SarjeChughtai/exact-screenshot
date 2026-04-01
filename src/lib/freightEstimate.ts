const POSTAL_PREFIX_MAP: Record<string, { province: string; distanceKm: number; remote: string }> = {
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

const ORIGIN_COORDS = { lat: 44.0469, lng: -79.4599 };

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
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

interface GoogleLookupResult {
  distanceKm: number;
  province: string;
}

function normalizeProvinceCode(value: string | null | undefined) {
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

function inferMethod(input: FreightLookupInput): FreightEstimate['method'] {
  if (input.postalCode?.trim()) return 'postal_code';
  if (input.city?.trim()) return 'city';
  return 'manual';
}

function inferRemoteLevel(distanceKm: number) {
  if (distanceKm >= 4200) return 'extreme';
  if (distanceKm >= 2500) return 'remote';
  if (distanceKm >= 1200) return 'moderate';
  return 'none';
}

function roundDistance(distanceKm: number) {
  return Math.round(distanceKm);
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
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_KEY);
}

export function buildFreightLookupLabel(input: FreightLookupInput) {
  return [input.postalCode?.trim(), input.city?.trim(), input.province?.trim(), input.address?.trim()]
    .filter(Boolean)
    .join(', ');
}

function estimateFreightFromLocationHeuristic(input: FreightLookupInput): FreightEstimate | null {
  const postalCode = input.postalCode?.trim().toUpperCase() || '';
  const province = normalizeProvinceCode(input.province);

  if (postalCode) {
    const prefix = postalCode[0];
    const fallback = POSTAL_PREFIX_MAP[prefix];
    if (fallback) {
      return {
        distanceKm: fallback.distanceKm,
        province: province || fallback.province,
        remote: fallback.remote,
        method: 'postal_code',
        distanceSource: 'heuristic',
      };
    }
  }

  return null;
}

async function getGoogleDistance(input: FreightLookupInput): Promise<GoogleLookupResult | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
  if (!apiKey) return null;

  const query = buildFreightLookupLabel(input);
  if (!query) return null;

  const geocodeUrl =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=ca&key=${encodeURIComponent(apiKey)}`;

  const geoRes = await fetch(geocodeUrl);
  const geoJson = await geoRes.json();
  const result = geoJson?.results?.[0];
  const location = result?.geometry?.location;
  if (!location?.lat || !location?.lng) return null;

  const provinceComponent = Array.isArray(result?.address_components)
    ? result.address_components.find((component: { types?: string[] }) => Array.isArray(component.types) && component.types.includes('administrative_area_level_1'))
    : null;

  const detectedProvince = normalizeProvinceCode(provinceComponent?.short_name || provinceComponent?.long_name || '');
  const origins = `${ORIGIN_COORDS.lat},${ORIGIN_COORDS.lng}`;
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

export async function estimateFreightFromLocation(input: string | FreightLookupInput): Promise<FreightEstimate | null> {
  const normalizedInput = buildLookupQuery(input);
  const method = inferMethod(normalizedInput);

  try {
    const googleResult = await getGoogleDistance(normalizedInput);
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
