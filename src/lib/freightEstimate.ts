// Postal code first letter to approximate province and distance from Bradford, ON
const POSTAL_PREFIX_MAP: Record<string, { province: string; distanceKm: number; remote: string }> = {
  // Ontario
  'K': { province: 'ON', distanceKm: 300, remote: 'none' },
  'L': { province: 'ON', distanceKm: 100, remote: 'none' },
  'M': { province: 'ON', distanceKm: 80, remote: 'none' },
  'N': { province: 'ON', distanceKm: 200, remote: 'none' },
  'P': { province: 'ON', distanceKm: 500, remote: 'moderate' },
  // Quebec
  'G': { province: 'QC', distanceKm: 700, remote: 'none' },
  'H': { province: 'QC', distanceKm: 550, remote: 'none' },
  'J': { province: 'QC', distanceKm: 600, remote: 'none' },
  // Atlantic
  'E': { province: 'NB', distanceKm: 1200, remote: 'none' },
  'B': { province: 'NS', distanceKm: 1500, remote: 'none' },
  'C': { province: 'PE', distanceKm: 1600, remote: 'moderate' },
  'A': { province: 'NL', distanceKm: 2500, remote: 'remote' },
  // West
  'R': { province: 'MB', distanceKm: 2200, remote: 'none' },
  'S': { province: 'SK', distanceKm: 2800, remote: 'none' },
  'T': { province: 'AB', distanceKm: 3400, remote: 'none' },
  'V': { province: 'BC', distanceKm: 4400, remote: 'none' },
  // North
  'X': { province: 'NT', distanceKm: 4500, remote: 'extreme' },
  'Y': { province: 'YT', distanceKm: 5500, remote: 'extreme' },
};

// Known city/town distance overrides (from Bradford, ON)
const CITY_DISTANCES: Record<string, { distanceKm: number; remote: string; province: string }> = {
  'toronto': { distanceKm: 85, remote: 'none', province: 'ON' },
  'ottawa': { distanceKm: 450, remote: 'none', province: 'ON' },
  'montreal': { distanceKm: 540, remote: 'none', province: 'QC' },
  'quebec city': { distanceKm: 800, remote: 'none', province: 'QC' },
  'halifax': { distanceKm: 1500, remote: 'none', province: 'NS' },
  'winnipeg': { distanceKm: 2200, remote: 'none', province: 'MB' },
  'saskatoon': { distanceKm: 2900, remote: 'none', province: 'SK' },
  'regina': { distanceKm: 2700, remote: 'none', province: 'SK' },
  'calgary': { distanceKm: 3400, remote: 'none', province: 'AB' },
  'edmonton': { distanceKm: 3500, remote: 'none', province: 'AB' },
  'vancouver': { distanceKm: 4400, remote: 'none', province: 'BC' },
  'victoria': { distanceKm: 4500, remote: 'none', province: 'BC' },
  'kamloops': { distanceKm: 4100, remote: 'none', province: 'BC' },
  'kelowna': { distanceKm: 4000, remote: 'none', province: 'BC' },
  'sudbury': { distanceKm: 390, remote: 'none', province: 'ON' },
  'thunder bay': { distanceKm: 1400, remote: 'moderate', province: 'ON' },
  'sault ste. marie': { distanceKm: 700, remote: 'moderate', province: 'ON' },
  'sault ste marie': { distanceKm: 700, remote: 'moderate', province: 'ON' },
  'timmins': { distanceKm: 650, remote: 'moderate', province: 'ON' },
  'north bay': { distanceKm: 330, remote: 'none', province: 'ON' },
  'barrie': { distanceKm: 30, remote: 'none', province: 'ON' },
  'bradford': { distanceKm: 5, remote: 'none', province: 'ON' },
  'beresford': { distanceKm: 1350, remote: 'none', province: 'NB' },
  'moncton': { distanceKm: 1300, remote: 'none', province: 'NB' },
  'fredericton': { distanceKm: 1200, remote: 'none', province: 'NB' },
  'saint john': { distanceKm: 1250, remote: 'none', province: 'NB' },
  'cherryville': { distanceKm: 4050, remote: 'moderate', province: 'BC' },
  'wabasca': { distanceKm: 4000, remote: 'extreme', province: 'AB' },
  'estaire': { distanceKm: 400, remote: 'none', province: 'ON' },
  'baie st-paul': { distanceKm: 850, remote: 'none', province: 'QC' },
  'saint-damien-de-buckland': { distanceKm: 750, remote: 'none', province: 'QC' },
};

