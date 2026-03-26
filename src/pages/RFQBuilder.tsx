import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { INSULATION_GRADES, formatCurrency, getProvinceTax } from '@/lib/calculations';
import type { Deal } from '@/types';
import { toast } from 'sonner';

type Openings = {
  leftEnd: string;
  rightEnd: string;
  frontSideWall: string;
  backSideWall: string;
};

type RFQPayload = {
  type: 'rfq';
  openings: Openings;
  insulationRequested: boolean;
  wallGrade: string;
  roofGrade: string;
  roofPanelGauge: number;
  wallPanelGauge: number;
};

function safeParseJson(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function gradeRParts(combined: string): { wall: string; roof: string } {
  const [w, r] = combined.split('/');
  return { wall: (w || '').trim(), roof: (r || '').trim() };
}

export default function RFQBuilder() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const jobId = params.get('jobId') || '';

  const { currentUser } = useRoles();
  const { deals, quotes, updateDeal, updateQuote } = useAppContext();

  const deal = deals.find(d => d.jobId === jobId);
  const quote = quotes.find(q => q.jobId === jobId);

  const derivedRValues = useMemo(() => {
    const parts = INSULATION_GRADES.flatMap(g => g.split('/').map(p => p.trim()).filter(Boolean));
    return Array.from(new Set(parts)).sort();
  }, []);

  const defaultOpeningNotes: Openings = {
    leftEnd: '',
    rightEnd: '',
    frontSideWall: '',
    backSideWall: '',
  };

  const [openings, setOpenings] = useState<Openings>(defaultOpeningNotes);
  const [insulationRequested, setInsulationRequested] = useState(true);
  const [wallGrade, setWallGrade] = useState('R20');
  const [roofGrade, setRoofGrade] = useState('R20');
  const [roofPanelGauge, setRoofPanelGauge] = useState(26);
  const [wallPanelGauge, setWallPanelGauge] = useState(26);

  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [jobName, setJobName] = useState('');

  // Load RFQ payload from deal notes when available.
  useEffect(() => {
    if (!deal) return;

    setClientName(deal.clientName || '');
    setClientId(deal.clientId || '');
    setJobName(deal.jobName || '');

    if (!deal.notes) return;
    const parsed = safeParseJson(deal.notes);
    if (!parsed || typeof parsed !== 'object') return;

    const rfq = parsed as Partial<RFQPayload>;
    if (rfq.type !== 'rfq') return;

    if (rfq.openings) {
      setOpenings({
        leftEnd: rfq.openings.leftEnd || '',
        rightEnd: rfq.openings.rightEnd || '',
        frontSideWall: rfq.openings.frontSideWall || '',
        backSideWall: rfq.openings.backSideWall || '',
      });
    }

    if (typeof rfq.insulationRequested === 'boolean') setInsulationRequested(rfq.insulationRequested);
    if (rfq.wallGrade) setWallGrade(rfq.wallGrade);
    if (rfq.roofGrade) setRoofGrade(rfq.roofGrade);
    if (typeof rfq.roofPanelGauge === 'number') setRoofPanelGauge(rfq.roofPanelGauge);
    if (typeof rfq.wallPanelGauge === 'number') setWallPanelGauge(rfq.wallPanelGauge);
  }, [deal]);

  const combinedInsulationGrade = `${wallGrade}/${roofGrade}`;

  const printRfQ = () => {
    const el = document.getElementById('rfq-output');
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const heading = `RFQ — ${jobId}`;

    win.document.write(
      `<html><head><title>${heading}</title><style>
      body{font-family:monospace;font-size:12px;padding:20px;max-width:700px;margin:0 auto;}
      .header{text-align:center;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:10px;}
      .section{margin-top:12px;border-top:1px solid #ccc;padding-top:10px;}
      .row{display:flex;justify-content:space-between;gap:10px;margin:3px 0;}
      .label{color:#444}
      </style></head><body>`
    );
    win.document.write(`<div class="header"><h2>${heading}</h2><div>${clientName || 'Client TBD'}</div></div>`);
    win.document.write(el.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const emailRfQ = () => {
    const to = 'estimates@canadasteelbuildings.ca';
    const subject = encodeURIComponent(`RFQ — ${jobId} — ${clientName || 'Client TBD'}`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease find the RFQ request below.\n\nJob ID: ${jobId}\nClient: ${clientName}\n\n` +
      `Openings Notes:\n- Left end: ${openings.leftEnd}\n- Right end: ${openings.rightEnd}\n- Front side wall: ${openings.frontSideWall}\n- Back side wall: ${openings.backSideWall}\n\n` +
      `Insulation requested: ${insulationRequested ? 'Yes' : 'No'}\nWall grade: ${wallGrade}\nRoof grade: ${roofGrade}\nCombined: ${combinedInsulationGrade}\n\n` +
      `Gauges (standard if unchanged):\n- Roof panel: ${roofPanelGauge} gauge\n- Wall/steel panels: ${wallPanelGauge} gauge\n\n` +
      `— Generated from CanadaSteelBuildings RFQ Builder`
    );

    window.open(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  const sendRfQ = async () => {
    if (!deal) {
      toast.error('Deal not found for this RFQ.');
      return;
    }

    const payload: RFQPayload = {
      type: 'rfq',
      openings,
      insulationRequested,
      wallGrade,
      roofGrade,
      roofPanelGauge,
      wallPanelGauge,
    };

    try {
      updateDeal(jobId, {
        clientName: clientName || deal.clientName,
        clientId: clientId || deal.clientId,
        jobName: jobName || deal.jobName,
        notes: JSON.stringify(payload),
      });
    } catch {
      // AppContext already toasts, but keep UI from crashing.
    }

    // Record in quote log as a request for quote (we re-use existing quote status `Sent`
    // because DB enum migrations aren't available in this code-only environment).
    if (quote) {
      updateQuote(quote.id, { status: 'Sent' });
    }

    // Print + email.
    printRfQ();
    emailRfQ();
    toast.success('RFQ prepared and email drafted');
  };

  if (!deal) {
    return (
      <div className="max-w-3xl space-y-4">
        <h2 className="text-2xl font-bold">RFQ Builder</h2>
        <p className="text-sm text-muted-foreground">No deal found for jobId: {jobId}</p>
        <Button variant="outline" onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    );
  }

  const prov = getProvinceTax(deal.province);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">RFQ Builder</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add openings, insulation request, and gauges. Then print and email the RFQ.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Project Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Job ID</Label>
                <Input className="input-blue mt-1" value={deal.jobId} readOnly />
              </div>
              <div>
                <Label className="text-xs">Sales Rep</Label>
                <Input className="input-blue mt-1" value={deal.salesRep} readOnly />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Job Name</Label>
                <Input className="input-blue mt-1" value={jobName} onChange={e => setJobName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Client Name</Label>
                <Input className="input-blue mt-1" value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Client ID</Label>
                <Input className="input-blue mt-1" value={clientId} onChange={e => setClientId(e.target.value)} />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Location: {deal.city}, {deal.province} {deal.postalCode}
              <br />
              Tax: {prov.type === 'HST' ? 'HST' : 'GST'} ({(prov.order_rate * 100).toFixed(0)}%)
            </div>
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Openings</h3>
            <div className="space-y-3">
              <OpeningField label="Left end" value={openings.leftEnd} onChange={v => setOpenings(o => ({ ...o, leftEnd: v }))} />
              <OpeningField label="Right end" value={openings.rightEnd} onChange={v => setOpenings(o => ({ ...o, rightEnd: v }))} />
              <OpeningField label="Front side wall" value={openings.frontSideWall} onChange={v => setOpenings(o => ({ ...o, frontSideWall: v }))} />
              <OpeningField label="Back side wall" value={openings.backSideWall} onChange={v => setOpenings(o => ({ ...o, backSideWall: v }))} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Insulation Request</h3>
            <div className="flex items-center gap-3">
              <Checkbox checked={insulationRequested} onCheckedChange={v => setInsulationRequested(!!v)} />
              <Label className="text-xs">Request insulation</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Wall grade</Label>
                <Select value={wallGrade} onValueChange={setWallGrade} disabled={!insulationRequested}>
                  <SelectTrigger className="input-blue mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{derivedRValues.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Roof grade</Label>
                <Select value={roofGrade} onValueChange={setRoofGrade} disabled={!insulationRequested}>
                  <SelectTrigger className="input-blue mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{derivedRValues.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Combined grade (used by estimator): <span className="font-mono">{combinedInsulationGrade}</span>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gauges</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Roof panel gauge</Label>
                <Input
                  className="input-blue mt-1"
                  type="number"
                  value={roofPanelGauge}
                  onChange={e => setRoofPanelGauge(parseInt(e.target.value || '0', 10) || 26)}
                />
              </div>
              <div>
                <Label className="text-xs">Wall/steel panel gauge</Label>
                <Input
                  className="input-blue mt-1"
                  type="number"
                  value={wallPanelGauge}
                  onChange={e => setWallPanelGauge(parseInt(e.target.value || '0', 10) || 26)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Standard default: 26 gauge.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={printRfQ} className="flex-1">Print PDF</Button>
            <Button onClick={() => void sendRfQ()} className="flex-1">Send RFQ</Button>
          </div>

          <div className="bg-muted rounded-md p-4 text-xs text-muted-foreground space-y-1">
            <div>
              Status in quote log: shown as <span className="font-mono">Request for Quote</span> when deal is in stage 1.
            </div>
            <div>
              Email drafts to: <span className="font-mono">estimates@canadasteelbuildings.ca</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only output */}
      <div id="rfq-output" className="hidden">
        <div className="section">
          <div className="row"><span className="label">Building</span><span>{deal.width}×{deal.length}×{deal.height} ft ({deal.sqft} sqft)</span></div>
          <div className="row"><span className="label">Weight</span><span>{deal.weight} lbs</span></div>
        </div>
        <div className="section">
          <div className="row"><span className="label">Openings</span><span>Left end / Right end / Front wall / Back wall</span></div>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: '6px' }}>
            {`Left end: ${openings.leftEnd}\nRight end: ${openings.rightEnd}\nFront side wall: ${openings.frontSideWall}\nBack side wall: ${openings.backSideWall}`}
          </div>
        </div>
        <div className="section">
          <div className="row"><span className="label">Insulation requested</span><span>{insulationRequested ? 'Yes' : 'No'}</span></div>
          <div className="row"><span className="label">Wall grade</span><span>{wallGrade}</span></div>
          <div className="row"><span className="label">Roof grade</span><span>{roofGrade}</span></div>
          <div className="row"><span className="label">Combined</span><span>{combinedInsulationGrade}</span></div>
        </div>
        <div className="section">
          <div className="row"><span className="label">Roof panel gauge</span><span>{roofPanelGauge}</span></div>
          <div className="row"><span className="label">Wall/steel panel gauge</span><span>{wallPanelGauge}</span></div>
        </div>
      </div>
    </div>
  );
}

function OpeningField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea
        className="text-xs h-20"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Add notes for ${label}...`}
      />
    </div>
  );
}

