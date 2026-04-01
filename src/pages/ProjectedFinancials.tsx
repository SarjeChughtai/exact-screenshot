import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency, calcTax } from '@/lib/calculations';
import { useSharedJobs } from '@/lib/sharedJobs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ProjectedFinancials() {
  const { deals, internalCosts } = useAppContext();
  const { visibleJobIds } = useSharedJobs({ allowedStates: ['deal'] });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const rows = deals.filter(deal => visibleJobIds.has(deal.jobId)).map(deal => {
    const internalCost = internalCosts.find(cost => cost.jobId === deal.jobId);
    const trueTotal = internalCost ? internalCost.trueMaterial + internalCost.trueStructuralDrawing + internalCost.trueFoundationDrawing + internalCost.trueFreight + internalCost.trueInsulation : 0;
    const repTotal = internalCost ? internalCost.repMaterial + internalCost.repStructuralDrawing + internalCost.repFoundationDrawing + internalCost.repFreight + internalCost.repInsulation : 0;
    const useRepCosts = internalCost?.showRepCosts ?? false;
    const displayTotal = useRepCosts ? repTotal : trueTotal;
    const salePrice = internalCost?.salePrice ?? 0;
    const grossProfit = salePrice - displayTotal;
    const margin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;
    const taxes = calcTax(salePrice, deal.province);

    const missingFields: string[] = [];
    if (!internalCost) {
      missingFields.push('Internal cost record');
    } else {
      if (!internalCost.salePrice) missingFields.push('Sale price');
      if (!internalCost.trueMaterial && !internalCost.repMaterial) missingFields.push('Material cost');
      if (!internalCost.trueStructuralDrawing && !internalCost.repStructuralDrawing) missingFields.push('Structural drawing cost');
      if (!internalCost.trueFoundationDrawing && !internalCost.repFoundationDrawing) missingFields.push('Foundation drawing cost');
      if (!internalCost.trueFreight && !internalCost.repFreight) missingFields.push('Freight cost');
    }

    return {
      deal,
      salePrice,
      displayTotal,
      grossProfit,
      margin,
      taxes,
      dataOk: missingFields.length === 0,
      missingFields,
      perSqft: deal.sqft > 0 ? salePrice / deal.sqft : 0,
    };
  });

  const selectedRow = rows.find(row => row.deal.jobId === selectedJobId) || null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Projected Financials</h2>
        <p className="text-sm text-muted-foreground mt-1">Auto-populated from Internal Costs. Click the warning indicator to see missing data.</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID', 'Client', 'Sale Price', 'Total Cost', 'Gross Profit', 'Margin %', '$/sqft', 'GST/HST', 'QST', 'Data'].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No deals with financial data</td></tr>
            ) : rows.map(row => (
              <tr key={row.deal.jobId} className={`border-b hover:bg-muted/50 ${!row.dataOk ? 'bg-warning/10' : ''}`}>
                <td className="px-3 py-2 font-mono text-xs">{row.deal.jobId}</td>
                <td className="px-3 py-2">{row.deal.clientName}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(row.salePrice)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(row.displayTotal)}</td>
                <td className={`px-3 py-2 font-mono font-semibold ${row.grossProfit < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(row.grossProfit)}</td>
                <td className="px-3 py-2 font-mono">{row.margin.toFixed(1)}%</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(row.perSqft)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(row.taxes.gstHst)}</td>
                <td className="px-3 py-2 font-mono">{row.taxes.qst > 0 ? formatCurrency(row.taxes.qst) : '-'}</td>
                <td className="px-3 py-2">
                  {row.dataOk ? (
                    <span className="text-success text-xs">OK</span>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-warning" onClick={() => setSelectedJobId(row.deal.jobId)}>
                      Warning
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selectedRow)} onOpenChange={open => !open && setSelectedJobId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Missing Financial Data</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <p><span className="font-medium">Job:</span> {selectedRow.deal.jobId}</p>
              <p><span className="font-medium">Client:</span> {selectedRow.deal.clientName}</p>
              <div>
                <p className="font-medium mb-2">Missing fields</p>
                {selectedRow.missingFields.length === 0 ? (
                  <p className="text-muted-foreground">No missing fields.</p>
                ) : (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {selectedRow.missingFields.map(field => <li key={field}>{field}</li>)}
                  </ul>
                )}
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline"><a href="/internal-costs">Open Internal Costs</a></Button>
                <Button asChild variant="outline"><a href="/deals">Open Master Deals</a></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
