import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { exportToCSV, csvCurrency } from '@/lib/csvExport';
import { PageActions } from '@/components/PageActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { RFQ, RFQStatus } from '@/types';
import { toast } from 'sonner';

const STATUSES: RFQStatus[] = ['Draft', 'Sent', 'Quoted', 'Accepted', 'Declined', 'Expired'];

export default function RFQWorkflow() {
  const { rfqs, addRFQ, updateRFQ, deleteRFQ, deals, freight, updateFreight, addFreight } = useAppContext();
  const { hasAnyRole } = useRoles();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<RFQ>>({
    jobId: '', clientName: '', buildingSize: '', weight: 0,
    pickupAddress: 'Bradford, ON', deliveryAddress: '',
    carriers: [], quotedPrices: {}, selectedCarrier: '', selectedPrice: 0,
    status: 'Draft', sentDate: '', responseDate: '', notes: ''
  });

  const canEdit = hasAnyRole('admin', 'owner', 'freight', 'operations');

  // New carrier input inside expanded view
  const [newCarrier, setNewCarrier] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // Form handler
  const handleJobSelect = (jobId: string) => {
    const deal = deals.find(d => d.jobId === jobId);
    if (deal) {
      setForm({
        ...form,
        jobId: deal.jobId,
        clientName: deal.clientName,
        buildingSize: `${deal.width}x${deal.length}x${deal.height}`,
        weight: deal.weight,
        deliveryAddress: deal.address || `${deal.city}, ${deal.province}`,
      });
    }
  };

  const saveRFQ = () => {
    if (!form.jobId) {
      toast.error('Please select a Job ID');
      return;
    }
    const rfq: RFQ = {
      id: crypto.randomUUID(),
      jobId: form.jobId!,
      clientName: form.clientName!,
      buildingSize: form.buildingSize!,
      weight: form.weight!,
      pickupAddress: form.pickupAddress!,
      deliveryAddress: form.deliveryAddress!,
      carriers: form.carriers || [],
      quotedPrices: form.quotedPrices || {},
      selectedCarrier: form.selectedCarrier || '',
      selectedPrice: form.selectedPrice || 0,
      status: form.status as RFQStatus || 'Draft',
      sentDate: form.sentDate || '',
      responseDate: form.responseDate || '',
      notes: form.notes || '',
      createdAt: new Date().toISOString()
    };
    addRFQ(rfq);
    setShowForm(false);
    setForm({
      jobId: '', clientName: '', buildingSize: '', weight: 0,
      pickupAddress: 'Bradford, ON', deliveryAddress: '',
      carriers: [], quotedPrices: {}, selectedCarrier: '', selectedPrice: 0,
      status: 'Draft', sentDate: '', responseDate: '', notes: ''
    });
    toast.success('RFQ Created');
  };

  const handleStatusChange = (id: string, status: RFQStatus) => {
    updateRFQ(id, { status });
    if (status === 'Sent') {
      updateRFQ(id, { sentDate: new Date().toISOString() });
    }
  };

  const handleAddQuote = (rfqId: string) => {
    if (!newCarrier || !newPrice) return;
    const rfq = rfqs.find(r => r.id === rfqId);
    if (!rfq) return;

    const price = parseFloat(newPrice);
    if (isNaN(price)) return;

    const newCarriers = rfq.carriers.includes(newCarrier) ? rfq.carriers : [...rfq.carriers, newCarrier];
    const newPrices = { ...rfq.quotedPrices, [newCarrier]: price };

    updateRFQ(rfqId, {
      carriers: newCarriers,
      quotedPrices: newPrices,
      status: rfq.status === 'Draft' || rfq.status === 'Sent' ? 'Quoted' : rfq.status,
      responseDate: new Date().toISOString()
    });

    setNewCarrier('');
    setNewPrice('');
    toast.success('Quote added');
  };

  const handleAcceptQuote = (rfqId: string, carrier: string, price: number) => {
    const rfq = rfqs.find(r => r.id === rfqId);
    if (!rfq) return;

    updateRFQ(rfq.id, {
      status: 'Accepted',
      selectedCarrier: carrier,
      selectedPrice: price
    });

    // Mirror to freight board
    const existingFreight = freight.find(f => f.jobId === rfq.jobId);
    if (existingFreight) {
      updateFreight(rfq.jobId, { actualFreight: price, carrier, status: 'Booked' as any });
    } else {
      addFreight({
        jobId: rfq.jobId, clientName: rfq.clientName, buildingSize: rfq.buildingSize,
        weight: rfq.weight, pickupAddress: rfq.pickupAddress, deliveryAddress: rfq.deliveryAddress,
        estDistance: 0, estFreight: 0, actualFreight: price, paid: false, carrier, status: 'Booked' as any
      });
    }

    toast.success(`Quote accepted and mirrored to Freight Board`);
  };

  const handleExport = () => {
    const headers = ['Job ID', 'Client', 'Size', 'Weight', 'Pickup', 'Delivery', 'Status', 'Selected Carrier', 'Selected Price'];
    const rows = rfqs.map(r => [
      r.jobId, r.clientName, r.buildingSize, r.weight, r.pickupAddress, r.deliveryAddress,
      r.status, r.selectedCarrier, csvCurrency(r.selectedPrice)
    ]);
    exportToCSV('freight_rfq_log', headers, rows);
  };

  const sortedRFQs = useMemo(() => {
    return [...rfqs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rfqs]);

  const activeDeals = deals.filter(d => d.dealStatus !== 'Cancelled' && d.dealStatus !== 'Complete');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">RFQ Workflow</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage freight quotes and carrier bids</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border bg-card hover:bg-muted text-foreground transition-colors">
            📥 Export
          </button>
          <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border bg-card hover:bg-muted text-foreground transition-colors">
            🖨️ Print
          </button>
          {canEdit && (
            <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New RFQ'}</Button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Create Freight RFQ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Job ID</label>
              <Select value={form.jobId} onValueChange={handleJobSelect}>
                <SelectTrigger className="input-blue h-9"><SelectValue placeholder="Select Deal" /></SelectTrigger>
                <SelectContent>
                  {activeDeals.map(d => (
                    <SelectItem key={d.jobId} value={d.jobId}>{d.jobId} — {d.clientName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Building Size</label>
              <Input className="input-blue h-9" value={form.buildingSize} onChange={e => setForm({...form, buildingSize: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Weight (lbs)</label>
              <Input type="number" className="input-blue h-9" value={form.weight || ''} onChange={e => setForm({...form, weight: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v as RFQStatus})}>
                <SelectTrigger className="input-blue h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-medium mb-1 block">Pickup Address</label>
              <Input className="input-blue h-9" value={form.pickupAddress} onChange={e => setForm({...form, pickupAddress: e.target.value})} />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-medium mb-1 block">Delivery Address</label>
              <Input className="input-blue h-9" value={form.deliveryAddress} onChange={e => setForm({...form, deliveryAddress: e.target.value})} />
            </div>
            <div className="lg:col-span-4">
              <label className="text-xs font-medium mb-1 block">Notes / Special Instructions</label>
              <Textarea className="input-blue" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
          </div>
          <Button onClick={saveRFQ}>Save RFQ</Button>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1F3864] text-white text-xs">
              {['Job ID', 'Client', 'Building', 'Weight', 'Delivery', 'Status', 'Best Quote', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRFQs.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No RFQs created yet</td></tr>
            ) : sortedRFQs.map(r => {
              const isExpanded = expandedId === r.id;
              const hasQuotes = Object.keys(r.quotedPrices).length > 0;
              const lowestPrice = hasQuotes ? Math.min(...Object.values(r.quotedPrices)) : 0;

              return (
                <React.Fragment key={r.id}>
                  <tr className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                    <td className="px-3 py-2 font-mono text-xs">{r.jobId}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2 text-xs">{r.buildingSize}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatNumber(r.weight)} lbs</td>
                    <td className="px-3 py-2 text-xs truncate max-w-[150px]" title={r.deliveryAddress}>{r.deliveryAddress}</td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                       <Select value={r.status} onValueChange={v => handleStatusChange(r.id, v as RFQStatus)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold">
                      {r.status === 'Accepted' ? (
                        <span className="text-green-700">{formatCurrency(r.selectedPrice)}</span>
                      ) : lowestPrice > 0 ? (
                        <span>{formatCurrency(lowestPrice)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                       <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : r.id); }}>
                         {isExpanded ? 'Collapse' : 'Manage Quotes'}
                       </Button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/20 border-b">
                      <td colSpan={8} className="p-4">
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           {/* Left side: Notes and info */}
                           <div>
                             <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">RFQ Details</h4>
                             <p className="text-xs"><strong>Pickup:</strong> {r.pickupAddress}</p>
                             <p className="text-xs mt-1"><strong>Notes:</strong> {r.notes || 'None'}</p>
                             <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                               <span>Created: {new Date(r.createdAt).toLocaleDateString()}</span>
                               {r.sentDate && <span>Sent: {new Date(r.sentDate).toLocaleDateString()}</span>}
                               {r.responseDate && <span>Last Response: {new Date(r.responseDate).toLocaleDateString()}</span>}
                             </div>
                           </div>

                           {/* Right side: Carrier quotes */}
                           <div className="bg-card rounded-lg border p-4 shadow-sm">
                             <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Carrier Bids</h4>

                             {r.carriers.length > 0 ? (
                               <div className="space-y-2 mb-4">
                                 {r.carriers.map(carrier => (
                                   <div key={carrier} className={`flex items-center justify-between p-2 rounded border ${r.selectedCarrier === carrier ? 'bg-green-50 border-green-200' : 'bg-background'}`}>
                                     <span className="text-sm font-medium">{carrier}</span>
                                     <div className="flex items-center gap-3">
                                       <span className="font-mono text-sm">{formatCurrency(r.quotedPrices[carrier] || 0)}</span>
                                       {r.status !== 'Accepted' && (
                                         <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleAcceptQuote(r.id, carrier, r.quotedPrices[carrier])}>
                                           Accept
                                         </Button>
                                       )}
                                       {r.selectedCarrier === carrier && (
                                         <span className="text-xs font-bold text-green-700 bg-green-100 px-2 rounded-full">ACCEPTED</span>
                                       )}
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <p className="text-xs text-muted-foreground mb-4">No quotes received yet.</p>
                             )}

                             {/* Add manual quote */}
                             {canEdit && r.status !== 'Accepted' && (
                               <div className="flex gap-2 items-center">
                                 <Input placeholder="Carrier Name" className="h-8 text-xs" value={newCarrier} onChange={e => setNewCarrier(e.target.value)} />
                                 <Input type="number" placeholder="Price ($)" className="h-8 text-xs w-24" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                                 <Button size="sm" className="h-8 text-xs" onClick={() => handleAddQuote(r.id)}>Add Quote</Button>
                               </div>
                             )}
                           </div>
                         </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
