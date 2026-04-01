import { getVisibleOperatorQuoteFiles } from '@/lib/importReview';
import type { Quote, QuoteFileRecord } from '@/types';

export interface QuoteFileVisibilitySummary {
  totalFiles: number;
  hiddenDuplicateCount: number;
  visibleFiles: QuoteFileRecord[];
  generatedPdfFiles: QuoteFileRecord[];
  supportFiles: QuoteFileRecord[];
  costFiles: QuoteFileRecord[];
  latestVisibleFile: QuoteFileRecord | null;
}

export interface JobDocumentVaultSummary extends QuoteFileVisibilitySummary {
  jobId: string;
  pdfQuotes: Quote[];
  latestPdfQuote: Quote | null;
}

export function summarizeQuoteFiles(files: QuoteFileRecord[]): QuoteFileVisibilitySummary {
  const visibleFiles = getVisibleOperatorQuoteFiles(files);
  const generatedPdfFiles = visibleFiles.filter(file => file.fileCategory === 'generated_pdf');
  const supportFiles = visibleFiles.filter(file => file.fileCategory === 'support_file');
  const costFiles = visibleFiles.filter(file => file.fileCategory === 'cost_file');

  return {
    totalFiles: files.length,
    hiddenDuplicateCount: Math.max(files.length - visibleFiles.length, 0),
    visibleFiles,
    generatedPdfFiles,
    supportFiles,
    costFiles,
    latestVisibleFile: visibleFiles[0] || null,
  };
}

export function buildJobDocumentVaultSummary(input: {
  jobId: string;
  quotes: Quote[];
  files: QuoteFileRecord[];
}): JobDocumentVaultSummary {
  const { jobId, quotes, files } = input;
  const fileSummary = summarizeQuoteFiles(files);
  const pdfQuotes = quotes
    .filter(quote => quote.jobId === jobId && !quote.isDeleted && Boolean(quote.pdfStoragePath))
    .sort((left, right) => {
      const leftDate = new Date(left.updatedAt || left.createdAt || left.date || 0).getTime();
      const rightDate = new Date(right.updatedAt || right.createdAt || right.date || 0).getTime();
      return rightDate - leftDate;
    });

  return {
    jobId,
    ...fileSummary,
    pdfQuotes,
    latestPdfQuote: pdfQuotes[0] || null,
  };
}
