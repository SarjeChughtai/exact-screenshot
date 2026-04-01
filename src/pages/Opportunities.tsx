import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, FileText, LayoutGrid, List, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { buildJobDocumentVaultSummary } from '@/lib/documentVault';
import { useSharedJobs } from '@/lib/sharedJobs';
import { supabase } from '@/integrations/supabase/client';
import { buildOpportunityWorkspaceRows, summarizeOpportunities } from '@/lib/opportunityWorkspace';
import { formatCurrency } from '@/lib/calculations';
import { getQuoteFileUrl } from '@/lib/quoteFileStorage';
import { quoteFileFromRow } from '@/lib/supabaseMappers';
import type { OpportunityStatus, QuoteFileRecord } from '@/types';
import { toast } from 'sonner';

const STATUS_OPTIONS: OpportunityStatus[] = ['open', 'won', 'lost', 'abandoned'];

export default function Opportunities() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    opportunities,
    quotes,
    deals,
    dealMilestones,
    updateOpportunityByJob,
  } = useAppContext();
  const { hasAnyRole } = useRoles();
  const { visibleJobIds } = useSharedJobs();
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>((searchParams.get('status') as OpportunityStatus | 'all') || 'all');
  const [search, setSearch] = useState(searchParams.get('jobId') || '');
  const [editingRevenueJobId, setEditingRevenueJobId] = useState<string | null>(null);
  const [editingRevenueValue, setEditingRevenueValue] = useState('');
  const [filesByJobId, setFilesByJobId] = useState<Record<string, QuoteFileRecord[]>>({});
  const [openingPdfJobId, setOpeningPdfJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');

  useEffect(() => {
    const nextStatus = (searchParams.get('status') as OpportunityStatus | 'all') || 'all';
    const nextJobId = searchParams.get('jobId') || '';
    setStatusFilter(nextStatus);
    setSearch(nextJobId);
  }, [searchParams]);

  const canEdit = hasAnyRole('admin', 'owner', 'operations', 'sales_rep');

  const rows = useMemo(() => {
    const baseRows = buildOpportunityWorkspaceRows({
      opportunities,
      quotes,
      deals,
      dealMilestones,
      visibleJobIds,
    });

    return baseRows.filter(row => {
      if (statusFilter !== 'all' && row.opportunity.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const normalized = search.trim().toLowerCase();
      return [
        row.opportunity.jobId,
        row.opportunity.clientName,
        row.opportunity.name,
        row.opportunity.salesRep,
        row.opportunity.estimator,
      ].some(value => (value || '').toLowerCase().includes(normalized));
    });
  }, [dealMilestones, deals, opportunities, quotes, search, statusFilter, visibleJobIds]);

  const summary = useMemo(() => summarizeOpportunities(rows.map(row => row.opportunity)), [rows]);
  const totalPipeline = useMemo(() => rows.reduce((sum, row) => sum + (row.opportunity.potentialRevenue || 0), 0), [rows]);
  const rowJobIds = useMemo(() => [...new Set(rows.map(row => row.opportunity.jobId).filter(Boolean))].sort(), [rows]);
  const documentSummaryByJobId = useMemo(() => {
    return rows.reduce<Record<string, ReturnType<typeof buildJobDocumentVaultSummary>>>((accumulator, row) => {
      accumulator[row.opportunity.jobId] = buildJobDocumentVaultSummary({
        jobId: row.opportunity.jobId,
        quotes: row.relatedQuotes,
        files: filesByJobId[row.opportunity.jobId] || [],
      });
      return accumulator;
    }, {});
  }, [filesByJobId, rows]);
  const rowsByStatus = useMemo(() => {
    return STATUS_OPTIONS.reduce<Record<OpportunityStatus, typeof rows>>((accumulator, status) => {
      accumulator[status] = rows.filter(row => row.opportunity.status === status);
      return accumulator;
    }, {
      open: [],
      won: [],
      lost: [],
      abandoned: [],
    });
  }, [rows]);

  useEffect(() => {
    if (rowJobIds.length === 0) {
      setFilesByJobId({});
      return;
    }

    void (async () => {
      const { data, error } = await (supabase.from as any)('quote_files')
        .select('*')
        .in('job_id', rowJobIds)
        .order('created_at', { ascending: false });

      if (error) return;

      const grouped = (data || [])
        .map((row: any) => quoteFileFromRow(row))
        .reduce<Record<string, QuoteFileRecord[]>>((accumulator, file) => {
          const key = file.jobId || '';
          if (!key) return accumulator;
          accumulator[key] = [...(accumulator[key] || []), file];
          return accumulator;
        }, {});

      setFilesByJobId(grouped);
    })();
  }, [rowJobIds]);

  const startRevenueEdit = (jobId: string, currentValue: number) => {
    setEditingRevenueJobId(jobId);
    setEditingRevenueValue(String(currentValue || 0));
  };

  const commitRevenueEdit = async (jobId: string) => {
    await updateOpportunityByJob(jobId, { potentialRevenue: Number(editingRevenueValue) || 0 });
    setEditingRevenueJobId(null);
    setEditingRevenueValue('');
  };

  const openLatestPdf = async (jobId: string) => {
    const row = rows.find(item => item.opportunity.jobId === jobId);
    const quote = row?.latestQuote?.pdfStoragePath ? row.latestQuote : null;
    if (!quote?.pdfStoragePath) {
      toast.error('No saved PDF is attached to this opportunity yet.');
      return;
    }

    setOpeningPdfJobId(jobId);
    try {
      const url = await getQuoteFileUrl(quote.pdfStoragePath);
      if (!url) {
        toast.error('Unable to load the saved PDF.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningPdfJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Opportunities
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Portal-native CRM view spanning RFQs, quotes, deals, and post-sale readiness.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Open</p>
          <p className="mt-2 text-2xl font-semibold">{summary.open}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Won</p>
          <p className="mt-2 text-2xl font-semibold">{summary.won}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lost</p>
          <p className="mt-2 text-2xl font-semibold">{summary.lost}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Abandoned</p>
          <p className="mt-2 text-2xl font-semibold">{summary.abandoned}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible Pipeline</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalPipeline)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={value => setStatusFilter(value as OpportunityStatus | 'all')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-72"
          placeholder="Search job, client, owner, estimator..."
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <div className="inline-flex rounded-md border bg-card p-1">
          <Button
            type="button"
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 gap-1"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
            Table
          </Button>
          <Button
            type="button"
            variant={viewMode === 'board' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 gap-1"
            onClick={() => setViewMode('board')}
          >
            <LayoutGrid className="h-4 w-4" />
            Board
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID', 'Client', 'Opportunity', 'Status', 'Potential Revenue', 'Source', 'Latest Document', 'Docs', 'Owner', 'Next Step', 'Actions'].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No opportunities in this view.</td></tr>
            ) : rows.map(row => (
              <tr key={row.opportunity.jobId} className="border-b hover:bg-muted/50">
                {(() => {
                  const documentSummary = documentSummaryByJobId[row.opportunity.jobId];
                  return (
                    <>
                <td className="px-3 py-2 font-mono text-xs">{row.opportunity.jobId}</td>
                <td className="px-3 py-2">{row.opportunity.clientName}</td>
                <td className="px-3 py-2">
                  <div>
                    <p className="font-medium">{row.opportunity.name || row.opportunity.jobId}</p>
                    <p className="text-xs text-muted-foreground">{row.relatedQuotes.length} linked document{row.relatedQuotes.length === 1 ? '' : 's'}</p>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Select
                      value={row.opportunity.status}
                      onValueChange={value => void updateOpportunityByJob(row.opportunity.jobId, { status: value as OpportunityStatus })}
                    >
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="capitalize">{row.opportunity.status}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">
                  {canEdit && editingRevenueJobId === row.opportunity.jobId ? (
                    <Input
                      autoFocus
                      className="h-7 w-32"
                      value={editingRevenueValue}
                      onChange={event => setEditingRevenueValue(event.target.value)}
                      onBlur={() => void commitRevenueEdit(row.opportunity.jobId)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void commitRevenueEdit(row.opportunity.jobId);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => canEdit && startRevenueEdit(row.opportunity.jobId, row.opportunity.potentialRevenue)}
                    >
                      {formatCurrency(row.opportunity.potentialRevenue || 0)}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{row.opportunity.source}</td>
                <td className="px-3 py-2 text-xs">
                  {row.latestQuote ? `${row.latestQuote.documentType} / ${row.latestQuote.workflowStatus}` : row.deal ? `deal / ${row.deal.dealStatus}` : '-'}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>
                    <p>{documentSummary.pdfQuotes.length} PDFs</p>
                    <p className="text-muted-foreground">
                      {documentSummary.visibleFiles.length} visible sets
                      {documentSummary.hiddenDuplicateCount > 0 ? ` / ${documentSummary.hiddenDuplicateCount} hidden` : ''}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>
                    <p>{row.opportunity.salesRep || 'Unassigned'}</p>
                    <p className="text-muted-foreground">{row.opportunity.estimator || 'No estimator'}</p>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>
                    <p>{row.nextStep}</p>
                    {row.freightReady && <p className="text-green-700">Freight ready</p>}
                  </div>
                </td>
                <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                    {row.latestQuote && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => navigate(`/quote-log?documentId=${row.latestQuote?.id}&view=log`)}
                      >
                        Open Log
                      </Button>
                    )}
                    {documentSummary.latestPdfQuote && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => void openLatestPdf(row.opportunity.jobId)}
                        disabled={openingPdfJobId === row.opportunity.jobId}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        {openingPdfJobId === row.opportunity.jobId ? 'Opening...' : 'Open PDF'}
                      </Button>
                    )}
                    {row.deal ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => navigate(`/deals?jobId=${encodeURIComponent(row.opportunity.jobId)}`)}
                      >
                        Open Deal
                      </Button>
                    ) : row.latestQuote?.documentType === 'external_quote' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => navigate(`/freight?freightMode=pre_sale&freightJobId=${encodeURIComponent(row.opportunity.jobId)}`)}
                      >
                        Freight Estimate
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => navigate(`/messages?dealJobId=${row.opportunity.jobId}`)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      Chat
                    </Button>
                  </div>
                </td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {STATUS_OPTIONS.map(status => (
            <div key={status} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold capitalize">{status}</p>
                  <p className="text-xs text-muted-foreground">{rowsByStatus[status].length} opportunities</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
                  {formatCurrency(rowsByStatus[status].reduce((sum, row) => sum + (row.opportunity.potentialRevenue || 0), 0))}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {rowsByStatus[status].length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
                    No opportunities.
                  </div>
                ) : rowsByStatus[status].map(row => {
                  const documentSummary = documentSummaryByJobId[row.opportunity.jobId];
                  return (
                    <div key={row.opportunity.jobId} className="rounded-md border bg-background p-3 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px]">{row.opportunity.jobId}</p>
                          <p className="mt-1 font-medium">{row.opportunity.clientName}</p>
                          <p className="text-muted-foreground truncate">{row.opportunity.name || row.opportunity.jobId}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700">
                          {formatCurrency(row.opportunity.potentialRevenue || 0)}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-muted-foreground">
                        <p>Source: {row.opportunity.source || '-'}</p>
                        <p>Owner: {row.opportunity.salesRep || 'Unassigned'}</p>
                        <p>Next: {row.nextStep}</p>
                        <p>
                          Docs: {documentSummary?.pdfQuotes.length || 0} PDFs / {documentSummary?.visibleFiles.length || 0} visible
                          {documentSummary?.hiddenDuplicateCount ? ` / ${documentSummary.hiddenDuplicateCount} hidden` : ''}
                        </p>
                        {row.freightReady && <p className="text-green-700">Freight ready</p>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.latestQuote && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => navigate(`/quote-log?documentId=${row.latestQuote?.id}&view=log`)}
                          >
                            Open Log
                          </Button>
                        )}
                        {documentSummary?.latestPdfQuote && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => void openLatestPdf(row.opportunity.jobId)}
                            disabled={openingPdfJobId === row.opportunity.jobId}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            PDF
                          </Button>
                        )}
                        {row.deal ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => navigate(`/deals?jobId=${encodeURIComponent(row.opportunity.jobId)}`)}
                          >
                            Deal
                          </Button>
                        ) : row.latestQuote?.documentType === 'external_quote' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => navigate(`/freight?freightMode=pre_sale&freightJobId=${encodeURIComponent(row.opportunity.jobId)}`)}
                          >
                            Freight
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
