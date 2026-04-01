import { describe, expect, it } from 'vitest';

import { buildDealerProjectDocuments, deriveDealerProjectStage } from '@/lib/dealerProjectTracker';
import type { Deal, Opportunity, Quote } from '@/types';

function buildDealerRequest(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'dealer-rfq-1',
    date: '2026-03-31',
    jobId: 'JOB-200',
    jobName: 'Farm Shop',
    clientName: 'Dealer Client',
    clientId: 'DL-001',
    salesRep: '',
    estimator: '',
    province: 'ON',
    city: 'Barrie',
    address: '',
    postalCode: '',
    width: 50,
    length: 80,
    height: 16,
    sqft: 4000,
    weight: 0,
    baseSteelCost: 0,
    steelAfter12: 0,
    markup: 0,
    adjustedSteel: 0,
    engineering: 0,
    foundation: 0,
    foundationType: 'slab',
    gutters: 0,
    liners: 0,
    insulation: 0,
    insulationGrade: '',
    freight: 0,
    combinedTotal: 0,
    perSqft: 0,
    perLb: 0,
    contingencyPct: 0,
    contingency: 0,
    gstHst: 0,
    qst: 0,
    grandTotal: 0,
    status: 'Sent',
    documentType: 'dealer_rfq',
    workflowStatus: 'submitted',
    payload: {},
    ...overrides,
  };
}

function buildExternalQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    ...buildDealerRequest(),
    id: 'quote-1',
    documentType: 'external_quote',
    workflowStatus: 'quote_sent',
    status: 'Sent',
    grandTotal: 100000,
    pdfStoragePath: 'quotes/JOB-200/external-quote.pdf',
    pdfFileName: 'external-quote.pdf',
    ...overrides,
  };
}

function buildDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    jobId: 'JOB-200',
    jobName: 'Farm Shop',
    clientName: 'Dealer Client',
    clientId: 'DL-001',
    salesRep: 'Rep One',
    estimator: 'Estimator One',
    teamLead: '',
    province: 'ON',
    city: 'Barrie',
    address: '',
    postalCode: '',
    width: 50,
    length: 80,
    height: 16,
    sqft: 4000,
    weight: 10000,
    taxRate: 0,
    taxType: '',
    orderType: '',
    dateSigned: '',
    dealStatus: 'In Progress',
    paymentStatus: 'UNPAID',
    productionStatus: 'Submitted',
    freightStatus: 'Pending',
    insulationStatus: '',
    deliveryDate: '',
    pickupDate: '',
    notes: '',
    ...overrides,
  };
}

describe('dealer project tracker', () => {
  it('defaults to request submitted when only a dealer RFQ exists', () => {
    expect(deriveDealerProjectStage({
      request: buildDealerRequest(),
      relatedQuotes: [],
    })).toBe('request_submitted');
  });

  it('shows quote ready when a sales quote exists', () => {
    expect(deriveDealerProjectStage({
      request: buildDealerRequest(),
      relatedQuotes: [buildExternalQuote()],
    })).toBe('quote_ready');
  });

  it('shows in production when a deal is active', () => {
    expect(deriveDealerProjectStage({
      request: buildDealerRequest(),
      relatedQuotes: [buildExternalQuote()],
      deal: buildDeal({ dealStatus: 'In Production' }),
    })).toBe('in_production');
  });

  it('shows lost when the opportunity is lost', () => {
    const opportunity: Opportunity = {
      id: 'opp-1',
      jobId: 'JOB-200',
      clientId: 'DL-001',
      clientName: 'Dealer Client',
      name: 'Farm Shop',
      potentialRevenue: 100000,
      status: 'lost',
      createdByUserId: null,
      ownerUserId: null,
      salesRep: '',
      estimator: '',
      source: 'dealer_rfq',
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:00.000Z',
    };

    expect(deriveDealerProjectStage({
      request: buildDealerRequest(),
      relatedQuotes: [],
      opportunity,
    })).toBe('lost');
  });

  it('orders PDFs with sales quote before dealer RFQ', () => {
    const documents = buildDealerProjectDocuments(
      buildDealerRequest({
        pdfStoragePath: 'quotes/JOB-200/dealer-rfq.pdf',
        pdfFileName: 'dealer-rfq.pdf',
      }),
      [buildExternalQuote()],
    );

    expect(documents[0]?.documentType).toBe('external_quote');
    expect(documents[1]?.documentType).toBe('dealer_rfq');
  });
});
