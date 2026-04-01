import { describe, expect, it } from 'vitest';

import { doesQuoteMatchAssigneeFilter, isEstimatorAssignedToQuote } from '@/lib/rfqWorkflow';

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

  it('matches an explicit assignee filter by user id', () => {
    expect(
      doesQuoteMatchAssigneeFilter(
        { assignedEstimatorUserId: 'user-3', estimator: 'Estimator Two' },
        { userId: 'user-3', name: 'Estimator One' },
      ),
    ).toBe(true);
  });

  it('matches the unassigned filter only when no estimator is set', () => {
    expect(
      doesQuoteMatchAssigneeFilter(
        { assignedEstimatorUserId: null, estimator: '' },
        { mode: 'unassigned' },
      ),
    ).toBe(true);

    expect(
      doesQuoteMatchAssigneeFilter(
        { assignedEstimatorUserId: null, estimator: 'Estimator Two' },
        { mode: 'unassigned' },
      ),
    ).toBe(false);
  });
});
