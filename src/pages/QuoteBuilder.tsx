import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobIdSelect } from '@/components/JobIdSelect';
import { useAppContext } from '@/context/AppContext';
import {
  calcTax, calcMarkup, calcEngineeringFromFactor, lookupFoundation, calcFreight,
  formatCurrency, formatNumber, PROVINCES, getProvinceTax
} from '@/lib/calculations';
import { estimateFreightFromLocation } from '@/lib/freightEstimate';
import type { Quote } from '@/types';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { PersonnelSelect } from '@/components/PersonnelSelect';

export default function QuoteBuilder() {
  const { addQuote, deals } = useAppContext();

  const [form, setForm] = useState({
    jobId: '', jobName: '', clientName: '', clientId: '',
    salesRep: '', estimator: '', province: 'ON',
    city: '', address: '', postalCode: '',
    width: '', length: '', height: '14',
    baseSteelCost: '', totalWeight: '',
    gutters: '0', liners: '0', otherAccessories: '0',
    insulationCost: '0', insulationGrade: '',
    distance: '200', remoteLevel: 'none', overrideFreight: '',
    complexityFactor: '1.0',
    foundationType: 'slab' as 'slab' | 'frost_wall',
    contingencyPct: '5',
  });

  const [quote, setQuote] = useState<Quote | null>(null);
  const [freightSource, setFreightSource] = useState('');

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleLocationLookup = async () => {
    const input = form.postalCode || form.city || form.address;
    if (!input.trim()) {
      setFreightSource('Enter a location to estimate freight');
      return;
    }

    setFreightSource('Looking up distance...');
    const estimate = await estimateFreightFromLocation(input);
    if (estimate) {
      set('distance', estimate.distanceKm.toString());
      set('remoteLevel', estimate.remote);
      set('province', estimate.province);
      const via = estimate.distanceSource === 'maps' ? 'Maps API' : 'heuristic';
      setFreightSource(`Auto: ~${estimate.distanceKm}km via ${via} (${estimate.method})`);
    } else {
      setFreightSource('Could not estimate');
    }
  };

  const generate = () => {
    const w = parseFloat(form.width) || 0;
    const l = parseFloat(form.length) || 0;
    const h = parseFloat(form.height) || 14;
    const sqft = w * l;
    const weight = parseFloat(form.totalWeight) || 0;
    const baseSteelCost = parseFloat(form.baseSteelCost) || 0;

    if (!sqft || !weight || !baseSteelCost) {
      toast.error('Please fill in dimensions, weight, and steel cost');
      return;
    }

    const priceLb = baseSteelCost / weight;
    const steelAfter12 = priceLb * 1.12 * weight;
    const markup = calcMarkup(steelAfter12);
    const adjustedSteel = steelAfter12 + markup;

    const engineering = calcEngineeringFromFactor(parseFloat(form.complexityFactor) || 1);
    const foundation = lookupFoundation(sqft, form.foundationType);
    const insulation = parseFloat(form.insulationCost) || 0;
    const guttersVal = parseFloat(form.gutters) || 0;
    const linersVal = parseFloat(form.liners) || 0;

    const freight = form.overrideFreight
      ? parseFloat(form.overrideFreight)
      : calcFreight(parseFloat(form.distance) || 0, weight, form.remoteLevel);

    const combinedTotal = adjustedSteel + engineering + foundation + insulation + guttersVal + linersVal + freight;
    const contingency = combinedTotal * (parseFloat(form.contingencyPct) || 0) / 100;
    const totalPlusCont = combinedTotal + contingency;
    const taxes = calcTax(totalPlusCont, form.province);

    const q: Quote = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      jobId: form.jobId || `CSB-${Date.now().toString(36).toUpperCase()}`,
      jobName: form.jobName,
      clientName: form.clientName,
      clientId: form.clientId,
      salesRep: form.salesRep,
      estimator: form.estimator,
      province: form.province,
      city: form.city,
      address: form.address,
      postalCode: form.postalCode,
      width: w, length: l, height: h,
      sqft, weight,
      baseSteelCost, steelAfter12, markup, adjustedSteel,
      engineering, foundation,
      foundationType: form.foundationType,
      gutters: guttersVal, liners: linersVal, insulation,
      insulationGrade: form.insulationGrade,
      freight,
      combinedTotal,
      perSqft: combinedTotal / sqft,
      perLb: adjustedSteel / weight,
      contingencyPct: parseFloat(form.contingencyPct) || 0,
      contingency,
      gstHst: taxes.gstHst, qst: taxes.qst,
      grandTotal: totalPlusCont + taxes.total,
      status: 'Draft',
    };
    setQuote(q);
  };

  const saveToLog = () => {
    if (!quote) return;
    addQuote(quote);
    toast.success('Quote saved to Quote Log');
  };

  const prov = getProvinceTax(form.province);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Sales Quote Builder</h2>
        <p className="text-sm text-muted-foreground mt-1">Create external sales quotes with your markups for clients</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5 bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Project Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Job ID</Label><JobIdSelect value={form.jobId} onValueChange={v => set('jobId', v)} deals={deals} placeholder="Auto-generated" /></div>
            <div><Label className="text-xs">Job Name</Label><Input className="input-blue mt-1" value={form.jobName} onChange={e => set('jobName', e.target.value)} /></div>
            <div><Label className="text-xs">Client Name</Label><Input className="input-blue mt-1" value={form.clientName} onChange={e => set('clientName', e.target.value)} /></div>
            <div><Label className="text-xs">Client ID</Label><Input className="input-blue mt-1" value={form.clientId} onChange={e => set('clientId', e.target.value)} /></div>
            <div><Label className="text-xs">Sales Rep</Label><PersonnelSelect value={form.salesRep} onValueChange={v => set('salesRep', v)} role="sales_rep" className="mt-1" /></div>
            <div><Label className="text-xs">Estimator</Label><PersonnelSelect value={form.estimator} onValueChange={v => set('estimator', v)} role="estimator" className="mt-1" /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Province</Label>
              <Select value={form.province} onValueChange={v => set('province', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">City</Label><Input className="input-blue mt-1" value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><Label className="text-xs">Postal Code</Label><Input className="input-blue mt-1" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} /></div>
          </div>

          {/* Auto freight from location */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void handleLocationLookup()} className="text-xs">
              <MapPin className="h-3 w-3 mr-1" /> Auto-estimate freight from location
            </Button>
            {freightSource && <span className="text-[10px] text-muted-foreground">{freightSource}</span>}
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pt-2">Building & Costs</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" value={form.width} onChange={e => set('width', e.target.value)} /></div>
            <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" value={form.length} onChange={e => set('length', e.target.value)} /></div>
            <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" value={form.height} onChange={e => set('height', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Base Steel Cost (MBS)</Label><Input className="input-blue mt-1" value={form.baseSteelCost} onChange={e => set('baseSteelCost', e.target.value)} placeholder="$" /></div>
            <div><Label className="text-xs">Total Weight (lbs)</Label><Input className="input-blue mt-1" value={form.totalWeight} onChange={e => set('totalWeight', e.target.value)} /></div>
            <div><Label className="text-xs">Gutters & Downspouts</Label><Input className="input-blue mt-1" value={form.gutters} onChange={e => set('gutters', e.target.value)} /></div>
            <div><Label className="text-xs">Liner Panels</Label><Input className="input-blue mt-1" value={form.liners} onChange={e => set('liners', e.target.value)} /></div>
            <div><Label className="text-xs">Insulation Cost</Label><Input className="input-blue mt-1" value={form.insulationCost} onChange={e => set('insulationCost', e.target.value)} /></div>
            <div><Label className="text-xs">Insulation Grade</Label><Input className="input-blue mt-1" value={form.insulationGrade} onChange={e => set('insulationGrade', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Distance (km)</Label><Input className="input-blue mt-1" value={form.distance} onChange={e => set('distance', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Remote</Label>
              <Select value={form.remoteLevel} onValueChange={v => set('remoteLevel', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="extreme">Extreme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Override Freight</Label><Input className="input-blue mt-1" value={form.overrideFreight} onChange={e => set('overrideFreight', e.target.value)} placeholder="Auto" /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Complexity Factor</Label><Input className="input-blue mt-1" value={form.complexityFactor} onChange={e => set('complexityFactor', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Foundation</Label>
              <Select value={form.foundationType} onValueChange={v => set('foundationType', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slab">Slab</SelectItem>
                  <SelectItem value="frost_wall">Frost Wall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Contingency %</Label><Input className="input-blue mt-1" value={form.contingencyPct} onChange={e => set('contingencyPct', e.target.value)} /></div>
          </div>

          <Button onClick={generate} className="w-full">Generate Quote</Button>
        </div>

        {/* Quote output */}
        {quote && (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sales Quote</h3>
              <Button onClick={saveToLog} size="sm" variant="outline">Save to Quote Log</Button>
            </div>

            <div className="font-mono text-sm space-y-1 bg-muted p-4 rounded-md whitespace-pre-wrap text-foreground">
              <p className="font-bold text-base">Quote – {quote.jobId} – {quote.clientName}</p>
              <p className="text-xs text-muted-foreground">Client ID: {quote.clientId}    Job ID: {quote.jobId}</p>
              <p className="text-xs text-muted-foreground">Job Name: {quote.jobName}</p>
              <p className="text-xs text-muted-foreground">Location: {quote.city}, {quote.province} {quote.postalCode}</p>
              <p className="text-xs text-muted-foreground">Building: {quote.width}&apos; × {quote.length}&apos; × {quote.height}&apos; | {formatNumber(quote.sqft)} sqft | {formatNumber(quote.weight)} lbs</p>
              <br />
              <Row2 label="Base Steel Cost" value={quote.adjustedSteel} />
              <Row2 label="Engineering Fee" value={quote.engineering} />
              <Row2 label="Foundation Drawing" value={quote.foundation} />
              <br />
              <Row2 label="Updated Steel Total" value={quote.adjustedSteel} bold />
              <br />
              <p className="text-xs text-muted-foreground">Accessories (included):</p>
              <Row2 label="  Gutters & Downspouts" value={quote.gutters} />
              <Row2 label="  Liner Panels" value={quote.liners} />
              <br />
              <Row2 label="Insulation" value={quote.insulation} />
              <Row2 label="Freight Estimate" value={quote.freight} />
              <br />
              <Row2 label="COMBINED TOTAL" value={quote.combinedTotal} bold />
              <Row2 label="Updated $/sqft" value={quote.perSqft} />
              <br />
              <Row2 label={`Contingency (${quote.contingencyPct}%)`} value={quote.contingency} />
              <Row2 label="Total + Contingency" value={quote.combinedTotal + quote.contingency} />
              <br />
              <Row2 label={prov.type === 'HST' ? 'HST' : 'GST'} value={quote.gstHst} />
              {quote.qst > 0 && <Row2 label="QST" value={quote.qst} />}
              <br />
              <Row2 label="GRAND TOTAL (incl tax)" value={quote.grandTotal} bold />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row2({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
