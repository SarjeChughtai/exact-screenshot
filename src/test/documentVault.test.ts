import { describe, expect, it } from 'vitest';
import { buildJobDocumentVaultSummary, summarizeQuoteFiles } from '@/lib/documentVault';
import type { Quote, QuoteFileRecord } from '@/types';

function createFile(overrides: Partial<QuoteFileRecord>): QuoteFileRecord {
  return {
    id: overrides.id || 'file-1',
    documentId: overrides.documentId ?? 'doc-1',
    storedDocumentId: overrides.storedDocumentId ?? null,
    jobId: overrides.jobId || 'JOB-1',
    clientName: overrides.clientName || 'Client',
    clientId: overrides.clientId || 'CLIENT-1',
    fileName: overrides.fileName || 'file.pdf',
    fileSize: overrides.fileSize || 1000,
    fileType: overrides.fileType || 'mbs',
    fileCategory: overrides.fileCategory || 'support_file',
    storagePath: overrides.storagePath || 'storage/path',
    buildingLabel: overrides.buildingLabel || 'Building 1',
    extractionSource: overrides.extractionSource || 'regex',
    aiOutput: overrides.aiOutput ?? null,
    reviewStatus: overrides.reviewStatus || 'approved',
    parseError: overrides.parseError ?? null,
    reviewedBy: overrides.reviewedBy ?? null,
    reviewedAt: overrides.reviewedAt ?? null,
    correctedData: overrides.correctedData ?? null,
    duplicateGroupKey: overrides.duplicateGroupKey ?? 'job-1|mbs|doc-1|building-1|client-1',
    isPrimaryDocument: overrides.isPrimaryDocument ?? true,
    gdriveStatus: overrides.gdriveStatus || 'complete',
    gdriveFileId: overrides.gdriveFileId ?? null,
    uploadedBy: overrides.uploadedBy ?? null,
    createdAt: overrides.createdAt || '2026-03-31T10:00:00.000Z',
  };
}

function createQuote(overrides: Partial<Quote>): Quote {
  return {
    id: overrides.id || 'quote-1',
    date: overrides.date || '2026-03-31',
    jobId: overrides.jobId || 'JOB-1',
    jobName: overrides.jobName || 'Main Building',
    clientName: overrides.clientName || 'Client',
    clientId: overrides.clientId || 'CLIENT-1',
    salesRep: overrides.salesRep || 'Rep',
    estimator: overrides.estimator || 'Estimator',
    province: overrides.province || 'ON',
    city: overrides.city || 'Toronto',
    address: overrides.address || '',
    postalCode: overrides.postalCode || '',
    width: overrides.width || 40,
    length: overrides.length || 60,
    height: overrides.height || 16,
    leftEaveHeight: overrides.leftEaveHeight,
    rightEaveHeight: overrides.rightEaveHeight,
    isSingleSlope: overrides.isSingleSlope,
    pitch: overrides.pitch,
    sqft: overrides.sqft || 2400,
    weight: overrides.weight || 10000,
    baseSteelCost: overrides.baseSteelCost || 0,
    steelAfter12: overrides.steelAfter12 || 0,
    markup: overrides.markup || 0,
    adjustedSteel: overrides.adjustedSteel || 0,
    engineering: overrides.engineering || 0,
    foundation: overrides.foundation || 0,
    foundationType: overrides.foundationType || 'slab',
    gutters: overrides.gutters || 0,
    liners: overrides.liners || 0,
    insulation: overrides.insulation || 0,
    insulationGrade: overrides.insulationGrade || '',
    freight: overrides.freight || 0,
    combinedTotal: overrides.combinedTotal || 0,
    perSqft: overrides.perSqft || 0,
    perLb: overrides.perLb || 0,
    contingencyPct: overrides.contingencyPct || 5,
    contingency: overrides.contingency || 0,
    gstHst: overrides.gstHst || 0,
    qst: overrides.qst || 0,
    grandTotal: overrides.grandTotal || 120000,
    status: overrides.status || 'Draft',
    documentType: overrides.documentType || 'external_quote',
    workflowStatus: overrides.workflowStatus || 'quote_sent',
    sourceDocumentId: overrides.sourceDocumentId ?? null,
    opportunityId: overrides.opportunityId ?? null,
    assignedEstimatorUserId: overrides.assignedEstimatorUserId ?? null,
    assignedOperationsUserId: overrides.assignedOperationsUserId ?? null,
    pdfStoragePath: overrides.pdfStoragePath || '',
    pdfFileName: overrides.pdfFileName || '',
    payload: overrides.payload || {},
    createdByUserId: overrides.createdByUserId ?? null,
    createdAt: overrides.createdAt || '2026-03-31T10:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-03-31T10:00:00.000Z',
    isDeleted: overrides.isDeleted ?? false,
  };
}

describe('documentVault', () => {
  it('summarizes visible files and hidden duplicates', () => {
    const files = [
      createFile({ id: 'a', fileCategory: 'support_file', createdAt: '2026-03-31T10:00:00.000Z' }),
      createFile({ id: 'b', fileCategory: 'support_file', createdAt: '2026-03-30T10:00:00.000Z' }),
      createFile({
        id: 'c',
        fileCategory: 'generated_pdf',
        duplicateGroupKey: 'job-1|generated|doc-2|building-1|client-1',
        documentId: 'doc-2',
        createdAt: '2026-03-31T11:00:00.000Z',
      }),
      createFile({
        id: 'd',
        fileCategory: 'cost_file',
        duplicateGroupKey: 'job-1|cost|doc-3|building-1|client-1',
        documentId: 'doc-3',
      }),
    ];

    const summary = summarizeQuoteFiles(files);

    expect(summary.visibleFiles).toHaveLength(3);
    expect(summary.hiddenDuplicateCount).toBe(1);
    expect(summary.generatedPdfFiles).toHaveLength(1);
    expect(summary.supportFiles).toHaveLength(1);
    expect(summary.costFiles).toHaveLength(1);
    expect(summary.latestVisibleFile?.id).toBe('c');
  });

  it('builds job-level vault summary including quote PDFs', () => {
    const quotes = [
      createQuote({
        id: 'quote-1',
        pdfStoragePath: 'quote-1.pdf',
        pdfFileName: 'quote-1.pdf',
        updatedAt: '2026-03-31T12:00:00.000Z',
      }),
      createQuote({
        id: 'quote-2',
        pdfStoragePath: 'quote-2.pdf',
        pdfFileName: 'quote-2.pdf',
        updatedAt: '2026-03-31T14:00:00.000Z',
      }),
    ];

    const summary = buildJobDocumentVaultSummary({
      jobId: 'JOB-1',
      quotes,
      files: [createFile({ id: 'file-1' })],
    });

    expect(summary.pdfQuotes).toHaveLength(2);
    expect(summary.latestPdfQuote?.id).toBe('quote-2');
    expect(summary.visibleFiles).toHaveLength(1);
  });
});
