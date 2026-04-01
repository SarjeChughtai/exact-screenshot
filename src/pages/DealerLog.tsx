import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, LayoutGrid, List, Plus, Store } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';
import { supabase } from '@/integrations/supabase/client';
import {
  buildDealerWorkspaceRows,
  DEALER_PROJECT_STAGE_META,
  type DealerProjectStage,
} from '@/lib/dealerProjectTracker';
import { getQuoteFileUrl } from '@/lib/quoteFileStorage';
import { quoteFileFromRow } from '@/lib/supabaseMappers';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { QuoteFileRecord } from '@/types';

type DealerWorkspaceView = 'table' | 'cards';
type DealerStageFilter = DealerProjectStage | 'all';

const STAGE_BADGE_CLASS: Record<DealerProjectStage, string> = {
  request_submitted: 'bg-slate-100 text-slate-700',
  estimating: 'bg-amber-100 text-amber-800',
  quote_ready: 'bg-blue-100 text-blue-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
  in_production: 'bg-violet-100 text-violet-700',
  freight_booked: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
};

const STAGE_OPTIONS = Object.keys(DEALER_PROJECT_STAGE_META) as DealerProjectStage[];

function isDealerWorkspaceView(value: string | null): value is DealerWorkspaceView {
  return value === 'table' || value === 'cards';
}

function isDealerProjectStage(value: string | null): value is DealerProjectStage {
  return Boolean(value) && STAGE_OPTIONS.includes(value as DealerProjectStage);
}

