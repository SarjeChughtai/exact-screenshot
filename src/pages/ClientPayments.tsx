import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function ClientPayments() {
  const { deals, payments } = useAppContext();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const rows = deals.map(d => {
    const clientPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Client Payment IN');
    const refunds = payments.filter(p => p.jobId === d.jobId && p.direction === 'Refund OUT');
    const totalReceived = clientPmts.reduce((s, p) => s + p.amountExclTax, 0);
    const hstCollected = clientPmts.reduce((s, p) => s + p.taxAmount, 0);
    const totalRefunded = refunds.reduce((s, p) => s + p.totalInclTax, 0);
    const lastDate = clientPmts.length ? clientPmts.sort((a, b) => b.date.localeCompare(a.date))[0].date : '—';
    const status = totalReceived === 0 ? 'UNPAID' : 'PARTIAL';
    return { deal: d, totalReceived, hstCollected, count: clientPmts.length, lastDate, status, clientPmts };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Client Payments</h2>
        <p className="text-sm text-muted-foreground mt-1">Payment status per deal — click to expand</p>
      </div>
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 w-6"></th>
              {['Job ID','Client','Total Received','HST Collected','# Payments','Last Payment','Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No deals</td></tr>
            ) : rows.map(r => (
              <>
                <tr key={r.deal.jobId} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setExpandedJob(prev => prev === r.deal.jobId ? null : r.deal.jobId)}>
                  <td className="px-2 py-2">{expandedJob === r.deal.jobId ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
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
                {expandedJob === r.deal.jobId && (
                  <tr key={`${r.deal.jobId}-detail`} className="bg-muted/30">
                    <td colSpan={8} className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Deal Info</p>
                          <p>Job Name: {r.deal.jobName}</p>
                          <p>Dimensions: {r.deal.width}×{r.deal.length}×{r.deal.height}</p>
                          <p>Province: {r.deal.province}</p>
                          <p>Status: {r.deal.dealStatus}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Location</p>
                          <p>{r.deal.address || '—'}</p>
                          <p>{r.deal.city}, {r.deal.province} {r.deal.postalCode}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Team</p>
                          <p>Sales Rep: {r.deal.salesRep}</p>
                          <p>Client ID: {r.deal.clientId}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Production</p>
                          <p>Production: {r.deal.productionStatus}</p>
                          <p>Freight: {r.deal.freightStatus}</p>
                        </div>
                      </div>
                      {r.clientPmts.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Payment History</p>
                          <div className="bg-background rounded border text-xs">
                            <div className="grid grid-cols-5 gap-2 px-3 py-1.5 font-semibold border-b">
                              <span>Date</span><span>Type</span><span>Amount</span><span>Tax</span><span>Method</span>
                            </div>
                            {r.clientPmts.map(p => (
                              <div key={p.id} className="grid grid-cols-5 gap-2 px-3 py-1.5 border-b last:border-0">
                                <span>{p.date}</span>
                                <span>{p.type}</span>
                                <span className="font-mono">{formatCurrency(p.amountExclTax)}</span>
                                <span className="font-mono">{formatCurrency(p.taxAmount)}</span>
                                <span>{p.paymentMethod || '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
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
