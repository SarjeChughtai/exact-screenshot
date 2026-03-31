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
import { JobIdSelect } from '@/components/JobIdSelect';
import { manufacturerBidFromRow, manufacturerBidToRow, manufacturerRFQFromRow, manufacturerRFQToRow } from '@/lib/supabaseMappers';
import type { ManufacturerBid, ManufacturerRFQ } from '@/types';

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

const createEmptyManufacturerRFQ = () => ({
  jobId: '',
  title: '',
  buildingSpec: '',
  width: '',
  length: '',
  height: '',
  weight: '',
  province: '',
  city: '',
  deliveryAddress: '',
  requiredByDate: '',
  closingDate: '',
  notes: '',
});

const createEmptyManufacturerBid = () => ({
  pricePerLb: '',
  totalPrice: '',
  leadTimeDays: '',
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
  const isManufacturerView = primaryRole === 'manufacturer';

  const { data: jobs, isLoading: isJobsLoading } = useQuery({
    queryKey: ['vendor_jobs', primaryRole],
    enabled: !isManufacturerView,
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
    enabled: !isManufacturerView,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('vendor_bids')
        .select('*')
        .eq('vendor_id', currentUser.id);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allBids } = useQuery({
    queryKey: ['vendor_bids_all', canManageBidBoard],
    enabled: canManageBidBoard && !isManufacturerView,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('vendor_bids')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: manufacturerRFQs = [], isLoading: isManufacturerRFQsLoading } = useQuery({
    queryKey: ['manufacturer_rfqs', currentUser.id, canManageBidBoard],
    enabled: isManufacturerView || canManageBidBoard,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('manufacturer_rfqs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(manufacturerRFQFromRow) as ManufacturerRFQ[];
    },
  });

  const { data: manufacturerBids = [], isLoading: isManufacturerBidsLoading } = useQuery({
    queryKey: ['manufacturer_bids', currentUser.id, canManageBidBoard],
    enabled: isManufacturerView || canManageBidBoard,
    queryFn: async () => {
      let query = (supabase.from as any)('manufacturer_bids')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (!canManageBidBoard) {
        query = query.eq('manufacturer_id', currentUser.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(manufacturerBidFromRow) as ManufacturerBid[];
    },
  });

  const relevantBidIds = useMemo(() => {
    const source = canManageBidBoard ? (allBids || []) : (bids || []);
    return source.map((bid: any) => bid.id).filter(Boolean);
  }, [allBids, bids, canManageBidBoard]);

  const { data: bidEvents } = useQuery({
    queryKey: ['vendor_bid_events', relevantBidIds.join('|')],
    enabled: relevantBidIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('vendor_bid_events')
        .select('*')
        .in('bid_id', relevantBidIds)
        .order('created_at', { ascending: false });
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
  const [manufacturerRFQDraft, setManufacturerRFQDraft] = useState(createEmptyManufacturerRFQ);
  const [manufacturerBidRFQId, setManufacturerBidRFQId] = useState<string | null>(null);
  const [manufacturerBidDraft, setManufacturerBidDraft] = useState(createEmptyManufacturerBid);

  const bidsByJobId = useMemo(
    () => new Map((bids || []).map((bid: any) => [bid.job_id, bid])),
    [bids],
  );

  const myManufacturerBidsByRFQId = useMemo(
    () => new Map(
      manufacturerBids
        .filter((bid) => bid.manufacturerId === currentUser.id)
        .map((bid) => [bid.rfqId, bid]),
    ),
    [currentUser.id, manufacturerBids],
  );

  const manufacturerBidsByRFQId = useMemo(
    () => manufacturerBids.reduce<Record<string, ManufacturerBid[]>>((accumulator, bid) => {
      accumulator[bid.rfqId] = [...(accumulator[bid.rfqId] || []), bid];
      return accumulator;
    }, {}),
    [manufacturerBids],
  );

  const activeBidRows = useMemo(() => {
    return (bids || [])
      .map((bid: any) => ({
        bid,
        job: (jobs || []).find((job: any) => job.id === bid.job_id),
      }))
      .filter((row: any) => row.job);
  }, [bids, jobs]);

  const eventsByBidId = useMemo(() => (
    (bidEvents || []).reduce<Record<string, any[]>>((accumulator, event: any) => {
      accumulator[event.bid_id] = [...(accumulator[event.bid_id] || []), event];
      return accumulator;
    }, {})
  ), [bidEvents]);

  const allBidsByJobId = useMemo(() => (
    (allBids || []).reduce<Record<string, any[]>>((accumulator, bid: any) => {
      accumulator[bid.job_id] = [...(accumulator[bid.job_id] || []), bid];
      return accumulator;
    }, {})
  ), [allBids]);

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

  const createManufacturerRFQMutation = useMutation({
    mutationFn: async () => {
      if (!manufacturerRFQDraft.title.trim()) {
        throw new Error('RFQ title is required');
      }

      const draft = manufacturerRFQDraft;
      const record = manufacturerRFQToRow({
        jobId: draft.jobId.trim(),
        title: draft.title.trim(),
        buildingSpec: draft.buildingSpec.trim(),
        width: Number(draft.width) || 0,
        length: Number(draft.length) || 0,
        height: Number(draft.height) || 0,
        weight: Number(draft.weight) || 0,
        province: draft.province.trim(),
        city: draft.city.trim(),
        deliveryAddress: draft.deliveryAddress.trim(),
        requiredByDate: draft.requiredByDate || '',
        closingDate: draft.closingDate || '',
        notes: draft.notes.trim(),
        status: 'Open',
        createdBy: currentUser.name || currentUser.email || '',
      });

      const { error } = await (supabase.from as any)('manufacturer_rfqs').insert(record);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Manufacturer RFQ created' });
      setManufacturerRFQDraft(createEmptyManufacturerRFQ());
      queryClient.invalidateQueries({ queryKey: ['manufacturer_rfqs'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create manufacturer RFQ', description: error.message, variant: 'destructive' });
    },
  });

  const submitManufacturerBidMutation = useMutation({
    mutationFn: async (rfq: ManufacturerRFQ) => {
      if (!manufacturerBidDraft.totalPrice) throw new Error('Total price is required');
      if (!manufacturerBidDraft.leadTimeDays) throw new Error('Lead time is required');

      const existingBid = myManufacturerBidsByRFQId.get(rfq.id);
      const bidRow = manufacturerBidToRow({
        rfqId: rfq.id,
        manufacturerId: currentUser.id,
        manufacturerName: currentUser.name || currentUser.email || '',
        pricePerLb: Number(manufacturerBidDraft.pricePerLb) || 0,
        totalPrice: Number(manufacturerBidDraft.totalPrice) || 0,
        leadTimeDays: Number(manufacturerBidDraft.leadTimeDays) || 0,
        notes: manufacturerBidDraft.notes.trim(),
        status: existingBid ? existingBid.status : 'Submitted',
      });

      if (existingBid) {
        const { error } = await (supabase.from as any)('manufacturer_bids')
          .update(bidRow)
          .eq('id', existingBid.id);
        if (error) throw error;
        return;
      }

      const { error } = await (supabase.from as any)('manufacturer_bids').insert(bidRow);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Manufacturer bid saved' });
      setManufacturerBidRFQId(null);
      setManufacturerBidDraft(createEmptyManufacturerBid());
      queryClient.invalidateQueries({ queryKey: ['manufacturer_bids'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturer_rfqs'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to save manufacturer bid', description: error.message, variant: 'destructive' });
    },
  });

  const updateManufacturerRFQStatusMutation = useMutation({
    mutationFn: async ({ rfqId, status, awardedBidId }: { rfqId: string; status: ManufacturerRFQ['status']; awardedBidId?: string }) => {
      const { error } = await (supabase.from as any)('manufacturer_rfqs')
        .update({
          status,
          awarded_bid_id: awardedBidId || '',
        })
        .eq('id', rfqId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer_rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturer_bids'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update manufacturer RFQ', description: error.message, variant: 'destructive' });
    },
  });

  const updateManufacturerBidStatusMutation = useMutation({
    mutationFn: async ({ bidId, status }: { bidId: string; status: ManufacturerBid['status'] }) => {
      const { error } = await (supabase.from as any)('manufacturer_bids')
        .update({ status: status })
        .eq('id', bidId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturer_bids'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update manufacturer bid', description: error.message, variant: 'destructive' });
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

  if ((isJobsLoading || isBidsLoading) && !isManufacturerView) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if ((isManufacturerRFQsLoading || isManufacturerBidsLoading) && (isManufacturerView || canManageBidBoard)) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isManufacturerView) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manufacturer RFQ Board</h1>
          <p className="text-muted-foreground mt-2">Open steel package requests and your submitted bids.</p>
        </div>

        <div className="space-y-4">
          {manufacturerRFQs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No manufacturer RFQs are available right now.
              </CardContent>
            </Card>
          ) : manufacturerRFQs.map((rfq) => {
            const myBid = myManufacturerBidsByRFQId.get(rfq.id);
            const isBidFormOpen = manufacturerBidRFQId === rfq.id;
            const relatedBids = manufacturerBidsByRFQId[rfq.id] || [];

            return (
              <Card key={rfq.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{rfq.title}</CardTitle>
                      <CardDescription>
                        {rfq.jobId || 'No shared job ID'} · {rfq.buildingSpec || `${rfq.width} x ${rfq.length} x ${rfq.height}`} · {formatCurrency(Number(rfq.weight) || 0).replace('.00', '')} lbs
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{rfq.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div><span className="text-muted-foreground">Location:</span> {rfq.city || '-'}, {rfq.province || '-'}</div>
                    <div><span className="text-muted-foreground">Required By:</span> {rfq.requiredByDate || '-'}</div>
                    <div><span className="text-muted-foreground">Closing:</span> {rfq.closingDate || '-'}</div>
                    <div><span className="text-muted-foreground">Delivery:</span> {rfq.deliveryAddress || '-'}</div>
                  </div>

                  {rfq.notes && (
                    <div className="rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                      {rfq.notes}
                    </div>
                  )}

                  {myBid ? (
                    <div className="rounded-md border bg-muted/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Your Bid</p>
                        <Badge variant="secondary">{myBid.status}</Badge>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3 text-sm">
                        <div><span className="text-muted-foreground">Price/lb:</span> {formatCurrency(myBid.pricePerLb)}</div>
                        <div><span className="text-muted-foreground">Total:</span> {formatCurrency(myBid.totalPrice)}</div>
                        <div><span className="text-muted-foreground">Lead Time:</span> {myBid.leadTimeDays} days</div>
                      </div>
                      {myBid.notes && <p className="text-sm text-muted-foreground">{myBid.notes}</p>}
                      {rfq.status === 'Open' && (
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => {
                            setManufacturerBidRFQId(rfq.id);
                            setManufacturerBidDraft({
                              pricePerLb: String(myBid.pricePerLb || ''),
                              totalPrice: String(myBid.totalPrice || ''),
                              leadTimeDays: String(myBid.leadTimeDays || ''),
                              notes: myBid.notes || '',
                            });
                          }}>
                            Update Bid
                          </Button>
                          {myBid.status !== 'Withdrawn' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => updateManufacturerBidStatusMutation.mutate({ bidId: myBid.id, status: 'Withdrawn' })}
                            >
                              Withdraw Bid
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {rfq.status === 'Open' && !myBid && !isBidFormOpen && (
                    <Button type="button" variant="outline" onClick={() => {
                      setManufacturerBidRFQId(rfq.id);
                      setManufacturerBidDraft(createEmptyManufacturerBid());
                    }}>
                      Submit Bid
                    </Button>
                  )}

                  {isBidFormOpen && (
                    <div className="rounded-md border p-4 space-y-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Price per lb</Label>
                          <Input type="number" min="0" step="0.01" value={manufacturerBidDraft.pricePerLb} onChange={(event) => setManufacturerBidDraft((current) => ({ ...current, pricePerLb: event.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Total price</Label>
                          <Input type="number" min="0" step="0.01" value={manufacturerBidDraft.totalPrice} onChange={(event) => setManufacturerBidDraft((current) => ({ ...current, totalPrice: event.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Lead time (days)</Label>
                          <Input type="number" min="0" step="1" value={manufacturerBidDraft.leadTimeDays} onChange={(event) => setManufacturerBidDraft((current) => ({ ...current, leadTimeDays: event.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Notes</Label>
                        <Textarea value={manufacturerBidDraft.notes} onChange={(event) => setManufacturerBidDraft((current) => ({ ...current, notes: event.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onClick={() => submitManufacturerBidMutation.mutate(rfq)} disabled={submitManufacturerBidMutation.isPending}>
                          Submit Bid
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setManufacturerBidRFQId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {canManageBidBoard && relatedBids.length > 0 && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Submitted Bids</p>
                        <div className="flex gap-2">
                          {rfq.status === 'Open' && (
                            <Button type="button" variant="outline" size="sm" onClick={() => updateManufacturerRFQStatusMutation.mutate({ rfqId: rfq.id, status: 'Closed' })}>
                              Close RFQ
                            </Button>
                          )}
                          {rfq.status !== 'Cancelled' && (
                            <Button type="button" variant="outline" size="sm" onClick={() => updateManufacturerRFQStatusMutation.mutate({ rfqId: rfq.id, status: 'Cancelled' })}>
                              Cancel RFQ
                            </Button>
                          )}
                        </div>
                      </div>
                      {relatedBids.map((bid) => (
                        <div key={bid.id} className="rounded-md border bg-muted/10 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{bid.manufacturerName || bid.manufacturerId}</p>
                              <p className="text-sm text-muted-foreground">{bid.notes || 'No notes provided'}</p>
                            </div>
                            <div className="text-right text-sm">
                              <p>{formatCurrency(bid.totalPrice)}</p>
                              <p className="text-muted-foreground">{bid.leadTimeDays} days · {formatCurrency(bid.pricePerLb)}/lb</p>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button type="button" size="sm" onClick={() => updateManufacturerRFQStatusMutation.mutate({ rfqId: rfq.id, status: 'Awarded', awardedBidId: bid.id })}>
                              Award
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => updateManufacturerBidStatusMutation.mutate({ bidId: bid.id, status: 'Accepted' })}>
                              Accept Bid
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => updateManufacturerBidStatusMutation.mutate({ bidId: bid.id, status: 'Rejected' })}>
                              Reject Bid
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
                <JobIdSelect
                  value={jobDraft.sourceJobId}
                  onValueChange={(jobId) => setJobDraft(current => ({ ...current, sourceJobId: jobId }))}
                  allowedStates={['deal']}
                  placeholder="Select a deal job"
                  searchPlaceholder="Search deal jobs by job ID, client, or job name..."
                  triggerClassName="input-blue mt-1"
                />
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
                  <th className="pb-2 font-medium">Change Log</th>
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
                    <td className="py-2 text-xs text-muted-foreground">
                      {(eventsByBidId[row.bid.id] || []).slice(0, 3).map((event: any) => (
                        <div key={event.id} className="mb-1 last:mb-0">
                          <span className="font-medium capitalize">{String(event.event_type || '').replace(/_/g, ' ')}</span>
                          <span className="ml-1">{new Date(event.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                      {(eventsByBidId[row.bid.id] || []).length === 0 && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {canManageBidBoard && (
        <Card>
          <CardHeader>
            <CardTitle>Bid Review</CardTitle>
            <CardDescription>Operations review blind bids and their event history by request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(jobs || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No bid requests available.</p>
            ) : (
              (jobs || []).map((job: any) => {
                const reviewBids = allBidsByJobId[job.id] || [];
                return (
                  <div key={`review-${job.id}`} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.job_id || 'No shared job ID'} · {reviewBids.length} bids received</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{job.status || 'open'}</Badge>
                    </div>
                    {reviewBids.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No bids submitted yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {reviewBids.map((bid: any) => (
                          <div key={`review-bid-${bid.id}`} className="rounded-md bg-muted/20 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                              <div>
                                <p className="font-medium">Vendor {String(bid.vendor_id).slice(0, 8)}</p>
                                <p className="text-xs text-muted-foreground">{bid.details || 'No notes provided'}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono">{formatCurrency(bid.amount || 0)}</p>
                                <p className="text-xs text-muted-foreground">{bid.lead_time_days || 0} days</p>
                              </div>
                            </div>
                            <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                              {(eventsByBidId[bid.id] || []).length === 0 ? (
                                <p>No event history yet.</p>
                              ) : (
                                (eventsByBidId[bid.id] || []).map((event: any) => (
                                  <div key={event.id} className="flex items-center justify-between gap-3 py-1">
                                    <span className="capitalize">{String(event.event_type || '').replace(/_/g, ' ')}</span>
                                    <span>{new Date(event.created_at).toLocaleString()}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {canManageBidBoard && (
        <Card>
          <CardHeader>
            <CardTitle>Create Manufacturer RFQ</CardTitle>
            <CardDescription>Publish steel-package requests for manufacturer users to bid on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1">
                <Label>Shared Job ID</Label>
                <JobIdSelect
                  value={manufacturerRFQDraft.jobId}
                  onValueChange={(jobId) => {
                    const sourceDeal = deals.find((deal) => deal.jobId === jobId);
                    setManufacturerRFQDraft((current) => ({
                      ...current,
                      jobId,
                      title: current.title || sourceDeal?.jobName || '',
                      province: current.province || sourceDeal?.province || '',
                      city: current.city || sourceDeal?.city || '',
                      deliveryAddress: current.deliveryAddress || sourceDeal?.address || '',
                      width: current.width || String(sourceDeal?.width || ''),
                      length: current.length || String(sourceDeal?.length || ''),
                      height: current.height || String(sourceDeal?.height || ''),
                      weight: current.weight || String(sourceDeal?.weight || ''),
                    }));
                  }}
                  allowedStates={['deal']}
                  includeCreateNew={false}
                  placeholder="Select a deal job"
                  searchPlaceholder="Search deal jobs by job ID, client, or job name..."
                  triggerClassName="input-blue mt-1"
                />
              </div>
              <div className="space-y-1">
                <Label>RFQ Title</Label>
                <Input value={manufacturerRFQDraft.title} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Building Spec</Label>
                <Input value={manufacturerRFQDraft.buildingSpec} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, buildingSpec: event.target.value }))} placeholder="80x120x24 single slope" />
              </div>
              <div className="space-y-1">
                <Label>Width</Label>
                <Input type="number" value={manufacturerRFQDraft.width} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, width: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Length</Label>
                <Input type="number" value={manufacturerRFQDraft.length} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, length: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Height</Label>
                <Input type="number" value={manufacturerRFQDraft.height} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, height: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Weight (lbs)</Label>
                <Input type="number" value={manufacturerRFQDraft.weight} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, weight: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Province</Label>
                <Input value={manufacturerRFQDraft.province} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, province: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={manufacturerRFQDraft.city} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, city: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Required By</Label>
                <Input type="date" value={manufacturerRFQDraft.requiredByDate} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, requiredByDate: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Closing Date</Label>
                <Input type="date" value={manufacturerRFQDraft.closingDate} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, closingDate: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Delivery Address</Label>
              <Input value={manufacturerRFQDraft.deliveryAddress} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, deliveryAddress: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={manufacturerRFQDraft.notes} onChange={(event) => setManufacturerRFQDraft((current) => ({ ...current, notes: event.target.value }))} />
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => createManufacturerRFQMutation.mutate()} disabled={createManufacturerRFQMutation.isPending}>
                Create Manufacturer RFQ
              </Button>
            </div>
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
