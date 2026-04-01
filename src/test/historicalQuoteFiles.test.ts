import { describe, expect, it } from 'vitest';

import { buildHistoricalQuoteFileSnapshot } from '@/lib/historicalQuoteFiles';
import type { QuoteFileRecord } from '@/types';

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
        components: [{ name: 'Framed openings', cost: 1000 }],
      },
    });

    expect(snapshot.weightLbs).toBe(15000);
    expect(snapshot.totalSupplierCost).toBe(31500);
    expect(snapshot.costPerLb).toBe(2.1);
    expect(snapshot.components).toHaveLength(1);
  });
});
