import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { formatNumber } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRoles } from '@/context/RoleContext';
import { useSharedJobs } from '@/lib/sharedJobs';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProductionProgressPct, normalizeProductionStage } from '@/lib/productionLifecycle';
import {
  getDealFreightBlockedReason,
  getDealPostSaleNextStep,
  isDealFreightReady,
  summarizeDealMilestoneProgress,
} from '@/lib/opportunities';

function derivePaymentStage(count: number, stages: string[]) {
  if (!count || stages.length === 0) return '';
  return stages[Math.min(count, stages.length) - 1] || '';
}

export default function ProductionStatus() {
  const { deals, dealMilestones, updateDeal, payments } = useAppContext();
  const { settings } = useSettings();
  const { hasAnyRole } = useRoles();
  const { visibleJobIds } = useSharedJobs({ allowedStates: ['deal'] });
  const canEdit = hasAnyRole('admin', 'owner', 'operations');

  const activeDeals = useMemo(() => {
    return deals.filter(deal =>
      visibleJobIds.has(deal.jobId) && !['Cancelled', 'Lead', 'Quoted'].includes(deal.dealStatus),
    );
  }, [deals, visibleJobIds]);

  const summary = useMemo(() => {
    const freightReady = activeDeals.filter(deal =>
      isDealFreightReady(dealMilestones.filter(item => item.jobId === deal.jobId)),
    ).length;
    const delivered = activeDeals.filter(deal => normalizeProductionStage(deal.productionStatus) === 'Delivered').length;
    const inProduction = activeDeals.filter(deal => normalizeProductionStage(deal.productionStatus) === 'In Production').length;

    return {
      total: activeDeals.length,
      freightReady,
      delivered,
      inProduction,
    };
  }, [activeDeals, dealMilestones]);

  return (
    <div className="space-y-6" data-testid="production-status-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Production Status</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live production state is driven from the deal record. Legacy production rows are treated as a shadow mirror only.
          </p>
        </div>
        {canEdit && (
          <a href="/deals" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add Deal via Master Deals
          </a>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Jobs</p>
          <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">In Production</p>
          <p className="mt-2 text-2xl font-semibold">{summary.inProduction}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Freight Ready</p>
          <p className="mt-2 text-2xl font-semibold">{summary.freightReady}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivered</p>
          <p className="mt-2 text-2xl font-semibold">{summary.delivered}</p>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID', 'Client', 'Building', 'Production', 'Insulation', 'Freight', 'Freight Ready', 'Milestones', 'Next Step', 'Blocked Reason', 'CX Payment', 'Factory Payment', 'Progress'].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDeals.length === 0 ? (
              <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">No active production</td></tr>
            ) : activeDeals.map(deal => {
              const progress = getProductionProgressPct(deal.productionStatus, settings.productionStatuses);
              const milestonesForJob = dealMilestones.filter(item => item.jobId === deal.jobId);
              const freightReady = isDealFreightReady(milestonesForJob);
              const milestoneProgress = summarizeDealMilestoneProgress(milestonesForJob);
              const nextStep = getDealPostSaleNextStep(deal, milestonesForJob);
              const blockedReason = getDealFreightBlockedReason(milestonesForJob);
              const clientPaymentCount = payments.filter(payment => payment.jobId === deal.jobId && payment.direction === 'Client Payment IN').length;
              const factoryPaymentCount = payments.filter(payment => payment.jobId === deal.jobId && payment.direction === 'Vendor Payment OUT').length;
              const clientStage = deal.cxPaymentStageOverride || derivePaymentStage(clientPaymentCount, settings.clientPaymentStatuses);
              const factoryStage = deal.factoryPaymentStageOverride || derivePaymentStage(factoryPaymentCount, settings.factoryPaymentStatuses);

              return (
                <tr key={deal.jobId} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{deal.jobId}</td>
                  <td className="px-3 py-2">{deal.clientName}</td>
                  <td className="px-3 py-2 text-xs">{deal.width}x{deal.length}x{deal.height} ({formatNumber(deal.sqft)} sqft)</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Select value={deal.productionStatus} onValueChange={value => updateDeal(deal.jobId, { productionStatus: value as any })}>
                        <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>{settings.productionStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-xs">{deal.productionStatus}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Select value={deal.insulationStatus || 'N/A'} onValueChange={value => updateDeal(deal.jobId, { insulationStatus: value })}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{settings.insulationStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-xs">{deal.insulationStatus || 'N/A'}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Select value={deal.freightStatus} onValueChange={value => updateDeal(deal.jobId, { freightStatus: value as any })}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{settings.freightStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-xs">{deal.freightStatus}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${freightReady ? 'status-paid' : 'status-partial'}`}>
                      {freightReady ? 'Ready' : 'Blocked'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {milestoneProgress.completedCount}/{milestoneProgress.totalCount}
                  </td>
                  <td className="px-3 py-2 text-xs">{nextStep}</td>
                  <td className="px-3 py-2 text-xs">{blockedReason || '-'}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Select value={clientStage || '__none__'} onValueChange={value => updateDeal(deal.jobId, { cxPaymentStageOverride: value === '__none__' ? '' : value })}>
                          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Auto" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Auto</SelectItem>
                            {settings.clientPaymentStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updateDeal(deal.jobId, { cxPaymentStageOverride: '' })}>Reset</Button>
                      </div>
                    ) : <span className="text-xs">{clientStage || '-'}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Select value={factoryStage || '__none__'} onValueChange={value => updateDeal(deal.jobId, { factoryPaymentStageOverride: value === '__none__' ? '' : value })}>
                          <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Auto" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Auto</SelectItem>
                            {settings.factoryPaymentStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updateDeal(deal.jobId, { factoryPaymentStageOverride: '' })}>Reset</Button>
                      </div>
                    ) : <span className="text-xs">{factoryStage || '-'}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{progress}%</span>
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
