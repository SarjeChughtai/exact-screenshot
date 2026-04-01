import { useAppContext } from '@/context/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import type { FreightStatus } from '@/types';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { useSharedJobs } from '@/lib/sharedJobs';
import { isDealFreightReady } from '@/lib/opportunities';

export default function FreightBoard() {
  const { deals, freight, dealMilestones, internalCosts, payments } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { profile } = useSettings();
  const { visibleJobIds } = useSharedJobs({ allowedStates: ['deal'] });
  const isRestrictedFreightUser = hasAnyRole('freight') && !hasAnyRole('admin', 'owner', 'operations') && !profile.canViewAllFreightBoard;

  const rows = deals.filter(deal => visibleJobIds.has(deal.jobId)).map(deal => {
    const freightRecord = freight.find(item => item.jobId === deal.jobId);
    const milestonesForJob = dealMilestones.filter(item => item.jobId === deal.jobId);
    const costs = internalCosts.find(item => item.jobId === deal.jobId);
    const freightPaid = payments
      .filter(payment => payment.jobId === deal.jobId && payment.direction === 'Vendor Payment OUT' && payment.type === 'Freight')
      .reduce((sum, payment) => sum + payment.amountExclTax, 0);

    const estFreight = costs?.trueFreight || 0;
    const actualFreight = freightRecord?.actualFreight || 0;
    const variance = actualFreight ? actualFreight - estFreight : 0;

    return {
      deal,
      estFreight,
      actualFreight,
      variance,
      paid: freightPaid > 0,
      carrier: freightRecord?.carrier || '',
      status: freightRecord?.status || 'Pending' as FreightStatus,
      pickupDate: freightRecord?.pickupDate || deal.pickupDate || '',
      deliveryDate: freightRecord?.deliveryDate || deal.deliveryDate || '',
      dropOffLocation: freightRecord?.dropOffLocation || freightRecord?.deliveryAddress || [deal.city, deal.province].filter(Boolean).join(', '),
      mode: freightRecord?.mode || 'execution',
      freightReady: isDealFreightReady(milestonesForJob),
      assignedFreightUserId: freightRecord?.assignedFreightUserId || null,
    };
  }).filter(row => {
    if (!isRestrictedFreightUser) return true;
    return row.assignedFreightUserId === currentUser.id;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Freight Board</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Freight coordinator view with execution dates, drop-off visibility, and milestone-derived readiness.
        </p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID', 'Client', 'Building', 'Weight', 'Province', 'Pickup', 'Delivery', 'Drop-Off', 'Mode', 'Ready', 'Est Freight', 'Actual', 'Variance', 'Paid', 'Status'].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">No deals</td></tr>
            ) : rows.map(row => (
              <tr key={row.deal.jobId} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-xs">{row.deal.jobId}</td>
                <td className="px-3 py-2">{row.deal.clientName}</td>
                <td className="px-3 py-2 text-xs">{row.deal.width}x{row.deal.length}x{row.deal.height}</td>
                <td className="px-3 py-2 font-mono">{formatNumber(row.deal.weight)} lbs</td>
                <td className="px-3 py-2">{row.deal.province}</td>
                <td className="px-3 py-2 text-xs">{row.pickupDate || '-'}</td>
                <td className="px-3 py-2 text-xs">{row.deliveryDate || '-'}</td>
                <td className="px-3 py-2 text-xs">{row.dropOffLocation || '-'}</td>
                <td className="px-3 py-2 text-xs uppercase">{row.mode === 'pre_sale' ? 'Pre-Sale' : 'Execution'}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${row.freightReady ? 'status-paid' : 'status-partial'}`}>
                    {row.freightReady ? 'Ready' : 'Blocked'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{formatCurrency(row.estFreight)}</td>
                <td className="px-3 py-2 font-mono">{row.actualFreight ? formatCurrency(row.actualFreight) : '-'}</td>
                <td className={`px-3 py-2 font-mono ${row.variance > 0 ? 'text-destructive' : row.variance < 0 ? 'text-success' : ''}`}>
                  {row.actualFreight ? formatCurrency(row.variance) : '-'}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${row.paid ? 'status-paid' : 'status-unpaid'}`}>{row.paid ? 'Yes' : 'No'}</span>
                </td>
                <td className="px-3 py-2 text-xs">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
