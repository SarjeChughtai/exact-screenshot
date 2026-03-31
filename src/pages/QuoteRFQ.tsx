import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobIdSelect } from '@/components/JobIdSelect';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { PROVINCES } from '@/lib/calculations';
import { notifyUsers } from '@/lib/workflowNotifications';
import { toast } from 'sonner';
import { Plus, Trash2, Send, Printer } from 'lucide-react';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { ClientSelect } from '@/components/ClientSelect';
import type { Estimate, Quote } from '@/types';
import { saveDocumentPdf } from '@/lib/documentPdf';
import { WALL_LABELS, createOpening, renumberOpenings, type RFQOpening, type WallLocation } from '@/lib/rfqShared';

const INITIAL_FORM = {
  clientId: '',
  jobId: '',
  jobName: '',
  clientName: '',
  province: 'ON',
  city: '',
  address: '',
  postalCode: '',
  width: '',
  length: '',
  height: '',
  roofPitch: '',
  salesRep: '',
  estimator: '',
  gutters: false,
  gutterNotes: '',
  liners: false,
  linerLocation: '' as '' | 'roof' | 'walls' | 'roof_walls',
  linerNotes: '',
  insulationRequired: false,
  insulationRoofGrade: '',
  insulationWallGrade: '',
  notes: '',
};

function mapEstimateToForm(estimate: Estimate) {
  return {
    ...INITIAL_FORM,
    clientId: estimate.clientId,
    clientName: estimate.clientName,
    jobName: `${estimate.width}x${estimate.length} steel building`,
    province: estimate.province,
    width: String(estimate.width),
    length: String(estimate.length),
    height: String(estimate.height),
    roofPitch: `${estimate.pitch}:12`,
    salesRep: estimate.salesRep,
  };
}

function mapQuoteToForm(quote: Quote) {
  const payload = (quote.payload || {}) as Record<string, any>;
  return {
    ...INITIAL_FORM,
    clientId: quote.clientId,
    jobId: quote.jobId,
    jobName: quote.jobName,
    clientName: quote.clientName,
    province: quote.province,
    city: quote.city,
    address: quote.address,
    postalCode: quote.postalCode,
    width: String(quote.width || ''),
    length: String(quote.length || ''),
    height: String(quote.height || ''),
    roofPitch: payload.roofPitch || '',
    salesRep: quote.salesRep,
    estimator: quote.estimator,
    gutters: Boolean(payload.gutters),
    gutterNotes: payload.gutterNotes || '',
    liners: Boolean(payload.liners),
    linerLocation: payload.linerLocation || '',
    linerNotes: payload.linerNotes || '',
    insulationRequired: Boolean(payload.insulationRequired),
    insulationRoofGrade: payload.insulationRoofGrade || '',
    insulationWallGrade: payload.insulationWallGrade || '',
    notes: payload.notes || '',
  };
}

