import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { formatNumber, formatCurrency } from '@/lib/calculations';
import { buildJobDocumentVaultSummary } from '@/lib/documentVault';
import { useSharedJobs } from '@/lib/sharedJobs';
import { findJobProfile } from '@/lib/jobProfiles';
import { supabase } from '@/integrations/supabase/client';
import { getQuoteFileUrl } from '@/lib/quoteFileStorage';
import { quoteFileFromRow } from '@/lib/supabaseMappers';
import { JobIdSelect } from '@/components/JobIdSelect';
import { ClientSelect } from '@/components/ClientSelect';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronRight, Edit, Trash2, Plus, EyeOff, Eye, MessageSquare } from 'lucide-react';
import type { Deal, DealStatus, QuoteFileRecord } from '@/types';
import {
  DEAL_MILESTONE_DEFINITIONS,
  getDealFreightBlockedReason,
  getDealPostSaleNextStep,
  isDealFreightReady,
  summarizeDealMilestoneProgress,
} from '@/lib/opportunities';
import { toast } from 'sonner';
import { jobIdsMatch } from '@/lib/jobIds';

const DEAL_STATUS_LABELS: Record<string, string> = {
  Lead: 'Request for Quote',
};

const EMPTY_DEAL: Partial<Deal> = {
  jobId: '', jobName: '', clientName: '', clientId: '',
  salesRep: '', estimator: '', teamLead: '', province: 'ON',
  city: '', address: '', postalCode: '',
  width: 0, length: 0, height: 0,
  dealStatus: 'Lead',
};

function derivePaymentStage(count: number, stages: string[]) {
  if (!count || stages.length === 0) return '';
  return stages[Math.min(count, stages.length) - 1] || '';
}

