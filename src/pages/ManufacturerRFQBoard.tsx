import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { formatCurrency } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { JobIdSelect } from '@/components/JobIdSelect';
import type { ManufacturerRFQ, ManufacturerRFQStatus, ManufacturerBid } from '@/types';
import { toast } from 'sonner';
import { Factory, Plus, ChevronDown, ChevronUp, Award, X } from 'lucide-react';

const STATUSES: ManufacturerRFQStatus[] = ['Open', 'Closed', 'Awarded', 'Cancelled'];

function formatWeight(weight: number): string {
  return weight > 0 ? `${weight.toLocaleString()} lbs` : 'Weight TBD';
}

const statusColors: Record<ManufacturerRFQStatus, string> = {
  Open: 'bg-green-100 text-green-800',
  Closed: 'bg-gray-100 text-gray-800',
  Awarded: 'bg-blue-100 text-blue-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const bidStatusColors: Record<string, string> = {
  Submitted: 'bg-yellow-100 text-yellow-800',
  'Under Review': 'bg-blue-100 text-blue-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Withdrawn: 'bg-gray-100 text-gray-800',
};

export default function ManufacturerRFQBoard() {
  const {
    deals, manufacturerRFQs, manufacturerBids,
    addManufacturerRFQ, updateManufacturerRFQ, deleteManufacturerRFQ,
    updateManufacturerBid,
  } = useAppContext();
  const { hasAnyRole, currentUser } = useRoles();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const canEdit = hasAnyRole('admin', 'owner', 'operations');

  const [form, setForm] = useState<Partial<ManufacturerRFQ>>({
    jobId: '', title: '', buildingSpec: '',
    width: 0, length: 0, height: 0, weight: 0,
    province: '', city: '', deliveryAddress: '',
    requiredByDate: '', notes: '', status: 'Open',
    closingDate: '',
  });

  const handleJobSelect = (jobId: string) => {
    const deal = deals.find(d => d.jobId === jobId);
    if (deal) {
      setForm(prev => ({
        ...prev,
        jobId: deal.jobId,
        title: `Steel Building — ${deal.jobName || deal.clientName}`,
        buildingSpec: `${deal.width}'W × ${deal.length}'L × ${deal.height}'H`,
        width: deal.width,
        length: deal.length,
        height: deal.height,
        weight: deal.weight,
        province: deal.province,
        city: deal.city,
        deliveryAddress: deal.address || `${deal.city}, ${deal.province}`,
      }));
    }
  };

  const saveRFQ = () => {
    if (!form.title?.trim()) { toast.error('Title is required'); return; }
    if (!form.width || !form.length) { toast.error('Building dimensions are required'); return; }

    const rfq: ManufacturerRFQ = {
      id: crypto.randomUUID(),
      jobId: form.jobId || '',
      title: form.title!,
      buildingSpec: form.buildingSpec || `${form.width}'W × ${form.length}'L × ${form.height}'H`,
      width: form.width || 0,
      length: form.length || 0,
      height: form.height || 0,
      weight: form.weight || 0,
      province: form.province || '',
      city: form.city || '',
      deliveryAddress: form.deliveryAddress || '',
      requiredByDate: form.requiredByDate || '',
      notes: form.notes || '',
      status: 'Open',
      createdBy: currentUser?.name || 'System',
      createdAt: new Date().toISOString(),
      closingDate: form.closingDate || '',
      awardedBidId: '',
    };

    addManufacturerRFQ(rfq);
    toast.success('Manufacturer RFQ posted');
    setShowForm(false);
    setForm({
      jobId: '', title: '', buildingSpec: '',
      width: 0, length: 0, height: 0, weight: 0,
      province: '', city: '', deliveryAddress: '',
      requiredByDate: '', notes: '', status: 'Open', closingDate: '',
    });
  };

  const awardBid = (rfqId: string, bidId: string) => {
    updateManufacturerRFQ(rfqId, { status: 'Awarded', awardedBidId: bidId });
    updateManufacturerBid(bidId, { status: 'Accepted' });
    // Reject other bids for this RFQ
    manufacturerBids
      .filter(b => b.rfqId === rfqId && b.id !== bidId)
      .forEach(b => updateManufacturerBid(b.id, { status: 'Rejected' }));
    toast.success('Bid awarded successfully');
  };

  const filteredRFQs = useMemo(() => {
    return manufacturerRFQs.filter(r => filterStatus === 'all' || r.status === filterStatus);
  }, [manufacturerRFQs, filterStatus]);

  const getBidsForRFQ = (rfqId: string): ManufacturerBid[] => {
    return manufacturerBids.filter(b => b.rfqId === rfqId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="h-6 w-6" /> Manufacturer RFQ Board
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Post RFQs for manufacturers to bid on steel building jobs
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X className="h-4 w-4 mr-1" />Cancel</> : <><Plus className="h-4 w-4 mr-1" />Post RFQ</>}
          </Button>
        )}
      </div>

      {/* New RFQ Form */}
      {showForm && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">New Manufacturer RFQ</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Link to Deal (optional)</Label>
              <JobIdSelect value={form.jobId || ''} onChange={handleJobSelect} deals={deals} allowedStates={['deal']} />
            </div>
            <div>
              <Label className="text-xs">Title *</Label>
              <Input className="input-blue mt-1" value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Steel Building — Client Name" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div><Label className="text-xs">Width (ft) *</Label><Input className="input-blue mt-1" type="number" value={form.width || ''} onChange={e => setForm(f => ({ ...f, width: Number(e.target.value) }))} /></div>
            <div><Label className="text-xs">Length (ft) *</Label><Input className="input-blue mt-1" type="number" value={form.length || ''} onChange={e => setForm(f => ({ ...f, length: Number(e.target.value) }))} /></div>
            <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" type="number" value={form.height || ''} onChange={e => setForm(f => ({ ...f, height: Number(e.target.value) }))} /></div>
            <div><Label className="text-xs">Est. Weight (lbs)</Label><Input className="input-blue mt-1" type="number" value={form.weight || ''} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))} /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Province</Label><Input className="input-blue mt-1" value={form.province || ''} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} /></div>
            <div><Label className="text-xs">City</Label><Input className="input-blue mt-1" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div><Label className="text-xs">Delivery Address</Label><Input className="input-blue mt-1" value={form.deliveryAddress || ''} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Required By Date</Label><Input className="input-blue mt-1" type="date" value={form.requiredByDate || ''} onChange={e => setForm(f => ({ ...f, requiredByDate: e.target.value }))} /></div>
            <div><Label className="text-xs">Closing Date</Label><Input className="input-blue mt-1" type="date" value={form.closingDate || ''} onChange={e => setForm(f => ({ ...f, closingDate: e.target.value }))} /></div>
          </div>

          <div>
            <Label className="text-xs">Notes / Specifications</Label>
            <Textarea className="text-xs min-h-[80px] mt-1" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional building specifications, requirements..." />
          </div>

          <Button onClick={saveRFQ} className="w-full">Post RFQ to Manufacturers</Button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{filteredRFQs.length} RFQ(s)</span>
      </div>

      {/* RFQ List */}
      <div className="space-y-3">
        {filteredRFQs.length === 0 ? (
          <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
            No manufacturer RFQs posted yet. Click "Post RFQ" to get started.
          </div>
        ) : filteredRFQs.map(rfq => {
          const bids = getBidsForRFQ(rfq.id);
          const isExpanded = expandedId === rfq.id;

          return (
            <div key={rfq.id} className="bg-card border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(isExpanded ? null : rfq.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{rfq.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {rfq.buildingSpec} • {formatWeight(rfq.weight)} • {rfq.city}, {rfq.province}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge className={statusColors[rfq.status]}>{rfq.status}</Badge>
                  <span className="text-xs text-muted-foreground">{bids.length} bid(s)</span>
                  {rfq.closingDate && <span className="text-xs text-muted-foreground">Closes: {rfq.closingDate}</span>}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-4 py-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-muted-foreground">Job ID:</span> {rfq.jobId || '—'}</div>
                    <div><span className="text-muted-foreground">Required By:</span> {rfq.requiredByDate || '—'}</div>
                    <div><span className="text-muted-foreground">Created:</span> {new Date(rfq.createdAt).toLocaleDateString()}</div>
                    <div><span className="text-muted-foreground">Delivery:</span> {rfq.deliveryAddress || '—'}</div>
                    <div><span className="text-muted-foreground">Posted By:</span> {rfq.createdBy}</div>
                  </div>
                  {rfq.notes && (
                    <div className="text-xs"><span className="text-muted-foreground">Notes:</span> {rfq.notes}</div>
                  )}

                  {/* Bids Table */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Bids ({bids.length})</h4>
                    {bids.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No bids received yet.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted text-xs">
                            {['Manufacturer', 'Price/lb', 'Total Price', 'Lead Time', 'Status', 'Submitted', 'Notes', ''].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bids.map(bid => (
                            <tr key={bid.id} className="border-b hover:bg-muted/30">
                              <td className="px-3 py-2 text-xs font-medium">{bid.manufacturerName}</td>
                              <td className="px-3 py-2 text-xs">{formatCurrency(bid.pricePerLb)}</td>
                              <td className="px-3 py-2 text-xs font-medium">{formatCurrency(bid.totalPrice)}</td>
                              <td className="px-3 py-2 text-xs">{bid.leadTimeDays} days</td>
                              <td className="px-3 py-2">
                                <Badge className={`text-[10px] ${bidStatusColors[bid.status] || ''}`}>{bid.status}</Badge>
                              </td>
                              <td className="px-3 py-2 text-xs">{new Date(bid.submittedAt).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-xs max-w-[150px] truncate">{bid.notes || '—'}</td>
                              <td className="px-3 py-2">
                                {canEdit && rfq.status === 'Open' && bid.status === 'Submitted' && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => awardBid(rfq.id, bid.id)}>
                                    <Award className="h-3 w-3 mr-1" />Award
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex gap-2 pt-2 border-t">
                      {rfq.status === 'Open' && (
                        <Button size="sm" variant="outline" onClick={() => updateManufacturerRFQ(rfq.id, { status: 'Closed' })}>Close RFQ</Button>
                      )}
                      {rfq.status !== 'Awarded' && (
                        <Button size="sm" variant="destructive" onClick={() => {
                          deleteManufacturerRFQ(rfq.id);
                          setExpandedId(null);
                        }}>Delete</Button>
                      )}
                      {rfq.status === 'Cancelled' && (
                        <Button size="sm" variant="outline" onClick={() => updateManufacturerRFQ(rfq.id, { status: 'Open' })}>Re-open</Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
