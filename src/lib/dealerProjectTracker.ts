import type { Deal, DealMilestone, Opportunity, Quote } from '@/types';

export type DealerProjectStage =
  | 'request_submitted'
  | 'estimating'
  | 'quote_ready'
  | 'won'
  | 'lost'
  | 'in_production'
  | 'freight_booked'
  | 'delivered';

export interface DealerProjectDocument {
  id: string;
  jobId: string;
  label: string;
  documentType: Quote['documentType'];
  date: string;
  pdfStoragePath: string;
  pdfFileName: string;
}

export const DEALER_PROJECT_STAGE_META: Record<DealerProjectStage, { label: string; description: string }> = {
  request_submitted: {
    label: 'Request Submitted',
    description: 'The dealer RFQ has been received and is waiting for internal follow-up.',
  },
  estimating: {
    label: 'Estimating',
    description: 'Estimating or RFQ work is active for this project.',
  },
  quote_ready: {
    label: 'Quote Ready',
    description: 'A sales quote has been prepared and is ready for dealer review.',
  },
  won: {
    label: 'Won',
    description: 'The project has been won and converted into an active deal.',
  },
  lost: {
    label: 'Lost',
    description: 'The opportunity was marked lost or closed without moving forward.',
  },
  in_production: {
    label: 'In Production',
    description: 'The project is active post-sale and moving through production steps.',
  },
  freight_booked: {
    label: 'Freight Booked',
    description: 'Freight execution is booked or in transit.',
  },
  delivered: {
    label: 'Delivered',
    description: 'The project has been delivered or completed.',
  },
};

const DOCUMENT_TYPE_LABELS: Record<Quote['documentType'], string> = {
  dealer_rfq: 'Dealer RFQ',
  rfq: 'RFQ',
  internal_quote: 'Internal Quote',
  external_quote: 'Sales Quote',
};

const DOCUMENT_TYPE_PRIORITY: Record<Quote['documentType'], number> = {
  external_quote: 4,
  rfq: 3,
  dealer_rfq: 2,
  internal_quote: 1,
};

export function deriveDealerProjectStage(input: {
  request: Quote;
  relatedQuotes: Quote[];
  deal?: Deal | null;
  opportunity?: Opportunity | null;
  milestones?: DealMilestone[];
}): DealerProjectStage {
  const { request, relatedQuotes, deal, opportunity } = input;

  const hasLossSignal = Boolean(
    opportunity?.status === 'lost'
    || request.workflowStatus === 'lost'
    || relatedQuotes.some(quote => quote.workflowStatus === 'lost' || quote.status === 'Lost' || quote.status === 'Expired'),
  );
  if (hasLossSignal) return 'lost';

  if (deal || opportunity?.status === 'won') {
    const effectiveDeal = deal;

    if (
      effectiveDeal?.freightStatus === 'Delivered'
      || effectiveDeal?.dealStatus === 'Delivered'
      || effectiveDeal?.dealStatus === 'Complete'
      || effectiveDeal?.productionStatus === 'Delivered'
    ) {
      return 'delivered';
    }

    if (
      effectiveDeal?.freightStatus === 'Booked'
      || effectiveDeal?.freightStatus === 'In Transit'
      || effectiveDeal?.dealStatus === 'Shipped'
    ) {
      return 'freight_booked';
    }

    if (
      effectiveDeal?.dealStatus
      && !['Lead', 'Quoted'].includes(effectiveDeal.dealStatus)
    ) {
      return 'in_production';
    }

    return 'won';
  }

  const hasReadySalesQuote = relatedQuotes.some(quote =>
    quote.documentType === 'external_quote'
    && ['external_quote_ready', 'quote_sent'].includes(quote.workflowStatus),
  );
  if (hasReadySalesQuote) return 'quote_ready';

  const hasActiveInternalWork = relatedQuotes.some(quote =>
    quote.documentType !== 'dealer_rfq'
    && ['estimate_needed', 'estimating', 'estimate_complete', 'internal_quote_in_progress', 'internal_quote_ready', 'external_quote_ready', 'quote_sent'].includes(quote.workflowStatus),
  );
  if (hasActiveInternalWork) return 'estimating';

  return 'request_submitted';
}

export function buildDealerProjectDocuments(request: Quote, relatedQuotes: Quote[]): DealerProjectDocument[] {
  const allDocuments = [request, ...relatedQuotes]
    .filter(quote => Boolean(quote.pdfStoragePath))
    .map(quote => ({
      id: quote.id,
      jobId: quote.jobId,
      label: `${DOCUMENT_TYPE_LABELS[quote.documentType]}${quote.documentType === 'external_quote' ? ` (${quote.status})` : ''}`,
      documentType: quote.documentType,
      date: quote.date,
      pdfStoragePath: quote.pdfStoragePath as string,
      pdfFileName: quote.pdfFileName || `${quote.jobId}-${quote.documentType}.pdf`,
    }));

  return allDocuments.sort((left, right) => {
    const priorityDelta = DOCUMENT_TYPE_PRIORITY[right.documentType] - DOCUMENT_TYPE_PRIORITY[left.documentType];
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.date).getTime() - new Date(left.date).getTime();
  });
}
