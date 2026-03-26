import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function VendorPayments() {
  const { deals, payments, internalCosts } = useAppContext();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const rows = deals.map(d => {
    const ic = internalCosts.find(c => c.jobId === d.jobId);
    const tscContract = ic?.trueMaterial || 0;
    const pmt15 = tscContract * 0.15;
    const pmt50 = tscContract * 0.50;
    const pmt35 = tscContract * 0.35;

    const vendorPmts = payments.filter(p => p.jobId === d.jobId && p.direction === 'Vendor Payment OUT');
    const totalPaid = vendorPmts.reduce((s, p) => s + p.amountExclTax, 0);
    const drawingsPaid = vendorPmts.filter(p => p.type === 'Drawings').reduce((s, p) => s + p.amountExclTax, 0);
    const insulationPaid = vendorPmts.filter(p => p.type === 'Insulation').reduce((s, p) => s + p.amountExclTax, 0);
    const freightPaid = vendorPmts.filter(p => p.type === 'Freight').reduce((s, p) => s + p.amountExclTax, 0);

    return { deal: d, tscContract, pmt15, pmt50, pmt35, totalPaid, drawingsPaid, insulationPaid, freightPaid, vendorPmts };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vendor Payments</h2>
        <p className="text-sm text-muted-foreground mt-1">TSC factory payments and vendor costs — click to expand</p>
      </div>
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 w-6"></th>
              {['Job ID','Client','TSC Contract','15% Due','50% Due','35% Due','Total Paid','Drawings','Insulation','Freight'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No deals</td></tr>
            ) : rows.map(r => (
              <>
                <tr key={r.deal.jobId} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setExpandedJob(prev => prev === r.deal.jobId ? null : r.deal.jobId)}>
                  <td className="px-2 py-2">{expandedJob === r.deal.jobId ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.deal.jobId}</td>
                  <td className="px-3 py-2">{r.deal.clientName}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(r.tscContract)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(r.pmt15)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(r.pmt50)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(r.pmt35)}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(r.totalPaid)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(r.drawingsPaid)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(r.insulationPaid)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(r.freightPaid)}</td>
                </tr>
                {expandedJob === r.deal.jobId && (
                  <tr key={`${r.deal.jobId}-detail`} className="bg-muted/30">
                    <td colSpan={11} className="p-4">
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
                      {r.vendorPmts.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Payment History</p>
                          <div className="bg-background rounded border text-xs">
                            <div className="grid grid-cols-5 gap-2 px-3 py-1.5 font-semibold border-b">
                              <span>Date</span><span>Type</span><span>Amount</span><span>Tax</span><span>Notes</span>
                            </div>
                            {r.vendorPmts.map(p => (
                              <div key={p.id} className="grid grid-cols-5 gap-2 px-3 py-1.5 border-b last:border-0">
                                <span>{p.date}</span>
                                <span>{p.type}</span>
                                <span className="font-mono">{formatCurrency(p.amountExclTax)}</span>
                                <span className="font-mono">{formatCurrency(p.taxAmount)}</span>
                                <span className="truncate">{p.notes || '—'}</span>
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
