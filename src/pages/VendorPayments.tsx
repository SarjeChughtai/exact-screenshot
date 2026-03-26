import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';

export default function VendorPayments() {
  const { deals, payments, internalCosts } = useAppContext();

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

    return { deal: d, tscContract, pmt15, pmt50, pmt35, totalPaid, drawingsPaid, insulationPaid, freightPaid };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vendor Payments</h2>
        <p className="text-sm text-muted-foreground mt-1">TSC factory payments and vendor costs</p>
      </div>
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID','Client','TSC Contract','15% Due','50% Due','35% Due','Total Paid','Drawings','Insulation','Freight'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No deals</td></tr>
            ) : rows.map(r => (
              <tr key={r.deal.jobId} className="border-b hover:bg-muted/50">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