export interface FreightEstimate {
  distanceKm: number;
  province: string;
  remote: string;
  method: 'postal_code' | 'city' | 'manual';
  distanceSource: 'heuristic' | 'maps';
}

function estimateFreightFromLocationHeuristic(input: string): FreightEstimate | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try postal code (Canadian format: A1A 1A1)
  const postalMatch = trimmed.match(/([A-Za-z])\d[A-Za-z]\s?\d[A-Za-z]\d/);
  if (postalMatch) {
    const prefix = postalMatch[1].toUpperCase();
    const data = POSTAL_PREFIX_MAP[prefix];
    if (data) {
      return {
        distanceKm: data.distanceKm,
        province: data.province,
        remote: data.remote,
        method: 'postal_code',
        distanceSource: 'heuristic',
      };
    }
  }

  // Try city name lookup
  const lower = trimmed.toLowerCase();
  for (const [city, data] of Object.entries(CITY_DISTANCES)) {
    if (lower.includes(city)) {
      return {
        distanceKm: data.distanceKm,
        province: data.province,
        remote: data.remote,
        method: 'city',
        distanceSource: 'heuristic',
      };
    }
  }

  // Try just the first letter as postal code prefix
  const firstLetter = trimmed[0]?.toUpperCase();
  if (firstLetter && POSTAL_PREFIX_MAP[firstLetter]) {
    const data = POSTAL_PREFIX_MAP[firstLetter];
    return {
      distanceKm: data.distanceKm,
      province: data.province,
      remote: data.remote,
      method: 'postal_code',
      distanceSource: 'heuristic',
    };
  }

  return null;
}

const ORIGIN_COORDS = { lat: 44.0469, lng: -79.4599 }; // Bradford, ON (approx)

async function getDrivingDistanceKmFromGoogle(input: string): Promise<number | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
  if (!apiKey) return null;

  // 1) Geocode the destination.
  const geocodeUrl =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input)}&region=ca&key=${encodeURIComponent(apiKey)}`;

  const geoRes = await fetch(geocodeUrl);
  const geoJson = await geoRes.json();
  const location = geoJson?.results?.[0]?.geometry?.location;
  if (!location?.lat || !location?.lng) return null;

  const destLat = location.lat;
  const destLng = location.lng;

  // 2) Distance matrix between Bradford and destination.
  const origins = `${ORIGIN_COORDS.lat},${ORIGIN_COORDS.lng}`;
  const destinations = `${destLat},${destLng}`;

  const distUrl =
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}` +
    `&mode=driving&units=metric&key=${encodeURIComponent(apiKey)}`;

  const distRes = await fetch(distUrl);
  const distJson = await distRes.json();

  const meters = distJson?.rows?.[0]?.elements?.[0]?.distance?.value;
  if (!meters || typeof meters !== 'number') return null;

  const km = meters / 1000;
  if (!Number.isFinite(km) || km <= 0) return null;
  return km;
}

export async function estimateFreightFromLocation(input: string): Promise<FreightEstimate | null> {
  const heuristic = estimateFreightFromLocationHeuristic(input);
  if (!heuristic) return null;

  // Prefer a Maps-based distance when configured; fall back to heuristic otherwise.
  try {
    const mapsDistanceKm = await getDrivingDistanceKmFromGoogle(input);
    if (mapsDistanceKm) {
      return {
        ...heuristic,
        distanceKm: mapsDistanceKm,
        distanceSource: 'maps',
      };
    }
  } catch {
    // Intentionally ignore errors and use heuristic.
  }

  return heuristic;
}
