import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobIdSelect } from '@/components/JobIdSelect';
import { useAppContext } from '@/context/AppContext';
import {
  calcTax, calcMarkup, calcEngineeringFromFactor, lookupFoundation, calcFreight,
  formatCurrency, formatNumber, PROVINCES, getProvinceTax,
} from '@/lib/calculations';
import { estimateFreightFromLocation } from '@/lib/freightEstimate';
import type { Quote } from '@/types';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { ClientSelect } from '@/components/ClientSelect';
import { saveDocumentPdf } from '@/lib/documentPdf';

const INITIAL_FORM = {
  jobId: '',
  jobName: '',
  clientName: '',
  clientId: '',
  salesRep: '',
  estimator: '',
  province: 'ON',
  city: '',
  address: '',
  postalCode: '',
  width: '',
  length: '',
  height: '14',
  baseSteelCost: '',
  totalWeight: '',
  gutters: '0',
  liners: '0',
  insulationCost: '0',
  insulationGrade: '',
  distance: '200',
  remoteLevel: 'none',
  overrideFreight: '',
  complexityFactor: '1.0',
  foundationType: 'slab' as 'slab' | 'frost_wall',
  contingencyPct: '5',
};

export default function QuoteBuilder() {
  const [searchParams] = useSearchParams();
  const { addQuote, updateQuote, deals, quotes, allocateJobId } = useAppContext();
  const editingQuoteId = searchParams.get('quoteId');
  const sourceDocumentId = searchParams.get('sourceDocumentId');

  const [form, setForm] = useState(INITIAL_FORM);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [freightSource, setFreightSource] = useState('');

  const existingQuote = useMemo(
    () => quotes.find(item => item.id === editingQuoteId),
    [editingQuoteId, quotes],
  );

  const sourceQuote = useMemo(
    () => quotes.find(item => item.id === sourceDocumentId),
    [quotes, sourceDocumentId],
  );

  useEffect(() => {
    if (!existingQuote) return;
    setForm({
      jobId: existingQuote.jobId,
      jobName: existingQuote.jobName,
      clientName: existingQuote.clientName,
      clientId: existingQuote.clientId,
      salesRep: existingQuote.salesRep,
      estimator: existingQuote.estimator,
      province: existingQuote.province,
      city: existingQuote.city,
      address: existingQuote.address,
      postalCode: existingQuote.postalCode,
      width: String(existingQuote.width || ''),
      length: String(existingQuote.length || ''),
      height: String(existingQuote.height || 14),
      baseSteelCost: String(existingQuote.baseSteelCost || 0),
      totalWeight: String(existingQuote.weight || 0),
      gutters: String(existingQuote.gutters || 0),
      liners: String(existingQuote.liners || 0),
      insulationCost: String(existingQuote.insulation || 0),
      insulationGrade: existingQuote.insulationGrade || '',
      distance: existingQuote.weight ? String(Math.round(existingQuote.freight / 4)) : '200',
      remoteLevel: 'none',
      overrideFreight: String(existingQuote.freight || 0),
      complexityFactor: existingQuote.engineering ? String((existingQuote.engineering - 500) / 2500 || 1) : '1.0',
      foundationType: existingQuote.foundationType,
      contingencyPct: String(existingQuote.contingencyPct || 5),
    });
    setQuote(existingQuote);
  }, [existingQuote]);

  useEffect(() => {
    if (existingQuote || !sourceQuote) return;
    const sourcePayload = (sourceQuote.payload || {}) as Record<string, any>;
    setForm({
      jobId: sourceQuote.jobId,
      jobName: sourceQuote.jobName,
      clientName: sourceQuote.clientName,
      clientId: sourceQuote.clientId,
      salesRep: sourceQuote.salesRep,
      estimator: sourceQuote.estimator,
      province: sourceQuote.province,
      city: sourceQuote.city,
      address: sourceQuote.address,
      postalCode: sourceQuote.postalCode,
      width: String(sourceQuote.width || ''),
      length: String(sourceQuote.length || ''),
      height: String(sourceQuote.height || 14),
      baseSteelCost: String(sourceQuote.baseSteelCost || sourceQuote.adjustedSteel || 0),
      totalWeight: String(sourceQuote.weight || 0),
      gutters: String(sourceQuote.gutters || 0),
      liners: String(sourceQuote.liners || 0),
      insulationCost: String(sourceQuote.insulation || 0),
      insulationGrade: sourceQuote.insulationGrade || '',
      distance: String(sourcePayload.distance || '200'),
      remoteLevel: sourcePayload.remoteLevel || 'none',
      overrideFreight: String(sourceQuote.freight || 0),
      complexityFactor: String(sourcePayload.complexityFactor || '1.0'),
      foundationType: sourceQuote.foundationType,
      contingencyPct: String(sourceQuote.contingencyPct || 5),
    });
  }, [existingQuote, sourceQuote]);

  const set = (key: keyof typeof INITIAL_FORM, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleClientSelect = ({ clientId, clientName }: { clientId: string; clientName: string }) => {
    setForm(current => ({ ...current, clientId, clientName }));
  };

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

  const generate = async () => {
    const width = parseFloat(form.width) || 0;
    const length = parseFloat(form.length) || 0;
    const height = parseFloat(form.height) || 14;
    const sqft = width * length;
    const weight = parseFloat(form.totalWeight) || 0;
    const baseSteelCost = parseFloat(form.baseSteelCost) || 0;

    if (!sqft || !weight || !baseSteelCost) {
      toast.error('Please fill in dimensions, weight, and steel cost');
      return;
    }

    const jobId = form.jobId || await allocateJobId();
    if (!form.jobId) set('jobId', jobId);

    const pricePerLb = baseSteelCost / weight;
    const steelAfter12 = pricePerLb * 1.12 * weight;
    const markup = calcMarkup(steelAfter12);
    const adjustedSteel = steelAfter12 + markup;
    const engineering = calcEngineeringFromFactor(parseFloat(form.complexityFactor) || 1);
    const foundation = lookupFoundation(sqft, form.foundationType);
    const insulation = parseFloat(form.insulationCost) || 0;
    const gutters = parseFloat(form.gutters) || 0;
    const liners = parseFloat(form.liners) || 0;
    const freight = form.overrideFreight
      ? parseFloat(form.overrideFreight)
      : calcFreight(parseFloat(form.distance) || 0, weight, form.remoteLevel);

    const combinedTotal = adjustedSteel + engineering + foundation + insulation + gutters + liners + freight;
    const contingencyPct = parseFloat(form.contingencyPct) || 0;
    const contingency = combinedTotal * contingencyPct / 100;
    const totalPlusContingency = combinedTotal + contingency;
    const taxes = calcTax(totalPlusContingency, form.province);

    setQuote({
      id: existingQuote?.id || crypto.randomUUID(),
      date: existingQuote?.date || new Date().toISOString().split('T')[0],
      jobId,
      jobName: form.jobName,
      clientName: form.clientName,
      clientId: form.clientId,
      salesRep: form.salesRep,
      estimator: form.estimator,
      province: form.province,
      city: form.city,
      address: form.address,
      postalCode: form.postalCode,
      width,
      length,
      height,
      sqft,
      weight,
      baseSteelCost,
      steelAfter12,
      markup,
      adjustedSteel,
      engineering,
      foundation,
      foundationType: form.foundationType,
      gutters,
      liners,
      insulation,
      insulationGrade: form.insulationGrade,
      freight,
      combinedTotal,
      perSqft: combinedTotal / sqft,
      perLb: adjustedSteel / weight,
      contingencyPct,
      contingency,
      gstHst: taxes.gstHst,
      qst: taxes.qst,
      grandTotal: totalPlusContingency + taxes.total,
      status: 'Draft',
      documentType: 'external_quote',
      workflowStatus: 'draft',
      sourceDocumentId: existingQuote?.sourceDocumentId || searchParams.get('sourceDocumentId'),
      payload: {
        remoteLevel: form.remoteLevel,
        distance: form.distance,
        overrideFreight: form.overrideFreight,
        complexityFactor: form.complexityFactor,
      },
    });
  };

  const saveToLog = async () => {
    if (!quote) return;
    if (existingQuote) {
      await updateQuote(existingQuote.id, { ...quote, updatedAt: new Date().toISOString() });
      const pdf = await saveDocumentPdf(quote);
      await updateQuote(existingQuote.id, {
        pdfStoragePath: pdf.storagePath,
        pdfFileName: pdf.fileName,
        updatedAt: new Date().toISOString(),
      });
      toast.success('External quote updated');
      return;
    }
    await addQuote(quote);
    const pdf = await saveDocumentPdf(quote);
    await updateQuote(quote.id, {
      pdfStoragePath: pdf.storagePath,
      pdfFileName: pdf.fileName,
      updatedAt: new Date().toISOString(),
    });
    if (quote.sourceDocumentId) {
      await updateQuote(quote.sourceDocumentId, {
        workflowStatus: 'external_quote_ready',
        updatedAt: new Date().toISOString(),
      });
    }
    toast.success('External quote saved');
  };

  const provinceTax = getProvinceTax(form.province);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Sales Quote Builder</h2>
        <p className="text-sm text-muted-foreground mt-1">Create external sales quotes without creating deals until conversion is explicit.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5 bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Project Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Job ID</Label>
              <JobIdSelect value={form.jobId} onValueChange={value => set('jobId', value)} allowedStates={['internal_quote', 'external_quote']} placeholder="Auto-generated" />
            </div>
            <div>
              <Label className="text-xs">Job Name</Label>
              <Input className="input-blue mt-1" value={form.jobName} onChange={event => set('jobName', event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Client Name</Label>
              <ClientSelect mode="name" valueId={form.clientId} valueName={form.clientName} onSelect={handleClientSelect} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Client ID</Label>
              <ClientSelect mode="id" valueId={form.clientId} valueName={form.clientName} onSelect={handleClientSelect} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Sales Rep</Label>
              <PersonnelSelect value={form.salesRep} onValueChange={value => set('salesRep', value)} role="sales_rep" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Estimator</Label>
              <PersonnelSelect value={form.estimator} onValueChange={value => set('estimator', value)} role="estimator" className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Province</Label>
              <Select value={form.province} onValueChange={value => set('province', value)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(province => <SelectItem key={province.code} value={province.code}>{province.code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">City</Label><Input className="input-blue mt-1" value={form.city} onChange={event => set('city', event.target.value)} /></div>
            <div><Label className="text-xs">Postal Code</Label><Input className="input-blue mt-1" value={form.postalCode} onChange={event => set('postalCode', event.target.value)} /></div>
          </div>

          <div>
            <Label className="text-xs">Address</Label>
            <Input className="input-blue mt-1" value={form.address} onChange={event => set('address', event.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void handleLocationLookup()} className="text-xs">
              <MapPin className="h-3 w-3 mr-1" /> Auto-estimate freight from location
            </Button>
            {freightSource && <span className="text-[10px] text-muted-foreground">{freightSource}</span>}
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pt-2">Building & Costs</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" value={form.width} onChange={event => set('width', event.target.value)} /></div>
            <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" value={form.length} onChange={event => set('length', event.target.value)} /></div>
            <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" value={form.height} onChange={event => set('height', event.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Base Steel Cost</Label><Input className="input-blue mt-1" value={form.baseSteelCost} onChange={event => set('baseSteelCost', event.target.value)} placeholder="$" /></div>
            <div><Label className="text-xs">Total Weight (lbs)</Label><Input className="input-blue mt-1" value={form.totalWeight} onChange={event => set('totalWeight', event.target.value)} /></div>
            <div><Label className="text-xs">Gutters</Label><Input className="input-blue mt-1" value={form.gutters} onChange={event => set('gutters', event.target.value)} /></div>
            <div><Label className="text-xs">Liners</Label><Input className="input-blue mt-1" value={form.liners} onChange={event => set('liners', event.target.value)} /></div>
            <div><Label className="text-xs">Insulation Cost</Label><Input className="input-blue mt-1" value={form.insulationCost} onChange={event => set('insulationCost', event.target.value)} /></div>
            <div><Label className="text-xs">Insulation Grade</Label><Input className="input-blue mt-1" value={form.insulationGrade} onChange={event => set('insulationGrade', event.target.value)} /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Distance (km)</Label><Input className="input-blue mt-1" value={form.distance} onChange={event => set('distance', event.target.value)} /></div>
            <div>
              <Label className="text-xs">Remote</Label>
              <Select value={form.remoteLevel} onValueChange={value => set('remoteLevel', value)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="extreme">Extreme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Override Freight</Label><Input className="input-blue mt-1" value={form.overrideFreight} onChange={event => set('overrideFreight', event.target.value)} placeholder="Auto" /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Complexity Factor</Label><Input className="input-blue mt-1" value={form.complexityFactor} onChange={event => set('complexityFactor', event.target.value)} /></div>
            <div>
              <Label className="text-xs">Foundation</Label>
              <Select value={form.foundationType} onValueChange={value => set('foundationType', value as 'slab' | 'frost_wall')}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slab">Slab</SelectItem>
                  <SelectItem value="frost_wall">Frost Wall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Contingency %</Label><Input className="input-blue mt-1" value={form.contingencyPct} onChange={event => set('contingencyPct', event.target.value)} /></div>
          </div>

          <Button onClick={() => void generate()} className="w-full">
            {existingQuote ? 'Recalculate Quote' : 'Generate Quote'}
          </Button>
        </div>

        {quote && (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">External Quote</h3>
              <Button onClick={() => void saveToLog()} size="sm" variant="outline">
                {existingQuote ? 'Update RFQ Log' : 'Save to RFQ Log'}
              </Button>
            </div>

            <div className="font-mono text-sm space-y-1 bg-muted p-4 rounded-md whitespace-pre-wrap text-foreground">
              <p className="font-bold text-base">External Quote - {quote.jobId} - {quote.clientName}</p>
              <p className="text-xs text-muted-foreground">Client ID: {quote.clientId} Job ID: {quote.jobId}</p>
              <p className="text-xs text-muted-foreground">Job Name: {quote.jobName}</p>
              <p className="text-xs text-muted-foreground">Location: {quote.city}, {quote.province} {quote.postalCode}</p>
              <p className="text-xs text-muted-foreground">Building: {quote.width} x {quote.length} x {quote.height} | {formatNumber(quote.sqft)} sqft | {formatNumber(quote.weight)} lbs</p>
              <br />
              <Row label="Base Steel Cost" value={quote.adjustedSteel} />
              <Row label="Engineering Fee" value={quote.engineering} />
              <Row label="Foundation Drawing" value={quote.foundation} />
              <br />
              <Row label="Updated Steel Total" value={quote.adjustedSteel} bold />
              <br />
              <Row label="Gutters" value={quote.gutters} />
              <Row label="Liners" value={quote.liners} />
              <Row label="Insulation" value={quote.insulation} />
              <Row label="Freight Estimate" value={quote.freight} />
              <br />
              <Row label="Combined Total" value={quote.combinedTotal} bold />
              <Row label="Updated $/sqft" value={quote.perSqft} />
              <br />
              <Row label={`Contingency (${quote.contingencyPct}%)`} value={quote.contingency} />
              <Row label="Total + Contingency" value={quote.combinedTotal + quote.contingency} />
              <br />
              <Row label={provinceTax.type === 'HST' ? 'HST' : 'GST'} value={quote.gstHst} />
              {quote.qst > 0 && <Row label="QST" value={quote.qst} />}
              <br />
              <Row label="Grand Total (incl tax)" value={quote.grandTotal} bold />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
