import { describe, expect, it } from 'vitest';

import { getVisibleOperatorQuoteFiles, groupImportReviewFiles } from '@/lib/importReview';
import type { QuoteFileRecord } from '@/types';

function buildFile(overrides: Partial<QuoteFileRecord> = {}): QuoteFileRecord {
  return {
    id: overrides.id || crypto.randomUUID(),
    documentId: overrides.documentId ?? null,
    storedDocumentId: overrides.storedDocumentId ?? null,
    jobId: overrides.jobId || 'JOB-100',
    clientName: overrides.clientName || 'North Yard',
    clientId: overrides.clientId || 'CL-001',
    fileName: overrides.fileName || 'quote.pdf',
    fileSize: overrides.fileSize || 1000,
    fileType: overrides.fileType || 'mbs',
    fileCategory: overrides.fileCategory || 'cost_file',
    storagePath: overrides.storagePath || 'path/to/file.pdf',
    buildingLabel: overrides.buildingLabel || 'Building 1',
    extractionSource: overrides.extractionSource || 'ai',
    aiOutput: overrides.aiOutput || null,
    reviewStatus: overrides.reviewStatus || 'pending',
    parseError: overrides.parseError || null,
    reviewedBy: overrides.reviewedBy || null,
    reviewedAt: overrides.reviewedAt || null,
    correctedData: overrides.correctedData || null,
    duplicateGroupKey: overrides.duplicateGroupKey || 'job-100|mbs|no-document|building-1|cl-001',
    isPrimaryDocument: overrides.isPrimaryDocument ?? true,
    gdriveStatus: overrides.gdriveStatus || 'pending',
    gdriveFileId: overrides.gdriveFileId || null,
    uploadedBy: overrides.uploadedBy || null,
    createdAt: overrides.createdAt || '2026-03-31T10:00:00.000Z',
  };
}

describe('import review duplicate governance', () => {
  it('returns only one operator-visible file per duplicate group', () => {
    const files = [
      buildFile({ id: 'old', createdAt: '2026-03-31T09:00:00.000Z', isPrimaryDocument: false }),
      buildFile({ id: 'new', createdAt: '2026-03-31T11:00:00.000Z', isPrimaryDocument: true }),
      buildFile({ id: 'other', jobId: 'JOB-200', duplicateGroupKey: 'job-200|mbs|no-document|building-1|cl-001' }),
    ];

    expect(getVisibleOperatorQuoteFiles(files).map(file => file.id)).toEqual(['new', 'other']);
  });

  it('groups duplicates and marks the preferred primary file', () => {
    const files = [
      buildFile({ id: 'pending', reviewStatus: 'pending', isPrimaryDocument: false }),
      buildFile({ id: 'approved', reviewStatus: 'approved', isPrimaryDocument: true }),
      buildFile({ id: 'single', jobId: 'JOB-300', duplicateGroupKey: 'job-300|mbs|no-document|building-1|cl-001' }),
    ];

    const groups = groupImportReviewFiles(files);
    const duplicateGroup = groups.find(group => group.key === 'job-100|mbs|no-document|building-1|cl-001');

    expect(duplicateGroup?.primaryFileId).toBe('approved');
    expect(duplicateGroup?.duplicateCount).toBe(1);
  });
});
