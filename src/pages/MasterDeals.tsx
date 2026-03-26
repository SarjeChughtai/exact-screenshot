import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { formatNumber, formatCurrency } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DealStatus } from '@/types';

const DEAL_STATUS_LABELS: Record<string, string> = {
  Lead: 'Request for Quote',
};

export default function MasterDeals() {
  const { deals, updateDeal, payments, internalCosts } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { settings } = useSettings();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRep, setFilterRep] = useState<string>('all');
  const [searchClient, setSearchClient] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const canEdit = hasAnyRole('admin', 'owner', 'operations');
  const isSalesRep = !hasAnyRole('admin', 'owner', 'accounting', 'operations', 'freight');

  const visibleDeals = isSalesRep
    ? deals.filter(d => d.salesRep === currentUser.name || d.salesRep.toLowerCase().includes(currentUser.name.toLowerCase()))
    : deals;

  const reps = [...new Set(visibleDeals.map(d => d.salesRep).filter(Boolean))];
  const filtered = visibleDeals.filter(d => {
    if (filterStatus !== 'all' && d.dealStatus !== filterStatus) return false;
    if (filterRep !== 'all' && d.salesRep !== filterRep) return false;
    if (searchClient && !d.clientName.toLowerCase().includes(searchClient.toLowerCase()) && !d.clientId.includes(searchClient) && !d.jobId.toLowerCase().includes(searchClient.toLowerCase())) return false;
    return true;
  });

  const toggle = (jobId: string) => setExpandedJob(prev => prev === jobId ? null : jobId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Master Deals</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} of {visibleDeals.length} deals shown
          {isSalesRep && ' (your deals only)'}
        </p>
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
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 w-6"></th>
              {['Job ID', 'Job Name', 'Client', 'Sales Rep', 'Province', 'Deal Status', 'Client Pmt', 'Factory Pmt', 'Production', 'Insulation', 'Freight'].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">No deals found</td></tr>
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
                  </tr>
                  {isExpanded && (
                    <tr key={`${d.jobId}-detail`} className="bg-muted/30">
                      <td colSpan={12} className="p-4">
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
    </div>
  );
}
