import { describe, expect, it } from 'vitest';

import { isQuoteAssignedToSalesRepUser, resolvePersonnelUserId } from '@/lib/personnelAssignments';
import { getRFQWorkflowDisplayLabel } from '@/lib/workflowStatus';

describe('RFQ visibility helpers', () => {
  it('resolves assigned sales reps from personnel records before falling back to display names', () => {
    const personnel = [
      { id: 'sales-1', name: 'Robert Brown', roles: ['sales_rep'] },
      { id: 'sales-2', name: 'Other Rep', roles: ['sales_rep'] },
    ];

    expect(resolvePersonnelUserId(personnel, 'sales_rep', 'Robert Brown')).toBe('sales-1');
    expect(isQuoteAssignedToSalesRepUser(personnel, { salesRep: 'Robert Brown' }, 'sales-1', 'Wrong Name')).toBe(true);
    expect(isQuoteAssignedToSalesRepUser(personnel, { salesRep: 'Robert Brown' }, 'sales-2', 'Robert Brown')).toBe(false);
  });

  it('maps workflow statuses to RFQ-facing business labels', () => {
    expect(getRFQWorkflowDisplayLabel('estimate_needed')).toBe('RFQ Submitted');
    expect(getRFQWorkflowDisplayLabel('estimating')).toBe('RFQ Submitted');
    expect(getRFQWorkflowDisplayLabel('estimate_complete')).toBe('RFQ Returned');
    expect(getRFQWorkflowDisplayLabel('internal_quote_ready')).toBe('Internal Quote Ready');
  });
});
