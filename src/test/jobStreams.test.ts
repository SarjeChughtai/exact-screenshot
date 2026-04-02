import { describe, expect, it } from 'vitest';

import {
  buildConstructionEvent,
  buildFreightEvent,
  buildProductionEvent,
  buildQuoteWorkflowEvent,
  resolveAssignedJobStreamUserIds,
} from '@/lib/jobStreams';
import type {
  ConstructionBid,
  ConstructionRFQ,
  FreightRecord,
  ProductionRecord,
  Quote,
  SharedJobRecord,
} from '@/types';
import type { PersonnelEntry } from '@/context/SettingsContext';

const BASE_QUOTE: Quote = {
  id: 'quote-1',
  date: '2026-04-02',
  jobId: 'J26-1001',
  jobName: '80x120x20',
  clientName: 'Atlas',
  clientId: 'C26-1001',
  salesRep: 'Rep One',
  estimator: 'Estimator One',
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
  documentType: 'rfq',
  workflowStatus: 'draft',
};

const BASE_FREIGHT: FreightRecord = {
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
  estimatedPickupDate: '',
  estimatedDeliveryDate: '',
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

const BASE_PRODUCTION: ProductionRecord = {
  jobId: 'J26-1001',
  submitted: true,
  acknowledged: false,
  inProduction: false,
  qcComplete: false,
  shipReady: false,
  shipped: false,
  delivered: false,
  drawingsStatus: '',
  insulationStatus: '',
  engineeringDrawingsStatus: 'requested',
  foundationDrawingsStatus: 'not_requested',
};

const BASE_CONSTRUCTION_RFQ: ConstructionRFQ = {
  id: 'construction-rfq-1',
  jobId: 'J26-1001',
  title: 'Install Bid',
  scope: 'install',
  buildingDetails: '80x120x20',
  jobName: 'Atlas Build',
  province: 'ON',
  city: 'Hamilton',
  postalCode: 'L8P1A1',
  address: '1 Test St',
  width: 80,
  length: 120,
  height: 20,
  notes: '',
  requiredByDate: '2026-04-20',
  closingDate: '2026-04-10',
  status: 'Open',
};

const BASE_CONSTRUCTION_BID: ConstructionBid = {
  id: 'construction-bid-1',
  rfqId: 'construction-rfq-1',
  vendorId: 'vendor-1',
  vendorName: 'Builder Inc',
  bidScope: 'both',
  installAmount: 10000,
  concreteAmount: 5000,
  totalAmount: 15000,
  notes: '',
  status: 'Submitted',
  submittedAt: '2026-04-02T12:00:00Z',
};

describe('job stream workflow event builders', () => {
  it('maps RFQ workflow states to stream events', () => {
    expect(
      buildQuoteWorkflowEvent(
        { ...BASE_QUOTE, workflowStatus: 'draft' },
        { ...BASE_QUOTE, workflowStatus: 'estimate_needed' },
      ),
    ).toMatchObject({
      eventKey: 'rfq_submitted',
      body: 'RFQ submitted for J26-1001.',
    });

    expect(
      buildQuoteWorkflowEvent(
        { ...BASE_QUOTE, workflowStatus: 'estimate_needed' },
        { ...BASE_QUOTE, workflowStatus: 'internal_quote_ready', documentType: 'internal_quote' },
      ),
    ).toMatchObject({
      eventKey: 'internal_quote_ready',
      body: 'Internal quote ready for J26-1001.',
    });
  });

  it('creates freight estimate and freight quoted events', () => {
    expect(buildFreightEvent(null, BASE_FREIGHT)).toMatchObject({
      eventKey: 'sent_to_freight',
      metadata: { mode: 'pre_sale', status: 'RFQ', moffettIncluded: true },
    });

    expect(
      buildFreightEvent(
        { ...BASE_FREIGHT, status: 'RFQ' },
        { ...BASE_FREIGHT, status: 'Quoted' },
      ),
    ).toMatchObject({
      eventKey: 'freight_quoted',
      body: 'Freight quoted for J26-1001.',
    });
  });

  it('only emits production events when tracked status changes', () => {
    expect(buildProductionEvent(BASE_PRODUCTION, { ...BASE_PRODUCTION })).toBeNull();

    expect(
      buildProductionEvent(
        BASE_PRODUCTION,
        { ...BASE_PRODUCTION, inProduction: true, engineeringDrawingsStatus: 'received' },
      ),
    ).toMatchObject({
      eventKey: 'production_status_changed',
      metadata: { inProduction: true, engineeringDrawingsStatus: 'received' },
    });
  });

  it('formats construction post and award events', () => {
    expect(buildConstructionEvent('construction_rfq_posted', BASE_CONSTRUCTION_RFQ)).toMatchObject({
      eventKey: 'construction_rfq_posted',
      body: 'Construction RFQ posted for J26-1001.',
    });

    expect(
      buildConstructionEvent('construction_rfq_awarded', BASE_CONSTRUCTION_RFQ, BASE_CONSTRUCTION_BID),
    ).toMatchObject({
      eventKey: 'construction_rfq_awarded',
      body: 'Construction RFQ awarded for J26-1001 to Builder Inc.',
    });
  });
});

describe('resolveAssignedJobStreamUserIds', () => {
  it('collects assignment ids from both direct record fields and personnel name resolution', () => {
    const record: SharedJobRecord = {
      jobId: 'J26-1001',
      clientName: 'Atlas',
      jobName: 'Atlas Build',
      state: 'deal',
      salesRep: 'Rep One',
      estimator: 'Estimator One',
      assignedFreightUserId: 'freight-user',
      dealerUserId: 'dealer-user',
      vendorUserIds: ['vendor-user', 'vendor-user'],
    };

    const personnel: PersonnelEntry[] = [
      { id: 'sales-user', name: 'Rep One', email: 'rep@example.com', role: 'sales_rep', roles: ['sales_rep'] },
      { id: 'estimator-user', name: 'Estimator One', email: 'estimator@example.com', role: 'estimator', roles: ['estimator'] },
    ];

    expect(resolveAssignedJobStreamUserIds(record, personnel).sort()).toEqual([
      'dealer-user',
      'estimator-user',
      'freight-user',
      'sales-user',
      'vendor-user',
    ]);
  });
});
