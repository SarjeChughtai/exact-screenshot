import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { quoteFileFromRow } from '@/lib/supabaseMappers';
import { getQuoteFileUrl, uploadQuoteFile } from '@/lib/quoteFileStorage';
import { isEstimatorAssignedToQuote } from '@/lib/rfqWorkflow';
import { getUserIdsForRole, notifyUsers } from '@/lib/workflowNotifications';
import type { Quote, QuoteFileRecord, WorkflowStatus } from '@/types';
import { toast } from 'sonner';

const SALES_QUEUE_STATUSES: WorkflowStatus[] = [
  'estimate_needed',
  'estimating',
  'estimate_complete',
  'internal_quote_in_progress',
  'internal_quote_ready',
  'external_quote_ready',
];

const ESTIMATOR_QUEUE_STATUSES: WorkflowStatus[] = ['estimate_needed', 'estimating'];
const OPERATIONS_QUEUE_STATUSES: WorkflowStatus[] = ['estimate_complete', 'internal_quote_in_progress'];

function formatWorkflowLabel(status: WorkflowStatus) {
  return status.replace(/_/g, ' ');
}

function QueueCard({
  quote,
  title,
  description,
  files,
  actions,
}: {
  quote: Quote;
  title: string;
  description: string;
  files: QuoteFileRecord[];
  actions: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">{formatWorkflowLabel(quote.workflowStatus)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-1 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Job:</span> {quote.jobId} {quote.jobName ? `- ${quote.jobName}` : ''}</p>
          <p><span className="font-medium text-foreground">Client:</span> {quote.clientName} ({quote.clientId || 'No client ID'})</p>
          <p><span className="font-medium text-foreground">Sales Rep:</span> {quote.salesRep || 'Unassigned'}</p>
          <p><span className="font-medium text-foreground">Estimator:</span> {quote.estimator || 'Unassigned'}</p>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Attached Cost Files</p>
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cost files uploaded yet.</p>
          ) : (
            <div className="space-y-1">
              {files.map(file => (
                <div key={file.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{file.fileName}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={async () => {
                      const url = await getQuoteFileUrl(file.storagePath);
                      if (!url) {
                        toast.error('Could not open file');
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
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      </CardContent>
    </Card>
  );
}

export function RFQWorkflowQueues() {
  const navigate = useNavigate();
  const { quotes, updateQuote } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { settings } = useSettings();
  const [filesByDocumentId, setFilesByDocumentId] = useState<Record<string, QuoteFileRecord[]>>({});

  const rfqDocuments = useMemo(
    () => quotes.filter(quote =>
      !quote.isDeleted &&
      (quote.documentType === 'rfq' || quote.documentType === 'dealer_rfq')
    ),
    [quotes],
  );

  const salesQueue = useMemo(() => (
    rfqDocuments.filter(quote =>
      SALES_QUEUE_STATUSES.includes(quote.workflowStatus) &&
      (
        hasAnyRole('admin', 'owner', 'operations') ||
        !hasAnyRole('sales_rep') ||
        quote.salesRep === currentUser.name ||
        quote.createdByUserId === currentUser.id
      )
    )
  ), [currentUser.id, currentUser.name, hasAnyRole, rfqDocuments]);

  const estimatorQueue = useMemo(() => (
    rfqDocuments.filter(quote =>
      ESTIMATOR_QUEUE_STATUSES.includes(quote.workflowStatus) &&
      isEstimatorAssignedToQuote(
        quote,
        currentUser.id,
        currentUser.name,
        hasAnyRole('admin', 'owner'),
      )
    )
  ), [currentUser.id, currentUser.name, hasAnyRole, rfqDocuments]);

  const operationsQueue = useMemo(() => (
    rfqDocuments.filter(quote => OPERATIONS_QUEUE_STATUSES.includes(quote.workflowStatus))
  ), [rfqDocuments]);

  useEffect(() => {
    const documentIds = rfqDocuments.map(quote => quote.id);
    if (documentIds.length === 0) {
      setFilesByDocumentId({});
      return;
    }

    void (async () => {
      const { data, error } = await (supabase.from as any)('quote_files')
        .select('*')
        .in('document_id', documentIds)
        .eq('file_category', 'cost_file')
        .order('created_at', { ascending: false });

      if (error) return;

      const mapped = (data || []).map((row: any) => quoteFileFromRow(row));
      const grouped = mapped.reduce<Record<string, QuoteFileRecord[]>>((accumulator, file) => {
        const key = file.documentId || '';
        if (!key) return accumulator;
        accumulator[key] = [...(accumulator[key] || []), file];
        return accumulator;
      }, {});
      setFilesByDocumentId(grouped);
    })();
  }, [rfqDocuments]);

  const linkedInternalQuoteBySourceId = useMemo(() => (
    new Map(
      quotes
        .filter(quote => !quote.isDeleted && quote.documentType === 'internal_quote' && quote.sourceDocumentId)
        .map(quote => [quote.sourceDocumentId as string, quote]),
    )
  ), [quotes]);

  const getPersonnelUserId = (role: 'sales_rep' | 'estimator', name: string) => (
    settings.personnel.find(person =>
      person.role === role && person.name.trim().toLowerCase() === name.trim().toLowerCase()
    )?.id
  );

  const uploadCostFiles = async (quote: Quote, selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return;

    for (const file of Array.from(selectedFiles)) {
      await uploadQuoteFile({
        file,
        fileType: 'unknown',
        fileCategory: 'cost_file',
        documentId: quote.id,
        jobId: quote.jobId,
        clientName: quote.clientName,
        clientId: quote.clientId,
        buildingLabel: 'Workflow Upload',
        extractionSource: 'unknown',
        reviewStatus: 'needs_review',
      });
    }

    const { data } = await (supabase.from as any)('quote_files')
      .select('*')
      .eq('document_id', quote.id)
      .eq('file_category', 'cost_file')
      .order('created_at', { ascending: false });

    setFilesByDocumentId(current => ({
      ...current,
      [quote.id]: (data || []).map((row: any) => quoteFileFromRow(row)),
    }));

    toast.success('Cost files uploaded');
  };

  if (!hasAnyRole('sales_rep', 'estimator', 'operations', 'admin', 'owner')) {
    return null;
  }

  return (
    <div className="space-y-6">
      {(hasAnyRole('sales_rep', 'admin', 'owner', 'operations')) && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Sales Queue</h3>
            <p className="text-xs text-muted-foreground">Track submitted RFQs as they move through estimating and internal quoting.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {salesQueue.length === 0 ? (
              <Card><CardContent className="py-6 text-sm text-muted-foreground">No active RFQs in the sales queue.</CardContent></Card>
            ) : salesQueue.map(quote => {
              const linkedInternal = linkedInternalQuoteBySourceId.get(quote.id);
              return (
                <QueueCard
                  key={`sales-${quote.id}`}
                  quote={quote}
                  title={quote.clientName}
                  description={`Submitted ${quote.documentType === 'dealer_rfq' ? 'dealer RFQ' : 'RFQ'} awaiting next step.`}
                  files={filesByDocumentId[quote.id] || []}
                  actions={
                    <>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/quote-rfq?quoteId=${quote.id}`)}>Open RFQ</Button>
                      {linkedInternal && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/quote-builder?sourceDocumentId=${linkedInternal.id}`)}>
                          Create External Quote
                        </Button>
                      )}
                      {linkedInternal?.pdfStoragePath && (
                        <Button size="sm" variant="outline" onClick={() => navigate('/internal-quote-log')}>
                          Review Internal Quote
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {(hasAnyRole('estimator', 'admin', 'owner')) && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Estimator Queue</h3>
            <p className="text-xs text-muted-foreground">Submitted RFQs waiting for cost files and estimator handoff.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {estimatorQueue.length === 0 ? (
              <Card><CardContent className="py-6 text-sm text-muted-foreground">No RFQs waiting on estimating.</CardContent></Card>
            ) : estimatorQueue.map(quote => (
              <QueueCard
                key={`estimator-${quote.id}`}
                quote={quote}
                title={quote.clientName}
                description="Upload cost files, then mark the RFQ ready for operations."
                files={filesByDocumentId[quote.id] || []}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await updateQuote(quote.id, {
                          workflowStatus: 'estimating',
                          assignedEstimatorUserId: currentUser.id,
                          updatedAt: new Date().toISOString(),
                        });
                        await notifyUsers({
                          userIds: [getPersonnelUserId('sales_rep', quote.salesRep)],
                          title: 'Estimator Started RFQ',
                          message: `${quote.jobId} for ${quote.clientName} is now in estimating.`,
                          link: '/quote-log',
                        });
                      }}
                    >
                      Start Estimate
                    </Button>
                    <label className="inline-flex">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={event => void uploadCostFiles(quote, event.target.files)}
                      />
                      <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm cursor-pointer bg-background hover:bg-muted">Upload Cost Files</span>
                    </label>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await updateQuote(quote.id, {
                          workflowStatus: 'estimate_complete',
                          assignedEstimatorUserId: currentUser.id,
                          updatedAt: new Date().toISOString(),
                        });
                        const operationsUserIds = await getUserIdsForRole('operations');
                        await notifyUsers({
                          userIds: [...operationsUserIds, getPersonnelUserId('sales_rep', quote.salesRep)],
                          title: 'Estimate Complete',
                          message: `${quote.jobId} for ${quote.clientName} is ready for internal quoting.`,
                          link: '/quote-log',
                        });
                      }}
                    >
                      Submit To Operations
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}

      {(hasAnyRole('operations', 'admin', 'owner')) && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Operations Queue</h3>
            <p className="text-xs text-muted-foreground">Estimate-complete RFQs waiting to be imported into the internal quote builder.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {operationsQueue.length === 0 ? (
              <Card><CardContent className="py-6 text-sm text-muted-foreground">No RFQs are waiting on operations.</CardContent></Card>
            ) : operationsQueue.map(quote => (
              <QueueCard
                key={`ops-${quote.id}`}
                quote={quote}
                title={quote.clientName}
                description="Import RFQ details and attached cost files into the internal quote builder."
                files={filesByDocumentId[quote.id] || []}
                actions={
                  <>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await updateQuote(quote.id, {
                          workflowStatus: 'internal_quote_in_progress',
                          assignedOperationsUserId: currentUser.id,
                          updatedAt: new Date().toISOString(),
                        });
                        await notifyUsers({
                          userIds: [getPersonnelUserId('sales_rep', quote.salesRep)],
                          title: 'Internal Quote In Progress',
                          message: `${quote.jobId} for ${quote.clientName} is being built by operations.`,
                          link: '/quote-log',
                        });
                        navigate(`/internal-quote-builder?sourceDocumentId=${quote.id}`);
                      }}
                    >
                      Build Internal Quote
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/quote-rfq?quoteId=${quote.id}`)}>Review RFQ</Button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
