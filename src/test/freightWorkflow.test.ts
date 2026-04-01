import { describe, expect, it } from 'vitest';

import { buildFreightBuildingSize, buildFreightExecutionRows, buildPreSaleFreightRows } from '@/lib/freightWorkflow';
import { buildDealMilestoneRecord } from '@/lib/opportunities';
import type { Deal, FreightRecord, InternalCost, PaymentEntry, Quote } from '@/types';

function buildDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    jobId: 'JOB-300',
    jobName: 'North Warehouse',
    clientName: 'North Client',
    clientId: 'CL-300',
    salesRep: 'Rep',
    estimator: 'Estimator',
    teamLead: '',
    province: 'ON',
    city: 'Barrie',
    address: '',
    postalCode: '',
    width: 60,
    length: 100,
    height: 18,
    sqft: 6000,
    weight: 20000,
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

function buildFreight(overrides: Partial<FreightRecord> = {}): FreightRecord {
  return {
    jobId: 'JOB-300',
    clientName: 'North Client',
    buildingSize: '60x100x18',
    province: 'ON',
    weight: 20000,
    pickupAddress: '',
    deliveryAddress: 'Barrie, ON',
    estDistance: 200,
    estFreight: 4500,
    actualFreight: 4700,
    paid: false,
    carrier: 'Carrier One',
    status: 'Booked',
    ...overrides,
  };
}

function buildQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-300',
    date: '2026-03-31',
    jobId: 'JOB-300',
    jobName: 'North Warehouse',
    clientName: 'North Client',
    clientId: 'CL-300',
    salesRep: 'Rep',
    estimator: 'Estimator',
    province: 'ON',
    city: 'Barrie',
    address: '',
    postalCode: '',
    width: 60,
    length: 100,
    height: 18,
    sqft: 6000,
    weight: 20000,
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
    grandTotal: 1,
    status: 'Sent',
    documentType: 'external_quote',
    workflowStatus: 'quote_sent',
    payload: {},
    ...overrides,
  };
}

describe('freight workflow helpers', () => {
  it('builds an execution row with freight-ready status and variance', () => {
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
    ].map(key => buildDealMilestoneRecord({
      jobId: 'JOB-300',
      milestoneKey: key as any,
      isComplete: true,
    }));

    const rows = buildFreightExecutionRows({
      deals: [buildDeal()],
      freight: [buildFreight()],
      dealMilestones: milestones,
      internalCosts: [{ jobId: 'JOB-300', trueMaterial: 0, trueStructuralDrawing: 0, trueFoundationDrawing: 0, trueFreight: 4500, trueInsulation: 0, repMaterial: 0, repStructuralDrawing: 0, repFoundationDrawing: 0, repFreight: 0, repInsulation: 0, salePrice: 0, showRepCosts: false } satisfies InternalCost],
      payments: [{ id: 'payment-1', date: '2026-03-31', jobId: 'JOB-300', clientVendorName: 'Carrier One', direction: 'Vendor Payment OUT', type: 'Freight', amountExclTax: 4700, province: 'ON', taxRate: 0, taxAmount: 0, totalInclTax: 4700, taxOverride: false, paymentMethod: '', referenceNumber: '', qbSynced: false, notes: '' } satisfies PaymentEntry],
    });

    expect(rows[0]?.freightReady).toBe(true);
    expect(rows[0]?.variance).toBe(200);
    expect(rows[0]?.paid).toBe(true);
  });

  it('builds pre-sale rows from manual freight records', () => {
    const rows = buildPreSaleFreightRows({
      freight: [buildFreight({ mode: 'pre_sale', estFreight: 3900, actualFreight: 0, status: 'Pending' })],
      quotes: [buildQuote()],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mode).toBe('pre_sale');
    expect(rows[0]?.estFreight).toBe(3900);
  });

  it('formats building size consistently', () => {
    expect(buildFreightBuildingSize({ width: 60, length: 100, height: 18 })).toBe('60x100x18');
  });
});
