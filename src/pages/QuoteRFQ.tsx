import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { notifyUsers } from '@/lib/workflowNotifications';
import { saveDocumentPdf } from '@/lib/documentPdf';
import { SharedRFQForm } from '@/components/rfq/SharedRFQForm';
import {
  buildRFQPayloadFromForm,
  computeRFQDimensionsFromForm,
  createInitialRFQFormValues,
  mapEstimateToSharedRFQForm,
  mapQuoteToSharedRFQForm,
  type SharedRFQFormValues,
} from '@/lib/rfqForm';
import { createOpening, renumberOpenings, type RFQOpening, type WallLocation } from '@/lib/rfqShared';
import type { Quote } from '@/types';

export default function QuoteRFQ() {
  const [searchParams] = useSearchParams();
  const { deals, quotes, estimates, addQuote, updateQuote, allocateJobId } = useAppContext();
  const { settings } = useSettings();
  const [form, setForm] = useState<SharedRFQFormValues>(createInitialRFQFormValues());
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
      setForm(mapQuoteToSharedRFQForm(existingQuote));
      const payload = (existingQuote.payload || {}) as Record<string, unknown>;
      setOpenings(Array.isArray(payload.openings) ? payload.openings as RFQOpening[] : []);
      return;
    }

    const estimateId = searchParams.get('estimateId');
    if (!estimateId) return;
    const estimate = estimates.find(item => item.id === estimateId);
    if (!estimate) return;
    setForm(current => ({
      ...current,
      ...mapEstimateToSharedRFQForm(estimate),
    }));
    setSelectedEstimateId(estimateId);
  }, [existingQuote, estimates, searchParams]);

  const set = <K extends keyof SharedRFQFormValues>(key: K, value: SharedRFQFormValues[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleClientSelect = ({ clientId, clientName }: { clientId: string; clientName: string }) => {
    setForm(current => ({ ...current, clientId, clientName }));
  };

  const handleEstimateImport = (estimateId: string) => {
    setSelectedEstimateId(estimateId);
    const estimate = estimates.find(item => item.id === estimateId);
    if (!estimate) return;
    setForm(current => ({ ...current, ...mapEstimateToSharedRFQForm(estimate) }));
    toast.success(`Imported ${estimate.label}`);
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
      <div class="row"><span>Dimensions:</span><span>${form.width} x ${form.length} x ${form.buildingStyle === 'Single Slope' ? form.highSide || form.height : form.height}</span></div>
      <div class="row"><span>Roof Pitch:</span><span>${form.roofPitch || 'Not set'}</span></div>
    </div>`);
    win.document.write('<div class="section"><h3>Openings</h3>');
    openings.forEach(opening => {
      win.document.write(`<div class="opening">${opening.wall} #${opening.number} - ${opening.width} x ${opening.height}${opening.notes ? ` - ${opening.notes}` : ''}</div>`);
    });
    if (openings.length === 0) win.document.write('<p>No openings added</p>');
    win.document.write('</div>');
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const handleSubmit = async () => {
    if (!form.clientId.trim()) {
      toast.error('Client ID is required');
      return;
    }

    const { width, length, height, sqft } = computeRFQDimensionsFromForm(form);
    if (!width || !length || !height) {
      toast.error('Building dimensions are required');
      return;
    }

    const jobId = form.jobId || await allocateJobId();
    if (!form.jobId) set('jobId', jobId);

    const payload = buildRFQPayloadFromForm(form, openings, {
      importedEstimateId: selectedEstimateId || null,
    });

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
      sqft,
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

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Quote RFQ</h2>
        <p className="text-sm text-muted-foreground mt-1">Submit RFQs as tracked documents without creating deals up front.</p>
      </div>

      <SharedRFQForm
        variant="internal"
        value={form}
        openings={openings}
        onChange={set}
        onAddOpening={addOpening}
        onUpdateOpening={updateOpening}
        onRemoveOpening={removeOpening}
        onSubmit={() => void handleSubmit()}
        submitLabel={existingQuote ? 'Update RFQ' : 'Submit RFQ'}
        onPrint={printRFQ}
        deals={deals}
        estimateOptions={estimateOptions}
        selectedEstimateId={selectedEstimateId}
        onEstimateImport={handleEstimateImport}
        onClientSelect={handleClientSelect}
      />
    </div>
  );
}
