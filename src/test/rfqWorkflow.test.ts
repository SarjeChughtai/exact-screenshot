import { describe, expect, it } from 'vitest';

import { isEstimatorAssignedToQuote } from '@/lib/rfqWorkflow';

describe('rfq workflow visibility helpers', () => {
  it('allows an estimator when the assigned user id matches', () => {
    expect(
      isEstimatorAssignedToQuote(
        { assignedEstimatorUserId: 'user-1', estimator: '' },
        'user-1',
        'Estimator One',
      )
    ).toBe(true);
  });

  it('allows an estimator when the estimator name matches', () => {
    expect(
      isEstimatorAssignedToQuote(
        { assignedEstimatorUserId: null, estimator: 'Estimator One' },
        'user-2',
        ' estimator one ',
      )
    ).toBe(true);
  });

  it('denies an estimator when neither assignment path matches', () => {
    expect(
      isEstimatorAssignedToQuote(
        { assignedEstimatorUserId: 'user-9', estimator: 'Different Person' },
        'user-2',
        'Estimator One',
      )
    ).toBe(false);
  });
});