export default function MasterDeals() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    deals,
    quotes,
    updateDeal,
    deleteDeal,
    addDeal,
    payments,
    internalCosts,
    opportunities,
    dealMilestones,
    upsertDealMilestone,
    jobProfiles,
  } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { settings } = useSettings();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRep, setFilterRep] = useState<string>('all');
  const [searchClient, setSearchClient] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [newDeal, setNewDeal] = useState<Partial<Deal>>(EMPTY_DEAL);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [pipelineView, setPipelineView] = useState(false);
  const [filesByJobId, setFilesByJobId] = useState<Record<string, QuoteFileRecord[]>>({});
  const { allJobs, visibleJobIds, stateByJobId } = useSharedJobs({ allowedStates: ['deal'] });

  const canEdit = hasAnyRole('admin', 'owner', 'operations');
  const isAdminOwner = hasAnyRole('admin', 'owner');
  const isSalesRep = !hasAnyRole('admin', 'owner', 'accounting', 'operations', 'freight');
  const canManageFreightWorkflow = hasAnyRole('admin', 'owner', 'operations', 'freight');

  const visibleDeals = deals.filter(deal =>
    visibleJobIds.has(deal.jobId) && stateByJobId[deal.jobId] === 'deal',
  );
  const visibleDealJobIds = useMemo(
    () => [...new Set(visibleDeals.map(deal => deal.jobId).filter(Boolean))].sort(),
    [visibleDeals],
  );

  const reps = [...new Set(visibleDeals.map(d => d.salesRep).filter(Boolean))];
  const cancelledCount = visibleDeals.filter(d => d.dealStatus === 'Cancelled').length;
  const filtered = visibleDeals.filter(d => {
    if (!showCancelled && d.dealStatus === 'Cancelled') return false;
    if (filterStatus !== 'all' && d.dealStatus !== filterStatus) return false;
    if (filterRep !== 'all' && d.salesRep !== filterRep) return false;
    if (searchClient && !d.clientName.toLowerCase().includes(searchClient.toLowerCase()) && !d.clientId.includes(searchClient) && !d.jobId.toLowerCase().includes(searchClient.toLowerCase())) return false;
    return true;
  });

  const pipelineStatuses = useMemo(
    () => settings.dealStatuses.filter(status => status !== 'Cancelled'),
    [settings.dealStatuses],
  );

  const pipelineDeals = useMemo(
    () => filtered.filter(deal => deal.dealStatus !== 'Cancelled'),
    [filtered],
  );

  const dealsByStatus = useMemo(() => (
    pipelineStatuses.reduce<Record<string, Deal[]>>((accumulator, status) => {
      accumulator[status] = pipelineDeals.filter(deal => deal.dealStatus === status);
      return accumulator;
    }, {})
  ), [pipelineDeals, pipelineStatuses]);

  const documentSummaryByJobId = useMemo(() => {
    return visibleDeals.reduce<Record<string, ReturnType<typeof buildJobDocumentVaultSummary>>>((accumulator, deal) => {
      accumulator[deal.jobId] = buildJobDocumentVaultSummary({
        jobId: deal.jobId,
        quotes: quotes.filter(quote => quote.jobId === deal.jobId),
        files: filesByJobId[deal.jobId] || [],
      });
      return accumulator;
    }, {});
  }, [filesByJobId, quotes, visibleDeals]);

  const toggle = (jobId: string) => setExpandedJob(prev => prev === jobId ? null : jobId);

  const applyProfileToDraft = (jobId: string, current: Partial<Deal>) => {
    const profile = findJobProfile(jobProfiles, jobId);
    if (!profile) return { ...current, jobId };

    return {
      ...current,
      jobId: profile.jobId,
      jobName: current.jobName || profile.jobName,
      clientId: current.clientId || profile.clientId,
      clientName: current.clientName || profile.clientName,
      salesRep: current.salesRep || profile.salesRep,
      estimator: current.estimator || profile.estimator,
      teamLead: current.teamLead || profile.teamLead,
      province: current.province || profile.province,
      city: current.city || profile.city,
      address: current.address || profile.address,
      postalCode: current.postalCode || profile.postalCode,
      width: current.width || profile.width,
      length: current.length || profile.length,
      height: current.height || profile.height,
    };
  };

  const handleDraftJobChange = (
    jobId: string,
    setter: React.Dispatch<React.SetStateAction<Partial<Deal>>>,
  ) => {
    setter(current => applyProfileToDraft(jobId, current));
  };

  const focusedJobId = searchParams.get('jobId') || '';

  useEffect(() => {
    if (!focusedJobId) return;
    if (searchClient === focusedJobId && expandedJob === focusedJobId) return;
    setSearchClient(focusedJobId);
    setExpandedJob(focusedJobId);
    setPipelineView(false);
  }, [expandedJob, focusedJobId, searchClient]);

  useEffect(() => {
    if (visibleDealJobIds.length === 0) {
      setFilesByJobId({});
      return;
    }

    void (async () => {
      const { data, error } = await (supabase.from as any)('quote_files')
        .select('*')
        .in('job_id', visibleDealJobIds)
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
  }, [visibleDealJobIds]);

  const openLatestPdf = async (jobId: string) => {
    const summary = documentSummaryByJobId[jobId];
    const latestPdf = summary?.latestPdfQuote;
    if (!latestPdf?.pdfStoragePath) {
      toast.error('No saved PDF is attached to this job yet.');
      return;
    }

    const url = await getQuoteFileUrl(latestPdf.pdfStoragePath);
    if (!url) {
      toast.error('Unable to load the saved PDF.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePipelineDrop = (status: string) => {
    if (!draggedDealId) return;
    updateDeal(draggedDealId, { dealStatus: status as DealStatus });
    setDraggedDealId(null);
  };

  const handleSaveEdit = () => {
    if (!editingDeal) return;
    updateDeal(editingDeal.jobId, editingDeal);
    setEditingDeal(null);
  };

  const handleAddDeal = () => {
    if (!newDeal.jobId) return;
    const deal: Deal = {
      jobId: newDeal.jobId || '',
      jobName: newDeal.jobName || '',
      clientName: newDeal.clientName || '',
      clientId: newDeal.clientId || '',
      salesRep: newDeal.salesRep || '',
      estimator: newDeal.estimator || '',
      teamLead: newDeal.teamLead || '',
      province: newDeal.province || 'ON',
      city: newDeal.city || '',
      address: newDeal.address || '',
      postalCode: newDeal.postalCode || '',
      width: Number(newDeal.width) || 0,
      length: Number(newDeal.length) || 0,
      height: Number(newDeal.height) || 0,
      sqft: (Number(newDeal.width) || 0) * (Number(newDeal.length) || 0),
      weight: 0,
      taxRate: 0,
      taxType: '',
      orderType: '',
      dateSigned: '',
      dealStatus: newDeal.dealStatus || 'Lead',
      paymentStatus: 'UNPAID',
      productionStatus: 'Submitted',
      freightStatus: 'Pending',
      insulationStatus: '',
      deliveryDate: '',
      pickupDate: '',
      notes: '',
    };
    addDeal(deal);
    setShowAddDeal(false);
    setNewDeal(EMPTY_DEAL);
  };

  return (
    <div className="space-y-6" data-testid="master-deals-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Master Deals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {visibleDeals.length} deals shown
            {isSalesRep && ' (your deals only)'}
            {!showCancelled && cancelledCount > 0 && (
              <span className="ml-1">· {cancelledCount} cancelled hidden</span>
            )}
          </p>
        </div>
        {isAdminOwner && (
          <Button size="sm" onClick={() => setShowAddDeal(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Deal
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {settings.dealStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {reps.length > 1 && (
          <Select value={filterRep} onValueChange={setFilterRep}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Reps" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reps</SelectItem>
              {reps.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input className="w-48 input-blue" placeholder="Search job, client, ID..." value={searchClient} onChange={e => setSearchClient(e.target.value)} />
        <Button
          size="sm"
          variant={showCancelled ? 'default' : 'outline'}
          onClick={() => setShowCancelled(prev => !prev)}
          className="gap-1.5"
        >
          {showCancelled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showCancelled ? 'Hide Cancelled' : 'Show Cancelled'}
        </Button>
        <Button
          size="sm"
          variant={pipelineView ? 'default' : 'outline'}
          onClick={() => setPipelineView(prev => !prev)}
        >
          {pipelineView ? 'Hide Pipeline' : 'Show Pipeline'}
        </Button>
      </div>

      {pipelineView && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sales Pipeline</h3>
            <p className="text-xs text-muted-foreground">Drag a deal card into a new stage to update `deal_status` across the database.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-3">
            {pipelineStatuses.map(status => (
              <div
                key={status}
                className="rounded-lg border bg-card p-3 min-h-56"
                onDragOver={event => event.preventDefault()}
                onDrop={() => handlePipelineDrop(status)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{DEAL_STATUS_LABELS[status] || status}</p>
                    <p className="text-xs text-muted-foreground">{dealsByStatus[status]?.length || 0} deals</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(dealsByStatus[status] || []).length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      Drop deals here
                    </div>
                  ) : (
                    (dealsByStatus[status] || []).map(deal => (
                      <button
                        key={`${status}-${deal.jobId}`}
                        type="button"
                        draggable
                        onDragStart={() => setDraggedDealId(deal.jobId)}
                        onDragEnd={() => setDraggedDealId(null)}
                        onClick={() => toggle(deal.jobId)}
                        className={`w-full rounded-md border p-3 text-left transition hover:border-primary hover:bg-muted/40 ${expandedJob === deal.jobId ? 'border-primary bg-muted/40' : 'border-border'} ${draggedDealId === deal.jobId ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-[11px] text-muted-foreground">{deal.jobId}</p>
                            <p className="text-sm font-semibold">{deal.clientName || 'Unnamed client'}</p>
                            <p className="text-xs text-muted-foreground">{deal.jobName || 'No job name'}</p>
                          </div>
                          <span className="rounded-full bg-muted px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {deal.salesRep || 'Unassigned'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 w-6"></th>
              {['Job ID', 'Job Name', 'Client', 'Sales Rep', 'Province', 'Deal Status', 'Client Pmt', 'Factory Pmt', 'Production', 'Insulation', 'Freight'].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
              {canEdit && <th className="px-2 py-2 text-left font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={canEdit ? 13 : 12} className="px-3 py-8 text-center text-muted-foreground">No deals found</td></tr>
            ) : filtered.map(d => {
              const isExpanded = expandedJob === d.jobId;
              const ic = internalCosts.find(c => c.jobId === d.jobId);
              const opportunity = opportunities.find(item => item.jobId === d.jobId);
              const milestonesForJob = dealMilestones.filter(item => item.jobId === d.jobId);
              const freightReady = isDealFreightReady(milestonesForJob);
              const milestoneProgress = summarizeDealMilestoneProgress(milestonesForJob);
              const blockedReason = getDealFreightBlockedReason(milestonesForJob);
              const nextStep = getDealPostSaleNextStep(d, milestonesForJob);
              const documentSummary = documentSummaryByJobId[d.jobId];
              const clientPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Client Payment IN');
              const vendorPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Vendor Payment OUT');
              const clientIn = clientPmts.reduce((s, p) => s + p.amountExclTax, 0);
              const vendorOut = vendorPmts.reduce((s, p) => s + p.amountExclTax, 0);
              const factoryStage = d.factoryPaymentStageOverride || derivePaymentStage(vendorPmts.length, settings.factoryPaymentStatuses);

              return (
                <>
                  <tr key={d.jobId} className={`border-b hover:bg-muted/50 cursor-pointer ${d.dealStatus === 'Cancelled' ? 'opacity-50' : ''}`} onClick={() => toggle(d.jobId)}>
                    <td className="px-2 py-2">{isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                    <td className="px-2 py-2 font-mono text-xs">{d.jobId || '—'}</td>
                    <td className="px-2 py-2 text-xs">{d.jobName}</td>
                    <td className="px-2 py-2 font-medium">{d.clientName}</td>
                    <td className="px-2 py-2 text-xs">{d.salesRep}</td>
                    <td className="px-2 py-2 text-xs">{d.province}</td>
                    <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                      {canEdit ? (
                        <Select value={d.dealStatus} onValueChange={v => updateDeal(d.jobId, { dealStatus: v as DealStatus })}>
                          <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>{settings.dealStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <span className="text-xs">{DEAL_STATUS_LABELS[d.dealStatus] || d.dealStatus}</span>}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${d.paymentStatus === 'PAID' ? 'status-paid' : d.paymentStatus === 'PARTIAL' ? 'status-partial' : 'status-unpaid'}`}>{d.paymentStatus}</span>
                    </td>
                    <td className="px-2 py-2 text-xs">{factoryStage || 'Auto'}</td>
                    <td className="px-2 py-2 text-xs">{d.productionStatus}</td>
                    <td className="px-2 py-2 text-xs">{d.insulationStatus || '—'}</td>
                    <td className="px-2 py-2 text-xs">{d.freightStatus}</td>
                    {canEdit && (
                      <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingDeal({ ...d })}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Deal</AlertDialogTitle>
                                <AlertDialogDescription>Delete {d.jobId} - {d.clientName}? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteDeal(d.jobId)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr key={`${d.jobId}-detail`} className="bg-muted/30">
                      <td colSpan={canEdit ? 13 : 12} className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Project Info</p>
                            <p>Address: {d.address || '—'}</p>
                            <p>City: {d.city}, {d.province} {d.postalCode}</p>
                            <p>Dimensions: {d.width}×{d.length}×{d.height}</p>
                            <p>Sqft: {formatNumber(d.sqft)} | Weight: {formatNumber(d.weight)} lbs</p>
                            <p>Order Type: {d.orderType || '—'}</p>
                            <p>Date Signed: {d.dateSigned || '—'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Team</p>
                            <p>Sales Rep: {d.salesRep}</p>
                            <p>Estimator: {d.estimator}</p>
                            <p>Team Lead: {d.teamLead || '—'}</p>
                            <p>Client ID: {d.clientId}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Internal Costs</p>
                            {ic ? (
                              <>
                                <p>TRUE Total: {formatCurrency(ic.trueMaterial + ic.trueStructuralDrawing + ic.trueFoundationDrawing + ic.trueFreight + ic.trueInsulation)}</p>
                                <p>Sale Price: {formatCurrency(ic.salePrice)}</p>
                                <p>GP: {formatCurrency(ic.salePrice - (ic.trueMaterial + ic.trueStructuralDrawing + ic.trueFoundationDrawing + ic.trueFreight + ic.trueInsulation))}</p>
                              </>
                            ) : <p className="text-muted-foreground">Not initialized</p>}
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Payment Summary</p>
                            <p className="text-success">Client In: {formatCurrency(clientIn)}</p>
                            <p className="text-destructive">Vendor Out: {formatCurrency(vendorOut)}</p>
                            <p className="font-semibold">Net: {formatCurrency(clientIn - vendorOut)}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-[280px,1fr]">
                          <div className="rounded-md border bg-background p-4 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-muted-foreground">Opportunity</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${freightReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {freightReady ? 'Freight Ready' : 'Freight Not Ready'}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1">
                              <p>Status: <span className="font-medium capitalize">{opportunity?.status || 'open'}</span></p>
                              <p>Source: <span className="font-medium">{opportunity?.source || 'deal'}</span></p>
                              <p>Potential Revenue: <span className="font-medium">{formatCurrency(opportunity?.potentialRevenue || 0)}</span></p>
                              <p>Owner: <span className="font-medium">{opportunity?.salesRep || d.salesRep || 'Unassigned'}</span></p>
                              <p>Milestones: <span className="font-medium">{milestoneProgress.completedCount}/{milestoneProgress.totalCount}</span></p>
                              <p>Next Step: <span className="font-medium">{nextStep}</span></p>
                              {!freightReady && blockedReason && (
                                <p>Blocked: <span className="font-medium text-amber-700">{blockedReason}</span></p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-md border bg-background p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-sm">Post-Sale Milestones</p>
                                <p className="text-xs text-muted-foreground">
                                  Freight readiness is derived from the required milestone set.
                                </p>
                              </div>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {DEAL_MILESTONE_DEFINITIONS.map(definition => {
                                const milestone = milestonesForJob.find(item => item.milestoneKey === definition.key);
                                return (
                                  <label
                                    key={`${d.jobId}-${definition.key}`}
                                    className={`flex items-start gap-3 rounded-md border px-3 py-2 text-xs ${milestone?.isComplete ? 'border-green-200 bg-green-50/50' : 'border-border'}`}
                                  >
                                    <Checkbox
                                      checked={milestone?.isComplete || false}
                                      disabled={!canEdit}
                                      onCheckedChange={(checked) => {
                                        void upsertDealMilestone(d.jobId, definition.key, checked === true, milestone?.notes || '');
                                      }}
                                    />
                                    <div className="space-y-0.5">
                                      <p className="font-medium">{definition.label}</p>
                                      {definition.requiredForFreightReady && (
                                        <p className="text-muted-foreground">Required for freight-ready status</p>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 rounded-md border bg-background p-4 text-xs">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-muted-foreground">Document Vault</p>
                              <p className="mt-1">Primary visible sets: <span className="font-medium">{documentSummary?.visibleFiles.length || 0}</span></p>
                              <p>Hidden duplicates: <span className="font-medium">{documentSummary?.hiddenDuplicateCount || 0}</span></p>
                              <p>PDFs: <span className="font-medium">{documentSummary?.pdfQuotes.length || 0}</span></p>
                              <p>Support files: <span className="font-medium">{documentSummary?.supportFiles.length || 0}</span></p>
                              <p>Cost files: <span className="font-medium">{documentSummary?.costFiles.length || 0}</span></p>
                            </div>
                            {documentSummary?.latestPdfQuote && (
                              <Button size="sm" variant="outline" onClick={() => void openLatestPdf(d.jobId)}>
                                Open Saved PDF
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="mb-3 flex justify-end">
                            {canManageFreightWorkflow && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mr-2"
                                onClick={() => navigate(`/freight?freightMode=execution&freightJobId=${encodeURIComponent(d.jobId)}`)}
                              >
                                Open Freight Posting
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="mr-2"
                              onClick={() => navigate(`/opportunities?jobId=${encodeURIComponent(d.jobId)}`)}
                            >
                              Open Opportunity
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/messages?dealJobId=${d.jobId}`)}
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                              Open Deal Chat
                            </Button>
                          </div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
                          <Textarea className="text-xs h-16" value={d.notes} onChange={e => updateDeal(d.jobId, { notes: e.target.value })} placeholder="Add notes..." />
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

      {/* Edit Deal Dialog */}
      <Dialog open={!!editingDeal} onOpenChange={open => !open && setEditingDeal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Deal — {editingDeal?.jobId}</DialogTitle>
          </DialogHeader>
          {editingDeal && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Job ID</label>
                <JobIdSelect
                  value={editingDeal.jobId}
                  onValueChange={jobId => setEditingDeal(prev => prev ? applyProfileToDraft(jobId, prev) as Deal : null)}
                  placeholder="Select job..."
                  triggerClassName="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Job Name</label>
                <Input className="mt-1" value={editingDeal.jobName || ''} onChange={e => setEditingDeal(prev => prev ? { ...prev, jobName: e.target.value } : null)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Client</label>
                <ClientSelect
                  mode="name"
                  valueId={editingDeal.clientId || ''}
                  valueName={editingDeal.clientName || ''}
                  onSelect={({ clientId, clientName }) => setEditingDeal(prev => prev ? { ...prev, clientId, clientName } : null)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Client ID</label>
                <ClientSelect
                  mode="id"
                  valueId={editingDeal.clientId || ''}
                  valueName={editingDeal.clientName || ''}
                  onSelect={({ clientId, clientName }) => setEditingDeal(prev => prev ? { ...prev, clientId, clientName } : null)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Sales Rep</label>
                <PersonnelSelect
                  role="sales_rep"
                  value={editingDeal.salesRep || ''}
                  onValueChange={value => setEditingDeal(prev => prev ? { ...prev, salesRep: value } : null)}
                  placeholder="Select sales rep..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estimator</label>
                <PersonnelSelect
                  role="estimator"
                  value={editingDeal.estimator || ''}
                  onValueChange={value => setEditingDeal(prev => prev ? { ...prev, estimator: value } : null)}
                  placeholder="Select estimator..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Team Lead</label>
                <PersonnelSelect
                  role="team_lead"
                  value={editingDeal.teamLead || ''}
                  onValueChange={value => setEditingDeal(prev => prev ? { ...prev, teamLead: value } : null)}
                  placeholder="Select team lead..."
                  className="mt-1"
                />
              </div>
              {[
                ['province', 'Province'], ['city', 'City'], ['address', 'Address'], ['postalCode', 'Postal Code'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input className="mt-1" value={(editingDeal[key as keyof Deal] as string) || ''} onChange={e => setEditingDeal(prev => prev ? { ...prev, [key]: e.target.value } : null)} />
                </div>
              ))}
              {[['width', 'Width (ft)'], ['length', 'Length (ft)'], ['height', 'Height (ft)']].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input className="mt-1" type="number" value={(editingDeal[key as keyof Deal] as number) || ''} onChange={e => setEditingDeal(prev => prev ? { ...prev, [key]: parseFloat(e.target.value) || 0 } : null)} />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Deal Status</label>
                <Select value={editingDeal.dealStatus} onValueChange={v => setEditingDeal(prev => prev ? { ...prev, dealStatus: v as DealStatus } : null)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{settings.dealStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDeal(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deal Dialog */}
      <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Deal</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Job ID *</label>
              <JobIdSelect
                value={newDeal.jobId || ''}
                onValueChange={jobId => handleDraftJobChange(jobId, setNewDeal)}
                placeholder="Select or create job..."
                triggerClassName="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Job Name</label>
              <Input className="mt-1" value={newDeal.jobName || ''} onChange={e => setNewDeal(prev => ({ ...prev, jobName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Client</label>
              <ClientSelect
                mode="name"
                valueId={newDeal.clientId || ''}
                valueName={newDeal.clientName || ''}
                onSelect={({ clientId, clientName }) => setNewDeal(prev => ({ ...prev, clientId, clientName }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Client ID</label>
              <ClientSelect
                mode="id"
                valueId={newDeal.clientId || ''}
                valueName={newDeal.clientName || ''}
                onSelect={({ clientId, clientName }) => setNewDeal(prev => ({ ...prev, clientId, clientName }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sales Rep</label>
              <PersonnelSelect
                role="sales_rep"
                value={newDeal.salesRep || ''}
                onValueChange={value => setNewDeal(prev => ({ ...prev, salesRep: value }))}
                placeholder="Select sales rep..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estimator</label>
              <PersonnelSelect
                role="estimator"
                value={newDeal.estimator || ''}
                onValueChange={value => setNewDeal(prev => ({ ...prev, estimator: value }))}
                placeholder="Select estimator..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Team Lead</label>
              <PersonnelSelect
                role="team_lead"
                value={newDeal.teamLead || ''}
                onValueChange={value => setNewDeal(prev => ({ ...prev, teamLead: value }))}
                placeholder="Select team lead..."
                className="mt-1"
              />
            </div>
            {[
              ['province', 'Province'], ['city', 'City'], ['address', 'Address'], ['postalCode', 'Postal Code'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input className="mt-1" value={(newDeal[key as keyof Deal] as string) || ''} onChange={e => setNewDeal(prev => ({ ...prev, [key]: e.target.value }))} />
              </div>
            ))}
            {[['width', 'Width (ft)'], ['length', 'Length (ft)'], ['height', 'Height (ft)']].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input className="mt-1" type="number" value={(newDeal[key as keyof Deal] as number) || ''} onChange={e => setNewDeal(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Deal Status</label>
              <Select value={newDeal.dealStatus || 'Lead'} onValueChange={v => setNewDeal(prev => ({ ...prev, dealStatus: v as DealStatus }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{settings.dealStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDeal(false); setNewDeal(EMPTY_DEAL); }}>Cancel</Button>
            <Button onClick={handleAddDeal} disabled={!newDeal.jobId}>Add Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
