import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';

export default function ClientPayments() {
  const { deals, payments } = useAppContext();

  const rows = deals.map(d => {
    const clientPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Client Payment IN');
    const refunds = payments.filter(p => p.jobId === d.jobId && p.direction === 'Refund OUT');
    const totalReceived = clientPmts.reduce((s, p) => s + p.amountExclTax, 0);
    const hstCollected = clientPmts.reduce((s, p) => s + p.taxAmount, 0);
    const totalRefunded = refunds.reduce((s, p) => s + p.totalInclTax, 0);
    const lastDate = clientPmts.length ? clientPmts.sort((a, b) => b.date.localeCompare(a.date))[0].date : '—';
    // We need a sale price to compute balance - use internalCosts if available
    const status = totalReceived === 0 ? 'UNPAID' : 'PARTIAL';
    return { deal: d, totalReceived, hstCollected, count: clientPmts.length, lastDate, status };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Client Payments</h2>
        <p className="text-sm text-muted-foreground mt-1">Payment status per deal (auto from ledger)</p>
      </div>
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID','Client','Total Received','HST Collected','# Payments','Last Payment','Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No deals</td></tr>
            ) : rows.map(r => (
              <tr key={r.deal.jobId} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-xs">{r.deal.jobId}</td>
                <td className="px-3 py-2">{r.deal.clientName}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.totalReceived)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.hstCollected)}</td>
                <td className="px-3 py-2 text-center">{r.count}</td>
                <td className="px-3 py-2 text-xs">{r.lastDate}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'PAID' ? 'status-paid' : r.status === 'PARTIAL' ? 'status-partial' : 'status-unpaid'}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
