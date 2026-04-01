import type {
  Deal,
  DealMilestone,
  DealMilestoneKey,
  Opportunity,
  OpportunityStatus,
  Quote,
} from '@/types';

export const DEAL_MILESTONE_DEFINITIONS: Array<{
  key: DealMilestoneKey;
  label: string;
  requiredForFreightReady?: boolean;
}> = [
  { key: 'order_form_sent', label: 'Order form sent' },
  { key: 'signed_order_form_received', label: 'Signed order form received', requiredForFreightReady: true },
  { key: 'first_client_invoice_issued', label: '30% invoice issued' },
  { key: 'first_client_payment_received', label: '30% payment received', requiredForFreightReady: true },
  { key: 'design_file_requested_from_estimator', label: 'Design file requested from estimator' },
  { key: 'design_file_sent_to_factory', label: 'Design file sent to factory', requiredForFreightReady: true },
  { key: 'vendor_rfq_sent', label: 'Vendor RFQ sent (optional)' },
  { key: 'factory_quote_received', label: 'Factory quote / PO received', requiredForFreightReady: true },
  { key: 'factory_quote_added_to_true_cost', label: 'Factory quote added to true cost', requiredForFreightReady: true },
  { key: 'first_factory_invoice_issued', label: 'First factory invoice issued (15%)' },
  { key: 'first_factory_invoice_paid', label: 'First factory invoice paid', requiredForFreightReady: true },
  { key: 'design_file_sent_for_stamp', label: 'Design file sent for stamp/foundation drawings', requiredForFreightReady: true },
  { key: 'second_client_invoice_issued', label: 'Second client invoice issued (70% total)' },
  { key: 'second_client_payment_received', label: 'Second client invoice paid', requiredForFreightReady: true },
  { key: 'second_factory_invoice_requested', label: 'Second factory invoice requested', requiredForFreightReady: true },
  { key: 'second_factory_invoice_paid', label: 'Second factory invoice paid (65% total cost)', requiredForFreightReady: true },
  { key: 'freight_ready_achieved', label: 'Freight-ready confirmed' },
];

const FREIGHT_READY_KEYS = DEAL_MILESTONE_DEFINITIONS
  .filter(item => item.requiredForFreightReady)
  .map(item => item.key);

export function deriveOpportunityStatusFromQuote(quote: Pick<Quote, 'workflowStatus' | 'status'>): OpportunityStatus {
  if (quote.workflowStatus === 'converted_to_deal' || quote.status === 'Won') {
    return 'won';
  }
  if (quote.workflowStatus === 'lost' || quote.status === 'Lost' || quote.status === 'Expired') {
    return 'lost';
  }
  if (quote.workflowStatus === 'cancelled') {
    return 'abandoned';
  }
  return 'open';
}

export function deriveOpportunityStatusFromDeal(deal: Pick<Deal, 'dealStatus'>): OpportunityStatus {
  if (deal.dealStatus === 'Cancelled') return 'abandoned';
  if (deal.dealStatus === 'Lead' || deal.dealStatus === 'Quoted') return 'open';
  return 'won';
}

export function buildOpportunityName(input: {
  jobId: string;
  jobName?: string | null;
  clientName?: string | null;
}) {
  return input.jobName?.trim() || input.clientName?.trim() || input.jobId;
}

export function buildOpportunityFromQuote(
  quote: Quote,
  existing?: Partial<Opportunity> | null,
): Opportunity {
  const now = new Date().toISOString();
  return {
    id: existing?.id || quote.opportunityId || crypto.randomUUID(),
    jobId: quote.jobId,
    clientId: quote.clientId,
    clientName: quote.clientName,
    name: buildOpportunityName({ jobId: quote.jobId, jobName: quote.jobName, clientName: quote.clientName }),
    potentialRevenue: quote.grandTotal || existing?.potentialRevenue || 0,
    status: existing?.status === 'won' ? 'won' : deriveOpportunityStatusFromQuote(quote),
    createdByUserId: existing?.createdByUserId || quote.createdByUserId || null,
    ownerUserId: existing?.ownerUserId || null,
    salesRep: quote.salesRep || existing?.salesRep || '',
    estimator: quote.estimator || existing?.estimator || '',
    source: quote.documentType,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function buildOpportunityFromDeal(
  deal: Deal,
  existing?: Partial<Opportunity> | null,
): Opportunity {
  const now = new Date().toISOString();
  return {
    id: existing?.id || deal.opportunityId || crypto.randomUUID(),
    jobId: deal.jobId,
    clientId: deal.clientId,
    clientName: deal.clientName,
    name: buildOpportunityName({ jobId: deal.jobId, jobName: deal.jobName, clientName: deal.clientName }),
    potentialRevenue: existing?.potentialRevenue || 0,
    status: deriveOpportunityStatusFromDeal(deal),
    createdByUserId: existing?.createdByUserId || null,
    ownerUserId: existing?.ownerUserId || null,
    salesRep: deal.salesRep || existing?.salesRep || '',
    estimator: deal.estimator || existing?.estimator || '',
    source: 'deal',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function buildDealMilestoneRecord(input: {
  jobId: string;
  milestoneKey: DealMilestoneKey;
  isComplete: boolean;
  completedByUserId?: string | null;
  notes?: string | null;
  existing?: Partial<DealMilestone> | null;
}) {
  const now = new Date().toISOString();
  return {
    id: input.existing?.id || crypto.randomUUID(),
    jobId: input.jobId,
    milestoneKey: input.milestoneKey,
    isComplete: input.isComplete,
    completedAt: input.isComplete ? now : null,
    completedByUserId: input.isComplete ? (input.completedByUserId || input.existing?.completedByUserId || null) : null,
    notes: input.notes ?? input.existing?.notes ?? '',
    createdAt: input.existing?.createdAt || now,
    updatedAt: now,
  } satisfies DealMilestone;
}

export function isDealFreightReady(milestones: DealMilestone[]) {
  const milestoneMap = milestones.reduce<Record<string, boolean>>((accumulator, milestone) => {
    accumulator[milestone.milestoneKey] = milestone.isComplete;
    return accumulator;
  }, {});

  return Boolean(
    milestoneMap.freight_ready_achieved ||
    FREIGHT_READY_KEYS.every(key => milestoneMap[key]),
  );
}
