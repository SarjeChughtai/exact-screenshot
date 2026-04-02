import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { JobIdSelect } from '@/components/JobIdSelect';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { findJobProfile } from '@/lib/jobProfiles';
import { constructionBidFromRow, constructionBidToRow, constructionRFQFromRow, constructionRFQToRow } from '@/lib/supabaseMappers';
import { buildConstructionEvent, recordJobStreamEvent } from '@/lib/jobStreams';
import { formatCurrency } from '@/lib/calculations';
import type { ConstructionBid, ConstructionBidScope, ConstructionRFQ, ConstructionRFQScope } from '@/types';
import { toast } from 'sonner';
import { useSharedJobs } from '@/lib/sharedJobs';

const EMPTY_RFQ_DRAFT = {
  jobId: '',
  scope: 'install' as ConstructionRFQScope,
  requiredByDate: '',
  closingDate: '',
  notes: '',
};

const EMPTY_BID_DRAFT = {
  bidScope: 'install_only' as ConstructionBidScope,
  installAmount: '',
  concreteAmount: '',
  totalAmount: '',
  notes: '',
};

export default function ConstructionBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { deals, quotes, jobProfiles } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { settings } = useSettings();
  const { allJobs } = useSharedJobs();
  const canManage = hasAnyRole('admin', 'owner', 'operations');
  const [rfqDialogOpen, setRfqDialogOpen] = useState(false);
  const [rfqDraft, setRfqDraft] = useState(EMPTY_RFQ_DRAFT);
  const [selectedRFQ, setSelectedRFQ] = useState<ConstructionRFQ | null>(null);
  const [bidDraft, setBidDraft] = useState(EMPTY_BID_DRAFT);

  const rfqsQuery = useQuery({
    queryKey: ['construction-rfqs'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('construction_rfqs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(constructionRFQFromRow) as ConstructionRFQ[];
    },
  });

  const bidsQuery = useQuery({
    queryKey: ['construction-bids', currentUser.id, canManage],
    queryFn: async () => {
      let query = (supabase.from as any)('construction_bids')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (!canManage) {
        query = query.eq('vendor_id', currentUser.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(constructionBidFromRow) as ConstructionBid[];
    },
  });

  const bidsByRFQ = useMemo(() => {
    return (bidsQuery.data || []).reduce<Record<string, ConstructionBid[]>>((accumulator, bid) => {
      accumulator[bid.rfqId] = [...(accumulator[bid.rfqId] || []), bid];
      return accumulator;
    }, {});
  }, [bidsQuery.data]);

  const rfqPreview = useMemo(() => {
    if (!rfqDraft.jobId) return null;
    const profile = findJobProfile(jobProfiles, rfqDraft.jobId);
    const deal = deals.find(item => item.jobId === rfqDraft.jobId);
    const quote = quotes.find(item => item.jobId === rfqDraft.jobId);
    return {
      jobId: rfqDraft.jobId,
      jobName: profile?.jobName || deal?.jobName || quote?.jobName || '',
      clientName: profile?.clientName || deal?.clientName || quote?.clientName || '',
      province: profile?.province || deal?.province || quote?.province || '',
      city: profile?.city || deal?.city || quote?.city || '',
      postalCode: profile?.postalCode || deal?.postalCode || quote?.postalCode || '',
      address: profile?.address || deal?.address || quote?.address || '',
      width: profile?.width || deal?.width || quote?.width || 0,
      length: profile?.length || deal?.length || quote?.length || 0,
      height: profile?.height || deal?.height || quote?.height || 0,
    };
  }, [deals, jobProfiles, quotes, rfqDraft.jobId]);

  const createRFQMutation = useMutation({
    mutationFn: async () => {
      if (!rfqPreview) {
        throw new Error('Select a job before posting a construction RFQ.');
      }

      const payload: ConstructionRFQ = {
        id: crypto.randomUUID(),
        jobId: rfqPreview.jobId,
        title: rfqDraft.scope === 'install_plus_concrete' ? 'Install + Concrete Bid Request' : 'Install Bid Request',
        scope: rfqDraft.scope,
        buildingDetails: `${rfqPreview.width}x${rfqPreview.length}x${rfqPreview.height}`,
        jobName: rfqPreview.jobName,
        province: rfqPreview.province,
        city: rfqPreview.city,
        postalCode: rfqPreview.postalCode,
        address: rfqPreview.address,
        width: rfqPreview.width,
        length: rfqPreview.length,
        height: rfqPreview.height,
        notes: rfqDraft.notes,
        requiredByDate: rfqDraft.requiredByDate,
        closingDate: rfqDraft.closingDate,
        status: 'Open',
        createdByUserId: currentUser.id || null,
      };

      const { error } = await (supabase.from as any)('construction_rfqs').insert(constructionRFQToRow(payload));
      if (error) throw error;
      return payload;
    },
    onSuccess: async (payload) => {
      const record = allJobs.find(job => job.jobId === payload.jobId) || null;
      await queryClient.invalidateQueries({ queryKey: ['construction-rfqs'] });
      await queryClient.invalidateQueries({ queryKey: ['job-stream-summaries'] });
      await recordJobStreamEvent({
        jobId: payload.jobId,
        actor: { id: currentUser.id, name: currentUser.name },
        record,
        personnel: settings.personnel,
        draft: buildConstructionEvent('construction_rfq_posted', payload),
      });
      setRfqDialogOpen(false);
      setRfqDraft(EMPTY_RFQ_DRAFT);
      toast.success('Construction RFQ posted.');
    },
    onError: (error: any) => toast.error(error?.message || 'Unable to create construction RFQ.'),
  });

  const submitBidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRFQ) throw new Error('Select an RFQ before submitting a bid.');
      const payload: ConstructionBid = {
        id: crypto.randomUUID(),
        rfqId: selectedRFQ.id,
        vendorId: currentUser.id || '',
        vendorName: currentUser.name || currentUser.email || 'Construction Vendor',
        bidScope: bidDraft.bidScope,
        installAmount: Number(bidDraft.installAmount) || 0,
        concreteAmount: Number(bidDraft.concreteAmount) || 0,
        totalAmount: Number(bidDraft.totalAmount) || 0,
        notes: bidDraft.notes,
        status: 'Submitted',
      };

      const { error } = await (supabase.from as any)('construction_bids')
        .upsert(constructionBidToRow(payload), { onConflict: 'rfq_id,vendor_id' });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['construction-bids'] });
      setSelectedRFQ(null);
      setBidDraft(EMPTY_BID_DRAFT);
      toast.success('Construction bid submitted.');
    },
    onError: (error: any) => toast.error(error?.message || 'Unable to submit construction bid.'),
  });

  const updateRFQStatus = async (rfq: ConstructionRFQ, status: ConstructionRFQ['status'], awardedBidId?: string | null) => {
    const { error } = await (supabase.from as any)('construction_rfqs')
      .update({ status, awarded_bid_id: awardedBidId || null })
      .eq('id', rfq.id);
    if (error) {
      toast.error('Unable to update construction RFQ.');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['construction-rfqs'] });
    await queryClient.invalidateQueries({ queryKey: ['construction-bids'] });
    await queryClient.invalidateQueries({ queryKey: ['job-stream-summaries'] });
    if (status === 'Awarded') {
      const awardedBid = (bidsByRFQ[rfq.id] || []).find(bid => bid.id === awardedBidId) || null;
      const record = allJobs.find(job => job.jobId === rfq.jobId) || null;
      await recordJobStreamEvent({
        jobId: rfq.jobId,
        actor: { id: currentUser.id, name: currentUser.name },
        record,
        personnel: settings.personnel,
        draft: buildConstructionEvent('construction_rfq_awarded', { ...rfq, status, awardedBidId: awardedBidId || null }, awardedBid),
      });
    }
  };

  const rfqs = rfqsQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Construction Board</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Post install and install-plus-concrete requests from a job, then collect construction bids without exposing client names or internal costs to vendors.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setRfqDialogOpen(true)}>Post Construction RFQ</Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Job</th>
              {canManage && <th className="px-3 py-2 font-medium">Client</th>}
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Building</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Close</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Bids</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rfqs.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-3 py-8 text-center text-muted-foreground">No construction RFQs posted.</td>
              </tr>
            ) : rfqs.map(rfq => {
              const profile = findJobProfile(jobProfiles, rfq.jobId);
              const rfqBids = bidsByRFQ[rfq.id] || [];
              return (
                <tr key={rfq.id} className="border-b align-top last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{rfq.jobId}</div>
                    <div className="text-xs text-muted-foreground">{rfq.jobName || profile?.jobName || 'Unnamed job'}</div>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-xs">{profile?.clientName || 'Unassigned'}</td>
                  )}
                  <td className="px-3 py-2 text-xs">{rfq.scope === 'install_plus_concrete' ? 'Install + Concrete' : 'Install'}</td>
                  <td className="px-3 py-2 text-xs">{rfq.width}x{rfq.length}x{rfq.height}</td>
                  <td className="px-3 py-2 text-xs">{[rfq.city, rfq.province, rfq.postalCode].filter(Boolean).join(', ')}</td>
                  <td className="px-3 py-2 text-xs">{rfq.closingDate || '-'}</td>
                  <td className="px-3 py-2 text-xs">{rfq.status}</td>
                  <td className="px-3 py-2 text-xs">{rfqBids.length}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {!canManage && rfq.status === 'Open' && (
                        <Button size="sm" variant="outline" onClick={() => setSelectedRFQ(rfq)}>Submit Bid</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => navigate(`/messages?jobStream=${encodeURIComponent(rfq.jobId)}`)}>
                        Open Stream
                      </Button>
                      {canManage && rfq.status === 'Open' && (
                        <Button size="sm" variant="outline" onClick={() => void updateRFQStatus(rfq, 'Closed')}>Close</Button>
                      )}
                    </div>
                    {canManage && rfqBids.length > 0 && (
                      <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-2">
                        {rfqBids.map(bid => (
                          <div key={bid.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div>
                              <div className="font-medium">{bid.vendorName}</div>
                              <div className="text-muted-foreground">
                                {bid.bidScope.replace(/_/g, ' ')} | Install {formatCurrency(bid.installAmount)} | Concrete {formatCurrency(bid.concreteAmount)} | Total {formatCurrency(bid.totalAmount)}
                              </div>
                              {bid.notes && <div className="text-muted-foreground">{bid.notes}</div>}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => void updateRFQStatus(rfq, 'Awarded', bid.id)}>Award</Button>
                              <Button size="sm" variant="ghost" onClick={async () => {
                                const { error } = await (supabase.from as any)('construction_bids').update({ status: 'Rejected' }).eq('id', bid.id);
                                if (error) {
                                  toast.error('Unable to reject bid.');
                                  return;
                                }
                                await queryClient.invalidateQueries({ queryKey: ['construction-bids'] });
                              }}>Reject</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={rfqDialogOpen} onOpenChange={setRfqDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post Construction RFQ</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Job ID</Label>
              <JobIdSelect
                value={rfqDraft.jobId}
                onValueChange={jobId => setRfqDraft(current => ({ ...current, jobId }))}
                placeholder="Select job..."
                triggerClassName="w-full justify-between font-normal"
              />
            </div>
            {rfqPreview && (
              <div className="md:col-span-2 rounded-md border bg-muted/20 p-3 text-xs">
                <p className="font-medium">{rfqPreview.jobName || rfqPreview.jobId}</p>
                <p className="text-muted-foreground">{rfqPreview.width}x{rfqPreview.length}x{rfqPreview.height}</p>
                <p className="text-muted-foreground">{[rfqPreview.address, rfqPreview.city, rfqPreview.province, rfqPreview.postalCode].filter(Boolean).join(', ')}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={rfqDraft.scope} onValueChange={(value: ConstructionRFQScope) => setRfqDraft(current => ({ ...current, scope: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="install">Install</SelectItem>
                  <SelectItem value="install_plus_concrete">Install + Concrete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Required By</Label>
              <Input type="date" value={rfqDraft.requiredByDate} onChange={event => setRfqDraft(current => ({ ...current, requiredByDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Closing Date</Label>
              <Input type="date" value={rfqDraft.closingDate} onChange={event => setRfqDraft(current => ({ ...current, closingDate: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Requirements / Notes</Label>
              <Textarea value={rfqDraft.notes} onChange={event => setRfqDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Install notes, concrete notes, site access, exclusions..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRfqDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createRFQMutation.mutate()} disabled={createRFQMutation.isPending}>Post RFQ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedRFQ)} onOpenChange={open => !open && setSelectedRFQ(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit Construction Bid</DialogTitle>
          </DialogHeader>
          {selectedRFQ && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/20 p-3 text-xs">
                <p className="font-medium">{selectedRFQ.jobId} - {selectedRFQ.jobName || 'Unnamed job'}</p>
                <p className="text-muted-foreground">{selectedRFQ.width}x{selectedRFQ.length}x{selectedRFQ.height}</p>
                <p className="text-muted-foreground">{[selectedRFQ.address, selectedRFQ.city, selectedRFQ.province, selectedRFQ.postalCode].filter(Boolean).join(', ')}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Bid Scope</Label>
                  <Select value={bidDraft.bidScope} onValueChange={(value: ConstructionBidScope) => setBidDraft(current => ({ ...current, bidScope: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="install_only">Install Only</SelectItem>
                      <SelectItem value="concrete_only">Concrete Only</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Install Amount</Label>
                  <Input value={bidDraft.installAmount} onChange={event => setBidDraft(current => ({ ...current, installAmount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Concrete Amount</Label>
                  <Input value={bidDraft.concreteAmount} onChange={event => setBidDraft(current => ({ ...current, concreteAmount: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Total Amount</Label>
                  <Input value={bidDraft.totalAmount} onChange={event => setBidDraft(current => ({ ...current, totalAmount: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={bidDraft.notes} onChange={event => setBidDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Crew assumptions, exclusions, site notes..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedRFQ(null)}>Cancel</Button>
                <Button onClick={() => submitBidMutation.mutate()} disabled={submitBidMutation.isPending}>Submit Bid</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
