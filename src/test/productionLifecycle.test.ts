import { describe, expect, it } from 'vitest';

import {
  buildProductionShadowRecord,
  deriveDealProductionStatusFromRecord,
  getProductionProgressPct,
  normalizeProductionStage,
} from '@/lib/productionLifecycle';

describe('production lifecycle helpers', () => {
  it('normalizes custom configured production labels to canonical stages', () => {
    expect(normalizeProductionStage('Drawings to be Signed')).toBe('Submitted');
    expect(normalizeProductionStage('MBS File Requested')).toBe('Acknowledged');
    expect(normalizeProductionStage('Ready for Pickup')).toBe('Ship Ready');
  });

  it('builds a shadow production record from the deal stage', () => {
    const shadow = buildProductionShadowRecord({
      jobId: 'JOB-400',
      productionStatus: 'Drawings Stamped',
      insulationStatus: 'Ordered',
    });

    expect(shadow.submitted).toBe(true);
    expect(shadow.acknowledged).toBe(true);
    expect(shadow.inProduction).toBe(true);
    expect(shadow.qcComplete).toBe(true);
    expect(shadow.shipReady).toBe(false);
    expect(shadow.insulationStatus).toBe('Ordered');
  });

  it('derives the current deal stage from a production shadow record', () => {
    expect(deriveDealProductionStatusFromRecord({
      jobId: 'JOB-400',
      submitted: true,
      acknowledged: true,
      inProduction: true,
      qcComplete: false,
      shipReady: false,
      shipped: false,
      delivered: false,
      drawingsStatus: '',
      insulationStatus: '',
    })).toBe('In Production');
  });

  it('computes progress from configured stage labels', () => {
    expect(getProductionProgressPct('Sent to Engineering', [
      'Drawings to be Signed',
      'MBS File Requested',
      'Sent to Engineering',
      'Drawings Stamped',
    ])).toBe(75);
  });
});
