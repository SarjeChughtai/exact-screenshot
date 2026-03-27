import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobIdSelect } from '@/components/JobIdSelect';
import type { InternalCost } from '@/types';
import { toast } from 'sonner';

export default function InternalCosts() {
  const { deals, internalCosts, addInternalCost, updateInternalCost } = useAppContext();

  const dealsWithoutCosts = deals.filter(d => !internalCosts.find(ic => ic.jobId === d.jobId));

  const initCost = (jobId: string) => {
    if (internalCosts.find(ic => ic.jobId === jobId)) return;
    addInternalCost({
      jobId, trueMaterial: 0, trueStructuralDrawing: 0, trueFoundationDrawing: 0,
      trueFreight: 0, trueInsulation: 0,
      repMaterial: 0, repStructuralDrawing: 0, repFoundationDrawing: 0,
      repFreight: 0, repInsulation: 0,
      salePrice: 0, showRepCosts: false,
    });
    toast.success('Internal costs initialized');
  };

  const update = (jobId: string, field: keyof InternalCost, value: number | boolean) => {
    updateInternalCost(jobId, { [field]: value });
  };

  const COST_FIELDS = [
    { label: 'Material', trueKey: 'trueMaterial', repKey: 'repMaterial' },
    { label: 'Structural Dwg', trueKey: 'trueStructuralDrawing', repKey: 'repStructuralDrawing' },
    { label: 'Foundation Dwg', trueKey: 'trueFoundationDrawing', repKey: 'repFoundationDrawing' },
    { label: 'Freight', trueKey: 'trueFreight', repKey: 'repFreight' },
    { label: 'Insulation', trueKey: 'trueInsulation', repKey: 'repInsulation' },
  ] as const;

  const rows = internalCosts.map(ic => {
    const deal = deals.find(d => d.jobId === ic.jobId);
    const trueTotal = ic.trueMaterial + ic.trueStructuralDrawing + ic.trueFoundationDrawing + ic.trueFreight + ic.trueInsulation;
    const repTotal = ic.repMaterial + ic.repStructuralDrawing + ic.repFoundationDrawing + ic.repFreight + ic.repInsulation;
    const trueGP = ic.salePrice - trueTotal;
    const margin = ic.salePrice > 0 ? (trueGP / ic.salePrice) * 100 : 0;
    return { ic, deal, trueTotal, repTotal, trueGP, margin };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Internal Costs</h2>
          <p className="text-sm text-muted-foreground mt-1">True vs. Rep-visible costs per deal — all fields editable inline</p>
        </div>
        <JobIdSelect onValueChange={initCost} deals={dealsWithoutCosts} placeholder="+ Initialize costs for..." triggerClassName="w-56" />
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 text-left font-medium">Job ID</th>
              <th className="px-2 py-2 text-left font-medium">Client</th>
              {COST_FIELDS.map(f => (
                <th key={f.label} className="px-1 py-2 text-center font-medium" colSpan={2}>{f.label}<br/><span className="font-normal opacity-70">TRUE / REP</span></th>
              ))}
              <th className="px-2 py-2 text-left font-medium">Sale Price</th>
              <th className="px-2 py-2 text-left font-medium">TRUE GP</th>
              <th className="px-2 py-2 text-left font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">No internal costs. Initialize costs for a deal above.</td></tr>
            ) : rows.map(r => (
              <tr key={r.ic.jobId} className="border-b hover:bg-muted/50">
                <td className="px-2 py-1 font-mono text-xs">{r.ic.jobId}</td>
                <td className="px-2 py-1 text-xs">{r.deal?.clientName || '—'}</td>
                {COST_FIELDS.map(f => (
                  <td key={f.label} className="px-0.5 py-1" colSpan={2}>
                    <div className="flex gap-0.5">
                      <Input className="input-blue h-7 text-xs w-20" type="number"
                        value={r.ic[f.trueKey as keyof InternalCost] as number || ''}
                        onChange={e => update(r.ic.jobId, f.trueKey as keyof InternalCost, parseFloat(e.target.value) || 0)} />
                      <Input className="h-7 text-xs w-20 bg-muted" type="number"
                        value={r.ic[f.repKey as keyof InternalCost] as number || ''}
                        onChange={e => update(r.ic.jobId, f.repKey as keyof InternalCost, parseFloat(e.target.value) || 0)} />
                    </div>
                  </td>
                ))}
                <td className="px-1 py-1">
                  <Input className="input-blue h-7 text-xs w-24" type="number"
                    value={r.ic.salePrice || ''}
                    onChange={e => update(r.ic.jobId, 'salePrice', parseFloat(e.target.value) || 0)} />
                </td>
                <td className={`px-2 py-1 font-mono text-xs font-semibold ${r.trueGP < 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency(r.trueGP)}
                </td>
                <td className="px-2 py-1 font-mono text-xs">{r.margin.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
