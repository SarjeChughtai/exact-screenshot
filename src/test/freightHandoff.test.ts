import { describe, expect, it } from 'vitest';
import type { FreightRecord, Quote } from '@/types';
import { buildFreightRecordFromInternalQuote, promoteFreightRecordToDealQuote } from '@/lib/freightHandoff';

const BASE_QUOTE: Quote = {
  id: 'quote-1',
  date: '2026-04-01',
  jobId: 'J26-1001',
  jobName: '80x120x20',
  clientName: 'Atlas',
  clientId: 'C26-1001',
  salesRep: 'Rep',
  estimator: 'Estimator',
  province: 'ON',
  city: 'Hamilton',
  address: '1 Test St',
  postalCode: 'L8P1A1',
  width: 80,
  length: 120,
  height: 20,
  sqft: 9600,
  weight: 25000,
  baseSteelCost: 100000,
  steelAfter12: 112000,
  markup: 10000,
  adjustedSteel: 122000,
  engineering: 2500,
  foundation: 1200,
  foundationType: 'slab',
  gutters: 0,
  liners: 0,
  insulation: 0,
  insulationGrade: '',
  freight: 6400,
  combinedTotal: 132100,
  perSqft: 13.76,
  perLb: 4.88,
  contingencyPct: 5,
  contingency: 6605,
  gstHst: 0,
  qst: 0,
  grandTotal: 138705,
  status: 'Draft',
  documentType: 'internal_quote',
  workflowStatus: 'internal_quote_ready',
};

describe('freight handoff', () => {
  it('builds a pre-sale freight estimate from an internal quote', () => {
    const record = buildFreightRecordFromInternalQuote({
      quote: BASE_QUOTE,
      distanceKm: 420,
      dropOffLocation: '1 Test St, Hamilton, ON, L8P1A1',
      moffettIncluded: true,
      isDealStage: false,
    });

    expect(record.mode).toBe('pre_sale');
    expect(record.status).toBe('RFQ');
    expect(record.estDistance).toBe(420);
    expect(record.estFreight).toBe(6400);
    expect(record.moffettIncluded).toBe(true);
  });

  it('promotes a pre-sale freight estimate into an execution freight quote', () => {
    const source: FreightRecord = {
      jobId: 'J26-1001',
      clientName: 'Atlas',
      buildingSize: '80x120x20',
      province: 'ON',
      weight: 25000,
      pickupAddress: '',
      deliveryAddress: '1 Test St, Hamilton, ON, L8P1A1',
      dropOffLocation: '1 Test St, Hamilton, ON, L8P1A1',
      pickupDate: '',
      deliveryDate: '',
      estimatedPickupDate: '2026-04-10',
      estimatedDeliveryDate: '2026-04-12',
      actualPickupDate: '',
      actualDeliveryDate: '',
      mode: 'pre_sale',
      estDistance: 420,
      estFreight: 6400,
      actualFreight: 0,
      paid: false,
      carrier: '',
      moffettIncluded: true,
      assignedFreightUserId: null,
      status: 'RFQ',
    };

    const promoted = promoteFreightRecordToDealQuote(source);

    expect(promoted.mode).toBe('execution');
    expect(promoted.status).toBe('Quoted');
    expect(promoted.pickupDate).toBe('2026-04-10');
    expect(promoted.deliveryDate).toBe('2026-04-12');
    expect(promoted.moffettIncluded).toBe(true);
  });

  it('preserves progressed execution statuses when rebuilding a deal-stage freight record', () => {
    const record = buildFreightRecordFromInternalQuote({
      quote: BASE_QUOTE,
      distanceKm: 420,
      dropOffLocation: '1 Test St, Hamilton, ON, L8P1A1',
      moffettIncluded: false,
      isDealStage: true,
      existing: {
        jobId: 'J26-1001',
        clientName: 'Atlas',
        buildingSize: '80x120x20',
        province: 'ON',
        weight: 25000,
        pickupAddress: '',
        deliveryAddress: '1 Test St, Hamilton, ON, L8P1A1',
        dropOffLocation: '1 Test St, Hamilton, ON, L8P1A1',
        pickupDate: '2026-04-10',
        deliveryDate: '2026-04-12',
        estimatedPickupDate: '2026-04-10',
        estimatedDeliveryDate: '2026-04-12',
        actualPickupDate: '',
        actualDeliveryDate: '',
        mode: 'execution',
        estDistance: 300,
        estFreight: 5000,
        actualFreight: 0,
        paid: false,
        carrier: '',
        moffettIncluded: false,
        assignedFreightUserId: 'freight-user',
        status: 'Booked',
      },
    });

    expect(record.mode).toBe('execution');
    expect(record.status).toBe('Booked');
    expect(record.assignedFreightUserId).toBe('freight-user');
  });
});
