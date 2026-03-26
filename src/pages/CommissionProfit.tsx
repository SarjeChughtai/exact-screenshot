import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { formatCurrency } from '@/lib/calculations';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function CommissionProfit() {
  const { deals, internalCosts, payments } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const isAdmin = hasAnyRole('admin', 'owner');
  const [showTrueGP, setShowTrueGP] = useState(false);

  const isSalesRep = !hasAnyRole('admin', 'owner', 'accounting', 'operations', 'freight');

  const visibleDeals = isSalesRep
    ? deals.filter(d => d.salesRep === currentUser.name || d.salesRep.toLowerCase().includes(currentUser.name.toLowerCase()))
    : deals;

  const rows = visibleDeals.map(d => {
    const ic = internalCosts.find(c => c.jobId === d.jobId);
    const salePrice = ic?.salePrice || 0;
    const trueTotal = ic ? ic.trueMaterial + ic.trueStructuralDrawing + ic.trueFoundationDrawing + ic.trueFreight + ic.trueInsulation : 0;
    const repTotal = ic ? ic.repMaterial + ic.repStructuralDrawing + ic.repFoundationDrawing + ic.repFreight + ic.repInsulation : 0;
    const trueGP = salePrice - trueTotal;
    const repGP = salePrice - repTotal;
    
    const gpToShow = (isAdmin && showTrueGP) ? trueGP : repGP;
    const totalRepCommission = gpToShow * 0.30;

    const clientPaid = payments.filter(p => p.jobId === d.jobId && p.direction === 'Client Payment IN').reduce((s, p) => s + p.amountExclTax, 0);
    const paidPct = salePrice > 0 ? (clientPaid / salePrice) * 100 : 0;
    const depositStage = paidPct >= 100 ? '100%' : paidPct >= 70 ? '70%+' : paidPct >= 30 ? '30%+' : '<30%';

    const comm1 = totalRepCommission * 0.50;
    const comm2 = totalRepCommission * 0.25;
    const comm3 = totalRepCommission * 0.25;

    const ownerEach = trueGP * 0.05;
    const estimatorComm = trueGP * 0.05;

    // Track what's been paid vs owed
    const commPaid = 0; // TODO: track actual commission payments
    const commOwing = totalRepCommission - commPaid;

    return {
      deal: d, salePrice, gpToShow, totalRepCommission,
      clientPaid, paidPct, depositStage, comm1, comm2, comm3,
      ownerEach, estimatorComm, commOwing,
      comm1Due: paidPct >= 30, comm2Due: paidPct >= 70, comm3Due: paidPct >= 100,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Commission & Profit</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isSalesRep ? 'Your commission breakdown' : 'Commission breakdown per deal'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Show TRUE GP</Label>
            <Switch checked={showTrueGP} onCheckedChange={setShowTrueGP} />
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID', 'Client', 'Rep', 'Sale Price', isAdmin && showTrueGP ? 'TRUE GP' : 'GP', 'Total Comm (30%)', 'Paid %', 'Stage', '1st (50%)', '2nd (25%)', '3rd (25%)', 'Amount Owing'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
              {isAdmin && <th className="px-3 py-2 text-left font-medium">Owner ×3</th>}
              {isAdmin && <th className="px-3 py-2 text-left font-medium">Estimator</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">No deals</td></tr>
            ) : rows.map(r => (
              <tr key={r.deal.jobId} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-xs">{r.deal.jobId}</td>
                <td className="px-3 py-2">{r.deal.clientName}</td>
                <td className="px-3 py-2 text-xs">{r.deal.salesRep}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.salePrice)}</td>
                <td className={`px-3 py-2 font-mono ${r.gpToShow < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(r.gpToShow)}</td>
                <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(r.totalRepCommission)}</td>
                <td className="px-3 py-2 font-mono">{r.paidPct.toFixed(0)}%</td>
                <td className="px-3 py-2 text-xs">{r.depositStage}</td>
                <td className={`px-3 py-2 font-mono ${r.comm1Due ? 'text-success font-semibold' : 'text-muted-foreground'}`}>{formatCurrency(r.comm1)}</td>
                <td className={`px-3 py-2 font-mono ${r.comm2Due ? 'text-success font-semibold' : 'text-muted-foreground'}`}>{formatCurrency(r.comm2)}</td>
                <td className={`px-3 py-2 font-mono ${r.comm3Due ? 'text-success font-semibold' : 'text-muted-foreground'}`}>{formatCurrency(r.comm3)}</td>
                <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(r.commOwing)}</td>
                {isAdmin && <td className="px-3 py-2 font-mono">{formatCurrency(r.ownerEach)}</td>}
                {isAdmin && <td className="px-3 py-2 font-mono">{formatCurrency(r.estimatorComm)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
