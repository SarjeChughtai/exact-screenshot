import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Send, Store } from 'lucide-react';
import { PROVINCES } from '@/lib/calculations';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';
import { saveDocumentPdf } from '@/lib/documentPdf';
import { notifyUsers } from '@/lib/workflowNotifications';
import { RFQOpeningsSection } from '@/components/rfq/RFQOpeningsSection';
import { createOpening, renumberOpenings, type RFQOpening, type WallLocation } from '@/lib/rfqShared';

const INITIAL_FORM = {
  clientName: '',
  contactEmail: '',
  contactPhone: '',
  province: 'ON',
  city: '',
  address: '',
  postalCode: '',
  buildingStyle: 'Symmetrical',
  width: '',
  length: '',
  height: '14',
  lowSide: '',
  highSide: '',
  roofPitch: '1:12',
  gutters: 'none',
  guttersPerSide: '',
  guttersSpacing: '',
  liners: 'none',
  insulationRequired: false,
  insulationRoofGrade: '',
  insulationWallGrade: '',
  notes: '',
};

export default function DealerRFQ() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { addQuote, updateQuote, allocateJobId } = useAppContext();
  const dealerProfile = settings.dealers?.find(dealer => dealer.userId === user?.id);

  const [form, setForm] = useState({
    ...INITIAL_FORM,
    contactEmail: dealerProfile?.contactEmail || user?.email || '',
    contactPhone: dealerProfile?.contactPhone || '',
  });
  const [openings, setOpenings] = useState<RFQOpening[]>([]);

  useEffect(() => {
    if (!dealerProfile) return;
    setForm(current => ({
      ...current,
      contactEmail: current.contactEmail || dealerProfile.contactEmail,
      contactPhone: current.contactPhone || dealerProfile.contactPhone,
    }));
  }, [dealerProfile]);

  useEffect(() => {
    if (form.buildingStyle !== 'Single Slope' || !form.width || !form.lowSide || !form.highSide) return;
    const width = parseFloat(form.width);
    const lowSide = parseFloat(form.lowSide);
    const highSide = parseFloat(form.highSide);
    if (!width || highSide <= lowSide) return;
    const rise = highSide - lowSide;
    const pitch = (rise / width) * 12;
    setForm(current => ({ ...current, roofPitch: `${pitch.toFixed(1)}:12` }));
  }, [form.buildingStyle, form.width, form.lowSide, form.highSide]);

  const set = (key: keyof typeof INITIAL_FORM, value: string | boolean) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const addOpening = (wall: WallLocation) => {
    setOpenings(current => [...current, createOpening(wall, current)]);
  };

  const updateOpening = (id: string, key: keyof RFQOpening, value: string) => {
    setOpenings(current => current.map(opening => opening.id === id ? { ...opening, [key]: value } : opening));
  };

  const removeOpening = (id: string) => {
    setOpenings(current => renumberOpenings(current.filter(opening => opening.id !== id)));
  };

  const handleSubmit = async () => {
    if (!form.clientName.trim()) {
      toast.error(t('dealerRfq.toast.clientNameRequired'));
      return;
    }
    if (!form.width || !form.length) {
      toast.error(t('dealerRfq.toast.dimensionsRequired'));
      return;
    }

    const width = parseFloat(form.width) || 0;
    const length = parseFloat(form.length) || 0;
    const height = parseFloat(form.height) || parseFloat(form.highSide) || 14;
    const jobId = await allocateJobId();

    const quote = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      jobId,
      jobName: `${width}x${length} dealer RFQ`,
      clientName: form.clientName,
      clientId: dealerProfile?.clientId || '',
      salesRep: '',
      estimator: '',
      province: form.province,
      city: form.city,
      address: form.address,
      postalCode: form.postalCode,
      width,
      length,
      height,
      sqft: width * length,
      weight: 0,
      baseSteelCost: 0,
      steelAfter12: 0,
      markup: 0,
      adjustedSteel: 0,
      engineering: 0,
      foundation: 0,
      foundationType: 'slab',
      gutters: 0,
      liners: 0,
      insulation: 0,
      insulationGrade: '',
      freight: 0,
      combinedTotal: 0,
      perSqft: 0,
      perLb: 0,
      contingencyPct: 0,
      contingency: 0,
      gstHst: 0,
      qst: 0,
      grandTotal: 0,
      status: 'Sent',
      documentType: 'dealer_rfq',
      workflowStatus: 'submitted',
      payload: {
        ...form,
        openings,
        dealerBusinessName: dealerProfile?.businessName || '',
        dealerClientId: dealerProfile?.clientId || '',
      },
    };

    await addQuote(quote);
    const pdf = await saveDocumentPdf(quote);
    await updateQuote(quote.id, {
      pdfStoragePath: pdf.storagePath,
      pdfFileName: pdf.fileName,
      updatedAt: new Date().toISOString(),
    });

    await notifyUsers({
      userIds: settings.personnel.filter(person => person.role === 'estimator').map(person => person.id),
      title: 'New Dealer RFQ Submitted',
      message: `${form.clientName || dealerProfile?.businessName || 'Dealer'} submitted RFQ ${jobId}.`,
      link: '/quote-log',
    });

    toast.success(t('dealerRfq.toast.success'));
    setForm({
      ...INITIAL_FORM,
      contactEmail: dealerProfile?.contactEmail || user?.email || '',
      contactPhone: dealerProfile?.contactPhone || '',
    });
    setOpenings([]);
  };

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" /> {t('dealerRfq.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('dealerRfq.subtitle')}</p>
      </div>

      <div className="space-y-5">
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dealerRfq.clientInfo')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">{t('dealerRfq.clientName')}</Label><Input className="input-blue mt-1" value={form.clientName} onChange={event => set('clientName', event.target.value)} placeholder={t('dealerRfq.clientNamePlaceholder')} /></div>
            <div><Label className="text-xs">{t('dealerRfq.contactEmail')}</Label><Input className="input-blue mt-1" type="email" value={form.contactEmail} onChange={event => set('contactEmail', event.target.value)} /></div>
            <div><Label className="text-xs">{t('dealerRfq.contactPhone')}</Label><Input className="input-blue mt-1" value={form.contactPhone} onChange={event => set('contactPhone', event.target.value)} /></div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">{t('dealerRfq.clientIdNote')} <span className="font-mono text-foreground font-semibold px-2 py-0.5 bg-muted rounded">{dealerProfile?.clientId || 'N/A'}</span></p>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dealerRfq.location')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('dealerRfq.province')}</Label>
              <Select value={form.province} onValueChange={value => set('province', value)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(province => <SelectItem key={province.code} value={province.code}>{province.code} - {province.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t('dealerRfq.city')}</Label><Input className="input-blue mt-1" value={form.city} onChange={event => set('city', event.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">{t('dealerRfq.address')}</Label><Input className="input-blue mt-1" value={form.address} onChange={event => set('address', event.target.value)} /></div>
            <div><Label className="text-xs">{t('dealerRfq.postalCode')}</Label><Input className="input-blue mt-1" value={form.postalCode} onChange={event => set('postalCode', event.target.value)} /></div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dealerRfq.buildingDetails')}</h3>
          <div className="mb-4">
            <Label className="text-xs">{t('dealerRfq.buildingStyle')}</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" checked={form.buildingStyle === 'Symmetrical'} onChange={() => set('buildingStyle', 'Symmetrical')} /> {t('dealerRfq.symmetrical')}
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" checked={form.buildingStyle === 'Single Slope'} onChange={() => set('buildingStyle', 'Single Slope')} /> {t('dealerRfq.singleSlope')}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div><Label className="text-xs">{t('dealerRfq.width')}</Label><Input className="input-blue mt-1" type="number" value={form.width} onChange={event => set('width', event.target.value)} /></div>
            <div><Label className="text-xs">{t('dealerRfq.length')}</Label><Input className="input-blue mt-1" type="number" value={form.length} onChange={event => set('length', event.target.value)} /></div>
            {form.buildingStyle === 'Symmetrical' ? (
              <>
                <div><Label className="text-xs">{t('dealerRfq.height')}</Label><Input className="input-blue mt-1" type="number" value={form.height} onChange={event => set('height', event.target.value)} /></div>
                <div><Label className="text-xs">{t('dealerRfq.roofPitch')}</Label><Input className="input-blue mt-1" value={form.roofPitch} onChange={event => set('roofPitch', event.target.value)} placeholder="1:12" /></div>
              </>
            ) : (
              <>
                <div><Label className="text-xs">{t('dealerRfq.lowSide')}</Label><Input className="input-blue mt-1" type="number" value={form.lowSide} onChange={event => set('lowSide', event.target.value)} /></div>
                <div><Label className="text-xs">{t('dealerRfq.highSide')}</Label><Input className="input-blue mt-1" type="number" value={form.highSide} onChange={event => set('highSide', event.target.value)} /></div>
                <div className="col-span-4 mt-2">
                  <Label className="text-xs block">{t('dealerRfq.calculatedPitch')}</Label>
                  <Input className="input-blue mt-1 bg-muted max-w-[150px]" readOnly value={form.roofPitch} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dealerRfq.accessories')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">{t('dealerRfq.liners')}</Label>
              <Select value={form.liners} onValueChange={value => set('liners', value)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('dealerRfq.linerOptions.none')}</SelectItem>
                  <SelectItem value="roof">{t('dealerRfq.linerOptions.roof')}</SelectItem>
                  <SelectItem value="walls">{t('dealerRfq.linerOptions.walls')}</SelectItem>
                  <SelectItem value="roof_walls">{t('dealerRfq.linerOptions.roofWalls')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">{t('dealerRfq.gutters')}</Label>
              <Select value={form.gutters} onValueChange={value => set('gutters', value)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('dealerRfq.noGutters')}</SelectItem>
                  <SelectItem value="per_side">{t('dealerRfq.specifyPerSide')}</SelectItem>
                  <SelectItem value="spacing">{t('dealerRfq.specifySpacing')}</SelectItem>
                </SelectContent>
              </Select>
              {form.gutters === 'per_side' && <div className="mt-3"><Label className="text-xs text-muted-foreground">{t('dealerRfq.downspoutsPerSide')}</Label><Input className="input-blue mt-1 h-8" type="number" value={form.guttersPerSide} onChange={event => set('guttersPerSide', event.target.value)} /></div>}
              {form.gutters === 'spacing' && <div className="mt-3"><Label className="text-xs text-muted-foreground">{t('dealerRfq.downspoutsSpacing')}</Label><Input className="input-blue mt-1 h-8" type="number" value={form.guttersSpacing} onChange={event => set('guttersSpacing', event.target.value)} /></div>}
            </div>
          </div>

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
        </div>

        <RFQOpeningsSection
          title="Wall Openings"
          subtitle="Track framed openings by wall for design reference."
          openings={openings}
          onAddOpening={addOpening}
          onUpdateOpening={updateOpening}
          onRemoveOpening={removeOpening}
          notesPlaceholder="Door, window, framed opening..."
        />

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dealerRfq.notes')}</h3>
          <Textarea className="text-xs min-h-[100px]" value={form.notes} onChange={event => set('notes', event.target.value)} placeholder={t('dealerRfq.notesPlaceholder')} />
        </div>

        <Button onClick={() => void handleSubmit()} className="w-full" size="lg">
          <Send className="h-4 w-4 mr-2" />{t('dealerRfq.submitRfq')}
        </Button>
      </div>
    </div>
  );
}
