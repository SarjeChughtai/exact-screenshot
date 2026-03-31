import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { formatCurrency } from '@/lib/calculations';
import { buildCommissionStageEntries, type CommissionStageEntry, type CommissionQueueStatus } from '@/lib/commission';
import type { CommissionPayout, CommissionRecipientRole } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

type QueueFilter = CommissionQueueStatus | 'all';
type SortBy = 'eligible' | 'paid' | 'user' | 'amount' | 'job';

const DEFAULT_CONFIRM_FORM = {
  paidOn: new Date().toISOString().split('T')[0],
  paymentMethod: '',
  referenceNumber: '',
  notes: '',
};

function statusBadgeClass(status: CommissionQueueStatus) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'pending') return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getStatusLabel(status: CommissionQueueStatus) {
  if (status === 'paid') return 'Paid';
  if (status === 'pending') return 'Pending';
  return 'Projected';
}

function compareEntries(a: CommissionStageEntry, b: CommissionStageEntry, sortBy: SortBy) {
  switch (sortBy) {
    case 'paid':
      return (b.payoutRecord?.paidOn || '').localeCompare(a.payoutRecord?.paidOn || '');
    case 'user':
      return a.recipientName.localeCompare(b.recipientName) || a.jobId.localeCompare(b.jobId);
    case 'amount':
      return b.amount - a.amount || a.recipientName.localeCompare(b.recipientName);
    case 'job':
      return a.jobId.localeCompare(b.jobId);
    case 'eligible':
    default:
      return (a.eligibleOnDate || '9999-12-31').localeCompare(b.eligibleOnDate || '9999-12-31')
        || a.recipientName.localeCompare(b.recipientName);
  }
}

function SummaryCard({ label, amount, count }: { label: string; amount: number; count: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(amount)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{count} payout{count === 1 ? '' : 's'}</p>
    </div>
  );
}

