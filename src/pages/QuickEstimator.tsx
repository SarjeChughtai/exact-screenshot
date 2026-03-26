import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  calcSteelCost, calcEngineering, lookupFoundation, lookupInsulation,
  calcInsulationArea, calcFreight, calcTax, formatCurrency, formatNumber,
  PROVINCES, INSULATION_GRADES, ENGINEERING_FACTORS, REMOTE_LEVELS, getProvinceTax,
  pitchCostMultiplier, heightCostMultiplier, calcMarkup, getMarkupRate
} from '@/lib/calculations';
import { estimateFreightFromLocation } from '@/lib/freightEstimate';
import { MapPin, Lightbulb, ChevronDown, Save } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { Quote } from '@/types';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { ClientSelect } from '@/components/ClientSelect';

interface SavedEstimate {
  id: string;
  label: string;
  date: string;
  clientName: string;
  clientId: string;
  salesRep: string;
  width: number;
  length: number;
  height: number;
  pitch: number;
  province: string;
  grandTotal: number;
  sqft: number;
  estimatedTotal: number;
  notes: string;
  auditNotes: string[];
  allData: Record<string, any>;
}

function getEstimates(): SavedEstimate[] {
  try {
    return JSON.parse(localStorage.getItem('csb_estimates') || '[]');
  } catch { return []; }
}

function saveEstimates(estimates: SavedEstimate[]) {
  localStorage.setItem('csb_estimates', JSON.stringify(estimates));
}

function getNextEstLabel(): string {
  const estimates = getEstimates();
  const maxNum = estimates.reduce((max, e) => {
    const m = e.label.match(/EST-(\d+)/);
    return m ? Math.max(max, parseInt(m[1])) : max;
  }, 0);
  return `EST-${String(maxNum + 1).padStart(3, '0')}`;
}

interface EstimateResult {
  sqft: number; weight: number;
  steelCost: number; engineering: number; foundation: number;
  insulation: number; gutters: number; liners: number; freight: number;
  subtotal: number; internalMargin: number; estimatedTotal: number;
  contingency: number; gstHst: number; qst: number; grandTotal: number;
  province: string;
  // Baked steel (margin included)
  steelWithMargin: number;
  markupType: string;
  markupRate: number;
  markupAmount: number;
}

