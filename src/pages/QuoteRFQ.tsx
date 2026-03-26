import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { PROVINCES } from '@/lib/calculations';
import { toast } from 'sonner';
import { Plus, Trash2, Send, Printer } from 'lucide-react';
import { PersonnelSelect } from '@/components/PersonnelSelect';

type WallLocation = 'LEW' | 'REW' | 'FSW' | 'BSW';
const WALL_LABELS: Record<WallLocation, string> = {
  LEW: 'Left End Wall',
  REW: 'Right End Wall',
  FSW: 'Front Side Wall',
  BSW: 'Back Side Wall',
};

interface Opening {
  id: string;
  wall: WallLocation;
  number: number;
  width: string;
  height: string;
  notes: string;
}

export default function QuoteRFQ() {
  const { deals } = useAppContext();
  const { getSalesReps } = useSettings();
  const salesReps = getSalesReps();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
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
  });

  // Auto-populate from URL params (from estimator)
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId) {
      setForm(f => ({
        ...f,
        jobId: searchParams.get('jobId') || f.jobId,
        clientName: searchParams.get('clientName') || f.clientName,
        clientId: searchParams.get('clientId') || f.clientId,
        salesRep: searchParams.get('salesRep') || f.salesRep,
        width: searchParams.get('width') || f.width,
        length: searchParams.get('length') || f.length,
        height: searchParams.get('height') || f.height,
        roofPitch: searchParams.get('pitch') ? `${searchParams.get('pitch')}:12` : f.roofPitch,
        province: searchParams.get('province') || f.province,
        city: searchParams.get('city') || f.city,
        postalCode: searchParams.get('postalCode') || f.postalCode,
      }));
    }
  }, [searchParams]);

  const [openings, setOpenings] = useState<Opening[]>([]);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  // Count openings per wall for auto-naming
  const getNextNumber = (wall: WallLocation) => {
    const wallOpenings = openings.filter(o => o.wall === wall);
    return wallOpenings.length + 1;
  };

  const addOpening = (wall: WallLocation) => {
    const num = getNextNumber(wall);
    setOpenings(prev => [...prev, {
      id: crypto.randomUUID(),
      wall,
      number: num,
      width: '',
      height: '',
      notes: '',
    }]);
  };

  const removeOpening = (id: string) => {
    setOpenings(prev => {
      const updated = prev.filter(o => o.id !== id);
      // Renumber per wall
      const renumbered = updated.map(o => {
        const sameWall = updated.filter(x => x.wall === o.wall);
        const idx = sameWall.indexOf(o);
        return { ...o, number: idx + 1 };
      });
      return renumbered;
    });
  };

  const updateOpening = (id: string, key: keyof Opening, val: string) => {
    setOpenings(prev => prev.map(o => o.id === id ? { ...o, [key]: val } : o));
  };

  const getOpeningName = (o: Opening) => `${o.wall} #${o.number}`;

  // Auto-populate from existing deal when client ID is entered
  const handleClientIdChange = (clientId: string) => {
    set('clientId', clientId);
    const deal = deals.find(d => d.clientId === clientId);
    if (deal) {
      setForm(f => ({
        ...f,
        clientId,
        clientName: deal.clientName,
        salesRep: deal.salesRep,
        estimator: deal.estimator,
      }));
      toast.info(`Client found: ${deal.clientName}`);
    }
  };

  const generateJobId = () => `CSB-${Date.now().toString(36).toUpperCase()}`;

  const handleSubmit = () => {
    if (!form.clientId.trim()) {
      toast.error('Client ID is required');
      return;
    }

    const jobId = form.jobId.trim() || generateJobId();

    // Quote saved without auto-creating deal — convert from Quote Log

    setForm(f => ({ ...f, jobId: jobId }));
    toast.success('Quote RFQ submitted');
  };

  const printRFQ = () => {
    const jobId = form.jobId || 'DRAFT';
    const win = window.open('', '_blank');
    if (!win) return;

    const openingsByWall = (['LEW', 'REW', 'FSW', 'BSW'] as WallLocation[]).map(wall => ({
      wall,
      label: WALL_LABELS[wall],
      items: openings.filter(o => o.wall === wall),
    }));

    win.document.write(`<html><head><title>Quote RFQ - ${jobId}</title><style>
      body{font-family:monospace;font-size:12px;padding:20px;max-width:700px;margin:0 auto;}
      .header{text-align:center;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:10px;}
      .section{margin-top:16px;border-top:1px solid #ccc;padding-top:10px;}
      .section h3{font-size:13px;margin:0 0 8px 0;text-transform:uppercase;}
      .row{display:flex;justify-content:space-between;margin:4px 0;}
      .label{color:#444;min-width:140px;}
      .opening{border:1px solid #ddd;padding:6px;margin:4px 0;border-radius:4px;}
      .opening-name{font-weight:bold;}
    </style></head><body>`);

    win.document.write(`<div class="header"><h2>QUOTE REQUEST FOR QUOTATION</h2><p>Job ID: ${jobId} | Client: ${form.clientName} (${form.clientId})</p></div>`);

    win.document.write(`<div class="section"><h3>Project Details</h3>
      <div class="row"><span class="label">Client ID:</span><span>${form.clientId}</span></div>
      <div class="row"><span class="label">Client Name:</span><span>${form.clientName}</span></div>
      <div class="row"><span class="label">Job Name:</span><span>${form.jobName}</span></div>
      <div class="row"><span class="label">Location:</span><span>${form.city}, ${form.province} ${form.postalCode}</span></div>
      <div class="row"><span class="label">Sales Rep:</span><span>${form.salesRep}</span></div>
      <div class="row"><span class="label">Estimator:</span><span>${form.estimator}</span></div>
    </div>`);

    win.document.write(`<div class="section"><h3>Building Dimensions</h3>
      <div class="row"><span class="label">Width:</span><span>${form.width} ft</span></div>
      <div class="row"><span class="label">Length:</span><span>${form.length} ft</span></div>
      <div class="row"><span class="label">Height:</span><span>${form.height} ft</span></div>
      <div class="row"><span class="label">Roof Pitch:</span><span>${form.roofPitch}</span></div>
    </div>`);

    win.document.write(`<div class="section"><h3>Openings</h3>`);
    for (const group of openingsByWall) {
      if (group.items.length === 0) continue;
      win.document.write(`<div style="margin:8px 0;"><strong>${group.label}</strong>`);
      for (const o of group.items) {
        win.document.write(`<div class="opening"><span class="opening-name">${getOpeningName(o)}</span> — ${o.width}' W × ${o.height}' H${o.notes ? ` — ${o.notes}` : ''}</div>`);
      }
      win.document.write(`</div>`);
    }
    win.document.write(`</div>`);

    win.document.write(`<div class="section"><h3>Accessories</h3>
      <div class="row"><span class="label">Gutters:</span><span>${form.gutters ? 'Yes' : 'No'}${form.gutterNotes ? ' — ' + form.gutterNotes : ''}</span></div>
      <div class="row"><span class="label">Liners:</span><span>${form.liners ? `Yes (${form.linerLocation || 'TBD'})` : 'No'}${form.linerNotes ? ' — ' + form.linerNotes : ''}</span></div>
    </div>`);

    win.document.write(`<div class="section"><h3>Insulation</h3>
      <div class="row"><span class="label">Required:</span><span>${form.insulationRequired ? 'Yes' : 'No'}</span></div>
      ${form.insulationRequired ? `<div class="row"><span class="label">Roof Grade:</span><span>${form.insulationRoofGrade}</span></div>
      <div class="row"><span class="label">Wall Grade:</span><span>${form.insulationWallGrade}</span></div>` : ''}
    </div>`);

    if (form.notes) {
      win.document.write(`<div class="section"><h3>Notes</h3><p style="white-space:pre-wrap;">${form.notes}</p></div>`);
    }

    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Quote RFQ</h2>
        <p className="text-sm text-muted-foreground mt-1">Submit a request for quotation with building specs, openings, and accessories</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Client & Job Info */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client & Job Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client ID <span className="text-destructive">*Required</span></Label>
                <Input className="input-blue mt-1" value={form.clientId} onChange={e => handleClientIdChange(e.target.value)} placeholder="6+ digit client ID" />
              </div>
              <div>
                <Label className="text-xs">Client Name</Label>
                <Input className="input-blue mt-1" value={form.clientName} onChange={e => set('clientName', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Job ID <span className="text-muted-foreground">(auto-gen if empty)</span></Label>
                <Input className="input-blue mt-1" value={form.jobId} onChange={e => set('jobId', e.target.value)} placeholder="Auto-generated" />
              </div>
              <div>
                <Label className="text-xs">Job Name</Label>
                <Input className="input-blue mt-1" value={form.jobName} onChange={e => set('jobName', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Sales Rep</Label>
                <PersonnelSelect value={form.salesRep} onValueChange={v => set('salesRep', v)} role="sales_rep" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Estimator</Label>
                <PersonnelSelect value={form.estimator} onValueChange={v => set('estimator', v)} role="estimator" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location</h3>
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
            <div className="col-span-3">
              <Label className="text-xs">Address</Label>
              <Input className="input-blue mt-1" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>

          {/* Building Dimensions */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Building Dimensions</h3>
            <div className="grid grid-cols-4 gap-3">
              <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" type="number" value={form.width} onChange={e => set('width', e.target.value)} /></div>
              <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" type="number" value={form.length} onChange={e => set('length', e.target.value)} /></div>
              <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" type="number" value={form.height} onChange={e => set('height', e.target.value)} /></div>
              <div><Label className="text-xs">Roof Pitch</Label><Input className="input-blue mt-1" value={form.roofPitch} onChange={e => set('roofPitch', e.target.value)} placeholder="e.g. 1:12" /></div>
            </div>
          </div>

          {/* Openings */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Openings</h3>

            {(['LEW', 'REW', 'FSW', 'BSW'] as WallLocation[]).map(wall => {
              const wallOpenings = openings.filter(o => o.wall === wall);
              return (
                <div key={wall} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{WALL_LABELS[wall]} ({wall})</Label>
                    <Button variant="outline" size="sm" onClick={() => addOpening(wall)} className="h-6 text-xs px-2">
                      <Plus className="h-3 w-3 mr-1" />Add Opening
                    </Button>
                  </div>
                  {wallOpenings.map(o => (
                    <div key={o.id} className="bg-muted rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary">{getOpeningName(o)}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeOpening(o.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Width (ft)</Label>
                          <Input className="h-7 text-xs" type="number" value={o.width} onChange={e => updateOpening(o.id, 'width', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[10px]">Height (ft)</Label>
                          <Input className="h-7 text-xs" type="number" value={o.height} onChange={e => updateOpening(o.id, 'height', e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px]">Notes / Description</Label>
                        <Textarea className="text-xs h-14 mt-0.5" value={o.notes} onChange={e => updateOpening(o.id, 'notes', e.target.value)} placeholder={`Details for ${getOpeningName(o)}...`} />
                      </div>
                    </div>
                  ))}
                  {wallOpenings.length === 0 && <p className="text-[10px] text-muted-foreground ml-1">No openings added</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Gutters & Liners */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gutters & Liners</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Gutters</Label>
                <Switch checked={form.gutters} onCheckedChange={v => set('gutters', v)} />
              </div>
              {form.gutters && (
                <div>
                  <Label className="text-[10px]">Gutter specifics</Label>
                  <Textarea className="text-xs h-16" value={form.gutterNotes} onChange={e => set('gutterNotes', e.target.value)} placeholder="Gutter specifications if required..." />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Liners</Label>
                <Switch checked={form.liners} onCheckedChange={v => set('liners', v)} />
              </div>
              {form.liners && (
                <>
                  <div>
                    <Label className="text-[10px]">Location</Label>
                    <Select value={form.linerLocation} onValueChange={v => set('linerLocation', v)}>
                      <SelectTrigger className="input-blue mt-1 h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roof">Roof</SelectItem>
                        <SelectItem value="wall">Wall</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Liner specifics</Label>
                    <Textarea className="text-xs h-16" value={form.linerNotes} onChange={e => set('linerNotes', e.target.value)} placeholder="Liner specifications if required..." />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Insulation */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Insulation</h3>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Insulation Required</Label>
              <Switch checked={form.insulationRequired} onCheckedChange={v => set('insulationRequired', v)} />
            </div>
            {form.insulationRequired && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Roof R-Value</Label>
                  <Input className="input-blue mt-1" value={form.insulationRoofGrade} onChange={e => set('insulationRoofGrade', e.target.value)} placeholder="e.g. R20" />
                </div>
                <div>
                  <Label className="text-xs">Wall R-Value</Label>
                  <Input className="input-blue mt-1" value={form.insulationWallGrade} onChange={e => set('insulationWallGrade', e.target.value)} placeholder="e.g. R20" />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quote Details / Notes</h3>
            <Textarea className="text-xs min-h-[120px]" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional details, special requirements, notes for estimator..." />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={printRFQ} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />Print RFQ
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              <Send className="h-4 w-4 mr-2" />Submit RFQ
            </Button>
          </div>

          {/* Summary */}
          {openings.length > 0 && (
            <div className="bg-muted rounded-md p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground">Opening Summary</p>
              {openings.map(o => (
                <div key={o.id} className="flex justify-between">
                  <span className="font-mono">{getOpeningName(o)}</span>
                  <span>{o.width}' × {o.height}'{o.notes ? ` — ${o.notes.substring(0, 30)}...` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
