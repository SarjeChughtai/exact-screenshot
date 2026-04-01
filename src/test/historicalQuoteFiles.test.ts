import { describe, expect, it } from 'vitest';

import { buildHistoricalQuoteFileSnapshot } from '@/lib/historicalQuoteFiles';
import type { QuoteFileRecord, StoredDocument } from '@/types';

function buildQuoteFile(overrides: Partial<QuoteFileRecord> = {}): QuoteFileRecord {
  return {
    id: 'file-1',
    documentId: null,
    storedDocumentId: null,
    jobId: 'JOB-100',
    clientName: 'North Yard',
    clientId: 'CL-001',
    fileName: 'mbs.pdf',
    fileSize: 2000,
    fileType: 'mbs',
    fileCategory: 'cost_file',
    storagePath: 'path/to/mbs.pdf',
    buildingLabel: 'Building 1',
    extractionSource: 'ai',
    aiOutput: {
      weight: 12000,
      total_cost: 24000,
    },
    reviewStatus: 'approved',
    parseError: null,
    reviewedBy: null,
    reviewedAt: null,
    correctedData: null,
    duplicateGroupKey: null,
    isPrimaryDocument: true,
    gdriveStatus: 'pending',
    gdriveFileId: null,
    uploadedBy: null,
    createdAt: '2026-03-31T10:00:00.000Z',
    ...overrides,
  };
}

function buildStoredDocument(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    id: 'stored-1',
    quoteFileId: 'file-1',
    documentId: null,
    jobId: 'JOB-100',
    projectId: null,
    clientId: 'CL-001',
    vendorId: null,
    sourceType: 'uploaded',
    sourceFilename: 'mbs.pdf',
    sourceFileExtension: 'pdf',
    fileName: 'mbs.pdf',
    fileSize: 2000,
    fileType: 'mbs',
    storagePath: 'path/to/mbs.pdf',
    extractedDocumentType: 'mbs',
    parserName: null,
    parserVersion: null,
    parseError: null,
    reviewStatus: 'approved',
    parsedData: null,
    metadata: {},
    duplicateGroupKey: null,
    isPrimaryDocument: true,
    parsedSuccessfully: true,
    reviewedBy: null,
    reviewedAt: null,
    uploadedBy: null,
    uploadedAt: '2026-03-31T10:00:00.000Z',
    createdAt: '2026-03-31T10:00:00.000Z',
    ...overrides,
  };
}

