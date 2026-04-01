import { describe, expect, it } from 'vitest';

import {
  buildDealMilestoneRecord,
  buildOpportunityFromDeal,
  buildOpportunityFromQuote,
  getQuoteLifecycleForOpportunityStatus,
  isDealFreightReady,
} from '@/lib/opportunities';
import type { Deal, Quote } from '@/types';

function buildQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    date: '2026-03-31',
    jobId: 'JOB-100',
    jobName: 'Main Shop',
    clientName: 'North Yard',
    clientId: 'CL-001',
    salesRep: 'Rep One',
    estimator: 'Estimator One',
    province: 'ON',
    city: 'Barrie',
    address: '',
    postalCode: '',
    width: 60,
    length: 100,
    height: 18,
    sqft: 6000,
    weight: 50000,
    baseSteelCost: 1,
    steelAfter12: 1,
    markup: 1,
    adjustedSteel: 1,
    engineering: 1,
    foundation: 1,
    foundationType: 'slab',
    gutters: 0,
    liners: 0,
    insulation: 0,
    insulationGrade: '',
    freight: 0,
    combinedTotal: 1,
    perSqft: 1,
    perLb: 1,
    contingencyPct: 5,
    contingency: 1,
    gstHst: 1,
    qst: 0,
    grandTotal: 125000,
    status: 'Sent',
    documentType: 'external_quote',
    workflowStatus: 'quote_sent',
    payload: {},
    ...overrides,
  };
}

function buildDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    jobId: 'JOB-100',
    jobName: 'Main Shop',
    clientName: 'North Yard',
    clientId: 'CL-001',
    salesRep: 'Rep One',
    estimator: 'Estimator One',
    teamLead: '',
    province: 'ON',
    city: 'Barrie',
    address: '',
    postalCode: '',
    width: 60,
    length: 100,
    height: 18,
    sqft: 6000,
    weight: 50000,
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

describe('opportunity and milestone helpers', () => {
  it('creates an open opportunity from a quote with revenue', () => {
    const opportunity = buildOpportunityFromQuote(buildQuote());

    expect(opportunity.jobId).toBe('JOB-100');
    expect(opportunity.potentialRevenue).toBe(125000);
    expect(opportunity.status).toBe('open');
  });

  it('marks a progressed deal as won', () => {
    const opportunity = buildOpportunityFromDeal(buildDeal({ dealStatus: 'In Production' }));
    expect(opportunity.status).toBe('won');
  });

  it('derives freight-ready only when all required milestones are complete', () => {
    const requiredKeys = [
      'signed_order_form_received',
      'first_client_payment_received',
      'design_file_sent_to_factory',
      'factory_quote_received',
      'factory_quote_added_to_true_cost',
      'first_factory_invoice_paid',
      'design_file_sent_for_stamp',
      'second_client_payment_received',
      'second_factory_invoice_requested',
      'second_factory_invoice_paid',
    ] as const;

    const incomplete = requiredKeys.slice(0, -1).map(key =>
      buildDealMilestoneRecord({ jobId: 'JOB-100', milestoneKey: key, isComplete: true }),
    );
    const complete = requiredKeys.map(key =>
      buildDealMilestoneRecord({ jobId: 'JOB-100', milestoneKey: key, isComplete: true }),
    );

    expect(isDealFreightReady(incomplete)).toBe(false);
    expect(isDealFreightReady(complete)).toBe(true);
  });

  it('maps a lost opportunity back onto quote lifecycle state', () => {
    expect(getQuoteLifecycleForOpportunityStatus(buildQuote(), 'lost')).toEqual({
      status: 'Lost',
      workflowStatus: 'lost',
    });
  });

  it('reopens a dealer RFQ into submitted state when opportunity is reopened', () => {
    expect(getQuoteLifecycleForOpportunityStatus(buildQuote({ documentType: 'dealer_rfq' }), 'open')).toEqual({
      status: 'Sent',
      workflowStatus: 'submitted',
    });
  });
});
