import { buildJobDocumentVaultSummary } from '@/lib/documentVault';
import type {
  Deal,
  DealMilestone,
  Opportunity,
  Quote,
  QuoteFileRecord,
} from '@/types';

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

export interface DealerSafeDocumentSummary {
  primaryVisibleSetCount: number;
  hiddenDuplicateCount: number;
  pdfCount: number;
  supportFileCount: number;
  latestPdfQuote: Quote | null;
  latestSupportFile: QuoteFileRecord | null;
  supportFiles: QuoteFileRecord[];
}

export interface DealerWorkspaceRow {
  request: Quote;
  relatedQuotes: Quote[];
  deal: Deal | null;
  opportunity: Opportunity | null;
  milestones: DealMilestone[];
  stage: DealerProjectStage;
  documents: DealerProjectDocument[];
  latestSalesQuote: Quote | null;
  latestActivityAt: string | null;
  nextDealerAction: string;
  documentSummary: DealerSafeDocumentSummary;
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

function getQuoteActivityTimestamp(quote: Quote) {
  return quote.updatedAt || quote.createdAt || quote.date || null;
}

function getLatestIsoTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map(value => new Date(value).getTime())
    .filter(value => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function buildDealerSafeDocumentSummary(request: Quote, relatedQuotes: Quote[], files: QuoteFileRecord[]): DealerSafeDocumentSummary {
  const summary = buildJobDocumentVaultSummary({
    jobId: request.jobId,
    quotes: [request, ...relatedQuotes],
    files,
  });

  return {
    primaryVisibleSetCount: summary.visibleFiles.length,
    hiddenDuplicateCount: summary.hiddenDuplicateCount,
    pdfCount: summary.pdfQuotes.length,
    supportFileCount: summary.supportFiles.length,
    latestPdfQuote: summary.latestPdfQuote,
    latestSupportFile: summary.supportFiles[0] || null,
    supportFiles: summary.supportFiles,
  };
}

function deriveDealerNextAction(input: {
  stage: DealerProjectStage;
  latestSalesQuote: Quote | null;
  deal: Deal | null;
}) {
  const { stage, latestSalesQuote, deal } = input;

  switch (stage) {
    case 'request_submitted':
      return 'Request submitted. Internal review is pending.';
    case 'estimating':
      return 'Estimating is in progress. Watch for quote updates.';
    case 'quote_ready':
      return latestSalesQuote?.pdfStoragePath
        ? 'Review the latest sales quote PDF.'
        : 'Review the latest sales quote details.';
    case 'won':
      return 'Order won. Internal intake and production setup are starting.';
    case 'in_production':
      return deal?.productionStatus === 'Delivered'
        ? 'Project delivered.'
        : 'Production is active. Watch for freight scheduling updates.';
    case 'freight_booked':
      return 'Freight is booked or in transit. Monitor delivery timing.';
    case 'delivered':
      return 'Project delivered.';
    case 'lost':
      return 'Project closed.';
    default:
      return 'Review the latest project update.';
  }
}

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

export function buildDealerWorkspaceRows(input: {
  quotes: Quote[];
  deals: Deal[];
  opportunities: Opportunity[];
  dealMilestones: DealMilestone[];
  filesByJobId?: Record<string, QuoteFileRecord[]>;
  dealerUserId?: string | null;
  isAdminView?: boolean;
}) {
  const {
    quotes,
    deals,
    opportunities,
    dealMilestones,
    filesByJobId = {},
    dealerUserId,
    isAdminView = false,
  } = input;

  return quotes
    .filter(quote => quote.documentType === 'dealer_rfq' && !quote.isDeleted)
    .filter(quote => isAdminView || quote.createdByUserId === dealerUserId)
    .map<DealerWorkspaceRow>(request => {
      const relatedQuotes = quotes
        .filter(quote => quote.jobId === request.jobId && quote.id !== request.id && !quote.isDeleted)
        .sort((left, right) => new Date(getQuoteActivityTimestamp(right) || 0).getTime() - new Date(getQuoteActivityTimestamp(left) || 0).getTime());
      const deal = deals.find(item => item.jobId === request.jobId) || null;
      const opportunity = opportunities.find(item => item.jobId === request.jobId) || null;
      const milestones = dealMilestones.filter(item => item.jobId === request.jobId);
      const stage = deriveDealerProjectStage({ request, relatedQuotes, deal, opportunity, milestones });
      const documents = buildDealerProjectDocuments(request, relatedQuotes);
      const latestSalesQuote = relatedQuotes.find(quote => quote.documentType === 'external_quote') || null;
      const documentSummary = buildDealerSafeDocumentSummary(request, relatedQuotes, filesByJobId[request.jobId] || []);
      const latestActivityAt = getLatestIsoTimestamp([
        request.updatedAt,
        request.createdAt,
        request.date,
        ...relatedQuotes.flatMap(quote => [quote.updatedAt, quote.createdAt, quote.date]),
        opportunity?.updatedAt,
        opportunity?.createdAt,
        deal?.dateSigned,
        deal?.pickupDate,
        deal?.deliveryDate,
        ...milestones.flatMap(milestone => [milestone.completedAt, milestone.updatedAt, milestone.createdAt]),
        ...(filesByJobId[request.jobId] || []).flatMap(file => [file.reviewedAt, file.createdAt]),
      ]);

      return {
        request,
        relatedQuotes,
        deal,
        opportunity,
        milestones,
        stage,
        documents,
        latestSalesQuote,
        latestActivityAt,
        nextDealerAction: deriveDealerNextAction({ stage, latestSalesQuote, deal }),
        documentSummary,
      };
    })
    .sort((left, right) => {
      const leftTime = new Date(left.latestActivityAt || left.request.date || 0).getTime();
      const rightTime = new Date(right.latestActivityAt || right.request.date || 0).getTime();
      return rightTime - leftTime;
    });
}
