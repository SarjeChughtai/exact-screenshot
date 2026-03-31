import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';
import { useSharedJobs } from '@/lib/sharedJobs';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function DealPL() {
  const { deals, payments } = useAppContext();
  const { visibleJobIds } = useSharedJobs({ allowedStates: ['deal'] });
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Only show actual deals, not quotes
  const rows = deals.filter(deal => visibleJobIds.has(deal.jobId)).map(d => {
    const clientIn = payments.filter(p => p.jobId === d.jobId && (p.direction === 'Client Payment IN' || p.direction === 'Refund IN')).reduce((s, p) => s + p.amountExclTax, 0);
    const vendorOut = payments.filter(p => p.jobId === d.jobId && (p.direction === 'Vendor Payment OUT' || p.direction === 'Refund OUT')).reduce((s, p) => s + p.amountExclTax, 0);
    const netCash = clientIn - vendorOut;
    const isCancelled = d.dealStatus === 'Cancelled';
    const dealPayments = payments.filter(p => p.jobId === d.jobId);
    return { deal: d, clientIn, vendorOut, netCash, isCancelled, dealPayments };
  });

  const activeProfit = rows.filter(r => !r.isCancelled).reduce((s, r) => s + r.netCash, 0);
  const cancelProfit = rows.filter(r => r.isCancelled).reduce((s, r) => s + r.netCash, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Deal Exposure</h2>
        <p className="text-sm text-muted-foreground mt-1">Cash position per deal — click to see payment details</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Active Deals Profit</p>
          <p className={`text-xl font-bold font-mono ${activeProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(activeProfit)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Cancelled P&L</p>
          <p className={`text-xl font-bold font-mono ${cancelProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(cancelProfit)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Combined</p>
          <p className={`text-xl font-bold font-mono ${activeProfit + cancelProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(activeProfit + cancelProfit)}</p>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 w-6"></th>
              {['Job ID', 'Client', 'Status', 'Client In', 'Vendor Out', 'Net Cash'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <>
                <tr key={r.deal.jobId} className={`border-b hover:bg-muted/50 cursor-pointer ${r.isCancelled ? 'opacity-50' : ''}`} onClick={() => setExpandedJob(prev => prev === r.deal.jobId ? null : r.deal.jobId)}>
                  <td className="px-2 py-2">{expandedJob === r.deal.jobId ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.deal.jobId}</td>
                  <td className="px-3 py-2">{r.deal.clientName}</td>
                  <td className="px-3 py-2 text-xs">{r.deal.dealStatus}</td>
                  <td className="px-3 py-2 font-mono text-success">{formatCurrency(r.clientIn)}</td>
                  <td className="px-3 py-2 font-mono text-destructive">{formatCurrency(r.vendorOut)}</td>
                  <td className={`px-3 py-2 font-mono font-semibold ${r.netCash >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(r.netCash)}</td>
                </tr>
                {expandedJob === r.deal.jobId && (
                  <tr key={`${r.deal.jobId}-payments`} className="bg-muted/30">
                    <td colSpan={7} className="p-4">
                      {r.dealPayments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No payments recorded for this deal.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="pb-1 text-left font-medium">Date</th>
                              <th className="pb-1 text-left font-medium">Direction</th>
                              <th className="pb-1 text-left font-medium">Type</th>
                              <th className="pb-1 text-right font-medium">Amount</th>
                              <th className="pb-1 text-right font-medium">Tax</th>
                              <th className="pb-1 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.dealPayments.map(p => (
                              <tr key={p.id} className="border-b last:border-0">
                                <td className="py-1">{p.date}</td>
                                <td className={`py-1 font-medium ${p.direction.includes('IN') ? 'text-success' : 'text-destructive'}`}>{p.direction}</td>
                                <td className="py-1">{p.type}</td>
                                <td className="py-1 text-right font-mono">{formatCurrency(p.amountExclTax)}</td>
                                <td className="py-1 text-right font-mono">{formatCurrency(p.taxAmount)}</td>
                                <td className="py-1 text-right font-mono font-semibold">{formatCurrency(p.totalInclTax)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t font-semibold">
                              <td colSpan={3} className="py-1">Net Position</td>
                              <td colSpan={3} className={`py-1 text-right font-mono ${r.netCash >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(r.netCash)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
