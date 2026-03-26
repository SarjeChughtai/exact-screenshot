import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { formatCurrency } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Download, Lock } from 'lucide-react';

export default function CommissionStatement() {
  const { deals, internalCosts, payments } = useAppContext();
  const { hasAnyRole } = useRoles();

  const isAdmin = hasAnyRole('admin', 'owner');

  const [selectedJob, setSelectedJob] = useState('');
  const [payThroughStage, setPayThroughStage] = useState('1');
  const [stage1Paid, setStage1Paid] = useState(false);
  const [stage2Paid, setStage2Paid] = useState(false);

  // Admin-only visibility controls — off by default
  const [showOwnerPayout, setShowOwnerPayout] = useState(false);
  const [showEstimatorPayout, setShowEstimatorPayout] = useState(false);

  const deal = deals.find(d => d.jobId === selectedJob);
  const ic = internalCosts.find(c => c.jobId === selectedJob);

  const salePrice = ic?.salePrice || 0;
  const trueTotal = ic ? ic.trueMaterial + ic.trueStructuralDrawing + ic.trueFoundationDrawing + ic.trueFreight + ic.trueInsulation : 0;
  const repTotal = ic ? ic.repMaterial + ic.repStructuralDrawing + ic.repFoundationDrawing + ic.repFreight + ic.repInsulation : 0;
  const useRep = ic?.showRepCosts ?? false;
  const gp = useRep ? salePrice - repTotal : salePrice - trueTotal;
  const trueGP = salePrice - trueTotal;
  const totalComm = gp * 0.30;

  const clientPaid = payments.filter(p => p.jobId === selectedJob && p.direction === 'Client Payment IN').reduce((s, p) => s + p.amountExclTax, 0);
  const paidPct = salePrice > 0 ? clientPaid / salePrice : 0;

  const comm1 = totalComm * 0.50;
  const comm2 = totalComm * 0.25;
  const comm3 = totalComm * 0.25;

  const eligible1 = paidPct >= 0.30;
  const eligible2 = paidPct >= 0.70;
  const eligible3 = paidPct >= 1.0;

  let owedThisPeriod = 0;
  if (payThroughStage === '1' && eligible1 && !stage1Paid) owedThisPeriod = comm1;
  if (payThroughStage === '2' && eligible2) {
    if (!stage1Paid) owedThisPeriod += comm1;
    if (!stage2Paid) owedThisPeriod += comm2;
  }
  if (payThroughStage === '3' && eligible3) {
    if (!stage1Paid) owedThisPeriod += comm1;
    if (!stage2Paid) owedThisPeriod += comm2;
    owedThisPeriod += comm3;
  }

  // Owner payouts: 3 × 5% of TRUE GP at 70% marker
  const ownerEach = trueGP * 0.05;
  const ownerEligible = paidPct >= 0.70;
  // Estimator payout: 5% at 70% marker
  const estimatorComm = trueGP * 0.05;

  const vendorPaid = payments.filter(p => p.jobId === selectedJob && p.direction === 'Vendor Payment OUT').reduce((s, p) => s + p.amountExclTax, 0);
  const cashPosition = clientPaid - vendorPaid - owedThisPeriod;

  const printStatement = () => {
    const el = document.getElementById('commission-statement');
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Commission Statement - ${deal?.jobId}</title><style>body{font-family:monospace;font-size:12px;padding:20px;max-width:600px;margin:0 auto;} .row{display:flex;justify-content:space-between;margin:3px 0;} .bold{font-weight:bold;} .header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:15px;} .section{border-top:1px solid #ccc;padding-top:8px;margin-top:8px;} .warning{color:red;}</style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Commission Statement Generator</h2>
        <p className="text-sm text-muted-foreground mt-1">Generate printable commission statements with owner/estimator payouts</p>
      </div>

      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Select Deal</Label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choose deal..." /></SelectTrigger>
              <SelectContent>{deals.map(d => <SelectItem key={d.jobId} value={d.jobId}>{d.jobId} — {d.clientName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Pay Through Stage</Label>
            <Select value={payThroughStage} onValueChange={setPayThroughStage}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1st Deposit</SelectItem>
                <SelectItem value="2">2nd Deposit</SelectItem>
                <SelectItem value="3">3rd Deposit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={stage1Paid} onCheckedChange={v => setStage1Paid(!!v)} />
            <Label className="text-xs">1st Stage Already Paid</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={stage2Paid} onCheckedChange={v => setStage2Paid(!!v)} />
            <Label className="text-xs">2nd Stage Already Paid</Label>
          </div>
        </div>

        {/* Admin-only visibility controls */}
        {isAdmin && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span className="font-semibold uppercase tracking-wider">Admin Controls</span>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Owner Payout</Label>
              <Switch checked={showOwnerPayout} onCheckedChange={setShowOwnerPayout} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Estimator Payout</Label>
              <Switch checked={showEstimatorPayout} onCheckedChange={setShowEstimatorPayout} />
            </div>
          </div>
        )}
      </div>

      {deal && (
        <>
          <div className="flex justify-end">
            <Button onClick={printStatement} variant="outline" size="sm">
              <Download className="h-3 w-3 mr-1" />Print / PDF
            </Button>
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-4 font-mono text-sm" id="commission-statement">
            <div className="text-center border-b pb-3">
              <h3 className="text-lg font-bold">COMMISSION STATEMENT</h3>
              <p className="text-xs text-muted-foreground">Canada Steel Buildings</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <p><span className="text-muted-foreground">Job ID:</span> {deal.jobId}</p>
              <p><span className="text-muted-foreground">Client:</span> {deal.clientName}</p>
              <p><span className="text-muted-foreground">Sales Rep:</span> {deal.salesRep}</p>
              <p><span className="text-muted-foreground">Estimator:</span> {deal.estimator}</p>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Row label="Sale Price" value={salePrice} />
              <Row label="Gross Profit (Rep View)" value={gp} />
              <Row label="Total Commission (30%)" value={totalComm} bold />
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-sans font-semibold">Rep Commission Breakdown</p>
              <Row label={`1st (50%) — ${eligible1 ? '✓ Eligible (≥30% paid)' : '✗ Not yet (<30% paid)'}`} value={comm1} />
              <Row label={`2nd (25%) — ${eligible2 ? '✓ Eligible (≥70% paid)' : '✗ Not yet (<70% paid)'}`} value={comm2} />
              <Row label={`3rd (25%) — ${eligible3 ? '✓ Eligible (100% paid)' : '✗ Not yet (<100% paid)'}`} value={comm3} />
            </div>

            {/* Owner Payout — admin-only toggle */}
            {isAdmin && showOwnerPayout && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-sans font-semibold">
                  Owner Payouts (3 × 5% of TRUE GP at 70% marker)
                </p>
                <Row label={`Owner Payout (each) — ${ownerEligible ? '✓ Eligible' : '✗ Not yet'}`} value={ownerEach} />
                <Row label="Owner Total (×3)" value={ownerEach * 3} />
              </div>
            )}

            {/* Estimator Payout — admin-only toggle */}
            {isAdmin && showEstimatorPayout && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-sans font-semibold">
                  Estimator Payout (5% of TRUE GP at 70% marker)
                </p>
                <Row label={`Estimator — ${ownerEligible ? '✓ Eligible' : '✗ Not yet'}`} value={estimatorComm} />
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <Row label="Client Paid to Date" value={clientPaid} />
              <Row label="Paid % of Sale" value={0} customValue={`${(paidPct * 100).toFixed(0)}%`} />
              <Row label="Amount Owed This Period" value={owedThisPeriod} bold />
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-sans font-semibold">Cash Position Check</p>
              <Row label="Cash Position After Payout" value={cashPosition} />
              {cashPosition < 0 && (
                <p className="text-destructive text-xs font-sans font-semibold">⚠ WARNING: Negative cash position after payout</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold, customValue }: { label: string; value: number; bold?: boolean; customValue?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span>{customValue ?? formatCurrency(value)}</span>
    </div>
  );
}