export default function CommissionProfit() {
  const { deals, internalCosts, payments, commissionPayouts, upsertCommissionPayout, deleteCommissionPayout } = useAppContext();
  const { currentUser } = useRoles();
  const [activeRole, setActiveRole] = useState<CommissionRecipientRole>('sales_rep');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('pending');
  const [userFilter, setUserFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('eligible');
  const [selectedEntry, setSelectedEntry] = useState<CommissionStageEntry | null>(null);
  const [confirmForm, setConfirmForm] = useState(DEFAULT_CONFIRM_FORM);
  const [pendingRemoval, setPendingRemoval] = useState<CommissionStageEntry | null>(null);

  const allEntries = useMemo(
    () => buildCommissionStageEntries(deals, internalCosts, payments, commissionPayouts),
    [commissionPayouts, deals, internalCosts, payments],
  );

  const roleEntries = useMemo(
    () => allEntries.filter(entry => entry.recipientRole === activeRole),
    [activeRole, allEntries],
  );

  const userOptions = useMemo(
    () => Array.from(new Set(roleEntries.map(entry => entry.recipientName))).sort((a, b) => a.localeCompare(b)),
    [roleEntries],
  );

  const summary = useMemo(() => {
    return roleEntries.reduce(
      (acc, entry) => {
        acc[entry.status].amount += entry.amount;
        acc[entry.status].count += 1;
        return acc;
      },
      {
        pending: { amount: 0, count: 0 },
        paid: { amount: 0, count: 0 },
        projected: { amount: 0, count: 0 },
      },
    );
  }, [roleEntries]);

  const userSummary = useMemo(() => {
    const grouped = new Map<string, {
      recipientName: string;
      pendingAmount: number;
      pendingCount: number;
      paidAmount: number;
      paidCount: number;
      projectedAmount: number;
      projectedCount: number;
    }>();

    for (const entry of roleEntries) {
      const existing = grouped.get(entry.recipientName) || {
        recipientName: entry.recipientName,
        pendingAmount: 0,
        pendingCount: 0,
        paidAmount: 0,
        paidCount: 0,
        projectedAmount: 0,
        projectedCount: 0,
      };

      if (entry.status === 'pending') {
        existing.pendingAmount += entry.amount;
        existing.pendingCount += 1;
      } else if (entry.status === 'paid') {
        existing.paidAmount += entry.amount;
        existing.paidCount += 1;
      } else {
        existing.projectedAmount += entry.amount;
        existing.projectedCount += 1;
      }

      grouped.set(entry.recipientName, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => (
      b.pendingAmount - a.pendingAmount
      || a.recipientName.localeCompare(b.recipientName)
    ));
  }, [roleEntries]);

  const filteredEntries = useMemo(() => {
    let next = roleEntries;
    if (queueFilter !== 'all') {
      next = next.filter(entry => entry.status === queueFilter);
    }
    if (userFilter !== 'all') {
      next = next.filter(entry => entry.recipientName === userFilter);
    }
    return [...next].sort((a, b) => compareEntries(a, b, sortBy));
  }, [queueFilter, roleEntries, sortBy, userFilter]);

  const openConfirmDialog = (entry: CommissionStageEntry) => {
    setSelectedEntry(entry);
    setConfirmForm({
      paidOn: new Date().toISOString().split('T')[0],
      paymentMethod: '',
      referenceNumber: '',
      notes: '',
    });
  };

  const confirmPaid = async () => {
    if (!selectedEntry) return;
    if (!confirmForm.paidOn) {
      toast.error('Paid date is required');
      return;
    }

    const now = new Date().toISOString();
    const payout: CommissionPayout = {
      id: selectedEntry.payoutRecord?.id || crypto.randomUUID(),
      jobId: selectedEntry.jobId,
      recipientRole: selectedEntry.recipientRole,
      recipientName: selectedEntry.recipientName,
      payoutStage: selectedEntry.payoutStage,
      amount: selectedEntry.amount,
      eligibleOnDate: selectedEntry.eligibleOnDate,
      paidOn: confirmForm.paidOn,
      paymentMethod: confirmForm.paymentMethod,
      referenceNumber: confirmForm.referenceNumber,
      notes: confirmForm.notes,
      confirmedByUserId: currentUser.id || null,
      confirmedByName: currentUser.name || null,
      createdAt: selectedEntry.payoutRecord?.createdAt || now,
      updatedAt: now,
    };

    await upsertCommissionPayout(payout);
    setSelectedEntry(null);
    toast.success('Commission payout recorded');
  };

  const removePaidFlag = async () => {
    if (!pendingRemoval?.payoutRecord?.id) return;
    await deleteCommissionPayout(pendingRemoval.payoutRecord.id);
    setPendingRemoval(null);
    toast.success('Payout returned to pending status');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Commission Payout Queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track who is eligible, when the deposit threshold was hit, what is still pending, and what has already been paid.
          </p>
        </div>
        <Tabs value={activeRole} onValueChange={value => { setActiveRole(value as CommissionRecipientRole); setUserFilter('all'); }}>
          <TabsList>
            <TabsTrigger value="sales_rep">Sales Reps</TabsTrigger>
            <TabsTrigger value="estimator">Estimators</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Pending Now" amount={summary.pending.amount} count={summary.pending.count} />
        <SummaryCard label="Already Paid" amount={summary.paid.amount} count={summary.paid.count} />
        <SummaryCard label="Projected Next" amount={summary.projected.amount} count={summary.projected.count} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">By User</h3>
            <p className="text-xs text-muted-foreground">
              See who has already been paid, what still needs payout, and what is only projected.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Pending</th>
                  <th className="px-2 py-2 font-medium">Paid</th>
                  <th className="px-2 py-2 font-medium">Projected</th>
                </tr>
              </thead>
              <tbody>
                {userSummary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-sm text-muted-foreground">No commission records</td>
                  </tr>
                ) : userSummary.map(row => (
                  <tr key={row.recipientName} className="border-b last:border-b-0">
                    <td className="px-2 py-2 font-medium text-foreground">{row.recipientName}</td>
                    <td className="px-2 py-2">
                      <div className="font-mono">{formatCurrency(row.pendingAmount)}</div>
                      <div className="text-xs text-muted-foreground">{row.pendingCount} item{row.pendingCount === 1 ? '' : 's'}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono">{formatCurrency(row.paidAmount)}</div>
                      <div className="text-xs text-muted-foreground">{row.paidCount} item{row.paidCount === 1 ? '' : 's'}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono">{formatCurrency(row.projectedAmount)}</div>
                      <div className="text-xs text-muted-foreground">{row.projectedCount} item{row.projectedCount === 1 ? '' : 's'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Queue</h3>
              <p className="text-xs text-muted-foreground">
                Eligibility is calculated from client deposits and updates automatically from the payment ledger.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={queueFilter} onValueChange={value => setQueueFilter(value as QueueFilter)}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="projected">Projected</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">User</Label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {userOptions.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sort</Label>
                <Select value={sortBy} onValueChange={value => setSortBy(value as SortBy)}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eligible">Eligible date</SelectItem>
                    <SelectItem value="paid">Paid date</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="job">Job ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Job</th>
                  <th className="px-2 py-2 font-medium">Stage</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Eligibility</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Paid</th>
                  <th className="px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-8 text-center text-muted-foreground">No payouts match the current filters</td>
                  </tr>
                ) : filteredEntries.map(entry => (
                  <tr key={entry.key} className="border-b align-top last:border-b-0">
                    <td className="px-2 py-2">
                      <div className="font-medium text-foreground">{entry.recipientName}</div>
                      <div className="text-xs text-muted-foreground">{entry.clientName}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-xs">{entry.jobId}</div>
                      <div className="text-xs text-muted-foreground">{(entry.paidPct * 100).toFixed(0)}% paid</div>
                    </td>
                    <td className="px-2 py-2">
                      <div>{entry.stageLabel}</div>
                      <div className="text-xs text-muted-foreground">{entry.thresholdLabel}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono font-semibold">{formatCurrency(entry.amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.recipientRole === 'sales_rep'
                          ? `${entry.commissionBasisLabel}: ${formatCurrency(entry.commissionBaseGp)}`
                          : `True GP: ${formatCurrency(entry.trueGp)}`}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {entry.eligibleOnDate ? (
                        <>
                          <div>{entry.eligibleOnDate}</div>
                          <div className="text-xs text-muted-foreground">Eligible once threshold cleared</div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono">{formatCurrency(entry.amountRemainingToThreshold)}</div>
                          <div className="text-xs text-muted-foreground">Still needed to reach {entry.thresholdLabel.toLowerCase()}</div>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(entry.status)}`}>
                        {getStatusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {entry.payoutRecord ? (
                        <>
                          <div>{entry.payoutRecord.paidOn}</div>
                          <div className="text-xs text-muted-foreground">{entry.payoutRecord.paymentMethod || 'No method saved'}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not paid</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {entry.status === 'pending' && (
                        <Button size="sm" onClick={() => openConfirmDialog(entry)}>Mark Paid</Button>
                      )}
                      {entry.status === 'paid' && (
                        <Button size="sm" variant="outline" onClick={() => setPendingRemoval(entry)}>Mark Unpaid</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedEntry} onOpenChange={open => { if (!open) setSelectedEntry(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirm Commission Payout</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">User</p>
                    <p className="font-medium">{selectedEntry.recipientName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Job</p>
                    <p className="font-mono">{selectedEntry.jobId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stage</p>
                    <p>{selectedEntry.stageLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-mono font-semibold">{formatCurrency(selectedEntry.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Eligible On</p>
                    <p>{selectedEntry.eligibleOnDate || 'Not yet eligible'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Client Paid</p>
                    <p className="font-mono">{formatCurrency(selectedEntry.clientPaid)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Paid Date</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={confirmForm.paidOn}
                    onChange={event => setConfirmForm(prev => ({ ...prev, paidOn: event.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Payment Method</Label>
                  <Input
                    className="mt-1"
                    value={confirmForm.paymentMethod}
                    onChange={event => setConfirmForm(prev => ({ ...prev, paymentMethod: event.target.value }))}
                    placeholder="Cheque, EFT, etc."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Reference</Label>
                  <Input
                    className="mt-1"
                    value={confirmForm.referenceNumber}
                    onChange={event => setConfirmForm(prev => ({ ...prev, referenceNumber: event.target.value }))}
                    placeholder="Reference number"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    className="mt-1 min-h-24"
                    value={confirmForm.notes}
                    onChange={event => setConfirmForm(prev => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional payout note"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedEntry(null)}>Cancel</Button>
                <Button onClick={() => void confirmPaid()}>Save Payout</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingRemoval} onOpenChange={open => { if (!open) setPendingRemoval(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Payout To Pending</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stored paid confirmation for {pendingRemoval?.recipientName} on job {pendingRemoval?.jobId}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={() => void removePaidFlag()}>
              Mark Unpaid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
