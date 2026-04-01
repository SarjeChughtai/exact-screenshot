import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';
import { JobIdSelect } from '@/components/JobIdSelect';
import { useSharedJobs } from '@/lib/sharedJobs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { buildCommissionStageEntries } from '@/lib/commission';

export default function CommissionStatement() {
  const { deals, internalCosts, payments, commissionPayouts } = useAppContext();
  const { visibleJobIds } = useSharedJobs({ allowedStates: ['deal'] });
  const [selectedJob, setSelectedJob] = useState('');

  const visibleDeals = useMemo(
    () => deals.filter(deal => visibleJobIds.has(deal.jobId)),
    [deals, visibleJobIds],
  );

  const deal = visibleDeals.find(entry => entry.jobId === selectedJob);
  const cost = internalCosts.find(entry => entry.jobId === selectedJob);

  const stageEntries = useMemo(
    () => buildCommissionStageEntries(deals, internalCosts, payments, commissionPayouts).filter(entry => entry.jobId === selectedJob),
    [commissionPayouts, deals, internalCosts, payments, selectedJob],
  );

  const salesRepStages = stageEntries.filter(entry => entry.recipientRole === 'sales_rep');
  const estimatorStage = stageEntries.find(entry => entry.recipientRole === 'estimator');

  const salePrice = cost?.salePrice || 0;
  const trueTotal = cost
    ? cost.trueMaterial + cost.trueStructuralDrawing + cost.trueFoundationDrawing + cost.trueFreight + cost.trueInsulation
    : 0;
  const repTotal = cost
    ? cost.repMaterial + cost.repStructuralDrawing + cost.repFoundationDrawing + cost.repFreight + cost.repInsulation
    : 0;
  const trueGp = salePrice - trueTotal;
  const repGp = salePrice - repTotal;
  const commissionBaseGp = (cost?.showRepCosts ?? false) ? repGp : trueGp;
  const commissionBasisLabel = (cost?.showRepCosts ?? false) ? 'Rep-visible GP' : 'True GP';
  const totalRepCommission = Math.max(0, commissionBaseGp * 0.3);
  const estimatorCommission = Math.max(0, trueGp * 0.05);

  const clientPaid = payments
    .filter(payment => payment.jobId === selectedJob && payment.direction === 'Client Payment IN')
    .reduce((sum, payment) => sum + payment.amountExclTax, 0);
  const vendorPaid = payments
    .filter(payment => payment.jobId === selectedJob && payment.direction === 'Vendor Payment OUT')
    .reduce((sum, payment) => sum + payment.amountExclTax, 0);
  const paidPct = salePrice > 0 ? clientPaid / salePrice : 0;

  const pendingRepAmount = salesRepStages
    .filter(entry => entry.status === 'pending')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const pendingEstimatorAmount = estimatorStage?.status === 'pending' ? estimatorStage.amount : 0;
  const cashPositionAfterPending = clientPaid - vendorPaid - pendingRepAmount - pendingEstimatorAmount;

  const ownerEach = Math.max(0, trueGp * 0.05);
  const ownerEligible = paidPct >= 0.7;

  const printStatement = () => {
    const element = document.getElementById('commission-statement');
    if (!element || !deal) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(
      `<html><head><title>Commission Statement - ${deal.jobId}</title><style>
        body{font-family:monospace;font-size:12px;padding:20px;max-width:760px;margin:0 auto;}
        table{width:100%;border-collapse:collapse;margin-top:8px;}
        th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top;}
        h1,h2,h3,p{margin:0;}
        .header{text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;}
        .section{margin-top:16px;}
        .muted{color:#666;}
      </style></head><body>`,
    );
    printWindow.document.write(element.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Commission Statement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Printable statement with live eligibility and stored payout confirmations.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="max-w-sm">
          <Label className="text-xs">Select Deal</Label>
          <JobIdSelect
            value={selectedJob}
            onValueChange={setSelectedJob}
            deals={visibleDeals}
            allowedStates={['deal']}
            placeholder="Choose deal..."
            triggerClassName="mt-1"
          />
        </div>
      </div>

      {deal && (
        <>
          <div className="flex justify-end">
            <Button onClick={printStatement} variant="outline" size="sm">
              <Download className="mr-1 h-3 w-3" />
              Print / PDF
            </Button>
          </div>

          <div className="space-y-6 rounded-lg border bg-card p-5 text-sm" id="commission-statement">
            <div className="header">
              <h3 className="text-lg font-bold">COMMISSION STATEMENT</h3>
              <p className="muted">Canada Steel Buildings</p>
            </div>

            <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="text-muted-foreground">Job ID:</span> {deal.jobId}</p>
              <p><span className="text-muted-foreground">Client:</span> {deal.clientName}</p>
              <p><span className="text-muted-foreground">Sales Rep:</span> {deal.salesRep || 'Unassigned'}</p>
              <p><span className="text-muted-foreground">Estimator:</span> {deal.estimator || 'Unassigned'}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gross Profit</p>
                <div className="mt-3 space-y-2">
                  <Row label="Sale Price" value={salePrice} />
                  <Row label="True GP" value={trueGp} />
                  <Row label="Rep-visible GP" value={repGp} />
                  <Row label={`Commission Basis (${commissionBasisLabel})`} value={commissionBaseGp} bold />
                  <Row label="Sales Rep Total Commission (30%)" value={totalRepCommission} />
                  <Row label="Estimator Commission (5% of True GP)" value={estimatorCommission} />
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash Position</p>
                <div className="mt-3 space-y-2">
                  <Row label="Client Paid To Date" value={clientPaid} />
                  <Row label="Vendor Paid To Date" value={vendorPaid} />
                  <Row label="Paid % Of Sale" value={0} customValue={`${(paidPct * 100).toFixed(0)}%`} />
                  <Row label="Pending Rep Payouts" value={pendingRepAmount} />
                  <Row label="Pending Estimator Payouts" value={pendingEstimatorAmount} />
                  <Row label="Cash After Pending Payouts" value={cashPositionAfterPending} bold />
                </div>
              </div>
            </div>

            <div className="section">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales Rep Payout Stages</p>
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Amount</th>
                    <th>Eligibility</th>
                    <th>Status</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {salesRepStages.map(stage => (
                    <tr key={stage.key}>
                      <td>
                        <div>{stage.stageLabel}</div>
                        <div className="muted">{stage.thresholdLabel}</div>
                      </td>
                      <td>{formatCurrency(stage.amount)}</td>
                      <td>
                        {stage.eligibleOnDate
                          ? `Eligible on ${stage.eligibleOnDate}`
                          : `Needs ${formatCurrency(stage.amountRemainingToThreshold)} more`}
                      </td>
                      <td>{stage.status === 'paid' ? 'Paid' : stage.status === 'pending' ? 'Pending payout' : 'Projected'}</td>
                      <td>{stage.payoutRecord?.paidOn || '-'}</td>
                    </tr>
                  ))}
                  {salesRepStages.length === 0 && (
                    <tr>
                      <td colSpan={5}>No sales rep commission available for this deal.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="section">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimator Payout</p>
              <table>
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Amount</th>
                    <th>Eligibility</th>
                    <th>Status</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {estimatorStage ? (
                    <tr>
                      <td>{estimatorStage.recipientName}</td>
                      <td>{formatCurrency(estimatorStage.amount)}</td>
                      <td>
                        {estimatorStage.eligibleOnDate
                          ? `Eligible on ${estimatorStage.eligibleOnDate}`
                          : `Needs ${formatCurrency(estimatorStage.amountRemainingToThreshold)} more`}
                      </td>
                      <td>{estimatorStage.status === 'paid' ? 'Paid' : estimatorStage.status === 'pending' ? 'Pending payout' : 'Projected'}</td>
                      <td>{estimatorStage.payoutRecord?.paidOn || '-'}</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={5}>No estimator commission available for this deal.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="section">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner Payout Reference</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Row label={`Owner Each (${ownerEligible ? 'eligible' : 'not yet eligible'})`} value={ownerEach} />
                <Row label="Owner Total (3 x 5%)" value={ownerEach * 3} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold, customValue }: { label: string; value: number; bold?: boolean; customValue?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className="font-mono">{customValue ?? formatCurrency(value)}</span>
    </div>
  );
}
