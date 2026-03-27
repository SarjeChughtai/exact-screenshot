import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { JobIdSelect } from '@/components/JobIdSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, getProvinceTax } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentEntry, PaymentDirection, PaymentType } from '@/types';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

const DIRECTIONS: PaymentDirection[] = ['Client Payment IN', 'Vendor Payment OUT', 'Refund IN', 'Refund OUT'];
const TYPES: PaymentType[] = ['Deposit', 'Progress Payment', 'Final Payment', 'Freight', 'Insulation', 'Drawings', 'Other'];

export default function PaymentLedger() {
  const { payments, deals, addPayment, refreshData, deletePayment } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    jobId: '', clientVendorName: '', direction: 'Client Payment IN' as PaymentDirection,
    type: 'Deposit' as PaymentType, amountExclTax: '',
    paymentMethod: '', referenceNumber: '', notes: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

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
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setPendingDeleteId(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
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
    </div>
  );
}
