import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatNumber, getProvinceTax } from '@/lib/calculations';
import { useAppContext } from '@/context/AppContext';
import { isEstimatorAssignedToQuote } from '@/lib/rfqWorkflow';
import { useSharedJobs } from '@/lib/sharedJobs';
import { supabase } from '@/integrations/supabase/client';
import { quoteFileFromRow } from '@/lib/supabaseMappers';
import type { Deal, DocumentType, Quote, QuoteFileRecord, QuoteStatus, SharedJobState } from '@/types';
import { toast } from 'sonner';
import { Archive, ChevronDown, ChevronRight, Download, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { getQuoteFileUrl } from '@/lib/quoteFileStorage';

const STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Follow Up', 'Won', 'Lost', 'Expired'];

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  rfq: 'RFQ',
  dealer_rfq: 'Dealer RFQ',
  internal_quote: 'Internal Quote',
  external_quote: 'External Quote',
};

interface DocumentLogTableProps {
  title: string;
  subtitle: string;
  filterDocumentTypes: DocumentType[];
  filterWorkflowStatuses?: string[];
  focusDocumentId?: string;
  estimatorFilter?: {
    userId: string;
    name: string;
  };
}

export function DocumentLogTable({
  title,
  subtitle,
  filterDocumentTypes,
  filterWorkflowStatuses,
  focusDocumentId,
  estimatorFilter,
}: DocumentLogTableProps) {
  const navigate = useNavigate();
  const { quotes, deals, updateQuote, deleteQuote, restoreQuote, addDeal, updateDeal, deleteDeal } = useAppContext();
  const { visibleJobIds, stateByJobId } = useSharedJobs();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [filesByDocumentId, setFilesByDocumentId] = useState<Record<string, QuoteFileRecord[]>>({});

  const expectedStateByType: Record<DocumentType, SharedJobState> = {
    rfq: 'rfq',
    dealer_rfq: 'rfq',
    internal_quote: 'internal_quote',
    external_quote: 'external_quote',
  };

  const visibleQuotes = quotes.filter(quote => {
    if (!filterDocumentTypes.includes(quote.documentType)) return false;
    if (filterWorkflowStatuses && !filterWorkflowStatuses.includes(quote.workflowStatus)) return false;
    if (
      estimatorFilter &&
      (quote.documentType === 'rfq' || quote.documentType === 'dealer_rfq') &&
      !isEstimatorAssignedToQuote(quote, estimatorFilter.userId, estimatorFilter.name)
    ) {
      return false;
    }
    if (!visibleJobIds.has(quote.jobId)) return false;
    return stateByJobId[quote.jobId] === expectedStateByType[quote.documentType];
  });
  const activeQuotes = visibleQuotes.filter(quote => !quote.isDeleted);
  const deletedQuotes = visibleQuotes.filter(quote => quote.isDeleted);

  const visibleDocumentIds = useMemo(
    () => visibleQuotes.map(quote => quote.id).sort(),
    [visibleQuotes],
  );
  const visibleDocumentIdsKey = visibleDocumentIds.join('|');

  useEffect(() => {
    if (visibleDocumentIds.length === 0) {
      setFilesByDocumentId({});
      return;
    }

    void (async () => {
      const { data, error } = await (supabase.from as any)('quote_files')
        .select('*')
        .in('document_id', visibleDocumentIds)
        .order('created_at', { ascending: false });

      if (error) return;

      const grouped = (data || [])
        .map((row: any) => quoteFileFromRow(row))
        .reduce<Record<string, QuoteFileRecord[]>>((accumulator, file) => {
          const key = file.documentId || '';
          if (!key) return accumulator;
          accumulator[key] = [...(accumulator[key] || []), file];
          return accumulator;
        }, {});

      setFilesByDocumentId(grouped);
    })();
  }, [visibleDocumentIdsKey]);

  useEffect(() => {
    if (!focusDocumentId) return;
    if (!visibleQuotes.some(quote => quote.id === focusDocumentId)) return;
    setExpandedId(focusDocumentId);
  }, [focusDocumentId, visibleQuotes]);

  const changeStatus = (id: string, status: QuoteStatus) => {
    updateQuote(id, { status });
  };

  const openEditor = (quote: Quote) => {
    if (quote.documentType === 'internal_quote') {
      navigate(`/internal-quote-builder?quoteId=${quote.id}`);
      return;
    }
    if (quote.documentType === 'external_quote') {
      navigate(`/quote-builder?quoteId=${quote.id}`);
      return;
    }
    navigate(`/quote-rfq?quoteId=${quote.id}`);
  };

  const openPdf = async (quote: Quote) => {
    if (!quote.pdfStoragePath) {
      toast.error('No saved PDF is attached to this document yet');
      return;
    }
    const url = await getQuoteFileUrl(quote.pdfStoragePath);
    if (!url) {
      toast.error('Unable to load the saved PDF');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const convertToDeal = (quote: Quote) => {
    if (quote.documentType !== 'external_quote') {
      toast.error('Only external quotes can convert into deals');
      return;
    }

    const provinceTax = getProvinceTax(quote.province);
    const existingDeal = deals.find(deal => deal.jobId === quote.jobId);
    const dealUpdates: Partial<Deal> = {
      jobName: quote.jobName,
      clientName: quote.clientName,
      clientId: quote.clientId,
      salesRep: quote.salesRep,
      estimator: quote.estimator,
      teamLead: existingDeal?.teamLead || '',
      province: quote.province,
      city: quote.city,
      address: quote.address,
      postalCode: quote.postalCode,
      width: quote.width,
      length: quote.length,
      height: quote.height,
      sqft: quote.sqft,
      weight: quote.weight,
      taxRate: provinceTax.order_rate,
      taxType: provinceTax.type,
      orderType: existingDeal?.orderType || '',
      dateSigned: existingDeal?.dateSigned || new Date().toISOString().split('T')[0],
      dealStatus: existingDeal?.dealStatus || 'Quoted',
      paymentStatus: existingDeal?.paymentStatus || 'UNPAID',
      productionStatus: existingDeal?.productionStatus || 'Submitted',
      freightStatus: existingDeal?.freightStatus || 'Pending',
      insulationStatus: existingDeal?.insulationStatus || 'Pending',
      deliveryDate: existingDeal?.deliveryDate || '',
      pickupDate: existingDeal?.pickupDate || '',
      notes: existingDeal?.notes || '',
    };

    if (existingDeal) {
      updateDeal(quote.jobId, dealUpdates);
    } else {
      addDeal({
        jobId: quote.jobId,
        jobName: quote.jobName,
        clientName: quote.clientName,
        clientId: quote.clientId,
        salesRep: quote.salesRep,
        estimator: quote.estimator,
        teamLead: '',
        province: quote.province,
        city: quote.city,
        address: quote.address,
        postalCode: quote.postalCode,
        width: quote.width,
        length: quote.length,
        height: quote.height,
        sqft: quote.sqft,
        weight: quote.weight,
        taxRate: provinceTax.order_rate,
        taxType: provinceTax.type,
        orderType: '',
        dateSigned: new Date().toISOString().split('T')[0],
        dealStatus: 'Quoted',
        paymentStatus: 'UNPAID',
        productionStatus: 'Submitted',
        freightStatus: 'Pending',
        insulationStatus: 'Pending',
        deliveryDate: '',
        pickupDate: '',
        notes: '',
      });
    }

    updateQuote(quote.id, { workflowStatus: 'converted_to_deal', status: 'Won' });
    toast.success(`Deal ${existingDeal ? 'updated' : 'created'} for ${quote.jobId}`);
  };

  const revertDealToQuote = (quote: Quote) => {
    const existingDeal = deals.find(deal => deal.jobId === quote.jobId);
    if (!existingDeal) {
      toast.error('No deal exists for this quote');
      return;
    }

    deleteDeal(quote.jobId);
    updateQuote(quote.id, {
      workflowStatus: 'quote_sent',
      status: 'Sent',
      updatedAt: new Date().toISOString(),
    });
    toast.success(`Deal reverted back to quote for ${quote.jobId}`);
  };

  const renderRows = (items: Quote[], isTrash = false) => {
    if (items.length === 0) {
      return (
        <tr>
          <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No documents found</td>
        </tr>
      );
    }

      return items.map(quote => {
      const isExpanded = expandedId === quote.id;
      const isFocused = focusDocumentId === quote.id;
      const existingDeal = deals.find(deal => deal.jobId === quote.jobId);
      const attachedFiles = filesByDocumentId[quote.id] || [];
      const payload = (quote.payload || {}) as Record<string, unknown>;
      const openings = Array.isArray(payload.openings) ? payload.openings as Array<Record<string, unknown>> : [];
      const isRfqDocument = quote.documentType === 'rfq' || quote.documentType === 'dealer_rfq';

      return (
        <Fragment key={quote.id}>
          <tr key={quote.id} className={`border-b hover:bg-muted/50 ${isFocused ? 'bg-accent/10' : ''}`}>
            <td className="px-2 py-2">
              <button onClick={() => setExpandedId(isExpanded ? null : quote.id)}>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </td>
            <td className="px-3 py-2 font-mono text-xs">{quote.jobId}</td>
            <td className="px-3 py-2 text-xs">{quote.date}</td>
            <td className="px-3 py-2 text-xs">{DOCUMENT_LABELS[quote.documentType]}</td>
            <td className="px-3 py-2">{quote.clientName}</td>
            <td className="px-3 py-2 text-xs">{quote.salesRep}</td>
            <td className="px-3 py-2 text-xs">{quote.width}x{quote.length}x{quote.height}</td>
            <td className="px-3 py-2 font-mono">{formatCurrency(quote.grandTotal)}</td>
            <td className="px-3 py-2 text-xs">{quote.workflowStatus}</td>
            <td className="px-3 py-2">
              <Select value={quote.status} onValueChange={value => changeStatus(quote.id, value as QuoteStatus)} disabled={isTrash}>
                <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
              <div className="flex items-center gap-2">
                {!isTrash && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openEditor(quote)}>
                      <Pencil className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void openPdf(quote)}>
                      <Download className="h-3 w-3 mr-1" />PDF
                    </Button>
                    {quote.documentType === 'external_quote' && (
                      existingDeal ? (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => revertDealToQuote(quote)}>
                          <RotateCcw className="h-3 w-3 mr-1" />Revert to Quote
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => convertToDeal(quote)}>
                          Convert to Deal
                        </Button>
                      )
                    )}
                    {quote.documentType === 'internal_quote' && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => navigate(`/quote-builder?sourceDocumentId=${quote.id}`)}>
                        Create External Quote
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteQuote(quote.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {isTrash && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" onClick={() => restoreQuote(quote.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </td>
          </tr>
          {isExpanded && (
            <tr key={`${quote.id}-expanded`} className="bg-muted/30 border-b">
              <td colSpan={11} className="px-4 py-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-muted-foreground">Document</p>
                    <p>Job Name: {quote.jobName || 'Not set'}</p>
                    <p>Client ID: {quote.clientId || 'Not set'}</p>
                    <p>Workflow: {quote.workflowStatus}</p>
                    <p>Type: {DOCUMENT_LABELS[quote.documentType]}</p>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-muted-foreground">Building</p>
                    <p>Dimensions: {quote.width}x{quote.length}x{quote.height}</p>
                    <p>Sqft: {formatNumber(quote.sqft)}</p>
                    <p>Weight: {formatNumber(quote.weight)} lbs</p>
                    <p>Location: {[quote.city, quote.province, quote.postalCode].filter(Boolean).join(', ') || quote.province}</p>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-muted-foreground">Commercial</p>
                    <p>Combined Total: {formatCurrency(quote.combinedTotal)}</p>
                    <p>Contingency: {formatCurrency(quote.contingency)}</p>
                    <p>Grand Total: {formatCurrency(quote.grandTotal)}</p>
                    <p>Source Document: {quote.sourceDocumentId || 'None'}</p>
                  </div>
                </div>
                {isRfqDocument && (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-muted-foreground">RFQ Details</p>
                      <p>Contact Email: {String(payload.contactEmail ?? 'Not set')}</p>
                      <p>Contact Phone: {String(payload.contactPhone ?? 'Not set')}</p>
                      <p>Building Style: {String(payload.buildingStyle ?? 'Symmetrical')}</p>
                      <p>Roof Pitch: {String(payload.roofPitch ?? 'Not set')}</p>
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-muted-foreground">Envelope</p>
                      <p>Insulation Required: {payload.insulationRequired ? 'Yes' : 'No'}</p>
                      <p>Roof Insulation: {String(payload.insulationRoofGrade ?? 'Not set')}</p>
                      <p>Wall Insulation: {String(payload.insulationWallGrade ?? 'Not set')}</p>
                      <p>Liners: {String(payload.linersMode ?? payload.linerLocation ?? 'none')}</p>
                      <p>Gutters: {String(payload.guttersMode ?? (payload.gutters ? 'enabled' : 'none'))}</p>
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-muted-foreground">Openings and PDF</p>
                      <p>Openings: {openings.length}</p>
                      <p>Notes: {String(payload.notes ?? 'None')}</p>
                      {quote.pdfStoragePath ? (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs mt-2" onClick={() => void openPdf(quote)}>
                          <Download className="h-3 w-3 mr-1" />Open Saved PDF
                        </Button>
                      ) : (
                        <p>No saved PDF attached yet.</p>
                      )}
                    </div>
                  </div>
                )}
                {quote.payload && Object.keys(quote.payload).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Payload Snapshot</p>
                    <pre className="text-[11px] bg-background border rounded p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(quote.payload, null, 2)}</pre>
                  </div>
                )}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Attached Files</p>
                  {attachedFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No files attached to this document yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {attachedFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between gap-3 rounded border bg-background px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{file.fileName}</p>
                            <p className="text-muted-foreground">
                              {file.fileCategory || 'support_file'} · {file.fileType} · {new Date(file.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              const url = await getQuoteFileUrl(file.storagePath);
                              if (!url) {
                                toast.error('Unable to load the file');
                                return;
                              }
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            Open
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}
        </Fragment>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 w-6"></th>
              {['Job ID', 'Date', 'Type', 'Client', 'Sales Rep', 'Building', 'Total', 'Workflow', 'Status', 'Actions'].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{renderRows(activeQuotes)}</tbody>
        </table>
      </div>

      <div className="pt-6 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-muted-foreground">Recently Deleted</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowTrash(!showTrash)} className="text-xs">
            {showTrash ? 'Hide Trash' : `Show Trash (${deletedQuotes.length})`}
          </Button>
        </div>
        {showTrash && (
          <div className="mt-4 bg-card border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-xs">
                  <th className="px-2 py-2 w-6"></th>
                  {['Job ID', 'Date', 'Type', 'Client', 'Sales Rep', 'Building', 'Total', 'Workflow', 'Status', 'Actions'].map(header => (
                    <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderRows(deletedQuotes, true)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