function formatLatestActivity(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function DealerLog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { quotes, deals, opportunities, dealMilestones } = useAppContext();
  const { user } = useAuth();
  const { hasAnyRole } = useRoles();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [filesByJobId, setFilesByJobId] = useState<Record<string, QuoteFileRecord[]>>({});

  const isAdminView = hasAnyRole('admin', 'owner');
  const stageFilter: DealerStageFilter = isDealerProjectStage(searchParams.get('stage'))
    ? searchParams.get('stage') as DealerProjectStage
    : 'all';
  const searchValue = searchParams.get('search') || '';
  const viewMode: DealerWorkspaceView = isDealerWorkspaceView(searchParams.get('view'))
    ? searchParams.get('view') as DealerWorkspaceView
    : 'cards';

  const rows = useMemo(() => buildDealerWorkspaceRows({
    quotes,
    deals,
    opportunities,
    dealMilestones,
    filesByJobId,
    dealerUserId: user?.id,
    isAdminView,
  }), [dealMilestones, deals, filesByJobId, isAdminView, opportunities, quotes, user?.id]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return rows.filter(row => {
      if (stageFilter !== 'all' && row.stage !== stageFilter) return false;
      if (!normalizedSearch) return true;

      return [
        row.request.jobId,
        row.request.clientName,
        row.request.jobName,
      ].some(value => (value || '').toLowerCase().includes(normalizedSearch));
    });
  }, [rows, searchValue, stageFilter]);

  const stageCounts = useMemo(() => {
    return rows.reduce<Record<DealerProjectStage, number>>((accumulator, row) => {
      accumulator[row.stage] = (accumulator[row.stage] || 0) + 1;
      return accumulator;
    }, {
      request_submitted: 0,
      estimating: 0,
      quote_ready: 0,
      won: 0,
      lost: 0,
      in_production: 0,
      freight_booked: 0,
      delivered: 0,
    });
  }, [rows]);

  const requestJobIds = useMemo(
    () => [...new Set(rows.map(row => row.request.jobId).filter(Boolean))].sort(),
    [rows],
  );

  useEffect(() => {
    if (requestJobIds.length === 0) {
      setFilesByJobId({});
      return;
    }

    void (async () => {
      const { data, error } = await (supabase.from as any)('quote_files')
        .select('*')
        .in('job_id', requestJobIds)
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
  }, [requestJobIds]);

  const updateSearchParam = (key: 'stage' | 'search' | 'view', value?: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!value || value === 'all' || value === 'cards') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const openStorageFile = async (id: string, storagePath: string, errorMessage: string) => {
    setOpeningDocumentId(id);
    try {
      const signedUrl = await getQuoteFileUrl(storagePath);
      if (!signedUrl) {
        toast.error(errorMessage);
        return;
      }
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningDocumentId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="dealer-log-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Store className="h-6 w-6" />
            {t('dealerLog.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dealerLog.subtitle', { count: filteredRows.length })}
          </p>
        </div>
        <Button onClick={() => navigate('/dealer-rfq')} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('dealerLog.addRfq')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={stageFilter} onValueChange={value => updateSearchParam('stage', value)}>
          <SelectTrigger className="w-52" data-testid="dealer-stage-filter">
            <SelectValue placeholder={t('dealerLog.filters.stageLabel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('dealerLog.filters.allStages')}</SelectItem>
            {STAGE_OPTIONS.map(stage => (
              <SelectItem key={stage} value={stage}>
                {DEALER_PROJECT_STAGE_META[stage].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-80"
          data-testid="dealer-search-input"
          placeholder={t('dealerLog.filters.searchPlaceholder')}
          value={searchValue}
          onChange={event => updateSearchParam('search', event.target.value)}
        />
        <div className="inline-flex rounded-md border bg-card p-1">
          <Button
            type="button"
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 gap-1"
            data-testid="dealer-view-cards"
            onClick={() => updateSearchParam('view', 'cards')}
          >
            <LayoutGrid className="h-4 w-4" />
            {t('dealerLog.filters.cardsView')}
          </Button>
          <Button
            type="button"
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 gap-1"
            data-testid="dealer-view-table"
            onClick={() => updateSearchParam('view', 'table')}
          >
            <List className="h-4 w-4" />
            {t('dealerLog.filters.tableView')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {STAGE_OPTIONS.map(stage => {
          const meta = DEALER_PROJECT_STAGE_META[stage];
          const isSelected = stageFilter === stage;
          return (
            <button
              key={stage}
              type="button"
              className={`rounded-lg border bg-card p-3 text-left transition hover:border-primary ${isSelected ? 'border-primary ring-1 ring-primary/20' : ''}`}
              onClick={() => updateSearchParam('stage', isSelected ? 'all' : stage)}
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
              <p className="mt-2 text-2xl font-semibold">{stageCounts[stage] || 0}</p>
            </button>
          );
        })}
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('dealerLog.noRequests')}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 xl:grid-cols-3 lg:grid-cols-2" data-testid="dealer-cards-view">
          {filteredRows.map(row => {
            const latestStatus = row.latestSalesQuote?.status || row.deal?.dealStatus || row.request.workflowStatus;
            return (
              <div
                key={row.request.id}
                className="rounded-lg border bg-card p-4"
                data-testid={`dealer-workspace-${row.request.jobId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">{row.request.jobId}</p>
                    <p className="mt-1 font-semibold">{row.request.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.request.jobName || t('dealerLog.workspace.noJobName')}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${STAGE_BADGE_CLASS[row.stage]}`}>
                    {DEALER_PROJECT_STAGE_META[row.stage].label}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('dealerLog.workspace.latestQuoteStatus')}</p>
                    <p className="mt-1 font-medium">{latestStatus || t('dealerLog.workspace.requestOnly')}</p>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('dealerLog.workspace.latestUpdate')}</p>
                    <p className="mt-1 font-medium">{formatLatestActivity(row.latestActivityAt)}</p>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2 sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('dealerLog.workspace.nextAction')}</p>
                    <p className="mt-1 font-medium">{row.nextDealerAction}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-md border bg-background p-3 text-xs">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                      {t('dealerLog.workspace.pdfs', { count: row.documentSummary.pdfCount })}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                      {t('dealerLog.workspace.supportFiles', { count: row.documentSummary.supportFileCount })}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {t('dealerLog.workspace.primaryVisibleSets', { count: row.documentSummary.primaryVisibleSetCount })}
                    </span>
                    {row.documentSummary.hiddenDuplicateCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                        {t('dealerLog.workspace.hiddenDuplicates', { count: row.documentSummary.hiddenDuplicateCount })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {row.documentSummary.latestPdfQuote?.pdfStoragePath && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openStorageFile(
                        `dealer-pdf-${row.request.jobId}`,
                        row.documentSummary.latestPdfQuote!.pdfStoragePath!,
                        t('dealerLog.workspace.openPdfError'),
                      )}
                      disabled={openingDocumentId === `dealer-pdf-${row.request.jobId}`}
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      {openingDocumentId === `dealer-pdf-${row.request.jobId}`
                        ? t('dealerLog.workspace.opening')
                        : t('dealerLog.workspace.openLatestPdf')}
                    </Button>
                  )}
                  {row.documentSummary.latestSupportFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openStorageFile(
                        row.documentSummary.latestSupportFile!.id,
                        row.documentSummary.latestSupportFile!.storagePath,
                        t('dealerLog.workspace.openFileError'),
                      )}
                      disabled={openingDocumentId === row.documentSummary.latestSupportFile.id}
                    >
                      {openingDocumentId === row.documentSummary.latestSupportFile.id
                        ? t('dealerLog.workspace.opening')
                        : t('dealerLog.workspace.openSupportFile')}
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => navigate('/dealer-rfq')}>
                    {t('dealerLog.workspace.createRfq')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card" data-testid="dealer-table-view">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-xs text-primary-foreground">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('dealerLog.headers.date')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Job ID</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('dealerLog.headers.client')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('dealerLog.workspace.currentStage')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('dealerLog.workspace.latestQuoteStatus')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('dealerLog.workspace.nextAction')}</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{t('dealerLog.workspace.latestUpdate')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const latestStatus = row.latestSalesQuote?.status || row.deal?.dealStatus || row.request.workflowStatus;
                const payload = (row.request.payload || {}) as Record<string, any>;
                const isExpanded = expandedJobId === row.request.jobId;

                return (
                  <Fragment key={row.request.id}>
                    <tr
                      className="cursor-pointer border-b hover:bg-muted/50"
                      data-testid={`dealer-workspace-${row.request.jobId}`}
                      onClick={() => setExpandedJobId(current => current === row.request.jobId ? null : row.request.jobId)}
                    >
                      <td className="px-3 py-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2 text-xs">{new Date(row.request.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.request.jobId}</td>
                      <td className="px-3 py-2">{row.request.clientName}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STAGE_BADGE_CLASS[row.stage]}`}>
                          {DEALER_PROJECT_STAGE_META[row.stage].label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{latestStatus || t('dealerLog.workspace.requestOnly')}</td>
                      <td className="px-3 py-2 text-xs">{row.nextDealerAction}</td>
                      <td className="px-3 py-2 text-xs">{formatLatestActivity(row.latestActivityAt)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
                            <div className="rounded-md border bg-background p-4">
                              <p className="text-sm font-semibold">{t('dealerLog.workspace.projectTracker')}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {DEALER_PROJECT_STAGE_META[row.stage].description}
                              </p>
                              <div className="mt-3 space-y-1 text-xs">
                                <p>{t('dealerLog.workspace.currentStage')}: <span className="font-medium">{DEALER_PROJECT_STAGE_META[row.stage].label}</span></p>
                                <p>{t('dealerLog.workspace.opportunity')}: <span className="font-medium capitalize">{row.opportunity?.status || 'open'}</span></p>
                                <p>{t('dealerLog.workspace.dealStatus')}: <span className="font-medium">{row.deal?.dealStatus || t('dealerLog.workspace.notConverted')}</span></p>
                                <p>{t('dealerLog.workspace.production')}: <span className="font-medium">{row.deal?.productionStatus || t('dealerLog.workspace.notStarted')}</span></p>
                                <p>{t('dealerLog.workspace.freight')}: <span className="font-medium">{row.deal?.freightStatus || t('dealerLog.workspace.notBooked')}</span></p>
                                <p>{t('dealerLog.workspace.latestQuoteStatus')}: <span className="font-medium">{latestStatus || t('dealerLog.workspace.requestOnly')}</span></p>
                                <p>{t('dealerLog.workspace.nextAction')}: <span className="font-medium">{row.nextDealerAction}</span></p>
                                <p>{t('dealerLog.workspace.latestUpdate')}: <span className="font-medium">{formatLatestActivity(row.latestActivityAt)}</span></p>
                                <p>{t('dealerLog.workspace.primaryVisibleSets', { count: row.documentSummary.primaryVisibleSetCount })}</p>
                                <p>{t('dealerLog.workspace.hiddenDuplicates', { count: row.documentSummary.hiddenDuplicateCount })}</p>
                                <p>{t('dealerLog.workspace.roofPitch')}: <span className="font-medium">{String(payload.roofPitch || payload.roof_pitch || '—')}</span></p>
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-4">
                              <p className="text-sm font-semibold">{t('dealerLog.workspace.availableDocuments')}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t('dealerLog.workspace.availableDocumentsSubtitle')}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                                  {t('dealerLog.workspace.pdfs', { count: row.documentSummary.pdfCount })}
                                </span>
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                                  {t('dealerLog.workspace.supportFiles', { count: row.documentSummary.supportFileCount })}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  {t('dealerLog.workspace.primaryVisibleSets', { count: row.documentSummary.primaryVisibleSetCount })}
                                </span>
                                {row.documentSummary.hiddenDuplicateCount > 0 && (
                                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                                    {t('dealerLog.workspace.hiddenDuplicates', { count: row.documentSummary.hiddenDuplicateCount })}
                                  </span>
                                )}
                              </div>
                              {row.documents.length === 0 && row.documentSummary.supportFiles.length === 0 ? (
                                <div className="mt-3 rounded-md border border-dashed px-4 py-6 text-xs text-muted-foreground">
                                  {t('dealerLog.workspace.noVisibleFiles')}
                                </div>
                              ) : (
                                <div className="mt-3 space-y-3">
                                  {row.documents.length > 0 && (
                                    <div className="space-y-2">
                                      {row.documents.map(document => (
                                        <div key={document.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="font-medium">{document.label}</p>
                                              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                                PDF
                                              </span>
                                            </div>
                                            <p className="truncate text-muted-foreground">{document.pdfFileName}</p>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="gap-1"
                                            disabled={openingDocumentId === document.id}
                                            onClick={event => {
                                              event.stopPropagation();
                                              void openStorageFile(document.id, document.pdfStoragePath, t('dealerLog.workspace.openPdfError'));
                                            }}
                                          >
                                            <FileText className="h-3.5 w-3.5" />
                                            {openingDocumentId === document.id
                                              ? t('dealerLog.workspace.opening')
                                              : t('dealerLog.workspace.openLatestPdf')}
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {row.documentSummary.supportFiles.length > 0 && (
                                    <div className="space-y-2">
                                      {row.documentSummary.supportFiles.map(file => (
                                        <div key={file.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="truncate font-medium">{file.fileName}</p>
                                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                                {t('dealerLog.workspace.primaryVisibleSet')}
                                              </span>
                                            </div>
                                            <p className="truncate text-muted-foreground">
                                              {file.fileType} | {new Date(file.createdAt).toLocaleString()}
                                            </p>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={openingDocumentId === file.id}
                                            onClick={event => {
                                              event.stopPropagation();
                                              void openStorageFile(file.id, file.storagePath, t('dealerLog.workspace.openFileError'));
                                            }}
                                          >
                                            {openingDocumentId === file.id
                                              ? t('dealerLog.workspace.opening')
                                              : t('dealerLog.workspace.openSupportFile')}
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex justify-end">
                                    <Button type="button" variant="outline" size="sm" onClick={() => navigate('/dealer-rfq')}>
                                      {t('dealerLog.workspace.createRfq')}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
