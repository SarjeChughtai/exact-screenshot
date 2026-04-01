import { describe, expect, it } from 'vitest';

import { buildOpportunityWorkspaceRows, summarizeOpportunities } from '@/lib/opportunityWorkspace';
import { buildDealMilestoneRecord } from '@/lib/opportunities';
import type { Deal, Opportunity, Quote } from '@/types';

function buildOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-500',
    jobId: 'JOB-500',
    clientId: 'CL-500',
    clientName: 'Prairie Yard',
    name: 'Prairie Yard Expansion',
    potentialRevenue: 150000,
    status: 'open',
    createdByUserId: null,
    ownerUserId: null,
    salesRep: 'Rep One',
    estimator: 'Estimator One',
    source: 'external_quote',
    createdAt: '2026-03-31T00:00:00.000Z',
    updatedAt: '2026-03-31T00:00:00.000Z',
    ...overrides,
  };
}

function buildQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-500',
    date: '2026-03-31',
    jobId: 'JOB-500',
    jobName: 'Prairie Yard Expansion',
    clientName: 'Prairie Yard',
    clientId: 'CL-500',
    salesRep: 'Rep One',
    estimator: 'Estimator One',
    province: 'AB',
    city: 'Calgary',
    address: '',
    postalCode: '',
    width: 80,
    length: 120,
    height: 20,
    sqft: 9600,
    weight: 25000,
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
    contingencyPct: 0,
    contingency: 0,
    gstHst: 0,
    qst: 0,
    grandTotal: 150000,
    status: 'Sent',
    documentType: 'external_quote',
    workflowStatus: 'quote_sent',
    payload: {},
    ...overrides,
  };
}

function buildDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    jobId: 'JOB-500',
    jobName: 'Prairie Yard Expansion',
    clientName: 'Prairie Yard',
    clientId: 'CL-500',
    salesRep: 'Rep One',
    estimator: 'Estimator One',
    teamLead: '',
    province: 'AB',
    city: 'Calgary',
    address: '',
    postalCode: '',
    width: 80,
    length: 120,
    height: 20,
    sqft: 9600,
    weight: 25000,
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

describe('opportunity workspace helpers', () => {
  it('builds next step from a quote-only opportunity', () => {
    const rows = buildOpportunityWorkspaceRows({
      opportunities: [buildOpportunity()],
      quotes: [buildQuote()],
      deals: [],
      dealMilestones: [],
    });

    expect(rows[0]?.nextStep).toBe('Follow up on sales quote');
  });

  it('marks deal-backed rows as freight ready when milestones are complete', () => {
    const milestones = [
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
    ].map(key => buildDealMilestoneRecord({ jobId: 'JOB-500', milestoneKey: key as any, isComplete: true }));

    const rows = buildOpportunityWorkspaceRows({
      opportunities: [buildOpportunity({ status: 'won', source: 'deal' })],
      quotes: [buildQuote()],
      deals: [buildDeal()],
      dealMilestones: milestones,
    });

    expect(rows[0]?.freightReady).toBe(true);
    expect(rows[0]?.nextStep).toBe('Post execution freight');
  });

  it('summarizes counts by opportunity status', () => {
    const summary = summarizeOpportunities([
      buildOpportunity({ status: 'open' }),
      buildOpportunity({ id: 'opp-2', jobId: 'JOB-501', status: 'won' }),
      buildOpportunity({ id: 'opp-3', jobId: 'JOB-502', status: 'lost' }),
    ]);

    expect(summary).toEqual({
      open: 1,
      won: 1,
      lost: 1,
      abandoned: 0,
    });
  });
});
