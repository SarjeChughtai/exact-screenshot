import type { ImportReviewStatus, QuoteFileRecord, StoredDocument } from '@/types';

export interface ImportReviewFile extends QuoteFileRecord {
  storedDocument?: StoredDocument | null;
}

export interface ImportReviewDuplicateGroup {
  key: string;
  files: ImportReviewFile[];
  primaryFileId: string;
  duplicateCount: number;
}

const REVIEW_PRIORITY: Record<ImportReviewStatus, number> = {
  corrected: 5,
  approved: 4,
  pending: 3,
  needs_review: 2,
  rejected: 1,
};

function normalizeKeyPart(value: string | null | undefined, fallback = 'none') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function buildDuplicateDocumentGroupKey(input: {
  jobId?: string | null;
  fileType?: string | null;
  extractedDocumentType?: string | null;
  documentId?: string | null;
  buildingLabel?: string | null;
  clientId?: string | null;
}) {
  const documentType = input.extractedDocumentType || input.fileType || 'unknown';
  return [
    normalizeKeyPart(input.jobId, 'no-job'),
    normalizeKeyPart(documentType, 'unknown'),
    normalizeKeyPart(input.documentId, 'no-document'),
    normalizeKeyPart(input.buildingLabel, 'no-building'),
    normalizeKeyPart(input.clientId, 'no-client'),
  ].join('|');
}

export function resolveDuplicateDocumentGroupKey(file: Pick<
  QuoteFileRecord,
  'duplicateGroupKey' | 'jobId' | 'fileType' | 'documentId' | 'buildingLabel' | 'clientId'
> & {
  storedDocument?: Pick<StoredDocument, 'duplicateGroupKey' | 'extractedDocumentType'> | null;
}) {
  if (file.duplicateGroupKey) return file.duplicateGroupKey;
  if (file.storedDocument?.duplicateGroupKey) return file.storedDocument.duplicateGroupKey;

  return buildDuplicateDocumentGroupKey({
    jobId: file.jobId,
    fileType: file.fileType,
    extractedDocumentType: file.storedDocument?.extractedDocumentType || null,
    documentId: file.documentId || null,
    buildingLabel: file.buildingLabel || null,
    clientId: file.clientId || null,
  });
}

function compareImportReviewFiles(a: ImportReviewFile, b: ImportReviewFile) {
  const primaryBias = Number(Boolean(b.isPrimaryDocument)) - Number(Boolean(a.isPrimaryDocument));
  if (primaryBias !== 0) return primaryBias;

  const reviewBias = (REVIEW_PRIORITY[b.reviewStatus] || 0) - (REVIEW_PRIORITY[a.reviewStatus] || 0);
  if (reviewBias !== 0) return reviewBias;

  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

export function pickPrimaryImportReviewFile(files: ImportReviewFile[]) {
  return [...files].sort(compareImportReviewFiles)[0];
}

export function groupImportReviewFiles(files: ImportReviewFile[]): ImportReviewDuplicateGroup[] {
  const grouped = files.reduce<Map<string, ImportReviewFile[]>>((accumulator, file) => {
    const key = resolveDuplicateDocumentGroupKey(file);
    accumulator.set(key, [...(accumulator.get(key) || []), file]);
    return accumulator;
  }, new Map<string, ImportReviewFile[]>());

  return [...grouped.entries()]
    .map(([key, groupFiles]) => {
      const primaryFile = pickPrimaryImportReviewFile(groupFiles);
      return {
        key,
        files: [...groupFiles].sort(compareImportReviewFiles),
        primaryFileId: primaryFile.id,
        duplicateCount: Math.max(groupFiles.length - 1, 0),
      };
    })
    .sort((a, b) => {
      const aPrimary = a.files.find(file => file.id === a.primaryFileId) || a.files[0];
      const bPrimary = b.files.find(file => file.id === b.primaryFileId) || b.files[0];
      return new Date(bPrimary?.createdAt || 0).getTime() - new Date(aPrimary?.createdAt || 0).getTime();
    });
}

export function getVisibleOperatorQuoteFiles<T extends QuoteFileRecord>(files: T[]) {
  const groups = files.reduce<Map<string, T[]>>((accumulator, file) => {
    const key = resolveDuplicateDocumentGroupKey(file);
    accumulator.set(key, [...(accumulator.get(key) || []), file]);
    return accumulator;
  }, new Map<string, T[]>());

  return [...groups.values()]
    .map(groupFiles => pickPrimaryImportReviewFile(groupFiles as ImportReviewFile[]) as T)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}