describe('historical quote file snapshot', () => {
  it('prefers warehouse-normalized steel data over raw ai output', () => {
    const snapshot = buildHistoricalQuoteFileSnapshot({
      file: buildQuoteFile(),
      steelWarehouseEntry: {
        id: 'steel-1',
        quoteFileId: 'file-1',
        totalWeightLb: 15000,
        totalCost: 31500,
        pricePerLb: 2.1,
        widthFt: 60,
        lengthFt: 100,
        eaveHeightFt: 18,
        roofSlope: 1,
        structureType: 'container_cover',
        components: [
          { name: 'Framed openings', cost: 1000 },
          { name: 'Gutters and Downspouts', cost: 600 },
          { name: 'Roof Liner Panels', cost: 1200 },
          { name: 'Wall Liner Panels', cost: 900 },
        ],
      },
    });

    expect(snapshot.weightLbs).toBe(15000);
    expect(snapshot.totalSupplierCost).toBe(31500);
    expect(snapshot.costPerLb).toBe(2.1);
    expect(snapshot.structureType).toBe('container_cover');
    expect(snapshot.guttersDownspoutsTotal).toBe(600);
    expect(snapshot.roofLinerPanelsTotal).toBe(1200);
    expect(snapshot.wallLinerPanelsTotal).toBe(900);
    expect(snapshot.components).toHaveLength(4);
  });

  it('merges warehouse steel rows with richer fallback job and location data', () => {
    const snapshot = buildHistoricalQuoteFileSnapshot({
      file: buildQuoteFile({
        correctedData: {
          projectId: 'JOB-321',
          city: 'Regina',
          postalCode: 'S4P 3Y2',
          client_name: 'Merged Client',
        },
      }),
      steelWarehouseEntry: {
        id: 'steel-2',
        quoteFileId: 'file-1',
        totalWeightLb: 18000,
        totalCost: 37800,
        pricePerLb: 2.1,
        widthFt: 80,
      },
    });

    expect(snapshot.jobId).toBe('JOB-321');
    expect(snapshot.clientName).toBe('Merged Client');
    expect(snapshot.city).toBe('Regina');
    expect(snapshot.postalCode).toBe('S4P 3Y2');
    expect(snapshot.width).toBe(80);
    expect(snapshot.weightLbs).toBe(18000);
  });

  it('prefers corrected quote-file data over stale ai output', () => {
    const snapshot = buildHistoricalQuoteFileSnapshot({
      file: buildQuoteFile({
        correctedData: {
          weight: 18000,
          cost_per_lb: 2.25,
          total_cost: 40500,
          city: 'Regina',
        },
        aiOutput: {
          weight: 9000,
          cost_per_lb: 1.5,
          total_cost: 13500,
          city: 'Old City',
        },
      }),
    });

    expect(snapshot.weightLbs).toBe(18000);
    expect(snapshot.costPerLb).toBe(2.25);
    expect(snapshot.totalSupplierCost).toBe(40500);
    expect(snapshot.city).toBe('Regina');
  });

  it('uses stored-document parsed data when corrected data is absent', () => {
    const snapshot = buildHistoricalQuoteFileSnapshot({
      file: buildQuoteFile({
        correctedData: null,
        aiOutput: {
          weight: 10000,
          job_id: 'OLD-JOB',
        },
      }),
      storedDocument: buildStoredDocument({
        parsedData: {
          job_id: 'JOB-200',
          client_name: 'Stored Client',
          postal_code: 'T2A 1A1',
          total_weight_lb: 22000,
          price_per_lb: 2.4,
          total_cost: 52800,
        },
      }),
    });

    expect(snapshot.jobId).toBe('JOB-200');
    expect(snapshot.clientName).toBe('Stored Client');
    expect(snapshot.postalCode).toBe('T2A 1A1');
    expect(snapshot.weightLbs).toBe(22000);
    expect(snapshot.costPerLb).toBe(2.4);
    expect(snapshot.totalSupplierCost).toBe(52800);
  });

  it('prefers the already-selected job id over extracted project aliases in ad hoc uploads', () => {
    const snapshot = buildHistoricalQuoteFileSnapshot({
      preferredJobId: 'JOB-777',
      file: buildQuoteFile({
        jobId: 'JOB-100',
        correctedData: {
          projectId: 'PROJECT-123',
          structureType: 'canopy',
          components: [
            { name: 'Downspouts', cost: 250 },
            { name: 'Roof liner', cost: 450 },
          ],
        },
      }),
    });

    expect(snapshot.jobId).toBe('JOB-777');
    expect(snapshot.structureType).toBe('canopy');
    expect(snapshot.guttersDownspoutsTotal).toBe(250);
    expect(snapshot.roofLinerPanelsTotal).toBe(450);
  });

  it('hydrates insulation data from warehouse rows without overwriting steel-only fields', () => {
    const snapshot = buildHistoricalQuoteFileSnapshot({
      file: buildQuoteFile({ fileType: 'insulation' }),
      insulationWarehouseEntry: {
        id: 'ins-1',
        quoteFileId: 'file-1',
        widthFt: 60,
        lengthFt: 100,
        eaveHeightFt: 18,
        roofSlope: 1,
        grade: 'R12',
        totalCost: 9800,
      },
    });

    expect(snapshot.documentType).toBe('insulation');
    expect(snapshot.insulationGrade).toBe('R12');
    expect(snapshot.insulationTotal).toBe(9800);
    expect(snapshot.weightLbs).toBeUndefined();
  });
});
