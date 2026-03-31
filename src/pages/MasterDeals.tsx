import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { formatNumber, formatCurrency } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronRight, Edit, Trash2, Plus, EyeOff, Eye, MessageSquare } from 'lucide-react';
import type { Deal, DealStatus } from '@/types';

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

export default function MasterDeals() {
  const navigate = useNavigate();
  const { deals, updateDeal, deleteDeal, addDeal, payments, internalCosts } = useAppContext();
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
  const [pipelineView, setPipelineView] = useState(true);

  const canEdit = hasAnyRole('admin', 'owner', 'operations');
  const isAdminOwner = hasAnyRole('admin', 'owner');
  const isSalesRep = !hasAnyRole('admin', 'owner', 'accounting', 'operations', 'freight');

  const visibleDeals = isSalesRep
    ? deals.filter(d => d.salesRep === currentUser.name || d.salesRep.toLowerCase().includes(currentUser.name.toLowerCase()))
    : deals;

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

  const toggle = (jobId: string) => setExpandedJob(prev => prev === jobId ? null : jobId);

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
    <div className="space-y-6">
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
              {isAdminOwner && <th className="px-2 py-2 text-left font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={isAdminOwner ? 13 : 12} className="px-3 py-8 text-center text-muted-foreground">No deals found</td></tr>
            ) : filtered.map(d => {
              const isExpanded = expandedJob === d.jobId;
              const ic = internalCosts.find(c => c.jobId === d.jobId);
              const clientPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Client Payment IN');
              const vendorPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Vendor Payment OUT');
              const clientIn = clientPmts.reduce((s, p) => s + p.amountExclTax, 0);
              const vendorOut = vendorPmts.reduce((s, p) => s + p.amountExclTax, 0);

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
                    <td className="px-2 py-2 text-xs">{d.productionStatus}</td>
                    <td className="px-2 py-2 text-xs">{d.productionStatus}</td>
                    <td className="px-2 py-2 text-xs">{d.insulationStatus || '—'}</td>
                    <td className="px-2 py-2 text-xs">{d.freightStatus}</td>
                    {isAdminOwner && (
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
                      <td colSpan={isAdminOwner ? 13 : 12} className="p-4">
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
                        <div className="mt-3">
                          <div className="mb-3 flex justify-end">
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
              {[
                ['jobId', 'Job ID'], ['jobName', 'Job Name'], ['clientName', 'Client Name'],
                ['clientId', 'Client ID'], ['salesRep', 'Sales Rep'], ['estimator', 'Estimator'],
                ['teamLead', 'Team Lead'], ['province', 'Province'], ['city', 'City'],
                ['address', 'Address'], ['postalCode', 'Postal Code'],
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
            {[
              ['jobId', 'Job ID *'], ['jobName', 'Job Name'], ['clientName', 'Client Name'],
              ['clientId', 'Client ID'], ['salesRep', 'Sales Rep'], ['estimator', 'Estimator'],
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
