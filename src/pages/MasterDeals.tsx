import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { formatNumber, formatCurrency } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import type { DealStatus, PaymentStatus } from '@/types';
import { toast } from 'sonner';

const DEAL_STATUS_LABELS: Record<string, string> = {
  Lead: 'Request for Quote',
};

/** Color coding for payment status */
const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  PAID: 'bg-green-100 text-green-800 border-green-200',
  PARTIAL: 'bg-amber-100 text-amber-800 border-amber-200',
  UNPAID: 'bg-red-100 text-red-700 border-red-200',
};

/** Color coding for deal status */
const DEAL_STATUS_COLORS: Record<string, string> = {
  Lead: 'bg-gray-100 text-gray-700',
  Quoted: 'bg-blue-100 text-blue-700',
  'Pending Payment': 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  'In Production': 'bg-purple-100 text-purple-700',
  Shipped: 'bg-cyan-100 text-cyan-700',
  Delivered: 'bg-teal-100 text-teal-700',
  Complete: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-700',
  'On Hold': 'bg-orange-100 text-orange-700',
};

/** Color coding for production */
const PRODUCTION_COLORS: Record<string, string> = {
  Submitted: 'bg-gray-100 text-gray-600',
  Acknowledged: 'bg-blue-100 text-blue-600',
  'In Production': 'bg-purple-100 text-purple-700',
  'QC Complete': 'bg-teal-100 text-teal-700',
  'Ship Ready': 'bg-cyan-100 text-cyan-700',
  Shipped: 'bg-indigo-100 text-indigo-700',
  Delivered: 'bg-green-100 text-green-800',
};

const FREIGHT_COLORS: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-600',
  Booked: 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-700',
  Delivered: 'bg-green-100 text-green-800',
};

