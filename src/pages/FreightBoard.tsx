import { useAppContext } from '@/context/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FreightStatus } from '@/types';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';

const FREIGHT_STATUSES: FreightStatus[] = ['Pending', 'Booked', 'In Transit', 'Delivered'];

export default function FreightBoard() {
  const { deals, freight, updateFreight, internalCosts, payments } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { profile } = useSettings();
  const isRestrictedFreightUser = hasAnyRole('freight') && !hasAnyRole('admin', 'owner', 'operations') && !profile.canViewAllFreightBoard;

  // Build freight data from deals + freight records
  const rows = deals.map(d => {
    const fr = freight.find(f => f.jobId === d.jobId);
    const ic = internalCosts.find(c => c.jobId === d.jobId);
    const freightPaid = payments.filter(p => p.jobId === d.jobId && p.direction === 'Vendor Payment OUT' && p.type === 'Freight').reduce((s, p) => s + p.amountExclTax, 0);
    const estFreight = ic?.trueFreight || 0;
    const actualFreight = fr?.actualFreight || 0;
    const activeFreight = actualFreight || estFreight;
    const variance = actualFreight ? actualFreight - estFreight : 0;

    return {
      deal: d, estFreight, actualFreight, activeFreight, variance,
      paid: freightPaid > 0, carrier: fr?.carrier || '', status: fr?.status || 'Pending' as FreightStatus,
    };
  }).filter(row => {
    if (!isRestrictedFreightUser) return true;
    const freightRecord = freight.find(item => item.jobId === row.deal.jobId);
    return freightRecord?.assignedFreightUserId === currentUser.id;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Freight Board</h2>
        <p className="text-sm text-muted-foreground mt-1">Freight coordinator view — no pricing/profit info</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID','Client','Building','Weight','Province','Est Freight','Actual','Variance','Paid','Status'].map(h => (
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
                <td className="px-3 py-2 text-xs">{r.deal.width}×{r.deal.length}×{r.deal.height}</td>
                <td className="px-3 py-2 font-mono">{formatNumber(r.deal.weight)} lbs</td>
                <td className="px-3 py-2">{r.deal.province}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(r.estFreight)}</td>
                <td className="px-3 py-2 font-mono">{r.actualFreight ? formatCurrency(r.actualFreight) : '—'}</td>
                <td className={`px-3 py-2 font-mono ${r.variance > 0 ? 'text-destructive' : r.variance < 0 ? 'text-success' : ''}`}>
                  {r.actualFreight ? formatCurrency(r.variance) : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.paid ? 'status-paid' : 'status-unpaid'}`}>{r.paid ? 'Yes' : 'No'}</span>
                </td>
                <td className="px-3 py-2 text-xs">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
