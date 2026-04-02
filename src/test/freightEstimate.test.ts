import { describe, expect, it } from 'vitest';

import { buildFreightLookupLabel, estimateFreightFromLocation, hasGoogleMapsKeyConfigured } from '@/lib/freightEstimate';

describe('freight estimate helpers', () => {
  it('builds a structured lookup label from postal code, city, and province', () => {
    expect(buildFreightLookupLabel({
      postalCode: 'L4N 0A1',
      city: 'Barrie',
      province: 'ON',
    })).toBe('L4N 0A1, Barrie, ON');
  });

  it('does not guess distance or province without a maps key when heuristic fallback is disabled', async () => {
    expect(hasGoogleMapsKeyConfigured()).toBe(false);

    await expect(estimateFreightFromLocation({
      postalCode: 'V5K 0A1',
      city: 'Vancouver',
      province: 'BC',
      allowHeuristicFallback: false,
    })).resolves.toBeNull();
  });

  it('uses the explicit heuristic fallback only when requested', async () => {
    await expect(estimateFreightFromLocation({
      postalCode: 'V5K 0A1',
      city: 'Vancouver',
      province: 'BC',
      allowHeuristicFallback: true,
    })).resolves.toMatchObject({
      distanceKm: 4400,
      province: 'BC',
      remote: 'extreme',
      distanceSource: 'heuristic',
    });
  });
});
