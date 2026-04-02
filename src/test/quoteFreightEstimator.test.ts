import { describe, expect, it } from 'vitest';

import { estimateQuoteFreight } from '@/lib/quoteFreightEstimator';
import type { QuoteFreightInput } from '@/lib/quoteFreightEstimator';
import type { FreightRecord } from '@/types';

const FACTORY_ORIGIN = { lat: 44.0469, lng: -79.4599, label: 'Bradford, ON' };

function makeInput(overrides: Partial<QuoteFreightInput> = {}): QuoteFreightInput {
  return {
    jobId: 'J26-1001',
    weight: 25000,
    province: 'ON',
    postalCode: 'L4N 0A1',
    factoryOrigin: FACTORY_ORIGIN,
    ...overrides,
  };
}

function makeFreightRecord(overrides: Partial<FreightRecord> = {}): FreightRecord {
  return {
    jobId: 'J26-0001',
    clientName: 'Test Client',
    buildingSize: '50x60',
    province: 'ON',
    weight: 25000,
    pickupAddress: 'Bradford, ON',
    deliveryAddress: 'Toronto, ON',
    estDistance: 100,
    estFreight: 4000,
    actualFreight: 4500,
    paid: true,
    carrier: 'Test Carrier',
    moffettIncluded: false,
    status: 'Delivered',
    mode: 'execution',
    ...overrides,
  };
}

describe('estimateQuoteFreight', () => {
  describe('no-history fallback', () => {
    it('uses the formula when no freight history exists', async () => {
      const result = await estimateQuoteFreight(makeInput(), []);

      expect(result.status).toBe('resolved');
      expect(result.confidence).toBe('low');
      expect(result.comparableCount).toBe(0);
      expect(result.basisNote).toContain('no freight history');
      // Postal heuristic for L prefix = 100 km -> max(4000, 100*4) = 4000
      expect(result.estimatedFreight).toBe(4000);
      expect(result.distanceKm).toBe(100);
      expect(result.resolvedProvince).toBe('ON');
    });

    it('uses formula for remote destinations when no history exists', async () => {
      const result = await estimateQuoteFreight(makeInput({ postalCode: 'V5K 0A1', province: 'BC' }), []);

      expect(result.status).toBe('resolved');
      expect(result.confidence).toBe('low');
      // Postal heuristic for V prefix = 4400 km -> max(4000, 4400*4) + extreme(3000) = 20600
      expect(result.estimatedFreight).toBe(20600);
      expect(result.distanceKm).toBe(4400);
    });
  });

  describe('comparable-match pricing', () => {
    it('returns high confidence when enough similar deliveries exist', async () => {
      // Create 5 comparable deliveries near the target (ON, ~100 km, ~25000 lbs)
      const history: FreightRecord[] = [
        makeFreightRecord({ estDistance: 90, weight: 24000, actualFreight: 4200 }),
        makeFreightRecord({ estDistance: 110, weight: 26000, actualFreight: 4800 }),
        makeFreightRecord({ estDistance: 95, weight: 25500, actualFreight: 4400 }),
        makeFreightRecord({ estDistance: 105, weight: 24500, actualFreight: 4600 }),
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 4500 }),
      ];

      const result = await estimateQuoteFreight(makeInput(), history);

      expect(result.status).toBe('resolved');
      expect(result.confidence).toBe('high');
      expect(result.comparableCount).toBeGreaterThanOrEqual(3);
      expect(result.basisNote).toContain('comparable deliveries');
      // Should be near the median of 4200-4800
      expect(result.estimatedFreight).toBeGreaterThanOrEqual(4000);
      expect(result.estimatedFreight).toBeLessThanOrEqual(5000);
    });

    it('prefers exact moffett matches', async () => {
      const historyNoMoffett: FreightRecord[] = [
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 4000, moffettIncluded: false }),
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 4100, moffettIncluded: false }),
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 4200, moffettIncluded: false }),
      ];
      const historyWithMoffett: FreightRecord[] = [
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 5500, moffettIncluded: true }),
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 5600, moffettIncluded: true }),
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 5700, moffettIncluded: true }),
      ];

      const resultWithMoffett = await estimateQuoteFreight(
        makeInput({ moffettIncluded: true }),
        [...historyNoMoffett, ...historyWithMoffett],
      );

      expect(resultWithMoffett.confidence).toBe('high');
      // Should use the moffett=true records (5500-5700 range) rather than the lower ones
      expect(resultWithMoffett.estimatedFreight).toBeGreaterThanOrEqual(5400);
    });
  });

  describe('sparse-history fallback', () => {
    it('uses global model when fewer than 3 comparables exist', async () => {
      // Only 1 comparable — different province, far distance
      const history: FreightRecord[] = [
        makeFreightRecord({ estDistance: 3000, weight: 30000, actualFreight: 15000, province: 'AB' }),
      ];

      const result = await estimateQuoteFreight(makeInput(), history);

      expect(result.status).toBe('resolved');
      expect(result.confidence).toBe('moderate');
      expect(result.basisNote).toContain('global model');
      expect(result.estimatedFreight).toBeGreaterThan(0);
    });
  });

  describe('manual_required status', () => {
    it('returns manual_required when no route info is available', async () => {
      // No postal code, no city, no address — cannot determine route
      const result = await estimateQuoteFreight(
        makeInput({ postalCode: undefined, city: undefined, address: undefined, province: undefined }),
        [],
      );

      expect(result.status).toBe('manual_required');
      expect(result.distanceKm).toBe(0);
      expect(result.estimatedFreight).toBe(0);
      expect(result.basisNote).toContain('manually');
    });

    it('returns manual_required for unknown postal prefix', async () => {
      const result = await estimateQuoteFreight(
        makeInput({ postalCode: 'Z9Z 9Z9', city: undefined, address: undefined }),
        [],
      );

      expect(result.status).toBe('manual_required');
    });
  });

  describe('pre-sale records are excluded', () => {
    it('ignores pre_sale mode records in history', async () => {
      const history: FreightRecord[] = [
        makeFreightRecord({ mode: 'pre_sale', estDistance: 100, weight: 25000, actualFreight: 9999 }),
      ];

      const result = await estimateQuoteFreight(makeInput(), history);

      // Should fall to formula since pre_sale record is excluded
      expect(result.confidence).toBe('low');
      expect(result.comparableCount).toBe(0);
    });
  });

  describe('records with zero actualFreight are excluded', () => {
    it('ignores records where actualFreight is 0', async () => {
      const history: FreightRecord[] = [
        makeFreightRecord({ estDistance: 100, weight: 25000, actualFreight: 0 }),
      ];

      const result = await estimateQuoteFreight(makeInput(), history);

      expect(result.confidence).toBe('low');
      expect(result.comparableCount).toBe(0);
    });
  });

  describe('overweight handling', () => {
    it('formula fallback includes overweight surcharge for heavy loads', async () => {
      const result = await estimateQuoteFreight(
        makeInput({ weight: 45000 }),
        [],
      );

      // 100 km -> max(4000, 400) + 0 remote + 1500 overweight = 5500
      expect(result.estimatedFreight).toBe(5500);
    });
  });
});
