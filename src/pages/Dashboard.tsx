import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { formatCurrency } from '@/lib/calculations';
import { BarChart3, Briefcase, DollarSign, TrendingUp, Clock, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PIPELINE_STAGES = ['Lead', 'Quoted', 'Pending Payment', 'In Progress', 'In Production', 'Shipped', 'Delivered', 'Complete'] as const;

const STAGE_COLORS: Record<string, string> = {
  Lead: 'bg-muted text-muted-foreground',
  Quoted: 'bg-accent/20 text-accent',
  'Pending Payment': 'bg-warning/20 text-warning',
  'In Progress': 'bg-primary/20 text-primary',
  'In Production': 'bg-steel-blue/20 text-steel-blue',
  Shipped: 'bg-accent/20 text-accent',
  Delivered: 'bg-success/20 text-success',
  Complete: 'bg-success/30 text-success',
};

export default function Dashboard() {
  const { quotes, deals, payments, freight, internalCosts } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { t } = useTranslation();

  const PIPELINE_STAGE_LABELS: Record<string, string> = {
    Lead: t('dashboard.stages.lead'),
    Quoted: t('dashboard.stages.quoted'),
    'Pending Payment': t('dashboard.stages.pendingPayment'),
    'In Progress': t('dashboard.stages.inProgress'),
    'In Production': t('dashboard.stages.inProduction'),
    Shipped: t('dashboard.stages.shipped'),
    Delivered: t('dashboard.stages.delivered'),
    Complete: t('dashboard.stages.complete'),
  };

  if (hasAnyRole('freight', 'manufacturer', 'construction')) {
     return <Navigate to="/vendor-board" replace />;
  }

  if (hasAnyRole('dealer')) {
     return <Navigate to="/dealer-log" replace />;
  }

  const isSalesRep = !hasAnyRole('admin', 'owner', 'accounting', 'operations', 'freight');

  // Filter data by role
  const visibleDeals = isSalesRep
    ? deals.filter(d => d.salesRep === currentUser.name || d.salesRep.toLowerCase().includes(currentUser.name.toLowerCase()))
    : deals;

  const visibleQuotes = isSalesRep
    ? quotes.filter(q => q.salesRep === currentUser.name || q.salesRep.toLowerCase().includes(currentUser.name.toLowerCase()))
    : quotes;

  const activeDeals = visibleDeals.filter(d => d.dealStatus !== 'Cancelled' && d.dealStatus !== 'Complete');
  const activeQuotes = visibleQuotes.filter(q => q.status === 'Sent' || q.status === 'Follow Up' || q.status === 'Draft');
  const wonQuotes = visibleQuotes.filter(q => q.status === 'Won').length;
  const totalQuotes = visibleQuotes.length;

  const visibleJobIds = new Set(visibleDeals.map(d => d.jobId));

  const visiblePayments = payments.filter(p => visibleJobIds.has(p.jobId));
  const totalRevenue = visiblePayments
    .filter(p => p.direction === 'Client Payment IN')
    .reduce((s, p) => s + p.amountExclTax, 0);
  const totalCosts = visiblePayments
    .filter(p => p.direction === 'Vendor Payment OUT')
    .reduce((s, p) => s + p.amountExclTax, 0);

  const pipelineDeals = visibleDeals.filter(d => d.dealStatus !== 'Cancelled' && d.dealStatus !== 'On Hold');

  // Payment math helpers (mirrors `DealPL.tsx` but scoped to visible deals).
  const clientInByJobId: Record<string, number> = {};
  const vendorOutByJobId: Record<string, number> = {};
  for (const d of visibleDeals) {
    clientInByJobId[d.jobId] = 0;
    vendorOutByJobId[d.jobId] = 0;
  }
  for (const p of payments) {
    if (!visibleJobIds.has(p.jobId)) continue;
    if (p.direction === 'Client Payment IN' || p.direction === 'Refund IN') {
      clientInByJobId[p.jobId] = (clientInByJobId[p.jobId] || 0) + p.amountExclTax;
    }
    if (p.direction === 'Vendor Payment OUT' || p.direction === 'Refund OUT') {
      vendorOutByJobId[p.jobId] = (vendorOutByJobId[p.jobId] || 0) + p.amountExclTax;
    }
  }

  const wonQuoteByJobId = new Map<string, number>();
  for (const q of quotes) {
    if (q.status !== 'Won') continue;
    if (!wonQuoteByJobId.has(q.jobId)) wonQuoteByJobId.set(q.jobId, q.grandTotal);
    else wonQuoteByJobId.set(q.jobId, Math.max(wonQuoteByJobId.get(q.jobId) || 0, q.grandTotal));
  }

  let pipelineValue = 0;
  let totalGrossProfit = 0;
  for (const d of pipelineDeals) {
    const ic = internalCosts.find(c => c.jobId === d.jobId);
    const salePrice = ic?.salePrice || wonQuoteByJobId.get(d.jobId) || 0;
    pipelineValue += salePrice;

    if (ic) {
      const trueTotal = ic.trueMaterial + ic.trueStructuralDrawing + ic.trueFoundationDrawing + ic.trueFreight + ic.trueInsulation;
      const repTotal = ic.repMaterial + ic.repStructuralDrawing + ic.repFoundationDrawing + ic.repFreight + ic.repInsulation;
      const gp = isSalesRep ? (ic.salePrice - repTotal) : (ic.salePrice - trueTotal);
      totalGrossProfit += gp;
    }
  }

  const cashPosition = pipelineDeals.reduce((sum, d) => {
    const clientIn = clientInByJobId[d.jobId] || 0;
    const vendorOut = vendorOutByJobId[d.jobId] || 0;
    return sum + (clientIn - vendorOut);
  }, 0);
  // Build pipeline counts
  const pipelineCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach(s => { pipelineCounts[s] = 0; });
  visibleDeals.filter(d => d.dealStatus !== 'Cancelled' && d.dealStatus !== 'On Hold').forEach(d => {
    if (pipelineCounts[d.dealStatus] !== undefined) pipelineCounts[d.dealStatus]++;
  });
  const onHold = visibleDeals.filter(d => d.dealStatus === 'On Hold').length;
  const cancelled = visibleDeals.filter(d => d.dealStatus === 'Cancelled').length;

  const stats = [
    ...(isSalesRep
      ? [
          { label: t('dashboard.activeDeals'), value: activeDeals.length, icon: Briefcase, color: 'text-accent' },
          { label: t('dashboard.pipelineValue'), value: formatCurrency(pipelineValue), icon: TrendingUp, color: 'text-steel-blue' },
          { label: t('dashboard.totalGp'), value: formatCurrency(totalGrossProfit), icon: DollarSign, color: 'text-success' },
          { label: t('dashboard.cashPosition'), value: formatCurrency(cashPosition), icon: CreditCard, color: 'text-warning' },
          { label: t('dashboard.winRate'), value: totalQuotes ? `${Math.round((wonQuotes / totalQuotes) * 100)}%` : '—', icon: TrendingUp, color: 'text-success' },
          { label: t('dashboard.activeQuotes'), value: activeQuotes.length, icon: Clock, color: 'text-warning' },
        ]
      : [
          { label: t('dashboard.activeDeals'), value: activeDeals.length, icon: Briefcase, color: 'text-accent' },
          { label: t('dashboard.pipelineValue'), value: formatCurrency(pipelineValue), icon: TrendingUp, color: 'text-steel-blue' },
          { label: t('dashboard.revenueIn'), value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-success' },
          { label: t('dashboard.costsOut'), value: formatCurrency(totalCosts), icon: BarChart3, color: 'text-destructive' },
          { label: t('dashboard.totalGp'), value: formatCurrency(totalGrossProfit), icon: DollarSign, color: 'text-success' },
          { label: t('dashboard.cashPosition'), value: formatCurrency(cashPosition), icon: CreditCard, color: 'text-warning' },
        ]),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isSalesRep ? t('dashboard.subtitleSalesRep', { name: currentUser.name }) : t('dashboard.subtitleAdmin')}
        </p>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-2 lg:grid-cols-3 ${isSalesRep ? 'xl:grid-cols-4' : 'xl:grid-cols-6'} gap-4`}>
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold text-card-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-card rounded-lg border p-5">
        <h3 className="text-sm font-semibold text-card-foreground mb-4">{t('dashboard.dealPipeline')}</h3>
        {visibleDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noDeals')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 XL:grid-cols-8 gap-2">
              {PIPELINE_STAGES.map(stage => (
                <div key={stage} className={`rounded-lg p-3 text-center ${STAGE_COLORS[stage] || 'bg-muted'}`}>
                  <p className="text-lg font-bold">{pipelineCounts[stage]}</p>
                  <p className="text-[10px] font-medium leading-tight mt-1">{PIPELINE_STAGE_LABELS[stage] || stage}</p>
                </div>
              ))}
            </div>
            {(onHold > 0 || cancelled > 0) && (
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                {onHold > 0 && <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-warning" />{onHold} On Hold</span>}
                {cancelled > 0 && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-destructive" />{cancelled} Cancelled</span>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent deals */}
      <div className="bg-card rounded-lg border p-5">
        <h3 className="text-sm font-semibold text-card-foreground mb-4">{t('dashboard.recentDeals')}</h3>
        {visibleDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noDeals')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">{t('dashboard.headers.jobId')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.client')}</th>
                  {!isSalesRep && <th className="pb-2 font-medium">{t('dashboard.headers.salesRep')}</th>}
                  <th className="pb-2 font-medium">{t('dashboard.headers.status')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.payment')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.production')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.freight')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeals.slice(-8).reverse().map(d => (
                  <tr key={d.jobId || d.clientId} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{d.jobId || '—'}</td>
                    <td className="py-2">{d.clientName}</td>
                    {!isSalesRep && <td className="py-2 text-xs">{d.salesRep}</td>}
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[d.dealStatus] || 'bg-muted text-muted-foreground'}`}>
                        {PIPELINE_STAGE_LABELS[d.dealStatus] || d.dealStatus}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.paymentStatus === 'PAID' ? 'status-paid' :
                        d.paymentStatus === 'PARTIAL' ? 'status-partial' : 'status-unpaid'
                      }`}>{d.paymentStatus}</span>
                    </td>
                    <td className="py-2 text-xs">{d.productionStatus}</td>
                    <td className="py-2 text-xs">{d.freightStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Quotes (prominent for sales reps, also visible for others) */}
      {activeQuotes.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            {t('dashboard.activeQuotesOut')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">{t('dashboard.headers.jobId')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.client')}</th>
                  {!isSalesRep && <th className="pb-2 font-medium">{t('dashboard.headers.salesRep')}</th>}
                  <th className="pb-2 font-medium">{t('dashboard.headers.building')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.total')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.status')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.headers.date')}</th>
                </tr>
              </thead>
              <tbody>
                {activeQuotes.map(q => (
                  <tr key={q.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{q.jobId}</td>
                    <td className="py-2">{q.clientName}</td>
                    {!isSalesRep && <td className="py-2 text-xs">{q.salesRep}</td>}
                    <td className="py-2 text-xs">{q.width}×{q.length}×{q.height}</td>
                    <td className="py-2 font-mono">{formatCurrency(q.grandTotal)}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        q.status === 'Sent' ? 'status-partial' :
                        q.status === 'Follow Up' ? 'bg-warning/20 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>{q.status}</span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{q.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