export default function QuickEstimator() {
  const navigate = useNavigate();
  const { addQuote } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { user } = useAuth();
  const isAdminOwner = hasAnyRole('admin', 'owner');

  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [height, setHeight] = useState('');
  const [pitch, setPitch] = useState('1');
  const [province, setProvince] = useState('ON');
  const [distance, setDistance] = useState('200');
  const [remoteLevel, setRemoteLevel] = useState('none');
  const [locationInput, setLocationInput] = useState('');
  const [freightSource, setFreightSource] = useState('');
  const [includeInsulation, setIncludeInsulation] = useState(false);
  const [insulationGrade, setInsulationGrade] = useState('R20/R20');
  const [includeGutters, setIncludeGutters] = useState(false);
  const [linerOption, setLinerOption] = useState('none');
  const [foundationType, setFoundationType] = useState<'slab' | 'frost_wall'>('slab');
  const [selectedFactors, setSelectedFactors] = useState<string[]>(['Clear span up to 80ft']);
  const [contingencyPct, setContingencyPct] = useState('5');
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [costSavingTips, setCostSavingTips] = useState<string[]>([]);

  // Client & rep fields
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [salesRep, setSalesRep] = useState('');

  // Admin/Owner markup toggle
  const [useFlat, setUseFlat] = useState(false);
  const [flatMarkupPct, setFlatMarkupPct] = useState('5');

  const toggleFactor = (item: string) => {
    setSelectedFactors(prev => prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item]);
  };

  const handleClientSelect = (client: { clientId: string; clientName: string }) => {
    setClientId(client.clientId);
    setClientName(client.clientName);
  };

  const handleLocationLookup = async () => {
    if (!locationInput.trim()) {
      setFreightSource('Enter a postal code, city, or address');
      return;
    }
    setFreightSource('Looking up distance...');
    const estimate = await estimateFreightFromLocation(locationInput);
    if (estimate) {
      setDistance(estimate.distanceKm.toString());
      setRemoteLevel(estimate.remote);
      setProvince(estimate.province);
      const via = estimate.distanceSource === 'maps' ? 'Maps API' : 'heuristic';
      setFreightSource(`Auto: ~${estimate.distanceKm}km via ${via} (${estimate.method})`);
    } else {
      setFreightSource('Could not estimate — enter manually');
    }
  };

  const calculate = () => {
    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    const h = parseFloat(height) || 14;
    const sqft = w * l;
    if (sqft <= 0) return;

    const steel = calcSteelCost(sqft);
    const eng = calcEngineering(selectedFactors);
    const found = lookupFoundation(sqft, foundationType);

    let ins = 0;
    if (includeInsulation) {
      const insPerSqft = lookupInsulation(insulationGrade);
      const area = calcInsulationArea(w, l, h);
      ins = insPerSqft * area.total;
    }

    const gutters = includeGutters ? l * 2 * 10 : 0;

    let linerArea = 0;
    if (linerOption === 'walls') linerArea = 2 * (w + l) * h;
    else if (linerOption === 'ceiling') linerArea = sqft;
    else if (linerOption === 'both') linerArea = 2 * (w + l) * h + sqft;
    const liners = linerArea * 3.25;

    const frt = calcFreight(parseFloat(distance) || 0, steel.weight, remoteLevel);

    // Apply pitch and height multipliers to steel
    const p = parseFloat(pitch) || 1;
    const pitchMult = pitchCostMultiplier(p);
    const heightMult = heightCostMultiplier(h);
    const adjustedSteel = steel.cost * pitchMult.multiplier * heightMult.multiplier;

    // Calculate markup - baked into steel price (hidden from user)
    let markupAmount: number;
    let markupRate: number;
    let markupType: string;

    if (isAdminOwner && useFlat) {
      markupRate = parseFloat(flatMarkupPct) / 100;
      markupAmount = adjustedSteel * markupRate;
      markupType = `Flat ${flatMarkupPct}%`;
    } else {
      markupAmount = calcMarkup(adjustedSteel);
      markupRate = getMarkupRate(adjustedSteel);
      markupType = `Tiered ${(markupRate * 100).toFixed(1)}%`;
    }

    const steelWithMargin = adjustedSteel + markupAmount;

    const subtotal = steelWithMargin + eng + found + ins + gutters + liners + frt;
    const contingency = subtotal * (parseFloat(contingencyPct) || 0) / 100;
    const estimatedTotal = subtotal;
    const taxes = calcTax(subtotal + contingency, province);

    setResult({
      sqft, weight: steel.weight,
      steelCost: adjustedSteel, engineering: eng, foundation: found,
      insulation: ins, gutters, liners, freight: frt,
      subtotal, internalMargin: markupAmount, estimatedTotal,
      contingency, gstHst: taxes.gstHst, qst: taxes.qst,
      grandTotal: subtotal + contingency + taxes.total,
      province,
      steelWithMargin,
      markupType,
      markupRate,
      markupAmount,
    });

    // Generate cost-saving tips
    const tips: string[] = [];
    if (p > 2) tips.push(`📐 Reducing roof pitch from ${p}:12 to 1:12 could save ~${((pitchMult.multiplier - 1) * 100).toFixed(0)}% on steel costs.`);
    if (h > 16) tips.push(`📏 A ${h}ft eave height adds ~${((heightMult.multiplier - 1) * 100).toFixed(0)}% to steel. Consider ${Math.min(h, 16)}ft if clearance allows.`);
    if (w > 80) tips.push(`🏗️ Buildings over 80ft wide require multi-span framing — significantly more costly. Consider ≤ 80ft width.`);
    if (foundationType === 'frost_wall') tips.push(`🧱 Frost wall foundations cost ~65% more than slab. Verify if slab-on-grade is feasible.`);
    if (remoteLevel === 'extreme') tips.push(`🚛 Extreme remote freight adds $3,000+. Consider a staging/pickup arrangement.`);
    if (remoteLevel === 'remote') tips.push(`🚛 Remote location adds $1,500 to freight. Check if a closer delivery point is available.`);
    if (sqft > 10000 && parseFloat(contingencyPct) >= 5) tips.push(`💰 For large buildings (${formatNumber(sqft)} sqft), contingency could be reduced to 3% — larger projects have more predictable costs.`);
    if (includeInsulation && !insulationGrade) tips.push(`🧊 Specify insulation grade to ensure the estimate matches the correct R-value.`);
    setCostSavingTips(tips);
  };

  const saveEstimate = () => {
    if (!result) {
      toast.error('Calculate an estimate first.');
      return;
    }
    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    const h = parseFloat(height) || 14;
    const p = parseFloat(pitch) || 1;
    const rep = salesRep || currentUser.name || user?.email || '';

    const auditNotes: string[] = [
      `Steel base: ${formatCurrency(result.steelCost)} at ${formatNumber(result.weight)} lbs`,
      `Margin baked in: ${result.markupType} = ${formatCurrency(result.markupAmount)}`,
      `Steel shown to client: ${formatCurrency(result.steelWithMargin)}`,
      `Pitch: ${p}:12 (×${pitchCostMultiplier(p).multiplier})`,
      `Height: ${h}ft (×${heightCostMultiplier(h).multiplier})`,
      `Engineering factors: ${selectedFactors.join(', ')}`,
    ];

    const label = getNextEstLabel();
    const estimate: SavedEstimate = {
      id: crypto.randomUUID(),
      label,
      date: new Date().toISOString().split('T')[0],
      clientName: clientName || 'TBD',
      clientId: clientId || '',
      salesRep: rep,
      width: w, length: l, height: h, pitch: p,
      province,
      grandTotal: result.grandTotal,
      sqft: result.sqft,
      estimatedTotal: result.estimatedTotal,
      notes: '',
      auditNotes,
      allData: {
        distance, remoteLevel, foundationType, contingencyPct,
        includeInsulation, insulationGrade, includeGutters, linerOption,
        locationInput, useFlat, flatMarkupPct,
        result,
      },
    };

    const estimates = getEstimates();
    estimates.push(estimate);
    saveEstimates(estimates);
    toast.success(`Estimate ${label} saved`);
  };

  const convertToRFQ = async () => {
    if (!result) {
      toast.error('Calculate an estimate first.');
      return;
    }

    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    const h = parseFloat(height) || 14;
    if (!w || !l) {
      toast.error('Missing building dimensions.');
      return;
    }

    // Auto-save estimate first
    saveEstimate();

    const date = new Date().toISOString().split('T')[0];
    const jobId = `CSB-${Date.now().toString(36).toUpperCase()}`;
    const rep = salesRep || currentUser.name || user?.email || '';

    const location = locationInput.trim();
    const postalMatch = location.match(/([A-Za-z])\d[A-Za-z]\s?\d[A-Za-z]\d/);
    const postalCode = postalMatch ? location.toUpperCase() : '';
    const city = postalMatch ? '' : location;

    const prov = getProvinceTax(province);
    const steelAfter12 = result.steelCost;
    const baseSteelCost = steelAfter12 / 1.12;

    const quote: Quote = {
      id: crypto.randomUUID(),
      date,
      jobId,
      jobName: `RFQ ${w}x${l} (Quick Estimator)`,
      clientName: clientName || 'Client TBD',
      clientId,
      salesRep: rep,
      estimator: currentUser.name,
      province,
      city,
      address: '',
      postalCode,
      width: w, length: l, height: h,
      sqft: result.sqft, weight: result.weight,
      baseSteelCost,
      steelAfter12,
      markup: result.internalMargin,
      adjustedSteel: result.steelWithMargin,
      engineering: result.engineering,
      foundation: result.foundation,
      foundationType,
      gutters: result.gutters,
      liners: result.liners,
      insulation: result.insulation,
      insulationGrade,
      freight: result.freight,
      combinedTotal: result.subtotal,
      perSqft: result.subtotal / result.sqft,
      perLb: result.steelWithMargin / result.weight,
      contingencyPct: parseFloat(contingencyPct) || 0,
      contingency: result.contingency,
      gstHst: result.gstHst,
      qst: result.qst,
      grandTotal: result.grandTotal,
      status: 'Sent',
    };

    await addQuote(quote);
    toast.success('Quote created & saved — navigating to RFQ');

    // Navigate to Quote RFQ with params
    const params = new URLSearchParams({
      jobId,
      clientName: clientName || '',
      clientId,
      salesRep: rep,
      width: String(w),
      length: String(l),
      height: String(h),
      pitch: pitch,
      province,
      city,
      postalCode,
    });
    navigate(`/quote-rfq?${params.toString()}`);
  };

  // Build compliance/audit notes for admin/owner
  const complianceNotes = result ? [
    `Base steel (before margin): ${formatCurrency(result.steelCost)}`,
    `Margin type: ${result.markupType}`,
    `Margin amount: ${formatCurrency(result.markupAmount)} (${(result.markupRate * 100).toFixed(1)}%)`,
    `Steel shown (margin baked in): ${formatCurrency(result.steelWithMargin)}`,
    `$/sqft: ${formatCurrency(result.subtotal / result.sqft)}`,
    `Weight: ${formatNumber(result.weight)} lbs`,
    `Pitch multiplier: ×${pitchCostMultiplier(parseFloat(pitch) || 1).multiplier}`,
    `Height multiplier: ×${heightCostMultiplier(parseFloat(height) || 14).multiplier}`,
  ] : [];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Quick Estimator</h2>
        <p className="text-sm text-muted-foreground mt-1">Instant ballpark pricing before a factory quote</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-5 bg-card border rounded-lg p-5">
          {/* Client & Sales Rep */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client & Rep</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client Name</Label>
                <ClientSelect mode="name" valueId={clientId} valueName={clientName} onSelect={handleClientSelect} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Client ID</Label>
                <ClientSelect mode="id" valueId={clientId} valueName={clientName} onSelect={handleClientSelect} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Sales Rep <span className="text-muted-foreground">(auto-assigned if empty)</span></Label>
                <PersonnelSelect value={salesRep} onValueChange={setSalesRep} role="sales_rep" className="mt-1" />
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Building Details</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" value={width} onChange={e => setWidth(e.target.value)} /></div>
            <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" value={length} onChange={e => setLength(e.target.value)} /></div>
            <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" value={height} onChange={e => setHeight(e.target.value)} /></div>
            <div><Label className="text-xs">Roof Pitch (:12)</Label><Input className="input-blue mt-1" value={pitch} onChange={e => setPitch(e.target.value)} placeholder="1" /></div>
          </div>
          {(parseFloat(pitch) > 1 || parseFloat(height) > 14) && (
            <div className="bg-muted rounded-md p-3 text-xs space-y-1">
              {parseFloat(pitch) > 1 && <p className="text-muted-foreground">📐 {pitchCostMultiplier(parseFloat(pitch)).note}</p>}
              {parseFloat(height) > 14 && <p className="text-muted-foreground">📏 {heightCostMultiplier(parseFloat(height)).note}</p>}
            </div>
          )}

          {/* Location */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              Auto Freight Estimate
            </Label>
            <div className="flex gap-2">
              <Input
                className="input-blue flex-1"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                placeholder="Postal code, city, or address..."
                onKeyDown={e => e.key === 'Enter' && void handleLocationLookup()}
              />
              <Button size="sm" variant="outline" onClick={() => void handleLocationLookup()}>Lookup</Button>
            </div>
            {freightSource && <p className="text-[10px] text-muted-foreground">{freightSource}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Province</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Distance from Bradford (km)</Label><Input className="input-blue mt-1" value={distance} onChange={e => setDistance(e.target.value)} /></div>
          </div>

          <div>
            <Label className="text-xs">Remote Level</Label>
            <Select value={remoteLevel} onValueChange={setRemoteLevel}>
              <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="moderate">Moderate (+$500)</SelectItem>
                <SelectItem value="remote">Remote (+$1,500)</SelectItem>
                <SelectItem value="extreme">Extreme (+$3,000)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Foundation Type</Label>
              <Select value={foundationType} onValueChange={v => setFoundationType(v as 'slab' | 'frost_wall')}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slab">Slab</SelectItem>
                  <SelectItem value="frost_wall">Frost Wall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Contingency %</Label><Input className="input-blue mt-1" value={contingencyPct} onChange={e => setContingencyPct(e.target.value)} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox checked={includeInsulation} onCheckedChange={v => setIncludeInsulation(!!v)} />
              <Label className="text-xs">Include Insulation</Label>
            </div>
            {includeInsulation && (
              <Select value={insulationGrade} onValueChange={setInsulationGrade}>
                <SelectTrigger className="input-blue"><SelectValue /></SelectTrigger>
                <SelectContent>{INSULATION_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={includeGutters} onCheckedChange={v => setIncludeGutters(!!v)} />
              <Label className="text-xs">Include Gutters</Label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Liners</Label>
            <Select value={linerOption} onValueChange={setLinerOption}>
              <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Liners</SelectItem>
                <SelectItem value="walls">Walls Only</SelectItem>
                <SelectItem value="ceiling">Ceiling Only</SelectItem>
                <SelectItem value="both">Walls + Ceiling</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Engineering Complexity</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {ENGINEERING_FACTORS.map(f => (
                <div key={f.item} className="flex items-center gap-2">
                  <Checkbox checked={selectedFactors.includes(f.item)} onCheckedChange={() => toggleFactor(f.item)} />
                  <Label className="text-xs">{f.item} (×{f.factor})</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Admin/Owner: Markup Toggle */}
          {isAdminOwner && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Use Flat Markup (instead of tiered)</Label>
                <Switch checked={useFlat} onCheckedChange={setUseFlat} />
              </div>
              {useFlat && (
                <div>
                  <Label className="text-xs">Flat Markup %</Label>
                  <Input className="input-blue mt-1" type="number" step="0.5" value={flatMarkupPct} onChange={e => setFlatMarkupPct(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <Button onClick={calculate} className="w-full">Calculate Estimate</Button>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estimate Summary</h3>
            <div className="text-xs text-muted-foreground">
              {parseFloat(width)}&apos; × {parseFloat(length)}&apos; × {parseFloat(height)}&apos; | Pitch: {pitch}:12 | {formatNumber(result.sqft)} sqft | {formatNumber(result.weight)} lbs
            </div>

            <div className="space-y-2 text-sm">
              <Row label="Steel" value={result.steelWithMargin} bold />
              <Row label="Engineering Fee" value={result.engineering} />
              <Row label="Foundation Drawing" value={result.foundation} />
              {result.insulation > 0 && <Row label={`Insulation (${insulationGrade})`} value={result.insulation} />}
              {result.gutters > 0 && <Row label="Gutters & Downspouts" value={result.gutters} />}
              {result.liners > 0 && <Row label="Liners" value={result.liners} />}
              <Row label="Freight Estimate" value={result.freight} />
              <div className="border-t pt-2" />
              <Row label="Estimated Total" value={result.estimatedTotal} bold />
              <Row label={`Contingency (${contingencyPct}%)`} value={result.contingency} />
              <div className="border-t pt-2" />
              <Row label="GST/HST" value={result.gstHst} />
              {result.qst > 0 && <Row label="QST" value={result.qst} />}
              <div className="border-t pt-2" />
              <div className="flex justify-between text-base font-bold text-foreground">
                <span>GRAND TOTAL (incl. tax)</span>
                <span>{formatCurrency(result.grandTotal)}</span>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {formatCurrency(result.estimatedTotal / result.sqft)}/sqft
              </div>

              <div className="pt-2 space-y-2">
                <Button onClick={saveEstimate} variant="outline" className="w-full">
                  <Save className="h-4 w-4 mr-2" />Save Estimate ({getNextEstLabel()})
                </Button>
                <Button onClick={() => void convertToRFQ()} className="w-full">
                  Convert to RFQ (Stage 1)
                </Button>
              </div>

              {/* Cost-Saving Tips */}
              {costSavingTips.length > 0 && (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-1.5 mt-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <Lightbulb className="h-3.5 w-3.5" /> Cost-Saving Opportunities
                  </div>
                  {costSavingTips.map((tip, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{tip}</p>
                  ))}
                </div>
              )}

              {/* Admin/Owner Compliance Notes */}
              {isAdminOwner && complianceNotes.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full">
                    <div className="bg-card border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors mt-3">
                      <span className="text-xs font-semibold text-muted-foreground">🔒 Compliance Notes (Owner View)</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-1">
                      {complianceNotes.map((note, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{note}</p>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''} ${muted ? 'text-muted-foreground text-xs' : ''}`}>
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );
}
