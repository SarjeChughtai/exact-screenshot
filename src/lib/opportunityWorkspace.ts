import { getDealFreightBlockedReason, getDealPostSaleNextStep, isDealFreightReady } from '@/lib/opportunities';
import type { Deal, DealMilestone, Opportunity, OpportunityStatus, Quote } from '@/types';

export interface OpportunityWorkspaceRow {
  opportunity: Opportunity;
  latestQuote: Quote | null;
  relatedQuotes: Quote[];
  deal: Deal | null;
  milestones: DealMilestone[];
  nextStep: string;
  freightReady: boolean;
  blockedReason: string | null;
}

export function buildOpportunityWorkspaceRows(input: {
  opportunities: Opportunity[];
  quotes: Quote[];
  deals: Deal[];
  dealMilestones: DealMilestone[];
  visibleJobIds?: Set<string>;
}) {
  const { opportunities, quotes, deals, dealMilestones, visibleJobIds } = input;

  return opportunities
    .filter(opportunity => !visibleJobIds || visibleJobIds.has(opportunity.jobId))
    .map<OpportunityWorkspaceRow>(opportunity => {
      const relatedQuotes = quotes
        .filter(quote => quote.jobId === opportunity.jobId && !quote.isDeleted)
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
      const deal = deals.find(item => item.jobId === opportunity.jobId) || null;
      const milestones = dealMilestones.filter(item => item.jobId === opportunity.jobId);

      const freightReady = isDealFreightReady(milestones);

      return {
        opportunity,
        latestQuote: relatedQuotes[0] || null,
        relatedQuotes,
        deal,
        milestones,
        freightReady,
        blockedReason: deal ? getDealFreightBlockedReason(milestones) : null,
        nextStep: deriveOpportunityNextStep({
          opportunityStatus: opportunity.status,
          latestQuote: relatedQuotes[0] || null,
          deal,
          milestones,
          freightReady,
        }),
      };
    })
    .sort((left, right) => new Date(right.opportunity.updatedAt).getTime() - new Date(left.opportunity.updatedAt).getTime());
}

export function summarizeOpportunities(opportunities: Opportunity[]) {
  return opportunities.reduce<Record<OpportunityStatus, number>>((accumulator, opportunity) => {
    accumulator[opportunity.status] += 1;
    return accumulator;
  }, {
    open: 0,
    won: 0,
    lost: 0,
    abandoned: 0,
  });
}

function deriveOpportunityNextStep(input: {
  opportunityStatus: OpportunityStatus;
  latestQuote: Quote | null;
  deal: Deal | null;
  milestones: DealMilestone[];
  freightReady: boolean;
}) {
  const { opportunityStatus, latestQuote, deal, milestones, freightReady } = input;

  if (opportunityStatus === 'lost') return 'Closed as lost';
  if (opportunityStatus === 'abandoned') return 'Closed as abandoned';

  if (deal) {
    if (deal.freightStatus === 'Booked' || deal.freightStatus === 'In Transit') {
      return getDealPostSaleNextStep(deal, milestones);
    }
    if (deal.productionStatus === 'Delivered' || deal.dealStatus === 'Delivered' || deal.dealStatus === 'Complete') {
      return 'Delivered';
    }
    if (freightReady) {
      return 'Post execution freight';
    }
    return getDealPostSaleNextStep(deal, milestones);
  }

  if (!latestQuote) return 'Review RFQ and assign next owner';

  if (latestQuote.documentType === 'dealer_rfq' || latestQuote.documentType === 'rfq') {
    return 'Advance RFQ through estimating';
  }

  if (latestQuote.documentType === 'internal_quote') {
    return 'Convert internal quote to external quote';
  }

  if (latestQuote.documentType === 'external_quote') {
    if (latestQuote.workflowStatus === 'quote_sent' || latestQuote.status === 'Sent') {
      return 'Follow up on sales quote';
    }
    return 'Finalize sales quote';
  }

  return 'Review opportunity';
}
