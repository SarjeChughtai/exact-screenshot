import { useEffect, useMemo, useState } from 'react';
import { Store } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { saveDocumentPdf } from '@/lib/documentPdf';
import { notifyUsers } from '@/lib/workflowNotifications';
import { SharedRFQForm } from '@/components/rfq/SharedRFQForm';
import {
  buildRFQPayloadFromForm,
  computeRFQDimensionsFromForm,
  createInitialRFQFormValues,
  type SharedRFQFormValues,
} from '@/lib/rfqForm';
import { createOpening, renumberOpenings, type RFQOpening, type WallLocation } from '@/lib/rfqShared';
import type { Quote } from '@/types';

export default function DealerRFQ() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { addQuote, updateQuote, allocateJobId } = useAppContext();
  const dealerProfile = settings.dealers?.find(dealer => dealer.userId === user?.id);

  const [form, setForm] = useState<SharedRFQFormValues>(() => createInitialRFQFormValues({
    contactEmail: dealerProfile?.contactEmail || user?.email || '',
    contactPhone: dealerProfile?.contactPhone || '',
    buildingStyle: 'Symmetrical',
    height: '14',
    roofPitch: '1:12',
  }));
  const [openings, setOpenings] = useState<RFQOpening[]>([]);

  useEffect(() => {
    if (!dealerProfile) return;
    setForm(current => ({
      ...current,
      contactEmail: current.contactEmail || dealerProfile.contactEmail || '',
      contactPhone: current.contactPhone || dealerProfile.contactPhone || '',
    }));
  }, [dealerProfile]);

  const set = <K extends keyof SharedRFQFormValues>(key: K, value: SharedRFQFormValues[K]) => {
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

  const labels = useMemo(() => ({
    clientInfo: t('dealerRfq.clientInfo'),
    clientName: t('dealerRfq.clientName'),
    clientNamePlaceholder: t('dealerRfq.clientNamePlaceholder'),
    contactEmail: t('dealerRfq.contactEmail'),
    contactPhone: t('dealerRfq.contactPhone'),
    location: t('dealerRfq.location'),
    province: t('dealerRfq.province'),
    city: t('dealerRfq.city'),
    address: t('dealerRfq.address'),
    postalCode: t('dealerRfq.postalCode'),
    buildingDetails: t('dealerRfq.buildingDetails'),
    buildingStyle: t('dealerRfq.buildingStyle'),
    symmetrical: t('dealerRfq.symmetrical'),
    singleSlope: t('dealerRfq.singleSlope'),
    width: t('dealerRfq.width'),
    length: t('dealerRfq.length'),
    height: t('dealerRfq.height'),
    roofPitch: t('dealerRfq.roofPitch'),
    lowSide: t('dealerRfq.lowSide'),
    highSide: t('dealerRfq.highSide'),
    calculatedPitch: t('dealerRfq.calculatedPitch'),
    accessories: t('dealerRfq.accessories'),
    liners: t('dealerRfq.liners'),
    'liners.none': t('dealerRfq.linerOptions.none'),
    'liners.roof': t('dealerRfq.linerOptions.roof'),
    'liners.walls': t('dealerRfq.linerOptions.walls'),
    'liners.roofWalls': t('dealerRfq.linerOptions.roofWalls'),
    gutters: t('dealerRfq.gutters'),
    'gutters.none': t('dealerRfq.noGutters'),
    'gutters.perSide': t('dealerRfq.specifyPerSide'),
    'gutters.spacing': t('dealerRfq.specifySpacing'),
    downspoutsPerSide: t('dealerRfq.downspoutsPerSide'),
    downspoutsSpacing: t('dealerRfq.downspoutsSpacing'),
    insulationRequired: 'Insulation Required',
    roofGrade: 'Roof Grade',
    wallGrade: 'Wall Grade',
    openingsTitle: 'Wall Openings',
    openingsSubtitle: 'Track framed openings by wall for design reference.',
    openingsNotesPlaceholder: 'Door, window, framed opening...',
    notes: t('dealerRfq.notes'),
    notesPlaceholder: t('dealerRfq.notesPlaceholder'),
  }), [t]);

  const handleSubmit = async () => {
    if (!form.clientName.trim()) {
      toast.error(t('dealerRfq.toast.clientNameRequired'));
      return;
    }

    const { width, length, height, sqft } = computeRFQDimensionsFromForm(form);
    if (!width || !length || !height) {
      toast.error(t('dealerRfq.toast.dimensionsRequired'));
      return;
    }

    const jobId = await allocateJobId();
    const payload = buildRFQPayloadFromForm(form, openings, {
      dealerBusinessName: dealerProfile?.businessName || '',
      dealerClientId: dealerProfile?.clientId || '',
    });

    const quote: Quote = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      jobId,
      jobName: form.jobName || `${width}x${length} dealer RFQ`,
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
      sqft,
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
      payload,
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
    setForm(createInitialRFQFormValues({
      contactEmail: dealerProfile?.contactEmail || user?.email || '',
      contactPhone: dealerProfile?.contactPhone || '',
      buildingStyle: 'Symmetrical',
      height: '14',
      roofPitch: '1:12',
    }));
    setOpenings([]);
  };

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" /> {t('dealerRfq.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('dealerRfq.subtitle')}</p>
      </div>

      <SharedRFQForm
        variant="dealer"
        value={form}
        openings={openings}
        onChange={set}
        onAddOpening={addOpening}
        onUpdateOpening={updateOpening}
        onRemoveOpening={removeOpening}
        onSubmit={() => void handleSubmit()}
        submitLabel={t('dealerRfq.submitRfq')}
        dealerClientNote={`${t('dealerRfq.clientIdNote')} ${dealerProfile?.clientId || 'N/A'}`}
        labels={labels}
      />
    </div>
  );
}
