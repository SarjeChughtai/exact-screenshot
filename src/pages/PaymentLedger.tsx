import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { JobIdSelect } from '@/components/JobIdSelect';
import { ClientSelect } from '@/components/ClientSelect';
import { VendorSelect } from '@/components/VendorSelect';
import { formatCurrency, getProvinceTax, PROVINCES } from '@/lib/calculations';
import { useSharedJobs } from '@/lib/sharedJobs';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentEntry, PaymentDirection, PaymentType } from '@/types';
import { toast } from 'sonner';
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { jobIdsMatch, resolveCanonicalJobId } from '@/lib/jobIds';

const DIRECTIONS: PaymentDirection[] = ['Client Payment IN', 'Vendor Payment OUT', 'Refund IN', 'Refund OUT'];
const TYPES: PaymentType[] = ['Deposit', 'Progress Payment', 'Final Payment', 'Freight', 'Insulation', 'Drawings', 'Other'];
const PROVINCE_CODES = PROVINCES.map(p => p.code);

const isClientDirection = (dir: PaymentDirection) =>
  dir === 'Client Payment IN' || dir === 'Refund OUT';

const BLANK_FORM = {
  date: new Date().toISOString().split('T')[0],
  jobId: '',
  direction: 'Client Payment IN' as PaymentDirection,
  type: 'Deposit' as PaymentType,
  clientId: '',
  vendorId: '',
  clientVendorName: '',
  vendorProvinceOverride: '',
  amountExclTax: '',
  taxOverride: false,
  taxOverrideRate: '',
  paymentMethod: '',
  referenceNumber: '',
  notes: '',
};

type SortCol = 'date' | 'jobId' | 'clientVendorName' | 'direction' | 'type' | 'amountExclTax' | 'taxAmount' | 'totalInclTax' | 'paymentMethod' | 'referenceNumber';

function computeTax(amount: number, province: string, taxOverride: boolean, taxOverrideRateStr: string) {
  if (taxOverride) {
    const overrideRate = parseFloat(taxOverrideRateStr) / 100 || 0;
    return { taxRate: overrideRate, taxAmount: amount * overrideRate, totalInclTax: amount + amount * overrideRate };
  }
  const prov = getProvinceTax(province || 'ON');
  const taxAmount = amount * prov.order_rate;
  return { taxRate: prov.order_rate, taxAmount, totalInclTax: amount + taxAmount };
}