export default function MasterDeals() {
  const {
    deals, updateDeal, payments, addPayment, internalCosts, production
  } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { settings } = useSettings();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRep, setFilterRep] = useState<string>('all');
  const [searchClient, setSearchClient] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [autoCreatedAlerts, setAutoCreatedAlerts] = useState<string[]>([]);

  const canEdit = hasAnyRole('admin', 'owner', 'operations');
  const isSalesRep = !hasAnyRole('admin', 'owner', 'accounting', 'operations', 'freight', 'estimator');

  const visibleDeals = isSalesRep
    ? deals.filter(d => d.salesRep === currentUser.name || d.salesRep.toLowerCase().includes(currentUser.name.toLowerCase()))
    : deals;

  // --- DATA SYNC: Derive payment status from actual payment records ---
  const derivedPaymentStatus = useCallback((jobId: string, salePrice: number): PaymentStatus => {
    const jobPayments = payments.filter(p => p.jobId === jobId && p.direction === 'Client Payment IN');
    const totalPaid = jobPayments.reduce((sum, p) => sum + p.amountExclTax, 0);

    if (totalPaid <= 0) return 'UNPAID';
    if (salePrice > 0 && totalPaid >= salePrice * 0.95) return 'PAID'; // 95% threshold for rounding
    return 'PARTIAL';
  }, [payments]);

  // --- DATA SYNC: Derive production status from production records ---
  const derivedProductionStatus = useCallback((jobId: string): string | null => {
    const record = production.find(p => p.jobId === jobId);
    if (!record) return null;

    if (record.delivered) return 'Delivered';
    if (record.shipped) return 'Shipped';
    if (record.shipReady) return 'Ship Ready';
    if (record.qcComplete) return 'QC Complete';
    if (record.inProduction) return 'In Production';
    if (record.acknowledged) return 'Acknowledged';
    if (record.submitted) return 'Submitted';
    return null;
  }, [production]);

  // --- AUTO-SYNC: Update deal payment/production statuses from related records ---
  useEffect(() => {
    deals.forEach(d => {
      const ic = internalCosts.find(c => c.jobId === d.jobId);
      const salePrice = ic?.salePrice || 0;

      // Sync payment status
      const derivedPmt = derivedPaymentStatus(d.jobId, salePrice);
      if (derivedPmt !== d.paymentStatus) {
        updateDeal(d.jobId, { paymentStatus: derivedPmt });
      }

      // Sync production status
      const derivedProd = derivedProductionStatus(d.jobId);
      if (derivedProd && derivedProd !== d.productionStatus) {
        updateDeal(d.jobId, { productionStatus: derivedProd as any });
      }
    });
    // Only run when payments or production change, not on every deal update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, production, internalCosts]);

  // --- AUTO-CREATE PAYMENT: When payment field is updated and no record exists ---
  const handlePaymentStatusChange = useCallback((jobId: string, newStatus: PaymentStatus) => {
    const existingPayments = payments.filter(p => p.jobId === jobId);

    if (existingPayments.length === 0 && newStatus !== 'UNPAID') {
      // Auto-create a payment record
      const deal = deals.find(d => d.jobId === jobId);
      const newPayment = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        jobId,
        clientVendorName: deal?.clientName || 'Unknown',
        direction: 'Client Payment IN' as const,
        type: 'Deposit' as const,
        amountExclTax: 0,
        province: deal?.province || 'ON',
        taxRate: deal?.taxRate || 0.13,
        taxAmount: 0,
        totalInclTax: 0,
        paymentMethod: '',
        referenceNumber: '',
        qbSynced: false,
        notes: 'Auto-created — needs completion',
      };
      addPayment(newPayment);
      setAutoCreatedAlerts(prev => [...prev, jobId]);
      toast.warning(
        `Payment record auto-created for ${jobId} — please complete the payment details in Payment Ledger.`,
        { duration: 8000 }
      );
    }

    updateDeal(jobId, { paymentStatus: newStatus });
  }, [payments, deals, addPayment, updateDeal]);

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

      {/* Auto-created payment alerts */}
      {autoCreatedAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">Payment records auto-created for:</p>
            <p>{autoCreatedAlerts.join(', ')}</p>
            <p className="mt-1">These records need completion in the Payment Ledger.</p>
            <Button
              size="sm" variant="ghost" className="text-xs h-6 mt-1 text-amber-700"
              onClick={() => setAutoCreatedAlerts([])}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

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
              {['Job ID', 'Job Name', 'Client', 'Sales Rep', 'Province', 'Deal Status', 'Client Pmt', 'Production', 'Insulation', 'Freight'].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No deals found</td></tr>
            ) : filtered.map(d => {
              const isExpanded = expandedJob === d.jobId;
              const ic = internalCosts.find(c => c.jobId === d.jobId);
              const clientPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Client Payment IN');
              const vendorPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Vendor Payment OUT');
              const clientIn = clientPmts.reduce((s, p) => s + p.amountExclTax, 0);
              const vendorOut = vendorPmts.reduce((s, p) => s + p.amountExclTax, 0);
              const hasIncompletePayment = clientPmts.some(p => p.amountExclTax === 0 && p.notes?.includes('Auto-created'));

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
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${DEAL_STATUS_COLORS[d.dealStatus] || 'bg-gray-100'}`}>
                          {DEAL_STATUS_LABELS[d.dealStatus] || d.dealStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${PAYMENT_STATUS_COLORS[d.paymentStatus]}`}>
                          {d.paymentStatus}
                        </span>
                        {hasIncompletePayment && (
                          <AlertCircle className="h-3 w-3 text-amber-500" title="Incomplete payment record" />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PRODUCTION_COLORS[d.productionStatus] || 'bg-gray-100'}`}>
                        {d.productionStatus}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-xs">{d.insulationStatus || '—'}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${FREIGHT_COLORS[d.freightStatus] || 'bg-gray-100'}`}>
                        {d.freightStatus}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${d.jobId}-detail`} className="bg-muted/30">
                      <td colSpan={11} className="p-4">
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
                            <p className="text-green-700">Client In: {formatCurrency(clientIn)}</p>
                            <p className="text-red-600">Vendor Out: {formatCurrency(vendorOut)}</p>
                            <p className="font-semibold">Net: {formatCurrency(clientIn - vendorOut)}</p>
                            {hasIncompletePayment && (
                              <p className="text-amber-600 font-semibold mt-1">
                                ⚠ Auto-created payment needs completion
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Production Status inline controls */}
                        {canEdit && (
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Production Status</p>
                              <Select value={d.productionStatus} onValueChange={v => updateDeal(d.jobId, { productionStatus: v as any })}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{settings.productionStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Insulation</p>
                              <Select value={d.insulationStatus || 'N/A'} onValueChange={v => updateDeal(d.jobId, { insulationStatus: v })}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{settings.insulationStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Freight</p>
                              <Select value={d.freightStatus} onValueChange={v => updateDeal(d.jobId, { freightStatus: v as any })}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{settings.freightStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

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
