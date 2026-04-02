import { describe, expect, it } from 'vitest';

import { buildDocumentLines } from '@/lib/documentPdf';
import type { Quote } from '@/types';

function buildRfqQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'rfq-1',
    date: '2026-04-02',
    jobId: 'J26-1200',
    jobName: 'Demo RFQ',
    clientName: 'North Yard',
    clientId: 'CL-1200',
    salesRep: 'Robert Brown',
    estimator: 'Estimator One',
    province: 'ON',
    city: 'Barrie',
    address: '1 Demo Street',
    postalCode: 'L4N1A1',
    width: 80,
    length: 120,
    height: 20,
    sqft: 9600,
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
    documentType: 'rfq',
    workflowStatus: 'estimate_needed',
    payload: {
      contactEmail: 'ops@example.com',
      contactPhone: '555-0100',
      buildingStyle: 'Symmetrical',
      roofPitch: '1:12',
      guttersMode: 'spacing',
      linersMode: 'roof_walls',
      insulationRequired: true,
      insulationRoofGrade: 'R20/R20',
      insulationWallGrade: 'R12/R20',
      notes: 'Customer requested price by Friday',
      openings: [
        { wall: 'Front', number: '1', width: '12', height: '14', notes: 'OH door' },
      ],
    },
    ...overrides,
  };
}

describe('documentPdf', () => {
  it('builds RFQ-specific PDF lines without financial summary or payload dump', () => {
    const lines = buildDocumentLines(buildRfqQuote());

    expect(lines).toContain('Project Details');
    expect(lines).toContain('Building Specs');
    expect(lines).toContain('Accessories');
    expect(lines).toContain('Openings');
    expect(lines).toContain('Notes');
    expect(lines.some(line => line.includes('Opening 1: Front #1 12 x 14 - OH door'))).toBe(true);
    expect(lines).not.toContain('Financial Summary');
    expect(lines).not.toContain('Document Payload');
  });
});
