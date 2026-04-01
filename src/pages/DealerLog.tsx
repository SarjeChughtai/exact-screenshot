import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Store, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  buildDealerProjectDocuments,
  DEALER_PROJECT_STAGE_META,
  deriveDealerProjectStage,
  type DealerProjectStage,
} from '@/lib/dealerProjectTracker';
import { buildJobDocumentVaultSummary } from '@/lib/documentVault';
import { getQuoteFileUrl } from '@/lib/quoteFileStorage';
import { quoteFileFromRow } from '@/lib/supabaseMappers';
import type { QuoteFileRecord } from '@/types';

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

export default function DealerLog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { quotes, deals, opportunities, dealMilestones } = useAppContext();
  const { user } = useAuth();
  const { hasAnyRole } = useRoles();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [filesByJobId, setFilesByJobId] = useState<Record<string, QuoteFileRecord[]>>({});

  const isAdminView = hasAnyRole('admin', 'owner');

  const requests = useMemo(() => {
    return quotes
      .filter(quote => quote.documentType === 'dealer_rfq' && !quote.isDeleted)
      .filter(quote => isAdminView || quote.createdByUserId === user?.id)
      .map(request => {
        const relatedQuotes = quotes.filter(quote =>
          quote.jobId === request.jobId
          && quote.id !== request.id
          && !quote.isDeleted,
        );
        const deal = deals.find(item => item.jobId === request.jobId) || null;
        const opportunity = opportunities.find(item => item.jobId === request.jobId) || null;
        const milestones = dealMilestones.filter(item => item.jobId === request.jobId);
        const stage = deriveDealerProjectStage({ request, relatedQuotes, deal, opportunity, milestones });

        return {
          request,
          relatedQuotes,
          deal,
          opportunity,
          milestones,
          stage,
          documents: buildDealerProjectDocuments(request, relatedQuotes),
        };
      })
      .sort((left, right) => new Date(right.request.date).getTime() - new Date(left.request.date).getTime());
  }, [dealMilestones, deals, isAdminView, opportunities, quotes, user?.id]);

  const stageCounts = useMemo(() => {
    return requests.reduce<Record<DealerProjectStage, number>>((accumulator, entry) => {
      accumulator[entry.stage] = (accumulator[entry.stage] || 0) + 1;
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
  }, [requests]);

  const requestJobIds = useMemo(
    () => [...new Set(requests.map(entry => entry.request.jobId).filter(Boolean))].sort(),
    [requests],
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

  const handleOpenPdf = async (documentId: string, storagePath: string) => {
    setOpeningDocumentId(documentId);
    try {
      const signedUrl = await getQuoteFileUrl(storagePath);
      if (!signedUrl) {
        toast.error('Could not open this PDF.');
        return;
      }
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningDocumentId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" />
            {t('dealerLog.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('dealerLog.subtitle', { count: requests.length })}
          </p>
        </div>
        <Button onClick={() => navigate('/dealer-rfq')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('dealerLog.addRfq')}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Object.entries(DEALER_PROJECT_STAGE_META).map(([key, meta]) => (
          <div key={key} className="rounded-lg border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
            <p className="mt-2 text-2xl font-semibold">{stageCounts[key as DealerProjectStage] || 0}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-3 py-2 w-8"></th>
              {[
                t('dealerLog.headers.date'),
                'Job ID',
                t('dealerLog.headers.client'),
                t('dealerLog.headers.location'),
                t('dealerLog.headers.dimensions'),
                'Project Stage',
                t('dealerLog.headers.status'),
                t('dealerLog.headers.notes'),
              ].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  {t('dealerLog.noRequests')}
                </td>
              </tr>
            ) : requests.map(entry => {
              const { request, relatedQuotes, deal, opportunity, stage, documents } = entry;
              const documentSummary = buildJobDocumentVaultSummary({
                jobId: request.jobId,
                quotes: [request, ...relatedQuotes],
                files: filesByJobId[request.jobId] || [],
              });
              const dealerSupportFiles = documentSummary.supportFiles;
              const payload = (request.payload || {}) as Record<string, any>;
              const isExpanded = expandedJobId === request.jobId;
              const latestQuote = relatedQuotes
                .filter(quote => quote.documentType === 'external_quote')
                .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];

              return (
                <>
                  <tr
                    key={request.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => setExpandedJobId(current => current === request.jobId ? null : request.jobId)}
                  >
                    <td className="px-3 py-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-3 py-2 text-xs">{new Date(request.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{request.jobId}</td>
                    <td className="px-3 py-2">{request.clientName}</td>
                    <td className="px-3 py-2 text-xs">{[request.city, request.province].filter(Boolean).join(', ') || '-'}</td>
                    <td className="px-3 py-2 text-xs">{request.width}x{request.length}x{request.height}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${STAGE_BADGE_CLASS[stage]}`}>
                        {DEALER_PROJECT_STAGE_META[stage].label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                        {latestQuote?.status || deal?.dealStatus || request.workflowStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[240px] truncate">{payload.notes || '-'}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${request.id}-detail`} className="bg-muted/20">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
                          <div className="rounded-md border bg-background p-4">
                            <p className="text-sm font-semibold">Project Tracker</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {DEALER_PROJECT_STAGE_META[stage].description}
                            </p>
                            <div className="mt-3 space-y-1 text-xs">
                              <p>Opportunity: <span className="font-medium capitalize">{opportunity?.status || 'open'}</span></p>
                              <p>Deal Status: <span className="font-medium">{deal?.dealStatus || 'Not converted'}</span></p>
                              <p>Production: <span className="font-medium">{deal?.productionStatus || 'Not started'}</span></p>
                              <p>Freight: <span className="font-medium">{deal?.freightStatus || 'Not booked'}</span></p>
                              <p>Primary File Sets: <span className="font-medium">{documentSummary.visibleFiles.length}</span></p>
                              <p>Hidden Duplicates: <span className="font-medium">{documentSummary.hiddenDuplicateCount}</span></p>
                              <p>Roof Pitch: <span className="font-medium">{String(payload.roofPitch || payload.roof_pitch || '-')}</span></p>
                            </div>
                          </div>
                          <div className="rounded-md border bg-background p-4">
                            <p className="text-sm font-semibold">Available Documents</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Current PDFs and dealer-visible support files attached to this project.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                                PDFs: {documents.length}
                              </span>
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                                Support files: {dealerSupportFiles.length}
                              </span>
                              {documentSummary.hiddenDuplicateCount > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                                  Hidden duplicates: {documentSummary.hiddenDuplicateCount}
                                </span>
                              )}
                            </div>
                            {documents.length === 0 && dealerSupportFiles.length === 0 ? (
                              <div className="mt-3 rounded-md border border-dashed px-4 py-6 text-xs text-muted-foreground">
                                No visible project files are attached yet.
                              </div>
                            ) : (
                              <div className="mt-3 space-y-3">
                                {documents.length > 0 && (
                                  <div className="space-y-2">
                                    {documents.map(document => (
                                      <div key={document.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium">{document.label}</p>
                                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                              PDF
                                            </span>
                                          </div>
                                          <p className="text-muted-foreground truncate">{document.pdfFileName}</p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="gap-1"
                                          disabled={openingDocumentId === document.id}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleOpenPdf(document.id, document.pdfStoragePath);
                                          }}
                                        >
                                          <FileText className="h-3.5 w-3.5" />
                                          {openingDocumentId === document.id ? 'Opening...' : 'Open PDF'}
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {dealerSupportFiles.length > 0 && (
                                  <div className="space-y-2">
                                    {dealerSupportFiles.map(file => (
                                      <div key={file.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium truncate">{file.fileName}</p>
                                            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                              Primary visible set
                                            </span>
                                          </div>
                                          <p className="text-muted-foreground truncate">
                                            {file.fileType} | {new Date(file.createdAt).toLocaleString()}
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={async (event) => {
                                            event.stopPropagation();
                                            const signedUrl = await getQuoteFileUrl(file.storagePath);
                                            if (!signedUrl) {
                                              toast.error('Could not open this file.');
                                              return;
                                            }
                                            window.open(signedUrl, '_blank', 'noopener,noreferrer');
                                          }}
                                        >
                                          Open File
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
