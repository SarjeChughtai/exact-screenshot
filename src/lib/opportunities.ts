import type {
  Deal,
  DealMilestone,
  DealMilestoneKey,
  Opportunity,
  OpportunityStatus,
  Quote,
} from '@/types';
import { normalizeProductionStage } from '@/lib/productionLifecycle';

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

export interface DealMilestoneProgressSummary {
  completedCount: number;
  totalCount: number;
  requiredCompletedCount: number;
  requiredTotalCount: number;
}

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

export function getQuoteLifecycleForOpportunityStatus(
  quote: Pick<Quote, 'documentType'>,
  status: OpportunityStatus,
): Pick<Quote, 'status' | 'workflowStatus'> {
  if (status === 'won') {
    return { status: 'Won', workflowStatus: 'converted_to_deal' };
  }

  if (status === 'lost') {
    return { status: 'Lost', workflowStatus: 'lost' };
  }

  if (status === 'abandoned') {
    return { status: 'Expired', workflowStatus: 'cancelled' };
  }

  if (quote.documentType === 'external_quote') {
    return { status: 'Sent', workflowStatus: 'quote_sent' };
  }

  if (quote.documentType === 'internal_quote') {
    return { status: 'Draft', workflowStatus: 'internal_quote_ready' };
  }

  if (quote.documentType === 'dealer_rfq') {
    return { status: 'Sent', workflowStatus: 'submitted' };
  }

  return { status: 'Draft', workflowStatus: 'estimate_needed' };
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

export function summarizeDealMilestoneProgress(milestones: DealMilestone[]): DealMilestoneProgressSummary {
  const completedKeys = new Set(
    milestones
      .filter(milestone => milestone.isComplete)
      .map(milestone => milestone.milestoneKey),
  );

  return {
    completedCount: DEAL_MILESTONE_DEFINITIONS.filter(definition => completedKeys.has(definition.key)).length,
    totalCount: DEAL_MILESTONE_DEFINITIONS.length,
    requiredCompletedCount: DEAL_MILESTONE_DEFINITIONS.filter(
      definition => definition.requiredForFreightReady && completedKeys.has(definition.key),
    ).length,
    requiredTotalCount: FREIGHT_READY_KEYS.length,
  };
}

export function getFirstMissingFreightReadyMilestone(milestones: DealMilestone[]) {
  const completedKeys = new Set(
    milestones
      .filter(milestone => milestone.isComplete)
      .map(milestone => milestone.milestoneKey),
  );

  return DEAL_MILESTONE_DEFINITIONS.find(
    definition => definition.requiredForFreightReady && !completedKeys.has(definition.key),
  ) || null;
}

export function getDealFreightBlockedReason(milestones: DealMilestone[]) {
  if (isDealFreightReady(milestones)) return null;

  const missingMilestone = getFirstMissingFreightReadyMilestone(milestones);
  if (!missingMilestone) return 'Waiting on post-sale milestones';

  return `Waiting on ${missingMilestone.label.toLowerCase()}`;
}

export function getDealPostSaleNextStep(
  deal: Pick<Deal, 'dealStatus' | 'productionStatus' | 'freightStatus'> | null,
  milestones: DealMilestone[],
) {
  if (!deal) return 'Review opportunity';

  if (deal.productionStatus === 'Delivered' || deal.dealStatus === 'Delivered' || deal.dealStatus === 'Complete') {
    return 'Delivered';
  }

  if (deal.freightStatus === 'In Transit') return 'Monitor freight delivery';
  if (deal.freightStatus === 'Booked') return 'Coordinate freight execution';
  if (isDealFreightReady(milestones)) return 'Post execution freight';

  const missingMilestone = getFirstMissingFreightReadyMilestone(milestones);
  if (missingMilestone) return `Complete ${missingMilestone.label.toLowerCase()}`;

  switch (normalizeProductionStage(deal.productionStatus)) {
    case 'Ship Ready':
      return 'Book freight carrier';
    case 'Shipped':
      return 'Track shipment to delivery';
    case 'In Production':
    case 'QC Complete':
      return 'Advance production toward ship-ready';
    case 'Acknowledged':
      return 'Advance production package';
    default:
      return 'Advance post-sale milestones';
  }
}
