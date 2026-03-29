import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ManufacturerRFQ, ManufacturerBid, ManufacturerBidStatus } from '@/types';
import { toast } from 'sonner';
import { Factory, Send, ChevronDown, ChevronUp, Clock, DollarSign } from 'lucide-react';

function formatWeight(weight: number): string {
  return weight > 0 ? `${weight.toLocaleString()} lbs` : 'Weight TBD';
}

const statusColors: Record<string, string> = {
  Open: 'bg-green-100 text-green-800',
  Closed: 'bg-gray-100 text-gray-800',
  Awarded: 'bg-blue-100 text-blue-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const bidStatusColors: Record<ManufacturerBidStatus, string> = {
  Submitted: 'bg-yellow-100 text-yellow-800',
  'Under Review': 'bg-blue-100 text-blue-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Withdrawn: 'bg-gray-100 text-gray-800',
};

export default function ManufacturerPortal() {
  const { manufacturerRFQs, manufacturerBids, addManufacturerBid, updateManufacturerBid } = useAppContext();
  const { currentUser } = useRoles();
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bidFormRFQId, setBidFormRFQId] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'my-bids'>('open');

  const [bidForm, setBidForm] = useState({
    pricePerLb: '',
    totalPrice: '',
    leadTimeDays: '',
    notes: '',
  });

  const manufacturerId = user?.id || '';
  const manufacturerName = currentUser?.name || user?.email || '';

  // Only show Open RFQs to manufacturers
  const openRFQs = useMemo(() =>
    manufacturerRFQs.filter(r => r.status === 'Open'),
    [manufacturerRFQs]
  );

  const myBids = useMemo(() =>
    manufacturerBids.filter(b => b.manufacturerId === manufacturerId),
    [manufacturerBids, manufacturerId]
  );

  const hasBidOnRFQ = (rfqId: string) => {
    return manufacturerBids.some(b => b.rfqId === rfqId && b.manufacturerId === manufacturerId);
  };

  const getMyBidForRFQ = (rfqId: string) => {
    return manufacturerBids.find(b => b.rfqId === rfqId && b.manufacturerId === manufacturerId);
  };

  const getRFQForBid = (rfqId: string) => {
    return manufacturerRFQs.find(r => r.id === rfqId);
  };

  const submitBid = (rfqId: string) => {
    if (!bidForm.totalPrice) { toast.error('Total price is required'); return; }
    if (!bidForm.leadTimeDays) { toast.error('Lead time is required'); return; }
    if (!manufacturerName) { toast.error('Manufacturer name is not available'); return; }

    const rfq = manufacturerRFQs.find(r => r.id === rfqId);
    if (!rfq || rfq.status !== 'Open') {
      toast.error('This RFQ is no longer accepting bids');
      return;
    }

    if (hasBidOnRFQ(rfqId)) {
      toast.error('You have already submitted a bid for this RFQ');
      return;
    }

    const bid: ManufacturerBid = {
      id: crypto.randomUUID(),
      rfqId,
      manufacturerId,
      manufacturerName,
      pricePerLb: Number(bidForm.pricePerLb) || 0,
      totalPrice: Number(bidForm.totalPrice),
      leadTimeDays: Number(bidForm.leadTimeDays),
      notes: bidForm.notes,
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
    };

    addManufacturerBid(bid);
    toast.success('Bid submitted successfully');
    setBidFormRFQId(null);
    setBidForm({ pricePerLb: '', totalPrice: '', leadTimeDays: '', notes: '' });
  };

  const withdrawBid = (bidId: string) => {
    updateManufacturerBid(bidId, { status: 'Withdrawn' });
    toast.success('Bid withdrawn');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Factory className="h-6 w-6" /> Manufacturer Portal
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          View available RFQs and submit your bids
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'open' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('open')}
        >
          Open RFQs ({openRFQs.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'my-bids' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('my-bids')}
        >
          My Bids ({myBids.length})
        </button>
      </div>

      {/* Open RFQs Tab */}
      {tab === 'open' && (
        <div className="space-y-3">
          {openRFQs.length === 0 ? (
            <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
              No open RFQs at this time. Check back later for new opportunities.
            </div>
          ) : openRFQs.map(rfq => {
            const isExpanded = expandedId === rfq.id;
            const myBid = getMyBidForRFQ(rfq.id);
            const showBidForm = bidFormRFQId === rfq.id;

            return (
              <div key={rfq.id} className="bg-card border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(isExpanded ? null : rfq.id)}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{rfq.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {rfq.buildingSpec} • {formatWeight(rfq.weight)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {myBid && <Badge className={`text-[10px] ${bidStatusColors[myBid.status]}`}>Bid: {myBid.status}</Badge>}
                    {rfq.closingDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />Closes: {rfq.closingDate}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div><span className="text-muted-foreground">Dimensions:</span> {rfq.width}'W × {rfq.length}'L × {rfq.height}'H</div>
                      <div><span className="text-muted-foreground">Weight:</span> {formatWeight(rfq.weight)}</div>
                      <div><span className="text-muted-foreground">Location:</span> {rfq.city}, {rfq.province}</div>
                      <div><span className="text-muted-foreground">Delivery:</span> {rfq.deliveryAddress || '—'}</div>
                      <div><span className="text-muted-foreground">Required By:</span> {rfq.requiredByDate || '—'}</div>
                      <div><span className="text-muted-foreground">Posted:</span> {new Date(rfq.createdAt).toLocaleDateString()}</div>
                    </div>
                    {rfq.notes && (
                      <div className="text-xs bg-muted/50 rounded p-3">
                        <span className="font-medium">Specifications & Notes:</span>
                        <p className="mt-1 whitespace-pre-wrap">{rfq.notes}</p>
                      </div>
                    )}

                    {/* My existing bid or bid form */}
                    {myBid ? (
                      <div className="bg-muted/30 border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold flex items-center gap-1">
                            <DollarSign className="h-4 w-4" /> Your Bid
                          </h4>
                          <Badge className={bidStatusColors[myBid.status]}>{myBid.status}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div><span className="text-muted-foreground">Price/lb:</span> {formatCurrency(myBid.pricePerLb)}</div>
                          <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">{formatCurrency(myBid.totalPrice)}</span></div>
                          <div><span className="text-muted-foreground">Lead Time:</span> {myBid.leadTimeDays} days</div>
                        </div>
                        {myBid.notes && <p className="text-xs mt-2 text-muted-foreground">{myBid.notes}</p>}
                        {myBid.status === 'Submitted' && (
                          <Button size="sm" variant="destructive" className="mt-3" onClick={() => withdrawBid(myBid.id)}>
                            Withdraw Bid
                          </Button>
                        )}
                      </div>
                    ) : showBidForm ? (
                      <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
                        <h4 className="text-sm font-semibold">Submit Your Bid</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Price per lb ($)</Label>
                            <Input className="input-blue mt-1" type="number" step="0.01" value={bidForm.pricePerLb} onChange={e => setBidForm(f => ({ ...f, pricePerLb: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs">Total Price ($) *</Label>
                            <Input className="input-blue mt-1" type="number" step="0.01" value={bidForm.totalPrice} onChange={e => setBidForm(f => ({ ...f, totalPrice: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs">Lead Time (days) *</Label>
                            <Input className="input-blue mt-1" type="number" value={bidForm.leadTimeDays} onChange={e => setBidForm(f => ({ ...f, leadTimeDays: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Notes</Label>
                          <Textarea className="text-xs min-h-[60px] mt-1" value={bidForm.notes} onChange={e => setBidForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details about your bid..." />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => submitBid(rfq.id)}>
                            <Send className="h-4 w-4 mr-1" />Submit Bid
                          </Button>
                          <Button variant="ghost" onClick={() => { setBidFormRFQId(null); setBidForm({ pricePerLb: '', totalPrice: '', leadTimeDays: '', notes: '' }); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => setBidFormRFQId(rfq.id)}>
                        <Send className="h-4 w-4 mr-1" />Place a Bid
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* My Bids Tab */}
      {tab === 'my-bids' && (
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground text-xs">
                {['RFQ', 'Building', 'Price/lb', 'Total Price', 'Lead Time', 'Status', 'Submitted'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myBids.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No bids submitted yet. View open RFQs to place your first bid.</td></tr>
              ) : myBids.map(bid => {
                const rfq = getRFQForBid(bid.rfqId);
                return (
                  <tr key={bid.id} className="border-b hover:bg-muted/50">
                    <td className="px-3 py-2 text-xs font-medium">{rfq?.title || bid.rfqId}</td>
                    <td className="px-3 py-2 text-xs">{rfq?.buildingSpec || '—'}</td>
                    <td className="px-3 py-2 text-xs">{formatCurrency(bid.pricePerLb)}</td>
                    <td className="px-3 py-2 text-xs font-medium">{formatCurrency(bid.totalPrice)}</td>
                    <td className="px-3 py-2 text-xs">{bid.leadTimeDays} days</td>
                    <td className="px-3 py-2">
                      <Badge className={`text-[10px] ${bidStatusColors[bid.status]}`}>{bid.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{new Date(bid.submittedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