export default function PaymentLedger() {
  const { payments, deals, clients, vendors, addPayment, updatePayment, refreshData, deletePayment } = useAppContext();
  const { visibleJobIds } = useSharedJobs();
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);

  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [viewingPayment, setViewingPayment] = useState<PaymentEntry | null>(null);

  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [editAuditNote, setEditAuditNote] = useState('');
  const [pendingConfirmEdit, setPendingConfirmEdit] = useState(false);

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string | boolean) => setEditForm(f => ({ ...f, [k]: v }));

  const handleDirectionChange = (dir: string) => {
    setForm(f => ({ ...f, direction: dir as PaymentDirection, clientId: '', vendorId: '', clientVendorName: '', vendorProvinceOverride: '' }));
  };
  const handleEditDirectionChange = (dir: string) => {
    setEditForm(f => ({ ...f, direction: dir as PaymentDirection, clientId: '', vendorId: '', clientVendorName: '', vendorProvinceOverride: '' }));
  };

  const handleClientSelect = ({ clientId, clientName }: { clientId: string; clientName: string }) => {
    const client = clients.find(c => c.clientId === clientId || c.id === clientId);
    setForm(f => ({ ...f, clientId: client?.id || clientId, clientVendorName: clientName || client?.clientName || client?.name || '' }));
  };
  const handleEditClientSelect = ({ clientId, clientName }: { clientId: string; clientName: string }) => {
    const client = clients.find(c => c.clientId === clientId || c.id === clientId);
    setEditForm(f => ({ ...f, clientId: client?.id || clientId, clientVendorName: clientName || client?.clientName || client?.name || '' }));
  };

  const handleVendorSelect = ({ vendorId, vendorName, province }: { vendorId: string; vendorName: string; province: string }) => {
    setForm(f => ({ ...f, vendorId, clientVendorName: vendorName, vendorProvinceOverride: province || '' }));
  };
  const handleEditVendorSelect = ({ vendorId, vendorName, province }: { vendorId: string; vendorName: string; province: string }) => {
    setEditForm(f => ({ ...f, vendorId, clientVendorName: vendorName, vendorProvinceOverride: province || '' }));
  };

  const resolveProvince = (f: typeof BLANK_FORM, jobId: string) => {
    const matchingDeal = visibleDeals.find(deal => jobIdsMatch(deal.jobId, jobId));
    if (!isClientDirection(f.direction)) {
      return f.vendorProvinceOverride || vendors.find(v => v.id === f.vendorId)?.province
        || matchingDeal?.province || 'ON';
    }
    return matchingDeal?.province || 'ON';
  };

  const visibleDeals = useMemo(
    () => deals.filter(deal => visibleJobIds.has(deal.jobId)),
    [deals, visibleJobIds],
  );

  const visiblePayments = useMemo(
    () => payments.filter(payment => visibleJobIds.has(resolveCanonicalJobId(payment.jobId) || payment.jobId)),
    [payments, visibleJobIds],
  );

  const save = async () => {
    const normalizedJobId = resolveCanonicalJobId(form.jobId) || form.jobId.trim();
    const amount = parseFloat(form.amountExclTax) || 0;
    if (!normalizedJobId || !amount) { toast.error('Job ID and amount required'); return; }
    const province = resolveProvince(form, normalizedJobId);
    const { taxRate, taxAmount, totalInclTax } = computeTax(amount, province, form.taxOverride, form.taxOverrideRate);
    const entry: PaymentEntry = {
      id: crypto.randomUUID(),
      date: form.date, jobId: normalizedJobId,
      clientVendorName: form.clientVendorName,
      clientId: isClientDirection(form.direction) ? (form.clientId && form.clientId !== '__manual' ? form.clientId : undefined) : undefined,
      vendorId: !isClientDirection(form.direction) ? (form.vendorId && form.vendorId !== '__manual' ? form.vendorId : undefined) : undefined,
      direction: form.direction, type: form.type,
      amountExclTax: amount, province, taxRate, taxAmount, totalInclTax,
      taxOverride: form.taxOverride,
      taxOverrideRate: form.taxOverride ? parseFloat(form.taxOverrideRate) / 100 || 0 : undefined,
      vendorProvinceOverride: !isClientDirection(form.direction) ? form.vendorProvinceOverride || undefined : undefined,
      paymentMethod: form.paymentMethod, referenceNumber: form.referenceNumber,
      qbSynced: false, notes: form.notes,
    };
    await addPayment(entry);
    setShowForm(false);
    setForm(BLANK_FORM);
    toast.success('Payment recorded');
  };

  const openEdit = (p: PaymentEntry) => {
    setEditingPayment(p);
    setEditForm({
      date: p.date, jobId: p.jobId, direction: p.direction, type: p.type,
      clientId: p.clientId ?? '',
      vendorId: p.vendorId ?? '',
      clientVendorName: p.clientVendorName,
      vendorProvinceOverride: p.vendorProvinceOverride ?? '',
      amountExclTax: String(p.amountExclTax),
      taxOverride: p.taxOverride,
      taxOverrideRate: p.taxOverride && p.taxOverrideRate != null ? String(p.taxOverrideRate * 100) : '',
      paymentMethod: p.paymentMethod, referenceNumber: p.referenceNumber, notes: p.notes,
    });
    setEditAuditNote('');
    setPendingConfirmEdit(false);
  };

  const requestSaveEdit = () => {
    if (!editingPayment) return;
    const amount = parseFloat(editForm.amountExclTax) || 0;
    if (!editForm.jobId || !amount) { toast.error('Job ID and amount required'); return; }
    setPendingConfirmEdit(true);
  };

  const confirmSaveEdit = async () => {
    if (!editingPayment) return;
    if (!editAuditNote.trim()) { toast.error('Audit note required'); return; }
    const amount = parseFloat(editForm.amountExclTax) || 0;
    const normalizedJobId = resolveCanonicalJobId(editForm.jobId) || editForm.jobId.trim();
    const province = resolveProvince(editForm, normalizedJobId);
    const { taxRate, taxAmount, totalInclTax } = computeTax(amount, province, editForm.taxOverride, editForm.taxOverrideRate);
    await updatePayment(editingPayment.id, {
      date: editForm.date, jobId: normalizedJobId,
      clientVendorName: editForm.clientVendorName,
      clientId: isClientDirection(editForm.direction) ? (editForm.clientId && editForm.clientId !== '__manual' ? editForm.clientId : undefined) : undefined,
      vendorId: !isClientDirection(editForm.direction) ? (editForm.vendorId && editForm.vendorId !== '__manual' ? editForm.vendorId : undefined) : undefined,
      direction: editForm.direction, type: editForm.type,
      amountExclTax: amount, province, taxRate, taxAmount, totalInclTax,
      taxOverride: editForm.taxOverride,
      taxOverrideRate: editForm.taxOverride ? parseFloat(editForm.taxOverrideRate) / 100 || 0 : undefined,
      vendorProvinceOverride: !isClientDirection(editForm.direction) ? editForm.vendorProvinceOverride || undefined : undefined,
      paymentMethod: editForm.paymentMethod, referenceNumber: editForm.referenceNumber,
      notes: editForm.notes + (editAuditNote ? `\n[Edit note: ${editAuditNote}]` : ''),
    });
    setEditingPayment(null);
    setPendingConfirmEdit(false);
    toast.success('Payment updated');
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    deletePayment(pendingDeleteId);
    setPendingDeleteId(null);
    toast.success('Payment deleted');
  };

  const syncQuickBooks = async () => {
    setSyncing(true);
    setSyncSummary('');
    try {
      const existingKeys = new Set(
        visiblePayments.map(p => `${p.jobId}|${p.date}|${p.direction}|${p.type}|${p.amountExclTax}|${p.referenceNumber}`)
      );
      const { data, error } = await supabase.functions.invoke('qbo-sync', { body: { action: 'sync' } });
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
          if (!direction || !type || !Number.isFinite(amountExclTax) || amountExclTax <= 0) { skipped++; continue; }
          const deal = visibleDeals.find(d => d.jobId === jobId);
          const province = (item.province ?? deal?.province ?? 'ON') as string;
          const prov = getProvinceTax(province);
          const taxAmount = typeof item.taxAmount === 'number' ? item.taxAmount : amountExclTax * prov.order_rate;
          const totalInclTax = typeof item.totalInclTax === 'number' ? item.totalInclTax : amountExclTax + taxAmount;
          const key = `${jobId}|${date}|${direction}|${type}|${amountExclTax}|${referenceNumber}`;
          if (existingKeys.has(key)) { skipped++; continue; }
          const entry: PaymentEntry = {
            id: crypto.randomUUID(), date, jobId, clientVendorName, direction, type,
            amountExclTax, province, taxRate: prov.order_rate, taxAmount, totalInclTax,
            taxOverride: false,
            paymentMethod: (item.paymentMethod ?? item.payment_method ?? '') as string,
            referenceNumber, qbSynced: true, notes: (item.notes ?? '') as string,
          };
          await addPayment(entry);
          existingKeys.add(key);
          inserted++;
        }
        setSyncSummary(`Inserted ${inserted}. Skipped ${skipped}. (${data.summary?.paymentsIn ?? 0} in, ${data.summary?.paymentsOut ?? 0} out from QBO)`);
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

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedPayments = useMemo(() => {
    return [...visiblePayments].sort((a, b) => {
      if (sortCol === 'amountExclTax' || sortCol === 'taxAmount' || sortCol === 'totalInclTax') {
        const av = a[sortCol] ?? 0;
        const bv = b[sortCol] ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const av = String(a[sortCol] ?? '');
      const bv = String(b[sortCol] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [sortCol, sortDir, visiblePayments]);

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const fmtRate = (rate: number) => `${(rate * 100).toFixed(1)}%`;

  const addProvince = resolveProvince(form, form.jobId);
  const addTaxPreview = form.amountExclTax
    ? computeTax(parseFloat(form.amountExclTax) || 0, addProvince, form.taxOverride, form.taxOverrideRate)
    : null;

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
          <Button onClick={() => { setShowForm(!showForm); setForm(BLANK_FORM); }}>{showForm ? 'Cancel' : '+ New Payment'}</Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input className="input-blue mt-1" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
                <Label className="text-xs">Job ID</Label>
          <JobIdSelect value={form.jobId} onValueChange={v => set('jobId', v)} />
            </div>
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={form.direction} onValueChange={handleDirectionChange}>
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

            {isClientDirection(form.direction) ? (
              <div>
                <Label className="text-xs">Client</Label>
                <ClientSelect
                  mode="name"
                  valueId={clients.find(c => c.id === form.clientId)?.clientId || form.clientId}
                  valueName={form.clientVendorName}
                  onSelect={handleClientSelect}
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Vendor</Label>
                <VendorSelect
                  valueId={form.vendorId}
                  valueName={form.clientVendorName}
                  onSelect={handleVendorSelect}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label className="text-xs">Name (auto-filled or override)</Label>
              <Input className="input-blue mt-1" value={form.clientVendorName} onChange={e => set('clientVendorName', e.target.value)} placeholder="Client/vendor name..." />
            </div>

            {!isClientDirection(form.direction) && (
              <div>
                <Label className="text-xs">Vendor Province (this tx)</Label>
                <Select value={form.vendorProvinceOverride || addProvince} onValueChange={v => set('vendorProvinceOverride', v)}>
                  <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVINCE_CODES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Amount (excl. tax)</Label>
              <Input className="input-blue mt-1" type="number" min="0" step="0.01" value={form.amountExclTax} onChange={e => set('amountExclTax', e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Tax Override</Label>
              <div className="flex items-center gap-2 mt-2">
                <Switch checked={form.taxOverride} onCheckedChange={v => set('taxOverride', v)} />
                <span className="text-xs text-muted-foreground">
                  {form.taxOverride ? 'Custom rate' : `Auto (${fmtRate(getProvinceTax(addProvince).order_rate)})`}
                </span>
              </div>
            </div>
            {form.taxOverride && (
              <div>
                <Label className="text-xs">Override Rate (%)</Label>
                <Input className="input-blue mt-1" type="number" min="0" max="100" step="0.1" value={form.taxOverrideRate} onChange={e => set('taxOverrideRate', e.target.value)} placeholder="e.g. 13" />
              </div>
            )}

            {addTaxPreview && (
              <div className="flex flex-col justify-end">
                <p className="text-xs text-muted-foreground">Tax: <span className="font-mono">{formatCurrency(addTaxPreview.taxAmount)}</span></p>
                <p className="text-xs font-semibold">Total: <span className="font-mono">{formatCurrency(addTaxPreview.totalInclTax)}</span></p>
              </div>
            )}

            <div>
              <Label className="text-xs">Method</Label>
              <Input className="input-blue mt-1" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Reference #</Label>
              <Input className="input-blue mt-1" value={form.referenceNumber} onChange={e => set('referenceNumber', e.target.value)} />
            </div>
            <div className="col-span-2 md:col-span-4">
              <Label className="text-xs">Notes</Label>
              <Input className="input-blue mt-1" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <Button onClick={save}>Save Payment</Button>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {(
                [
                  ['date', 'Date'], ['jobId', 'Job ID'], ['clientVendorName', 'Name'],
                  ['direction', 'Direction'], ['type', 'Type'], ['amountExclTax', 'Amount'],
                  ['taxAmount', 'Tax'], ['totalInclTax', 'Total'],
                  ['paymentMethod', 'Method'], ['referenceNumber', 'Ref #'],
                ] as [SortCol, string][]
              ).map(([col, label]) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium whitespace-nowrap cursor-pointer select-none hover:bg-primary/80"
                  onClick={() => handleSort(col)}
                >
                  {label}<SortIcon col={col} />
                </th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sortedPayments.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No payments recorded</td></tr>
            ) : sortedPayments.map(p => (
              <tr key={p.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setViewingPayment(p)}>
                <td className="px-3 py-2 text-xs">{p.date}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.jobId}</td>
                <td className="px-3 py-2">{p.clientVendorName}</td>
                <td className="px-3 py-2 text-xs">{p.direction}</td>
                <td className="px-3 py-2 text-xs">{p.type}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(p.amountExclTax)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {formatCurrency(p.taxAmount)}
                  {p.taxOverride && <span className="ml-1 text-amber-600 text-[10px]">*</span>}
                </td>
                <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(p.totalInclTax)}</td>
                <td className="px-3 py-2 text-xs">{p.paymentMethod}</td>
                <td className="px-3 py-2 text-xs">{p.referenceNumber}</td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
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

      {sortedPayments.some(p => p.taxOverride) && (
        <p className="text-xs text-muted-foreground">* Tax override applied on this transaction</p>
      )}

      {syncSummary && (
        <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground">{syncSummary}</div>
      )}

      <AlertDialog open={!!pendingDeleteId} onOpenChange={open => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this payment? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingPayment} onOpenChange={open => { if (!open) setViewingPayment(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Payment Details</DialogTitle></DialogHeader>
          {viewingPayment && (() => {
            const deal = visibleDeals.find(d => d.jobId === viewingPayment.jobId);
            const jobPayments = visiblePayments.filter(p => p.jobId === viewingPayment.jobId);
            const totalIn = jobPayments.filter(p => p.direction === 'Client Payment IN' || p.direction === 'Refund IN').reduce((s, p) => s + p.totalInclTax, 0);
            const totalOut = jobPayments.filter(p => p.direction === 'Vendor Payment OUT' || p.direction === 'Refund OUT').reduce((s, p) => s + p.totalInclTax, 0);
            const linkedClient = clients.find(c => c.id === viewingPayment.clientId);
            const linkedVendor = vendors.find(v => v.id === viewingPayment.vendorId);
            return (
              <div className="space-y-5">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Payment Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{viewingPayment.date}</span></div>
                    <div><span className="text-muted-foreground">Job ID:</span> <span className="font-mono font-medium">{viewingPayment.jobId}</span></div>
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{viewingPayment.clientVendorName}</span></div>
                    {linkedClient && <div><span className="text-muted-foreground">Linked Client:</span> <span className="font-medium">{linkedClient.clientName || linkedClient.name}</span></div>}
                    {linkedVendor && <div><span className="text-muted-foreground">Linked Vendor:</span> <span className="font-medium">{linkedVendor.name} ({linkedVendor.province})</span></div>}
                    <div><span className="text-muted-foreground">Direction:</span> <span className="font-medium">{viewingPayment.direction}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{viewingPayment.type}</span></div>
                    <div><span className="text-muted-foreground">Method:</span> <span className="font-medium">{viewingPayment.paymentMethod || '—'}</span></div>
                    <div><span className="text-muted-foreground">Reference #:</span> <span className="font-medium">{viewingPayment.referenceNumber || '—'}</span></div>
                    <div><span className="text-muted-foreground">Province:</span> <span className="font-medium">{viewingPayment.vendorProvinceOverride || viewingPayment.province}</span></div>
                    <div><span className="text-muted-foreground">Amount (excl. tax):</span> <span className="font-mono font-medium">{formatCurrency(viewingPayment.amountExclTax)}</span></div>
                    <div><span className="text-muted-foreground">Tax ({viewingPayment.taxOverride ? 'override' : fmtRate(viewingPayment.taxRate)}):</span> <span className="font-mono font-medium">{formatCurrency(viewingPayment.taxAmount)}</span></div>
                    <div><span className="text-muted-foreground">Total (incl. tax):</span> <span className="font-mono font-semibold">{formatCurrency(viewingPayment.totalInclTax)}</span></div>
                    {viewingPayment.notes && (
                      <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">Notes:</span> <span className="font-medium whitespace-pre-wrap">{viewingPayment.notes}</span></div>
                    )}
                  </div>
                </div>

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
                    </div>
                    <div className="flex gap-6 pt-1 text-xs font-medium">
                      <span className="text-green-600">Total IN: {formatCurrency(totalIn)}</span>
                      <span className="text-red-500">Total OUT: {formatCurrency(totalOut)}</span>
                      <span className="text-muted-foreground">Net: {formatCurrency(totalIn - totalOut)}</span>
                    </div>
                  </div>
                )}

                {jobPayments.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">All Payments for Job {viewingPayment.jobId}</h3>
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
                            <tr key={jp.id} className={`border-b ${jp.id === viewingPayment.id ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40'}`}>
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

                <div className="flex gap-2">
                  <Button onClick={() => { const p = viewingPayment; setViewingPayment(null); openEdit(p); }}>Edit Payment</Button>
                  <Button variant="outline" onClick={() => setViewingPayment(null)}>Close</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPayment} onOpenChange={open => { if (!open) { setEditingPayment(null); setPendingConfirmEdit(false); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
          {editingPayment && (() => {
            const editProvince = resolveProvince(editForm, editForm.jobId);
            const editTaxPreview = computeTax(parseFloat(editForm.amountExclTax) || 0, editProvince, editForm.taxOverride, editForm.taxOverrideRate);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input className="input-blue mt-1" type="date" value={editForm.date} onChange={e => setEdit('date', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Job ID</Label>
                    <JobIdSelect value={editForm.jobId} onValueChange={v => setEdit('jobId', v)} />
                  </div>
                  <div>
                    <Label className="text-xs">Direction</Label>
                    <Select value={editForm.direction} onValueChange={handleEditDirectionChange}>
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

                  {isClientDirection(editForm.direction) ? (
                    <div>
                      <Label className="text-xs">Client</Label>
                      <ClientSelect
                        mode="name"
                        valueId={clients.find(c => c.id === editForm.clientId)?.clientId || editForm.clientId}
                        valueName={editForm.clientVendorName}
                        onSelect={handleEditClientSelect}
                        className="mt-1"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Vendor</Label>
                      <VendorSelect
                        valueId={editForm.vendorId}
                        valueName={editForm.clientVendorName}
                        onSelect={handleEditVendorSelect}
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Name (override)</Label>
                    <Input className="input-blue mt-1" value={editForm.clientVendorName} onChange={e => setEdit('clientVendorName', e.target.value)} />
                  </div>

                  {!isClientDirection(editForm.direction) && (
                    <div>
                      <Label className="text-xs">Vendor Province (this tx)</Label>
                      <Select value={editForm.vendorProvinceOverride || editProvince} onValueChange={v => setEdit('vendorProvinceOverride', v)}>
                        <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{PROVINCE_CODES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Amount (excl. tax)</Label>
                    <Input className="input-blue mt-1" type="number" min="0" step="0.01" value={editForm.amountExclTax} onChange={e => setEdit('amountExclTax', e.target.value)} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Tax Override</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Switch checked={editForm.taxOverride} onCheckedChange={v => setEdit('taxOverride', v)} />
                      <span className="text-xs text-muted-foreground">
                        {editForm.taxOverride ? 'Custom rate' : `Auto (${fmtRate(getProvinceTax(editProvince).order_rate)})`}
                      </span>
                    </div>
                  </div>

                  {editForm.taxOverride && (
                    <div>
                      <Label className="text-xs">Override Rate (%)</Label>
                      <Input className="input-blue mt-1" type="number" min="0" max="100" step="0.1" value={editForm.taxOverrideRate} onChange={e => setEdit('taxOverrideRate', e.target.value)} placeholder="e.g. 13" />
                    </div>
                  )}

                  <div className="flex flex-col justify-end">
                    <p className="text-xs text-muted-foreground">Tax: <span className="font-mono">{formatCurrency(editTaxPreview.taxAmount)}</span></p>
                    <p className="text-xs font-semibold">Total: <span className="font-mono">{formatCurrency(editTaxPreview.totalInclTax)}</span></p>
                  </div>

                  <div>
                    <Label className="text-xs">Method</Label>
                    <Input className="input-blue mt-1" value={editForm.paymentMethod} onChange={e => setEdit('paymentMethod', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Reference #</Label>
                    <Input className="input-blue mt-1" value={editForm.referenceNumber} onChange={e => setEdit('referenceNumber', e.target.value)} />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <Label className="text-xs">Notes</Label>
                    <Input className="input-blue mt-1" value={editForm.notes} onChange={e => setEdit('notes', e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={requestSaveEdit}>Save Changes</Button>
                  <Button variant="outline" onClick={() => { setEditingPayment(null); setPendingConfirmEdit(false); }}>Cancel</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingConfirmEdit} onOpenChange={open => { if (!open) setPendingConfirmEdit(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment Edit</AlertDialogTitle>
            <AlertDialogDescription>Please provide a reason for this change (required for audit trail).</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            className="mt-2"
            placeholder="Reason for change..."
            value={editAuditNote}
            onChange={e => setEditAuditNote(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingConfirmEdit(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveEdit}>Confirm & Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
