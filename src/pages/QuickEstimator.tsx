import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  calcSteelCost, calcEngineering, lookupFoundation, lookupInsulation,
  calcInsulationArea, calcFreight, calcTax, formatCurrency, formatNumber,
  PROVINCES, INSULATION_GRADES, ENGINEERING_FACTORS, REMOTE_LEVELS, getProvinceTax,
  pitchCostMultiplier, heightCostMultiplier
} from '@/lib/calculations';
import { estimateFreightFromLocation } from '@/lib/freightEstimate';
import { MapPin, Lightbulb } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { toast } from 'sonner';
import type { Quote } from '@/types';

interface EstimateResult {
  sqft: number; weight: number;
  steelCost: number; engineering: number; foundation: number;
  insulation: number; gutters: number; liners: number; freight: number;
  subtotal: number; internalMargin: number; estimatedTotal: number;
  contingency: number; gstHst: number; qst: number; grandTotal: number;
  province: string;
}

export default function QuickEstimator() {
  const navigate = useNavigate();
  const { addQuote } = useAppContext();
  const { currentUser } = useRoles();

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

  const toggleFactor = (item: string) => {
    setSelectedFactors(prev => prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item]);
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

    const subtotal = steel.cost + eng + found + ins + gutters + liners + frt;
    const internalMargin = subtotal * 0.05;
    const estimatedTotal = subtotal + internalMargin;
    const contingency = estimatedTotal * (parseFloat(contingencyPct) || 0) / 100;
    const taxes = calcTax(estimatedTotal + contingency, province);

    setResult({
      sqft, weight: steel.weight,
      steelCost: steel.cost, engineering: eng, foundation: found,
      insulation: ins, gutters, liners, freight: frt,
      subtotal, internalMargin, estimatedTotal,
      contingency, gstHst: taxes.gstHst, qst: taxes.qst,
      grandTotal: estimatedTotal + contingency + taxes.total,
      province,
    });

    // Generate cost-saving tips
    const tips: string[] = [];
    const p = parseFloat(pitch) || 1;
    if (p > 2) tips.push(`📐 Reducing roof pitch from ${p}:12 to 1:12 could save ~${((pitchCostMultiplier(p).multiplier - 1) * 100).toFixed(0)}% on steel costs.`);
    if (h > 16) tips.push(`📏 A ${h}ft eave height adds ~${((heightCostMultiplier(h).multiplier - 1) * 100).toFixed(0)}% to steel. Consider ${Math.min(h, 16)}ft if clearance allows.`);
    if (w > 80) tips.push(`🏗️ Buildings over 80ft wide require multi-span framing — significantly more costly. Consider ≤ 80ft width.`);
    if (foundationType === 'frost_wall') tips.push(`🧱 Frost wall foundations cost ~65% more than slab. Verify if slab-on-grade is feasible.`);
    if (remoteLevel === 'extreme') tips.push(`🚛 Extreme remote freight adds $3,000+. Consider a staging/pickup arrangement.`);
    if (remoteLevel === 'remote') tips.push(`🚛 Remote location adds $1,500 to freight. Check if a closer delivery point is available.`);
    if (sqft > 10000 && parseFloat(contingencyPct) >= 5) tips.push(`💰 For large buildings (${formatNumber(sqft)} sqft), contingency could be reduced to 3% — larger projects have more predictable costs.`);
    if (includeInsulation && !insulationGrade) tips.push(`🧊 Specify insulation grade to ensure the estimate matches the correct R-value.`);
    setCostSavingTips(tips);
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

    const date = new Date().toISOString().split('T')[0];
    const jobId = `CSB-${Date.now().toString(36).toUpperCase()}`;

    const location = locationInput.trim();
    const postalMatch = location.match(/([A-Za-z])\d[A-Za-z]\s?\d[A-Za-z]\d/);
    const postalCode = postalMatch ? location.toUpperCase() : '';
    const city = postalMatch ? '' : location;

    const prov = getProvinceTax(province);
    const steelAfter12 = result.steelCost;
    const baseSteelCost = steelAfter12 / 1.12;

    const clientName = city || 'Client TBD';

    const quote: Quote = {
      id: crypto.randomUUID(),
      date,
      jobId,
      jobName: `RFQ ${w}x${l} (Quick Estimator)`,
      clientName,
      clientId: '',
      salesRep: currentUser.name,
      estimator: currentUser.name,
      province,
      city,
      address: '',
      postalCode,
      width: w,
      length: l,
      height: h,
      sqft: result.sqft,
      weight: result.weight,
      baseSteelCost,
      steelAfter12,
      markup: result.internalMargin,
      adjustedSteel: steelAfter12,
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
      perLb: steelAfter12 / result.weight,
      contingencyPct: parseFloat(contingencyPct) || 0,
      contingency: result.contingency,
      gstHst: result.gstHst,
      qst: result.qst,
      grandTotal: result.grandTotal,
      status: 'Sent',
    };

    await addQuote(quote);
    toast.success('Quote created — convert to Deal from the Quote Log when ready');
    navigate(`/rfq-builder?jobId=${encodeURIComponent(jobId)}`);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Quick Estimator</h2>
        <p className="text-sm text-muted-foreground mt-1">Instant ballpark pricing before a factory quote</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-5 bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Building Details</h3>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" value={width} onChange={e => setWidth(e.target.value)} /></div>
            <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" value={length} onChange={e => setLength(e.target.value)} /></div>
            <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" value={height} onChange={e => setHeight(e.target.value)} /></div>
            <div><Label className="text-xs">Roof Pitch (:12)</Label><Input className="input-blue mt-1" value={pitch} onChange={e => setPitch(e.target.value)} placeholder="1" /></div>
          </div>
          {/* Pitch & Height impact notes */}
          {(parseFloat(pitch) > 1 || parseFloat(height) > 14) && (
            <div className="bg-muted rounded-md p-3 text-xs space-y-1">
              {parseFloat(pitch) > 1 && <p className="text-muted-foreground">📐 {pitchCostMultiplier(parseFloat(pitch)).note}</p>}
              {parseFloat(height) > 14 && <p className="text-muted-foreground">📏 {heightCostMultiplier(parseFloat(height)).note}</p>}
            </div>
          )}

          {/* Location-based freight estimation */}
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
            {freightSource && (
              <p className="text-[10px] text-muted-foreground">{freightSource}</p>
            )}
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

          <Button onClick={calculate} className="w-full">Calculate Estimate</Button>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estimate Summary</h3>
            <div className="text-xs text-muted-foreground">
              {parseFloat(width)}&apos; × {parseFloat(length)}&apos; × {parseFloat(height)}&apos; | {formatNumber(result.sqft)} sqft | {formatNumber(result.weight)} lbs
            </div>

            <div className="space-y-2 text-sm">
              <Row label="Steel (incl. 12% increase)" value={result.steelCost} />
              <Row label="Engineering Fee" value={result.engineering} />
              <Row label="Foundation Drawing" value={result.foundation} />
              {result.insulation > 0 && <Row label={`Insulation (${insulationGrade})`} value={result.insulation} />}
              {result.gutters > 0 && <Row label="Gutters & Downspouts" value={result.gutters} />}
              {result.liners > 0 && <Row label="Liners" value={result.liners} />}
              <Row label="Freight Estimate" value={result.freight} />
              <div className="border-t pt-2" />
              <Row label="Subtotal" value={result.subtotal} bold />
              <Row label="Internal Margin (5%)" value={result.internalMargin} muted />
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

              <div className="pt-2">
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