export default function QuoteRFQ() {
  const [searchParams] = useSearchParams();
  const { deals, quotes, estimates, addQuote, updateQuote, allocateJobId } = useAppContext();
  const { settings } = useSettings();
  const [form, setForm] = useState(INITIAL_FORM);
  const [openings, setOpenings] = useState<RFQOpening[]>([]);
  const [selectedEstimateId, setSelectedEstimateId] = useState(searchParams.get('estimateId') || '');

  const editingQuoteId = searchParams.get('quoteId');
  const existingQuote = useMemo(
    () => quotes.find(quote => quote.id === editingQuoteId),
    [editingQuoteId, quotes],
  );

  const estimateOptions = useMemo(
    () => estimates.map(estimate => ({ id: estimate.id, label: `${estimate.label} - ${estimate.clientName}` })),
    [estimates],
  );

  useEffect(() => {
    if (existingQuote) {
      setForm(mapQuoteToForm(existingQuote));
      const payload = (existingQuote.payload || {}) as Record<string, any>;
      setOpenings(Array.isArray(payload.openings) ? payload.openings : []);
      return;
    }

    const estimateId = searchParams.get('estimateId');
    if (!estimateId) return;
    const estimate = estimates.find(item => item.id === estimateId);
    if (!estimate) return;
    setForm(current => ({ ...current, ...mapEstimateToForm(estimate) }));
    setSelectedEstimateId(estimateId);
  }, [existingQuote, estimates, searchParams]);

  const set = (key: keyof typeof INITIAL_FORM, value: string | boolean) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleClientSelect = ({ clientId, clientName }: { clientId: string; clientName: string }) => {
    setForm(current => ({ ...current, clientId, clientName }));
  };

  const handleEstimateImport = (estimateId: string) => {
    setSelectedEstimateId(estimateId);
    const estimate = estimates.find(item => item.id === estimateId);
    if (!estimate) return;
    setForm(current => ({ ...current, ...mapEstimateToForm(estimate) }));
    toast.success(`Imported ${estimate.label}`);
  };

  const addOpening = (wall: WallLocation) => {
    setOpenings(current => [...current, createOpening(wall, current)]);
  };

  const updateOpening = (id: string, key: keyof Opening, value: string) => {
    setOpenings(current => current.map(opening => opening.id === id ? { ...opening, [key]: value } : opening));
  };

  const removeOpening = (id: string) => {
    setOpenings(current => renumberOpenings(current.filter(opening => opening.id !== id)));
  };

  const getOpeningName = (opening: Opening) => `${opening.wall} #${opening.number}`;

  const handleSubmit = async () => {
    if (!form.clientId.trim()) {
      toast.error('Client ID is required');
      return;
    }

    const width = parseFloat(form.width) || 0;
    const length = parseFloat(form.length) || 0;
    const height = parseFloat(form.height) || 0;
    if (!width || !length || !height) {
      toast.error('Building dimensions are required');
      return;
    }

    const jobId = form.jobId || await allocateJobId();
    if (!form.jobId) set('jobId', jobId);

    const payload = {
      roofPitch: form.roofPitch,
      openings,
      gutters: form.gutters,
      gutterNotes: form.gutterNotes,
      liners: form.liners,
      linerLocation: form.linerLocation,
      linerNotes: form.linerNotes,
      insulationRequired: form.insulationRequired,
      insulationRoofGrade: form.insulationRoofGrade,
      insulationWallGrade: form.insulationWallGrade,
      notes: form.notes,
      importedEstimateId: selectedEstimateId || null,
    };

    const document: Quote = {
      id: existingQuote?.id || crypto.randomUUID(),
      date: existingQuote?.date || new Date().toISOString().split('T')[0],
      jobId,
      jobName: form.jobName || `${width}x${length} steel building`,
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
      sqft: width * length,
      weight: existingQuote?.weight || 0,
      baseSteelCost: existingQuote?.baseSteelCost || 0,
      steelAfter12: existingQuote?.steelAfter12 || 0,
      markup: existingQuote?.markup || 0,
      adjustedSteel: existingQuote?.adjustedSteel || 0,
      engineering: existingQuote?.engineering || 0,
      foundation: existingQuote?.foundation || 0,
      foundationType: existingQuote?.foundationType || 'slab',
      gutters: existingQuote?.gutters || 0,
      liners: existingQuote?.liners || 0,
      insulation: existingQuote?.insulation || 0,
      insulationGrade: existingQuote?.insulationGrade || '',
      freight: existingQuote?.freight || 0,
      combinedTotal: existingQuote?.combinedTotal || 0,
      perSqft: existingQuote?.perSqft || 0,
      perLb: existingQuote?.perLb || 0,
      contingencyPct: existingQuote?.contingencyPct || 0,
      contingency: existingQuote?.contingency || 0,
      gstHst: existingQuote?.gstHst || 0,
      qst: existingQuote?.qst || 0,
      grandTotal: existingQuote?.grandTotal || 0,
      status: 'Sent',
      documentType: existingQuote?.documentType === 'dealer_rfq' ? 'dealer_rfq' : 'rfq',
      workflowStatus: 'estimate_needed',
      sourceDocumentId: existingQuote?.sourceDocumentId || null,
      payload,
    };

    if (existingQuote) {
      await updateQuote(existingQuote.id, { ...document, updatedAt: new Date().toISOString() });
      const pdf = await saveDocumentPdf(document);
      await updateQuote(existingQuote.id, {
        pdfStoragePath: pdf.storagePath,
        pdfFileName: pdf.fileName,
        updatedAt: new Date().toISOString(),
      });
      toast.success('RFQ updated');
      return;
    }

    await addQuote(document);
    const pdf = await saveDocumentPdf(document);
    await updateQuote(document.id, {
      pdfStoragePath: pdf.storagePath,
      pdfFileName: pdf.fileName,
      updatedAt: new Date().toISOString(),
    });

    const estimatorUserIds = form.estimator.trim()
      ? settings.personnel
          .filter(person => person.role === 'estimator' && person.name.trim().toLowerCase() === form.estimator.trim().toLowerCase())
          .map(person => person.id)
      : settings.personnel.filter(person => person.role === 'estimator').map(person => person.id);
    await notifyUsers({
      userIds: estimatorUserIds,
      title: 'New RFQ Submitted',
      message: `${form.clientName || 'A client'} RFQ ${jobId} is ready for estimating.`,
      link: '/quote-log',
    });
    toast.success('RFQ submitted');
  };

  const printRFQ = () => {
    const jobId = form.jobId || 'DRAFT';
    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`<html><head><title>RFQ - ${jobId}</title><style>
      body{font-family:monospace;font-size:12px;padding:20px;max-width:800px;margin:0 auto;}
      .header{text-align:center;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:10px;}
      .section{margin-top:16px;border-top:1px solid #ccc;padding-top:10px;}
      .section h3{font-size:13px;margin:0 0 8px 0;text-transform:uppercase;}
      .row{display:flex;justify-content:space-between;margin:4px 0;}
      .opening{border:1px solid #ddd;padding:6px;margin:4px 0;border-radius:4px;}
    </style></head><body>`);
    win.document.write(`<div class="header"><h2>REQUEST FOR QUOTE</h2><p>Job ID: ${jobId} | Client: ${form.clientName} (${form.clientId})</p></div>`);
    win.document.write(`<div class="section"><h3>Project Details</h3>
      <div class="row"><span>Client:</span><span>${form.clientName}</span></div>
      <div class="row"><span>Client ID:</span><span>${form.clientId}</span></div>
      <div class="row"><span>Job Name:</span><span>${form.jobName}</span></div>
      <div class="row"><span>Location:</span><span>${form.city}, ${form.province} ${form.postalCode}</span></div>
      <div class="row"><span>Sales Rep:</span><span>${form.salesRep}</span></div>
      <div class="row"><span>Estimator:</span><span>${form.estimator}</span></div>
    </div>`);
    win.document.write(`<div class="section"><h3>Building</h3>
      <div class="row"><span>Dimensions:</span><span>${form.width} x ${form.length} x ${form.height}</span></div>
      <div class="row"><span>Roof Pitch:</span><span>${form.roofPitch || 'Not set'}</span></div>
    </div>`);
    win.document.write('<div class="section"><h3>Openings</h3>');
    openings.forEach(opening => {
      win.document.write(`<div class="opening">${getOpeningName(opening)} - ${opening.width} x ${opening.height}${opening.notes ? ` - ${opening.notes}` : ''}</div>`);
    });
    if (openings.length === 0) win.document.write('<p>No openings added</p>');
    win.document.write('</div>');
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Quote RFQ</h2>
        <p className="text-sm text-muted-foreground mt-1">Submit RFQs as tracked documents without creating deals up front.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Import Source</h3>
            <div>
              <Label className="text-xs">Saved Estimate</Label>
              <Select value={selectedEstimateId} onValueChange={handleEstimateImport}>
                <SelectTrigger className="input-blue mt-1"><SelectValue placeholder="Import an estimate" /></SelectTrigger>
                <SelectContent>
                  {estimateOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client & Job Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client Name</Label>
                <ClientSelect mode="name" valueId={form.clientId} valueName={form.clientName} onSelect={handleClientSelect} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Client ID</Label>
                <ClientSelect mode="id" valueId={form.clientId} valueName={form.clientName} onSelect={handleClientSelect} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Job ID</Label>
                <JobIdSelect value={form.jobId} onValueChange={value => set('jobId', value)} deals={deals} allowedStates={['rfq']} placeholder="Auto-generated" />
              </div>
              <div>
                <Label className="text-xs">Job Name</Label>
                <Input className="input-blue mt-1" value={form.jobName} onChange={event => set('jobName', event.target.value)} />
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
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location</h3>
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
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Building Dimensions</h3>
            <div className="grid grid-cols-4 gap-3">
              <div><Label className="text-xs">Width</Label><Input className="input-blue mt-1" type="number" value={form.width} onChange={event => set('width', event.target.value)} /></div>
              <div><Label className="text-xs">Length</Label><Input className="input-blue mt-1" type="number" value={form.length} onChange={event => set('length', event.target.value)} /></div>
              <div><Label className="text-xs">Height</Label><Input className="input-blue mt-1" type="number" value={form.height} onChange={event => set('height', event.target.value)} /></div>
              <div><Label className="text-xs">Roof Pitch</Label><Input className="input-blue mt-1" value={form.roofPitch} onChange={event => set('roofPitch', event.target.value)} placeholder="e.g. 1:12" /></div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Openings</h3>
            {(['LEW', 'REW', 'FSW', 'BSW'] as WallLocation[]).map(wall => {
              const wallOpenings = openings.filter(opening => opening.wall === wall);
              return (
                <div key={wall} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{WALL_LABELS[wall]}</Label>
                    <Button variant="outline" size="sm" onClick={() => addOpening(wall)} className="h-6 text-xs px-2">
                      <Plus className="h-3 w-3 mr-1" />Add Opening
                    </Button>
                  </div>
                  {wallOpenings.map(opening => (
                    <div key={opening.id} className="bg-muted rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary">{getOpeningName(opening)}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeOpening(opening.id)} className="h-6 w-6 p-0 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-[10px]">Width</Label><Input className="h-7 text-xs" type="number" value={opening.width} onChange={event => updateOpening(opening.id, 'width', event.target.value)} /></div>
                        <div><Label className="text-[10px]">Height</Label><Input className="h-7 text-xs" type="number" value={opening.height} onChange={event => updateOpening(opening.id, 'height', event.target.value)} /></div>
                      </div>
                      <div><Label className="text-[10px]">Notes</Label><Textarea className="text-xs h-14 mt-0.5" value={opening.notes} onChange={event => updateOpening(opening.id, 'notes', event.target.value)} /></div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accessories & Notes</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Gutters</Label>
                <Switch checked={form.gutters} onCheckedChange={value => set('gutters', value)} />
              </div>
              {form.gutters && <div><Label className="text-xs">Gutter Notes</Label><Textarea className="text-xs mt-1" value={form.gutterNotes} onChange={event => set('gutterNotes', event.target.value)} /></div>}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Liners</Label>
                <Switch checked={form.liners} onCheckedChange={value => set('liners', value)} />
              </div>
              {form.liners && (
                <>
                  <div>
                    <Label className="text-xs">Liner Location</Label>
                    <Select value={form.linerLocation} onValueChange={value => set('linerLocation', value)}>
                      <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roof">Roof</SelectItem>
                        <SelectItem value="walls">Walls</SelectItem>
                        <SelectItem value="roof_walls">Roof + Walls</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Liner Notes</Label><Textarea className="text-xs mt-1" value={form.linerNotes} onChange={event => set('linerNotes', event.target.value)} /></div>
                </>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Insulation Required</Label>
                <Switch checked={form.insulationRequired} onCheckedChange={value => set('insulationRequired', value)} />
              </div>
              {form.insulationRequired && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Roof Grade</Label><Input className="input-blue mt-1" value={form.insulationRoofGrade} onChange={event => set('insulationRoofGrade', event.target.value)} /></div>
                  <div><Label className="text-xs">Wall Grade</Label><Input className="input-blue mt-1" value={form.insulationWallGrade} onChange={event => set('insulationWallGrade', event.target.value)} /></div>
                </div>
              )}
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea className="text-xs min-h-[120px] mt-1" value={form.notes} onChange={event => set('notes', event.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</h3>
            <Button onClick={() => void handleSubmit()} className="w-full">
              <Send className="h-4 w-4 mr-2" />{existingQuote ? 'Update RFQ' : 'Submit RFQ'}
            </Button>
            <Button variant="outline" onClick={printRFQ} className="w-full">
              <Printer className="h-4 w-4 mr-2" />Print RFQ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
