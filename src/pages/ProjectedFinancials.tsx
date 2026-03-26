import { useAppContext } from '@/context/AppContext';
import { formatCurrency, calcTax } from '@/lib/calculations';

export default function ProjectedFinancials() {
  const { deals, internalCosts } = useAppContext();

  const rows = deals.map(d => {
    const ic = internalCosts.find(c => c.jobId === d.jobId);
    const trueTotal = ic ? ic.trueMaterial + ic.trueStructuralDrawing + ic.trueFoundationDrawing + ic.trueFreight + ic.trueInsulation : 0;
    const repTotal = ic ? ic.repMaterial + ic.repStructuralDrawing + ic.repFoundationDrawing + ic.repFreight + ic.repInsulation : 0;
    const useRep = ic?.showRepCosts ?? false;
    const displayTotal = useRep ? repTotal : trueTotal;
    const salePrice = ic?.salePrice ?? 0;
    const gp = salePrice - displayTotal;
    const margin = salePrice > 0 ? (gp / salePrice) * 100 : 0;
    const taxes = calcTax(salePrice, d.province);
    const dataOk = ic && salePrice > 0;

    return { deal: d, salePrice, displayTotal, gp, margin, taxes, dataOk, perSqft: d.sqft > 0 ? salePrice / d.sqft : 0 };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Projected Financials</h2>
        <p className="text-sm text-muted-foreground mt-1">Auto-populated from Internal Costs</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID','Client','Sale Price','Total Cost','Gross Profit','Margin %','$/sqft','GST/HST','QST','Data OK?'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No deals with financial data</td></tr>
            ) : rows.map(r => (
              <tr key={r.deal.jobId} className={`border-b hover:bg-muted/50 ${!r.dataOk ? 'bg-warning/10' : ''}`}>
                <td className="px-3 py-2 font-mono text-xs">{r.deal.jobId}</td>
                <td className="px-3 py-2">{r.deal.clientName}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.salePrice)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.displayTotal)}</td>
                <td className={`px-3 py-2 font-mono font-semibold ${r.gp < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(r.gp)}</td>
                <td className="px-3 py-2 font-mono">{r.margin.toFixed(1)}%</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.perSqft)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.taxes.gstHst)}</td>
                <td className="px-3 py-2 font-mono">{r.taxes.qst > 0 ? formatCurrency(r.taxes.qst) : '—'}</td>
                <td className="px-3 py-2">{r.dataOk ? <span className="text-success text-xs">✓</span> : <span className="text-warning text-xs">⚠</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
