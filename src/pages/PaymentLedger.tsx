import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobIdSelect } from '@/components/JobIdSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, getProvinceTax } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentEntry, PaymentDirection, PaymentType } from '@/types';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';

const DIRECTIONS: PaymentDirection[] = ['Client Payment IN', 'Vendor Payment OUT', 'Refund IN', 'Refund OUT'];
const TYPES: PaymentType[] = ['Deposit', 'Progress Payment', 'Final Payment', 'Freight', 'Insulation', 'Drawings', 'Other'];

const BLANK_FORM = {
  date: new Date().toISOString().split('T')[0],
  jobId: '', clientVendorName: '', direction: 'Client Payment IN' as PaymentDirection,
  type: 'Deposit' as PaymentType, amountExclTax: '',
  paymentMethod: '', referenceNumber: '', notes: '',
};

export default function PaymentLedger() {
  const { payments, deals, addPayment, updatePayment, refreshData, deletePayment } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);

  // Edit state
  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const openEdit = (p: PaymentEntry) => {
    setEditingPayment(p);
    setEditForm({
      date: p.date,
      jobId: p.jobId,
      clientVendorName: p.clientVendorName,
      direction: p.direction,
      type: p.type,
      amountExclTax: String(p.amountExclTax),
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber,
      notes: p.notes,
    });
  };

  const saveEdit = () => {
    if (!editingPayment) return;
    const amount = parseFloat(editForm.amountExclTax) || 0;
    if (!editForm.jobId || !amount) { toast.error('Job ID and amount required'); return; }
    const deal = deals.find(d => d.jobId === editForm.jobId);
    const province = deal?.province || 'ON';
    const prov = getProvinceTax(province);
    const taxAmount = amount * prov.order_rate;
    updatePayment(editingPayment.id, {
      date: editForm.date,
      jobId: editForm.jobId,
      clientVendorName: editForm.clientVendorName,
      direction: editForm.direction,
      type: editForm.type,
      amountExclTax: amount,
      province,
      taxRate: prov.order_rate,
      taxAmount,
      totalInclTax: amount + taxAmount,
      paymentMethod: editForm.paymentMethod,
      referenceNumber: editForm.referenceNumber,
      notes: editForm.notes,
    });
    setEditingPayment(null);
    toast.success('Payment updated');
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    deletePayment(pendingDeleteId);
    setPendingDeleteId(null);
    toast.success('Payment deleted');
  };

  const save = () => {
    const amount = parseFloat(form.amountExclTax) || 0;
    if (!form.jobId || !amount) { toast.error('Job ID and amount required'); return; }

    const deal = deals.find(d => d.jobId === form.jobId);
    const province = deal?.province || 'ON';
    const prov = getProvinceTax(province);
    const taxAmount = amount * prov.order_rate;

    const entry: PaymentEntry = {
      id: crypto.randomUUID(), date: form.date, jobId: form.jobId,
      clientVendorName: form.clientVendorName, direction: form.direction,
      type: form.type, amountExclTax: amount, province,
      taxRate: prov.order_rate, taxAmount, totalInclTax: amount + taxAmount,
      paymentMethod: form.paymentMethod, referenceNumber: form.referenceNumber,
      qbSynced: false, notes: form.notes,
    };
    addPayment(entry);
    setShowForm(false);
    toast.success('Payment recorded');
  };

  const syncQuickBooks = async () => {
    setSyncing(true);
    setSyncSummary('');
    try {
      const existingKeys = new Set(
        payments.map(p => `${p.jobId}|${p.date}|${p.direction}|${p.type}|${p.amountExclTax}|${p.referenceNumber}`)
      );

      const { data, error } = await supabase.functions.invoke('qbo-sync', {
        body: { action: 'sync' },
      });

      if (error) throw new Error(error.message);

      const incoming = Array.isArray(data?.payments) ? data.payments : [];
      if (incoming.length > 0) {
        let inserted = 0;
        let skipped = 0;

        for (const item of incoming) {
          const jobId = item.jobId ?? item.job_id ?? '';
          const direction = item.direction;
          const type = item.type;
          const date = item.date ?? new Date().toISOString().split('T')[0];
          const referenceNumber = (item.referenceNumber ?? item.reference_number ?? '') as string;
          const clientVendorName = (item.clientVendorName ?? item.client_vendor_name ?? '') as string;

          const amountExclTax = Number(item.amountExclTax ?? item.amount_excl_tax ?? 0);
          if (!direction || !type || !Number.isFinite(amountExclTax) || amountExclTax <= 0) {
            skipped++;
            continue;
          }

          const deal = deals.find(d => d.jobId === jobId);
          const province = (item.province ?? deal?.province ?? 'ON') as string;
          const prov = getProvinceTax(province);

          const taxAmount = typeof item.taxAmount === 'number' ? item.taxAmount : amountExclTax * prov.order_rate;
          const totalInclTax = typeof item.totalInclTax === 'number' ? item.totalInclTax : amountExclTax + taxAmount;

          const key = `${jobId}|${date}|${direction}|${type}|${amountExclTax}|${referenceNumber}`;
          if (existingKeys.has(key)) {
            skipped++;
            continue;
          }

          const entry: PaymentEntry = {
            id: crypto.randomUUID(), date, jobId, clientVendorName, direction, type,
            amountExclTax, province, taxRate: prov.order_rate, taxAmount, totalInclTax,
            paymentMethod: (item.paymentMethod ?? item.payment_method ?? '') as string,
            referenceNumber, qbSynced: true,
            notes: (item.notes ?? '') as string,
          };

          await addPayment(entry);
          existingKeys.add(key);
          inserted++;
        }

        setSyncSummary(`Inserted ${inserted}. Skipped ${skipped}. (${data.summary?.paymentsIn ?? 0} payments in, ${data.summary?.paymentsOut ?? 0} payments out from QBO)`);
        toast.success('QuickBooks sync complete');
        return;
      }

      await refreshData();
      setSyncSummary('Sync complete — no new transactions found.');
      toast.success('QuickBooks sync complete');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'QuickBooks sync failed';
      setSyncSummary(message);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment Ledger</h2>
          <p className="text-sm text-muted-foreground mt-1">All money movement in one place</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => void syncQuickBooks()} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync QuickBooks'}
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Payment'}</Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Date</Label><Input className="input-blue mt-1" type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Job ID</Label>
              <JobIdSelect value={form.jobId} onValueChange={v => set('jobId', v)} deals={deals} />
            </div>
            <div><Label className="text-xs">Client/Vendor Name</Label><Input className="input-blue mt-1" value={form.clientVendorName} onChange={e => set('clientVendorName', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={form.direction} onValueChange={v => set('direction', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{DIRECTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Amount (excl. tax)</Label><Input className="input-blue mt-1" value={form.amountExclTax} onChange={e => set('amountExclTax', e.target.value)} /></div>
            <div><Label className="text-xs">Method</Label><Input className="input-blue mt-1" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} /></div>
            <div><Label className="text-xs">Reference #</Label><Input className="input-blue mt-1" value={form.referenceNumber} onChange={e => set('referenceNumber', e.target.value)} /></div>
          </div>
          <Button onClick={save}>Save Payment</Button>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Date','Job ID','Name','Direction','Type','Amount','Tax','Total','Method','Ref #',''].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No payments recorded</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 text-xs">{p.date}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.jobId}</td>
                <td className="px-3 py-2">{p.clientVendorName}</td>
                <td className="px-3 py-2 text-xs">{p.direction}</td>
                <td className="px-3 py-2 text-xs">{p.type}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(p.amountExclTax)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(p.taxAmount)}</td>
                <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(p.totalInclTax)}</td>
                <td className="px-3 py-2 text-xs">{p.paymentMethod}</td>
                <td className="px-3 py-2 text-xs">{p.referenceNumber}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(p)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setPendingDeleteId(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {syncSummary && (
        <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground">
          {syncSummary}
        </div>
      )}

      <AlertDialog open={!!pendingDeleteId} onOpenChange={open => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={open => { if (!open) setEditingPayment(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>

          {editingPayment && (() => {
            const deal = deals.find(d => d.jobId === editForm.jobId);
            const jobPayments = payments.filter(p => p.jobId === editForm.jobId);
            const totalIn = jobPayments.filter(p => p.direction === 'Client Payment IN' || p.direction === 'Refund IN').reduce((s, p) => s + p.totalInclTax, 0);
            const totalOut = jobPayments.filter(p => p.direction === 'Vendor Payment OUT' || p.direction === 'Refund OUT').reduce((s, p) => s + p.totalInclTax, 0);
            return (
              <div className="space-y-5">
                {/* Job Info */}
                {deal && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Job Information — {deal.jobId}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                      <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{deal.clientName}</span></div>
                      <div><span className="text-muted-foreground">Job Name:</span> <span className="font-medium">{deal.jobName}</span></div>
                      <div><span className="text-muted-foreground">Sales Rep:</span> <span className="font-medium">{deal.salesRep}</span></div>
                      <div><span className="text-muted-foreground">Province:</span> <span className="font-medium">{deal.province}</span></div>
                      <div><span className="text-muted-foreground">City:</span> <span className="font-medium">{deal.city}</span></div>
                      <div><span className="text-muted-foreground">Deal Status:</span> <span className="font-medium">{deal.dealStatus}</span></div>
                      <div><span className="text-muted-foreground">Payment Status:</span> <span className="font-medium">{deal.paymentStatus}</span></div>
                      <div><span className="text-muted-foreground">Production:</span> <span className="font-medium">{deal.productionStatus}</span></div>
                      <div><span className="text-muted-foreground">Date Signed:</span> <span className="font-medium">{deal.dateSigned}</span></div>
                      <div><span className="text-muted-foreground">Delivery:</span> <span className="font-medium">{deal.deliveryDate || '—'}</span></div>
                      <div><span className="text-muted-foreground">Size:</span> <span className="font-medium">{deal.width}×{deal.length}×{deal.height} ft</span></div>
                      <div><span className="text-muted-foreground">Sq ft:</span> <span className="font-medium">{deal.sqft?.toLocaleString()}</span></div>
                    </div>
                    <div className="flex gap-6 pt-1 text-xs font-medium">
                      <span className="text-green-600">Total IN: {formatCurrency(totalIn)}</span>
                      <span className="text-red-500">Total OUT: {formatCurrency(totalOut)}</span>
                      <span className="text-muted-foreground">Net: {formatCurrency(totalIn - totalOut)}</span>
                    </div>
                  </div>
                )}

                {/* All payments for this job */}
                {jobPayments.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">All Payments for Job {editForm.jobId}</h3>
                    <div className="bg-card border rounded-md overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted text-muted-foreground">
                            {['Date','Direction','Type','Amount','Tax','Total','Method','Ref #'].map(h => (
                              <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {jobPayments.map(jp => (
                            <tr key={jp.id} className={`border-b ${jp.id === editingPayment.id ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40'}`}>
                              <td className="px-2 py-1.5">{jp.date}</td>
                              <td className="px-2 py-1.5">{jp.direction}</td>
                              <td className="px-2 py-1.5">{jp.type}</td>
                              <td className="px-2 py-1.5 font-mono">{formatCurrency(jp.amountExclTax)}</td>
                              <td className="px-2 py-1.5 font-mono">{formatCurrency(jp.taxAmount)}</td>
                              <td className="px-2 py-1.5 font-mono">{formatCurrency(jp.totalInclTax)}</td>
                              <td className="px-2 py-1.5">{jp.paymentMethod}</td>
                              <td className="px-2 py-1.5">{jp.referenceNumber}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Edit form */}
                <div>
                  <h3 className="font-semibold text-sm mb-2">Edit Payment</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div><Label className="text-xs">Date</Label><Input className="input-blue mt-1" type="date" value={editForm.date} onChange={e => setEdit('date', e.target.value)} /></div>
                    <div>
                      <Label className="text-xs">Job ID</Label>
                      <JobIdSelect value={editForm.jobId} onValueChange={v => setEdit('jobId', v)} deals={deals} />
                    </div>
                    <div><Label className="text-xs">Client/Vendor Name</Label><Input className="input-blue mt-1" value={editForm.clientVendorName} onChange={e => setEdit('clientVendorName', e.target.value)} /></div>
                    <div>
                      <Label className="text-xs">Direction</Label>
                      <Select value={editForm.direction} onValueChange={v => setEdit('direction', v)}>
                        <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{DIRECTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={editForm.type} onValueChange={v => setEdit('type', v)}>
                        <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Amount (excl. tax)</Label><Input className="input-blue mt-1" value={editForm.amountExclTax} onChange={e => setEdit('amountExclTax', e.target.value)} /></div>
                    <div><Label className="text-xs">Method</Label><Input className="input-blue mt-1" value={editForm.paymentMethod} onChange={e => setEdit('paymentMethod', e.target.value)} /></div>
                    <div><Label className="text-xs">Reference #</Label><Input className="input-blue mt-1" value={editForm.referenceNumber} onChange={e => setEdit('referenceNumber', e.target.value)} /></div>
                    <div className="col-span-2 md:col-span-3"><Label className="text-xs">Notes</Label><Input className="input-blue mt-1" value={editForm.notes} onChange={e => setEdit('notes', e.target.value)} /></div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={saveEdit}>Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditingPayment(null)}>Cancel</Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
