import type { WorkflowStatus } from '@/types';

const RFQ_WORKFLOW_LABELS: Partial<Record<WorkflowStatus, string>> = {
  draft: 'Draft',
  estimate_needed: 'RFQ Submitted',
  estimating: 'RFQ Submitted',
  estimate_complete: 'RFQ Returned',
  internal_quote_in_progress: 'Internal Quote In Progress',
  internal_quote_ready: 'Internal Quote Ready',
  external_quote_ready: 'External Quote Ready',
  quote_sent: 'Quote Sent',
  converted_to_deal: 'Converted To Deal',
  cancelled: 'Cancelled',
  lost: 'Lost',
  won: 'Won',
  submitted: 'Submitted',
};

export function getRFQWorkflowDisplayLabel(status: WorkflowStatus) {
  return RFQ_WORKFLOW_LABELS[status] || status.replace(/_/g, ' ');
}
