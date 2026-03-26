import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { exportToCSV, csvCurrency } from '@/lib/csvExport';
import { Download } from 'lucide-react';

type TimePeriod = 'monthly' | 'quarterly' | 'yearly' | 'custom';

function getQuarter(dateStr: string): string {
  const month = parseInt(dateStr.substring(5, 7), 10);
  const year = dateStr.substring(0, 4);
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function getYear(dateStr: string): string {
  return dateStr.substring(0, 4);
}

function getMonth(dateStr: string): string {
  return dateStr.substring(0, 7);
}

export default function MonthlyHST() {
  const { payments, deals } = useAppContext();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Filter payments by custom date range
  const filteredPayments = useMemo(() => {
    if (timePeriod === 'custom' && customStart && customEnd) {
      return payments.filter(p => p.date >= customStart && p.date <= customEnd);
    }
    return payments;
  }, [payments, timePeriod, customStart, customEnd]);

  // Group by period
  const groupKey = (dateStr: string): string => {
    if (!dateStr) return 'Unknown';
    switch (timePeriod) {
      case 'quarterly': return getQuarter(dateStr);
      case 'yearly': return getYear(dateStr);
      case 'custom':
      case 'monthly':
      default: return getMonth(dateStr);
    }
  };

  // Transaction-level data
  const transactions = useMemo(() => {
    return filteredPayments.map(p => {
      const deal = deals.find(d => d.jobId === p.jobId);
      return {
        ...p,
        clientName: deal?.clientName || p.clientVendorName || '—',
        period: groupKey(p.date),
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredPayments, deals, timePeriod]);

  // Period summaries
  const periodSummaries = useMemo(() => {
    const map: Record<string, { collected: number; paid: number; transactions: number }> = {};

    transactions.forEach(t => {
      if (!map[t.period]) map[t.period] = { collected: 0, paid: 0, transactions: 0 };
      map[t.period].transactions++;
      if (t.direction === 'Client Payment IN' || t.direction === 'Refund IN') {
        map[t.period].collected += t.taxAmount;
      }
      if (t.direction === 'Vendor Payment OUT' || t.direction === 'Refund OUT') {
        map[t.period].paid += t.taxAmount;
      }
    });

    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([period, data]) => ({
        period,
        ...data,
        net: data.collected - data.paid,
      }));
  }, [transactions]);

  // Grand totals
  const grandTotals = useMemo(() => {
    return periodSummaries.reduce(
      (acc, s) => ({
        collected: acc.collected + s.collected,
        paid: acc.paid + s.paid,
        net: acc.net + s.net,
        transactions: acc.transactions + s.transactions,
      }),
      { collected: 0, paid: 0, net: 0, transactions: 0 }
    );
  }, [periodSummaries]);

  const handleExport = () => {
    const headers = [
      'Date', 'Job ID', 'Transaction', 'Payor/Payee', 'Payment Name',
      'Amount (excl tax)', 'HST/GST Amount', 'Total (incl tax)', 'Direction', 'Period',
    ];
    const rows = transactions.map(t => [
      t.date, t.jobId, t.type, t.clientName, t.referenceNumber || '—',
      csvCurrency(t.amountExclTax), csvCurrency(t.taxAmount), csvCurrency(t.totalInclTax),
      t.direction, t.period,
    ]);
    exportToCSV('hst_report', headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">HST Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tax collected vs. paid — net HST position by period
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* Period controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Time Period</Label>
          <Select value={timePeriod} onValueChange={v => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-36 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {timePeriod === 'custom' && (
          <>
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date" className="mt-1 w-40"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input
                type="date" className="mt-1 w-40"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {/* Period Summary Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Period', 'Transactions', 'Tax Collected', 'Tax Paid', 'Net Position', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodSummaries.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No payment data</td></tr>
            ) : (
              <>
                {periodSummaries.map(s => (
                  <tr key={s.period} className="border-b hover:bg-muted/50">
                    <td className="px-3 py-2 font-mono font-semibold">{s.period}</td>
                    <td className="px-3 py-2 text-xs">{s.transactions}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(s.collected)}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(s.paid)}</td>
                    <td className={`px-3 py-2 font-mono font-semibold ${s.net >= 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatCurrency(s.net)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${s.net >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {s.net >= 0 ? 'Owe CRA' : 'ITC Refund'}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Net Position Footer */}
                <tr className="bg-muted/50 font-semibold border-t-2">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-xs">{grandTotals.transactions}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(grandTotals.collected)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(grandTotals.paid)}</td>
                  <td className={`px-3 py-2 font-mono ${grandTotals.net >= 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatCurrency(grandTotals.net)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${grandTotals.net >= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      Net: {grandTotals.net >= 0 ? 'Owe CRA' : 'ITC Refund'}
                    </span>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Transaction Detail Table */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Transaction Detail ({transactions.length} records)
        </h3>
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs">
                {['Date', 'Job ID', 'Transaction', 'Payor/Payee', 'Payment Name', 'Amount', 'HST', 'Total', 'Direction'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground text-xs">No transactions</td></tr>
              ) : transactions.map(t => (
                <tr key={t.id} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-1.5 text-xs">{t.date}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{t.jobId}</td>
                  <td className="px-3 py-1.5 text-xs">{t.type}</td>
                  <td className="px-3 py-1.5 text-xs">{t.clientName}</td>
                  <td className="px-3 py-1.5 text-xs">{t.referenceNumber || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{formatCurrency(t.amountExclTax)}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{formatCurrency(t.taxAmount)}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{formatCurrency(t.totalInclTax)}</td>
                  <td className="px-3 py-1.5 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      t.direction.includes('IN') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.direction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
