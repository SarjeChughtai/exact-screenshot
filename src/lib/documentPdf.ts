import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Quote } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatNumber } from '@/lib/calculations';

const PAGE_MARGIN = 48;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;

const DOCUMENT_TITLES: Record<Quote['documentType'], string> = {
  rfq: 'Request For Quote',
  dealer_rfq: 'Dealer RFQ',
  internal_quote: 'Internal Quote',
  external_quote: 'External Quote',
};

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return 'Not set';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(item => formatValue(item)).join(', ') : 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildPayloadLines(payload: Record<string, unknown> | undefined) {
  if (!payload) return [];

  const lines: string[] = [];
  const keys = Object.keys(payload).sort();
  for (const key of keys) {
    const value = payload[key];
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;

    if (key === 'openings' && Array.isArray(value)) {
      lines.push(`Openings: ${value.length}`);
      for (const opening of value.slice(0, 20)) {
        const item = opening as Record<string, unknown>;
        lines.push(`  - ${formatValue(item.wall)} #${formatValue(item.number)} ${formatValue(item.width)} x ${formatValue(item.height)} ${formatValue(item.notes)}`);
      }
      continue;
    }

    if (key === 'buildings' && Array.isArray(value)) {
      lines.push(`Buildings: ${value.length}`);
      value.forEach((building, index) => {
        const item = building as Record<string, unknown>;
        lines.push(`  - ${formatValue(item.label || `Building ${index + 1}`)}`);
      });
      continue;
    }

    lines.push(`${key}: ${formatValue(value)}`);
  }

  return lines;
}

function buildDocumentLines(quote: Quote) {
  const lines: string[] = [];
  const title = DOCUMENT_TITLES[quote.documentType];

  lines.push(title);
  lines.push(`${quote.jobId} | ${quote.clientName}`);
  lines.push('');
  lines.push(`Date: ${quote.date}`);
  lines.push(`Job Name: ${quote.jobName || 'Not set'}`);
  lines.push(`Client ID: ${quote.clientId || 'Not set'}`);
  lines.push(`Sales Rep: ${quote.salesRep || 'Not set'}`);
  lines.push(`Estimator: ${quote.estimator || 'Not set'}`);
  lines.push(`Workflow Status: ${quote.workflowStatus}`);
  lines.push(`Record Status: ${quote.status}`);
  lines.push('');
  lines.push('Project Details');
  lines.push(`Location: ${[quote.address, quote.city, quote.province, quote.postalCode].filter(Boolean).join(', ') || 'Not set'}`);
  lines.push(`Dimensions: ${quote.width} x ${quote.length} x ${quote.height}`);
  lines.push(`Sqft: ${formatNumber(quote.sqft)} | Weight: ${formatNumber(quote.weight)} lbs`);
  lines.push('');
  lines.push('Financial Summary');
  lines.push(`Base Steel: ${formatCurrency(quote.baseSteelCost)}`);
  lines.push(`Adjusted Steel: ${formatCurrency(quote.adjustedSteel)}`);
  lines.push(`Engineering: ${formatCurrency(quote.engineering)}`);
  lines.push(`Foundation: ${formatCurrency(quote.foundation)}`);
  lines.push(`Gutters & Downspouts: ${formatCurrency(quote.gutters)}`);
  lines.push(`Liners: ${formatCurrency(quote.liners)}`);
  lines.push(`Insulation: ${formatCurrency(quote.insulation)}`);
  lines.push(`Freight: ${formatCurrency(quote.freight)}`);
  lines.push(`Combined Total: ${formatCurrency(quote.combinedTotal)}`);
  lines.push(`Contingency: ${formatCurrency(quote.contingency)} (${quote.contingencyPct}%)`);
  lines.push(`Tax: ${formatCurrency((quote.gstHst || 0) + (quote.qst || 0))}`);
  lines.push(`Grand Total: ${formatCurrency(quote.grandTotal)}`);

  const payloadLines = buildPayloadLines((quote.payload || {}) as Record<string, unknown>);
  if (payloadLines.length) {
    lines.push('');
    lines.push('Document Payload');
    lines.push(...payloadLines);
  }

  return lines;
}

async function createDocumentPdfBytes(quote: Quote) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage();
  let { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = height - PAGE_MARGIN;

  const drawLine = (text: string, options?: { bold?: boolean; color?: ReturnType<typeof rgb> }) => {
    if (y <= PAGE_MARGIN) {
      page = pdf.addPage();
      ({ width, height } = page.getSize());
      y = height - PAGE_MARGIN;
    }

    page.drawText(text, {
      x: PAGE_MARGIN,
      y,
      size: FONT_SIZE,
      font: options?.bold ? boldFont : font,
      color: options?.color || rgb(0.12, 0.12, 0.12),
      maxWidth: width - PAGE_MARGIN * 2,
      lineHeight: LINE_HEIGHT,
    });
    y -= LINE_HEIGHT;
  };

  for (const line of buildDocumentLines(quote)) {
    const bold = !line || ['Project Details', 'Financial Summary', 'Document Payload'].includes(line) || line === DOCUMENT_TITLES[quote.documentType];
    drawLine(line, {
      bold,
      color: line === DOCUMENT_TITLES[quote.documentType] ? rgb(0.08, 0.23, 0.42) : undefined,
    });
  }

  return pdf.save();
}

export async function buildDocumentPdfFile(quote: Quote): Promise<File> {
  const bytes = await createDocumentPdfBytes(quote);
  const fileName = sanitizeFileName(`${DOCUMENT_TITLES[quote.documentType]}-${quote.jobId}-${quote.clientName}.pdf`);
  return new File([bytes], fileName, { type: 'application/pdf' });
}

export async function saveDocumentPdf(quote: Quote) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Authentication required to save document PDFs');
  }

  const file = await buildDocumentPdfFile(quote);
  const timestamp = Date.now();
  const storagePath = `${user.id}/${quote.jobId || quote.id}/generated/${timestamp}-${sanitizeFileName(file.name)}`;

  const { data: existingFile } = await (supabase.from as any)('quote_files')
    .select('id, storage_path')
    .eq('document_id', quote.id)
    .eq('file_category', 'generated_pdf')
    .maybeSingle();

  const { error: uploadError } = await supabase.storage
    .from('quote-files')
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const filePayload = {
    document_id: quote.id,
    job_id: quote.jobId || '',
    client_name: quote.clientName || '',
    client_id: quote.clientId || '',
    file_name: file.name,
    file_size: file.size,
    file_type: 'generated_pdf',
    file_category: 'generated_pdf',
    storage_path: storagePath,
    uploaded_by: user.id,
    building_label: quote.jobName || DOCUMENT_TITLES[quote.documentType],
    gdrive_status: 'pending',
    extraction_source: 'generated',
    review_status: 'approved',
    parse_error: null,
    ai_output: null,
    corrected_data: null,
  };

  if (existingFile?.id) {
    await (supabase.from as any)('quote_files').update(filePayload).eq('id', existingFile.id);
    if (existingFile.storage_path) {
      await supabase.storage.from('quote-files').remove([existingFile.storage_path]);
    }
  } else {
    await (supabase.from as any)('quote_files').insert(filePayload);
  }

  return {
    file,
    storagePath,
    fileName: file.name,
  };
}

export async function downloadDocumentPdf(quote: Quote) {
  const file = await buildDocumentPdfFile(quote);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
