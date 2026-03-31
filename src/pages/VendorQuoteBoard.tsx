import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRoles } from '@/context/RoleContext';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/calculations';
import { Loader2, Calendar, FileText, Send, Building2, Pencil, Ban, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type BidStatus = 'submitted' | 'updated' | 'cancelled' | 'awarded' | 'rejected';
type BidLineItemDraft = {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

const createEmptyLineItem = (): BidLineItemDraft => ({
  name: '',
  quantity: '',
  unit: '',
  notes: '',
});

async function logBidEvent(bidId: string, eventType: string, payload: Record<string, unknown>) {
  await (supabase.from as any)('vendor_bid_events').insert({
    bid_id: bidId,
    event_type: eventType,
    payload,
  });
}

export default function VendorQuoteBoard() {
  const { currentUser } = useRoles();
  const { deals, internalCosts } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const primaryRole = ['freight', 'manufacturer', 'construction'].find(role => currentUser.roles.includes(role as any)) || 'vendor';
  const canManageBidBoard = currentUser.roles.some(role => ['admin', 'owner', 'operations'].includes(role));

  const { data: jobs, isLoading: isJobsLoading } = useQuery({
    queryKey: ['vendor_jobs', primaryRole],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('vendor_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bids, isLoading: isBidsLoading } = useQuery({
    queryKey: ['vendor_bids', currentUser.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('vendor_bids')
        .select('*')
        .eq('vendor_id', currentUser.id);
      if (error) throw error;
      return data || [];
    },
  });

  const [bidAmount, setBidAmount] = useState<Record<string, string>>({});
  const [bidLeadTime, setBidLeadTime] = useState<Record<string, string>>({});
  const [bidDetails, setBidDetails] = useState<Record<string, string>>({});
  const [jobDraft, setJobDraft] = useState({
    sourceJobId: '',
    title: '',
    category: 'materials',
    description: '',
    requiredByDate: '',
    closingDate: '',
    lineItems: [createEmptyLineItem()],
  });

  const bidsByJobId = useMemo(
    () => new Map((bids || []).map((bid: any) => [bid.job_id, bid])),
    [bids],
  );

  const activeBidRows = useMemo(() => {
    return (bids || [])
      .map((bid: any) => ({
        bid,
        job: (jobs || []).find((job: any) => job.id === bid.job_id),
      }))
      .filter((row: any) => row.job);
  }, [bids, jobs]);

  const createVendorJobMutation = useMutation({
    mutationFn: async () => {
      const cleanedLineItems = jobDraft.lineItems
        .map(item => ({
          name: item.name.trim(),
          quantity: item.quantity.trim(),
          unit: item.unit.trim(),
          notes: item.notes.trim(),
        }))
        .filter(item => item.name);

      if (!jobDraft.title.trim()) throw new Error('Bid title is required');
      if (cleanedLineItems.length === 0) throw new Error('At least one line item is required');

      const sourceDeal = deals.find(deal => deal.jobId === jobDraft.sourceJobId);
      const sourceCost = internalCosts.find(cost => cost.jobId === jobDraft.sourceJobId);

      const { error } = await (supabase.from as any)('vendor_jobs').insert({
        job_id: jobDraft.sourceJobId || null,
        title: jobDraft.title.trim(),
        category: jobDraft.category.trim() || 'materials',
        description: jobDraft.description.trim(),
        line_items: cleanedLineItems,
        required_by_date: jobDraft.requiredByDate || null,
        closing_date: jobDraft.closingDate || null,
        specifications: {
          source: jobDraft.sourceJobId ? 'deal_import' : 'manual',
          sourceDeal: sourceDeal ? {
            clientName: sourceDeal.clientName,
            jobName: sourceDeal.jobName,
            province: sourceDeal.province,
            dimensions: {
              width: sourceDeal.width,
              length: sourceDeal.length,
              height: sourceDeal.height,
            },
            address: sourceDeal.address,
            city: sourceDeal.city,
          } : null,
          internalCostSummary: sourceCost ? {
            salePrice: sourceCost.salePrice,
            trueMaterial: sourceCost.trueMaterial,
            trueFreight: sourceCost.trueFreight,
          } : null,
        },
        status: 'open',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Bid request created' });
      setJobDraft({
        sourceJobId: '',
        title: '',
        category: 'materials',
        description: '',
        requiredByDate: '',
        closingDate: '',
        lineItems: [createEmptyLineItem()],
      });
      queryClient.invalidateQueries({ queryKey: ['vendor_jobs'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create bid request', description: error.message, variant: 'destructive' });
    },
  });

  const upsertBidMutation = useMutation({
    mutationFn: async ({ jobId, existingBidId }: { jobId: string; existingBidId?: string }) => {
      const amount = parseFloat(bidAmount[jobId] || '0');
      const leadTime = parseInt(bidLeadTime[jobId] || '0', 10);
      const details = bidDetails[jobId] || '';
      if (!amount || amount <= 0) throw new Error('Valid amount required');

      if (existingBidId) {
        const { error } = await (supabase.from as any)('vendor_bids')
          .update({
            amount,
            lead_time_days: leadTime,
            details,
            status: 'updated' satisfies BidStatus,
          })
          .eq('id', existingBidId);
        if (error) throw error;
        await logBidEvent(existingBidId, 'updated', { amount, leadTimeDays: leadTime, details });
        return;
      }

      const { data, error } = await (supabase.from as any)('vendor_bids')
        .insert({
          job_id: jobId,
          vendor_id: currentUser.id,
          amount,
          lead_time_days: leadTime,
          details,
          status: 'submitted' satisfies BidStatus,
        })
        .select('id')
        .single();
      if (error) throw error;
      await logBidEvent(data.id, 'submitted', { amount, leadTimeDays: leadTime, details });
    },
    onSuccess: (_, variables) => {
      toast({ title: variables.existingBidId ? 'Bid updated' : 'Bid submitted successfully' });
      queryClient.invalidateQueries({ queryKey: ['vendor_bids'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save bid', description: error.message, variant: 'destructive' });
    },
  });

  const cancelBidMutation = useMutation({
    mutationFn: async (bidId: string) => {
      const { error } = await (supabase.from as any)('vendor_bids')
        .update({ status: 'cancelled' satisfies BidStatus })
        .eq('id', bidId);
      if (error) throw error;
      await logBidEvent(bidId, 'cancelled', {});
    },
    onSuccess: () => {
      toast({ title: 'Bid cancelled' });
      queryClient.invalidateQueries({ queryKey: ['vendor_bids'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to cancel bid', description: error.message, variant: 'destructive' });
    },
  });

  const primeDraftFields = (jobId: string, bid: any) => {
    if (bidAmount[jobId] == null) setBidAmount(current => ({ ...current, [jobId]: String(bid.amount || '') }));
    if (bidLeadTime[jobId] == null) setBidLeadTime(current => ({ ...current, [jobId]: String(bid.lead_time_days || '') }));
    if (bidDetails[jobId] == null) setBidDetails(current => ({ ...current, [jobId]: bid.details || '' }));
  };

  const importDealIntoBidDraft = (sourceJobId: string) => {
    const sourceDeal = deals.find(deal => deal.jobId === sourceJobId);
    if (!sourceDeal) return;

    setJobDraft(current => ({
      ...current,
      sourceJobId,
      title: sourceDeal.jobName ? `${sourceDeal.jobName} Vendor Bid` : `${sourceDeal.clientName} Vendor Bid`,
      description: [
        `Client: ${sourceDeal.clientName}`,
        `Location: ${[sourceDeal.city, sourceDeal.province].filter(Boolean).join(', ') || 'N/A'}`,
        `Dimensions: ${sourceDeal.width || 0} x ${sourceDeal.length || 0} x ${sourceDeal.height || 0}`,
      ].join('\n'),
      lineItems: current.lineItems.some(item => item.name)
        ? current.lineItems
        : [{
            name: 'Primary material package',
            quantity: '1',
            unit: 'lot',
            notes: `Imported from deal ${sourceDeal.jobId}`,
          }],
    }));
  };

  if (isJobsLoading || isBidsLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight capitalize">{primaryRole} Bid Board</h1>
        <p className="text-muted-foreground mt-2">Blind-bid board with an active bids log and update/cancel controls.</p>
      </div>

      {canManageBidBoard && (
        <Card>
          <CardHeader>
            <CardTitle>Create Bid Request</CardTitle>
            <CardDescription>Operations can import an existing job, define line items, and publish a blind bid request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1">
                <Label>Import Existing Job</Label>
                <Input
                  list="bid-board-job-ids"
                  placeholder="Enter job ID"
                  value={jobDraft.sourceJobId}
                  onChange={event => setJobDraft(current => ({ ...current, sourceJobId: event.target.value }))}
                />
                <datalist id="bid-board-job-ids">
                  {deals.map(deal => (
                    <option key={deal.jobId} value={deal.jobId}>{deal.clientName} - {deal.jobName}</option>
                  ))}
                </datalist>
                <Button type="button" variant="outline" size="sm" onClick={() => importDealIntoBidDraft(jobDraft.sourceJobId)}>
                  Import Job Details
                </Button>
              </div>
              <div className="space-y-1">
                <Label>Bid Title</Label>
                <Input
                  value={jobDraft.title}
                  onChange={event => setJobDraft(current => ({ ...current, title: event.target.value }))}
                  placeholder="Steel package, insulation, freight, etc."
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input
                  value={jobDraft.category}
                  onChange={event => setJobDraft(current => ({ ...current, category: event.target.value }))}
                  placeholder="materials"
                />
              </div>
              <div className="space-y-1">
                <Label>Required By</Label>
                <Input
                  type="date"
                  value={jobDraft.requiredByDate}
                  onChange={event => setJobDraft(current => ({ ...current, requiredByDate: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Closing Date</Label>
                <Input
                  type="date"
                  value={jobDraft.closingDate}
                  onChange={event => setJobDraft(current => ({ ...current, closingDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Scope / Notes</Label>
              <Textarea
                value={jobDraft.description}
                onChange={event => setJobDraft(current => ({ ...current, description: event.target.value }))}
                placeholder="Describe the scope vendors are bidding on."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Requested Line Items</Label>
                  <p className="text-xs text-muted-foreground">Vendors see these requirements but not competitors' pricing.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setJobDraft(current => ({ ...current, lineItems: [...current.lineItems, createEmptyLineItem()] }))}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Line Item
                </Button>
              </div>

              {jobDraft.lineItems.map((item, index) => (
                <div key={`line-item-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label>Item</Label>
                    <Input
                      value={item.name}
                      onChange={event => setJobDraft(current => ({
                        ...current,
                        lineItems: current.lineItems.map((lineItem, itemIndex) => itemIndex === index ? { ...lineItem, name: event.target.value } : lineItem),
                      }))}
                      placeholder="Item name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Qty</Label>
                    <Input
                      value={item.quantity}
                      onChange={event => setJobDraft(current => ({
                        ...current,
                        lineItems: current.lineItems.map((lineItem, itemIndex) => itemIndex === index ? { ...lineItem, quantity: event.target.value } : lineItem),
                      }))}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Unit</Label>
                    <Input
                      value={item.unit}
                      onChange={event => setJobDraft(current => ({
                        ...current,
                        lineItems: current.lineItems.map((lineItem, itemIndex) => itemIndex === index ? { ...lineItem, unit: event.target.value } : lineItem),
                      }))}
                      placeholder="lot, pcs, ft"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setJobDraft(current => ({
                        ...current,
                        lineItems: current.lineItems.length === 1
                          ? [createEmptyLineItem()]
                          : current.lineItems.filter((_, itemIndex) => itemIndex !== index),
                      }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1 md:col-span-4">
                    <Label>Item Notes</Label>
                    <Textarea
                      value={item.notes}
                      onChange={event => setJobDraft(current => ({
                        ...current,
                        lineItems: current.lineItems.map((lineItem, itemIndex) => itemIndex === index ? { ...lineItem, notes: event.target.value } : lineItem),
                      }))}
                      placeholder="Specs, tolerances, special delivery constraints..."
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => createVendorJobMutation.mutate()} disabled={createVendorJobMutation.isPending}>
                {createVendorJobMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Publish Bid Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeBidRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Bids Log</CardTitle>
            <CardDescription>Your submitted, updated, or cancelled bids.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Reference</th>
                  <th className="pb-2 font-medium">Bid</th>
                  <th className="pb-2 font-medium">Lead Time</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {activeBidRows.map((row: any) => (
                  <tr key={row.bid.id} className="border-b last:border-0">
                    <td className="py-2">{row.job?.job_id || row.job?.title}</td>
                    <td className="py-2 font-mono">{formatCurrency(row.bid.amount || 0)}</td>
                    <td className="py-2">{row.bid.lead_time_days || 0} days</td>
                    <td className="py-2"><Badge variant="outline" className="capitalize">{row.bid.status || 'submitted'}</Badge></td>
                    <td className="py-2 text-muted-foreground">{row.bid.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {jobs?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No active bids available</p>
            <p className="text-sm">Check back later for new opportunities.</p>
          </div>
        )}

        {jobs?.map((job: any) => {
          const myBid = bidsByJobId.get(job.id);
          if (myBid) primeDraftFields(job.id, myBid);
          const isSubmitted = Boolean(myBid);
          const lineItems = Array.isArray(job.line_items) ? job.line_items : [];

          return (
            <Card key={job.id} className="flex flex-col border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/10 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-1.5 opacity-80">
                      <Calendar className="h-3.5 w-3.5" />
                      Closes: {job.closing_date ? new Date(job.closing_date).toLocaleDateString() : 'TBD'}
                    </CardDescription>
                  </div>
                  {isSubmitted && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      {String(myBid.status || 'submitted')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-4 space-y-4">
                <div className="text-sm space-y-2 flex-1">
                  {job.job_id && (
                    <p className="text-muted-foreground flex items-center gap-2">
                      <span className="font-semibold text-foreground">Reference:</span> {job.job_id}
                    </p>
                  )}
                  {job.description && (
                    <div className="p-3 bg-muted/30 rounded-md border border-border/50 text-foreground/80">
                      <p className="flex items-center gap-2 font-semibold text-foreground mb-1">
                        <FileText className="h-3.5 w-3.5" /> Scope
                      </p>
                      {job.description}
                    </div>
                  )}
                  {lineItems.length > 0 && (
                    <div className="p-3 bg-muted/20 rounded-md border border-border/50">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Requested Line Items</p>
                      <div className="space-y-1 text-xs">
                        {lineItems.map((item: any, index: number) => (
                          <div key={`${job.id}-item-${index}`} className="flex justify-between gap-3">
                            <span>{item.name || item.description || `Item ${index + 1}`}</span>
                            <span className="text-muted-foreground">{item.quantity || ''} {item.unit || ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mt-auto pt-4 border-t border-border/50">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Amount ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={bidAmount[job.id] || ''}
                        onChange={event => setBidAmount(current => ({ ...current, [job.id]: event.target.value }))}
                        disabled={myBid?.status === 'cancelled'}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lead Time (Days)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 14"
                        value={bidLeadTime[job.id] || ''}
                        onChange={event => setBidLeadTime(current => ({ ...current, [job.id]: event.target.value }))}
                        disabled={myBid?.status === 'cancelled'}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      placeholder="Additional details or constraints..."
                      className="h-16 resize-none"
                      value={bidDetails[job.id] || ''}
                      onChange={event => setBidDetails(current => ({ ...current, [job.id]: event.target.value }))}
                      disabled={myBid?.status === 'cancelled'}
                    />
                  </div>

                  {isSubmitted ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="gap-2"
                        onClick={() => upsertBidMutation.mutate({ jobId: job.id, existingBidId: myBid.id })}
                        disabled={upsertBidMutation.isPending || myBid.status === 'cancelled'}
                      >
                        <Pencil className="h-4 w-4" />
                        Update Bid
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => cancelBidMutation.mutate(myBid.id)}
                        disabled={cancelBidMutation.isPending || myBid.status === 'cancelled'}
                      >
                        <Ban className="h-4 w-4" />
                        Cancel Bid
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full gap-2 mt-2"
                      onClick={() => upsertBidMutation.mutate({ jobId: job.id })}
                      disabled={upsertBidMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                      Submit Bid
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
