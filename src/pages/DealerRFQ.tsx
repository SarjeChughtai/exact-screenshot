import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, Store } from 'lucide-react';
import { PROVINCES } from '@/lib/calculations';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';
import { useTranslation } from 'react-i18next';

export default function DealerRFQ() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { hasRole } = useRoles();
  const navigate = useNavigate();
  
  const dealerProfile = settings.dealers?.find(d => d.userId === user?.id);

  useEffect(() => {
    if (user && hasRole('dealer') && !dealerProfile) {
      navigate('/settings');
    }
  }, [user, hasRole, dealerProfile, navigate]);

  const [form, setForm] = useState({
    clientName: '', 
    contactEmail: dealerProfile?.contactEmail || user?.email || '', 
    contactPhone: dealerProfile?.contactPhone || '',
    province: 'ON', city: '', address: '', postalCode: '',
    buildingStyle: 'Symmetrical',
    width: '', length: '', height: '14', 
    lowSide: '', highSide: '',
    roofPitch: '1:12',
    gutters: 'none',
    guttersPerSide: '',
    guttersSpacing: '',
    liners: 'none', insulationRequired: false,
    insulationRoofGrade: '', insulationWallGrade: '',
    notes: '',
  });

  // Keep contact email and phone updated if profile loads late
  useEffect(() => {
    if (dealerProfile) {
      setForm(f => ({
        ...f,
        contactEmail: f.contactEmail || dealerProfile.contactEmail,
        contactPhone: f.contactPhone || dealerProfile.contactPhone,
      }));
    }
  }, [dealerProfile]);

  useEffect(() => {
    if (form.buildingStyle === 'Single Slope' && form.width && form.lowSide && form.highSide) {
      const w = parseFloat(form.width);
      const low = parseFloat(form.lowSide);
      const high = parseFloat(form.highSide);
      if (w > 0 && high > low) {
        const rise = high - low;
        const x = (rise / w) * 12;
        setForm(f => ({ ...f, roofPitch: `${x.toFixed(1)}:12` }));
      }
    }
  }, [form.buildingStyle, form.width, form.lowSide, form.highSide]);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    if (!form.clientName.trim()) { toast.error(t('dealerRfq.toast.clientNameRequired')); return; }
    if (!form.width || !form.length) { toast.error(t('dealerRfq.toast.dimensionsRequired')); return; }

    const requests = JSON.parse(localStorage.getItem('csb_dealer_requests') || '[]');
    requests.push({
      id: crypto.randomUUID(),
      ...form,
      clientId: dealerProfile?.clientId || 'UNKNOWN',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('csb_dealer_requests', JSON.stringify(requests));

    toast.success(t('dealerRfq.toast.success'));
    setForm({
      clientName: '', 
      contactEmail: dealerProfile?.contactEmail || user?.email || '', 
      contactPhone: dealerProfile?.contactPhone || '',
      province: 'ON', city: '', address: '', postalCode: '',
      buildingStyle: 'Symmetrical',
      width: '', length: '', height: '14', 
      lowSide: '', highSide: '',
      roofPitch: '1:12',
      gutters: 'none',
      guttersPerSide: '',
      guttersSpacing: '',
      liners: 'none', insulationRequired: false,
      insulationRoofGrade: '', insulationWallGrade: '', notes: '',
    });
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
            <div className="col-span-2"><Label className="text-xs">{t('dealerRfq.clientName')}</Label><Input className="input-blue mt-1" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder={t('dealerRfq.clientNamePlaceholder')} /></div>
            <div><Label className="text-xs">{t('dealerRfq.contactEmail')}</Label><Input className="input-blue mt-1" type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></div>
            <div><Label className="text-xs">{t('dealerRfq.contactPhone')}</Label><Input className="input-blue mt-1" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} /></div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">{t('dealerRfq.clientIdNote')} <span className="font-mono text-foreground font-semibold px-2 py-0.5 bg-muted rounded">{dealerProfile?.clientId || 'N/A'}</span></p>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dealerRfq.location')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('dealerRfq.province')}</Label>
              <Select value={form.province} onValueChange={v => set('province', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.code} &mdash; {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t('dealerRfq.city')}</Label><Input className="input-blue mt-1" value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">{t('dealerRfq.address')}</Label><Input className="input-blue mt-1" value={form.address} onChange={e => set('address', e.target.value)} /></div>
            <div><Label className="text-xs">{t('dealerRfq.postalCode')}</Label><Input className="input-blue mt-1" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} /></div>
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
            <div><Label className="text-xs">{t('dealerRfq.width')}</Label><Input className="input-blue mt-1" type="number" value={form.width} onChange={e => set('width', e.target.value)} /></div>
            <div><Label className="text-xs">{t('dealerRfq.length')}</Label><Input className="input-blue mt-1" type="number" value={form.length} onChange={e => set('length', e.target.value)} /></div>
            
            {form.buildingStyle === 'Symmetrical' ? (
              <>
                <div><Label className="text-xs">{t('dealerRfq.height')}</Label><Input className="input-blue mt-1" type="number" value={form.height} onChange={e => set('height', e.target.value)} /></div>
                <div><Label className="text-xs">{t('dealerRfq.roofPitch')}</Label><Input className="input-blue mt-1" value={form.roofPitch} onChange={e => set('roofPitch', e.target.value)} placeholder="1:12" /></div>
              </>
            ) : (
              <>
                <div><Label className="text-xs">{t('dealerRfq.lowSide')}</Label><Input className="input-blue mt-1" type="number" value={form.lowSide} onChange={e => set('lowSide', e.target.value)} /></div>
                <div><Label className="text-xs">{t('dealerRfq.highSide')}</Label><Input className="input-blue mt-1" type="number" value={form.highSide} onChange={e => set('highSide', e.target.value)} /></div>
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
              <Select value={form.liners} onValueChange={v => set('liners', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue placeholder={t('dealerRfq.linersPlaceholder')} /></SelectTrigger>
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
              <Select value={form.gutters} onValueChange={v => set('gutters', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue placeholder={t('dealerRfq.noGutters')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('dealerRfq.noGutters')}</SelectItem>
                  <SelectItem value="per_side">{t('dealerRfq.specifyPerSide')}</SelectItem>
                  <SelectItem value="spacing">{t('dealerRfq.specifySpacing')}</SelectItem>
                </SelectContent>
              </Select>
              
              {form.gutters === 'per_side' && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">{t('dealerRfq.downspoutsPerSide')}</Label>
                  <Input className="input-blue mt-1 h-8" type="number" placeholder={t('dealerRfq.specifyPerSide')} value={form.guttersPerSide} onChange={e => set('guttersPerSide', e.target.value)} />
                </div>
              )}
              {form.gutters === 'spacing' && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">{t('dealerRfq.downspoutsSpacing')}</Label>
                  <Input className="input-blue mt-1 h-8" type="number" placeholder={t('dealerRfq.specifySpacing')} value={form.guttersSpacing} onChange={e => set('guttersSpacing', e.target.value)} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dealerRfq.notes')}</h3>
          <Textarea className="text-xs min-h-[100px]" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('dealerRfq.notesPlaceholder')} />
        </div>

        <Button onClick={handleSubmit} className="w-full" size="lg">
          <Send className="h-4 w-4 mr-2" />{t('dealerRfq.submitRfq')}
        </Button>
      </div>
    </div>
  );
}
