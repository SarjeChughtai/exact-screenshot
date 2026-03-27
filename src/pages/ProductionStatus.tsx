import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { formatNumber } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRoles } from '@/context/RoleContext';
import { Plus } from 'lucide-react';

export default function ProductionStatus() {
  const { deals, updateDeal } = useAppContext();
  const { settings } = useSettings();
  const { hasAnyRole } = useRoles();
  const canEdit = hasAnyRole('admin', 'owner', 'operations');

  // Amalgamation — reads from Master Deals, no separate dataset
  const activeDeals = deals.filter(d => d.dealStatus !== 'Cancelled' && d.dealStatus !== 'Lead' && d.dealStatus !== 'Quoted');

  const getProgressPct = (status: string) => {
    const idx = settings.productionStatuses.indexOf(status);
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / settings.productionStatuses.length) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Production Status</h2>
          <p className="text-sm text-muted-foreground mt-1">Amalgamated view — pulls from Master Deals</p>
        </div>
        {canEdit && (
          <a href="/deals" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add Deal via Master Deals
          </a>
        )}
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID', 'Client', 'Building', 'Production', 'Insulation', 'Freight', 'Progress'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDeals.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No active production</td></tr>
            ) : activeDeals.map(d => {
              const pct = getProgressPct(d.productionStatus);
              return (
                <tr key={d.jobId} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{d.jobId}</td>
                  <td className="px-3 py-2">{d.clientName}</td>
                  <td className="px-3 py-2 text-xs">{d.width}×{d.length}×{d.height} ({formatNumber(d.sqft)} sqft)</td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    {canEdit ? (
                      <Select value={d.productionStatus} onValueChange={v => updateDeal(d.jobId, { productionStatus: v as any })}>
                        <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>{settings.productionStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-xs">{d.productionStatus}</span>}
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    {canEdit ? (
                      <Select value={d.insulationStatus || 'N/A'} onValueChange={v => updateDeal(d.jobId, { insulationStatus: v })}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{settings.insulationStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-xs">{d.insulationStatus || 'N/A'}</span>}
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    {canEdit ? (
                      <Select value={d.freightStatus} onValueChange={v => updateDeal(d.jobId, { freightStatus: v as any })}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{settings.freightStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-xs">{d.freightStatus}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
