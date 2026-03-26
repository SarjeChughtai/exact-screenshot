import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency, formatNumber, PROVINCES, getProvinceTax, calcFreight, calcEngineeringFromFactor, lookupFoundation, calcMarkup, getMarkupRate, autoComplexityFactor, pitchCostMultiplier, heightCostMultiplier } from '@/lib/calculations';
import { estimateFreightFromLocation } from '@/lib/freightEstimate';
import type { Quote } from '@/types';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, AlertTriangle, Download, Mail, ChevronDown, X, Sparkles, Loader2, MapPin, Lightbulb, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { ClientSelect } from '@/components/ClientSelect';

interface CostFileData {
  steelWeightLbs: number;
  supplierCostPerLb: number;
  totalSupplierCost: number;
  accessories: { name: string; weight: number; cost: number }[];
}

interface ParsedFile {
  name: string;
  type: 'mbs' | 'insulation' | 'unknown';
  status: 'success' | 'failed';
  data?: any;
  buildingIndex: number;
}

interface BuildingTab {
  label: string;
  costData: CostFileData;
  files: ParsedFile[];
  width: string;
  length: string;
  height: string;
  pitch: string;
}

function generateCostSavingTips(form: any, costData: CostFileData, quote: Quote | null): string[] {
  const tips: string[] = [];
  const w = parseFloat(form.width) || 0;
  const l = parseFloat(form.length) || 0;
  const h = parseFloat(form.height) || 14;
  const pitch = parseFloat(form.pitch) || 1;

  if (pitch > 2) tips.push(`📐 Reducing roof pitch from ${pitch}:12 to 1:12 could save ~${((pitchCostMultiplier(pitch).multiplier - 1) * 100).toFixed(0)}% on steel costs.`);
  if (h > 16) tips.push(`📏 A ${h}ft eave height adds ~${((heightCostMultiplier(h).multiplier - 1) * 100).toFixed(0)}% to steel. Consider ${Math.min(h, 16)}ft if clearance allows.`);
  if (w > 80) tips.push(`🏗️ Buildings over 80ft wide require multi-span framing — significantly more costly. If possible, keep width ≤ 80ft.`);
  if (form.foundationType === 'frost_wall') tips.push(`🧱 Frost wall foundations cost ~65% more than slab. Verify if slab-on-grade is feasible for this site.`);
  if (form.remoteLevel === 'extreme') tips.push(`🚛 Extreme remote freight adds $3,000+. Consider a staging/pickup arrangement to reduce cost.`);
  if (form.remoteLevel === 'remote') tips.push(`🚛 Remote location adds $1,500 to freight. Check if a closer delivery point is available.`);
  if (w * l > 10000 && parseFloat(form.contingencyPct) >= 5) tips.push(`💰 For large buildings (${formatNumber(w * l)} sqft), you may be able to reduce contingency to 3% — the larger the project, the more predictable costs become.`);
  if (parseFloat(form.insulationCost) > 0 && !form.insulationGrade) tips.push(`🧊 Specify insulation grade to ensure the quote matches the correct R-value specification.`);
  return tips;
}

export default function InternalQuoteBuilder() {
  const { addQuote, addDeal, deals, quotes } = useAppContext();
  const { settings, getSalesReps } = useSettings();

  const [form, setForm] = useState({
    jobId: '', jobName: '', clientName: '', clientId: '',
    salesRep: '', estimator: '', province: 'ON',
    city: '', address: '', postalCode: '',
    width: '', length: '', height: '14',
    pitch: '1',
    distance: '200', remoteLevel: 'none',
    foundationType: 'slab' as 'slab' | 'frost_wall',
    insulationCost: '0', insulationGrade: '',
    gutters: '0', liners: '0',
    contingencyPct: '5',
    notes: '',
  });

  const [supplierMarkupPct, setSupplierMarkupPct] = useState(String(settings.supplierIncreasePct));
  const [internalMarkupPct] = useState('0');
  const [buildings, setBuildings] = useState<BuildingTab[]>([
    { label: 'Building 1', costData: { steelWeightLbs: 0, supplierCostPerLb: 0, totalSupplierCost: 0, accessories: [] }, files: [], width: '', length: '', height: '14', pitch: '1' },
  ]);
  const [activeBuildingIdx, setActiveBuildingIdx] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [tieredMarkupInfo, setTieredMarkupInfo] = useState<{ rate: number; amount: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [complianceNotes, setComplianceNotes] = useState<string[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [costSavingTips, setCostSavingTips] = useState<string[]>([]);
  const [locationSource, setLocationSource] = useState('');

  const costData = buildings[activeBuildingIdx]?.costData || { steelWeightLbs: 0, supplierCostPerLb: 0, totalSupplierCost: 0, accessories: [] };
  const parsedFiles = buildings[activeBuildingIdx]?.files || [];

  const setCostData = (updater: CostFileData | ((d: CostFileData) => CostFileData)) => {
    setBuildings(prev => prev.map((b, i) => i === activeBuildingIdx ? { ...b, costData: typeof updater === 'function' ? updater(b.costData) : updater } : b));
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  // Location lookup for auto-populating distance/province
  const handleLocationLookup = async () => {
    const input = form.postalCode || form.city;
    if (!input.trim()) { setLocationSource('Enter a postal code or city'); return; }
    setLocationSource('Looking up distance...');
    const estimate = await estimateFreightFromLocation(input);
    if (estimate) {
      set('distance', estimate.distanceKm.toString());
      set('remoteLevel', estimate.remote);
      set('province', estimate.province);
      const via = estimate.distanceSource === 'maps' ? 'Maps API' : 'heuristic';
      setLocationSource(`Auto: ~${estimate.distanceKm}km via ${via} (${estimate.method})`);
    } else {
      setLocationSource('Could not estimate — enter manually');
    }
  };

  // Auto-populate from Job ID
  const handleJobIdChange = (jobId: string) => {
    set('jobId', jobId);
    const deal = deals.find(d => d.jobId === jobId);
    if (deal) {
      setForm(f => ({
        ...f, jobId, jobName: deal.jobName, clientName: deal.clientName, clientId: deal.clientId,
        salesRep: deal.salesRep, estimator: deal.estimator, province: deal.province,
        city: deal.city, address: deal.address, postalCode: deal.postalCode,
        width: String(deal.width || ''), length: String(deal.length || ''), height: String(deal.height || '14'),
      }));
    }
    const q = quotes.find(q => q.jobId === jobId);
    if (q && !deal) {
      setForm(f => ({
        ...f, jobId, jobName: q.jobName, clientName: q.clientName, clientId: q.clientId,
        salesRep: q.salesRep, estimator: q.estimator, province: q.province,
        city: q.city, address: q.address, postalCode: q.postalCode,
        width: String(q.width || ''), length: String(q.length || ''), height: String(q.height || '14'),
      }));
    }
  };

  const handleClientSelect = (client: { clientId: string; clientName: string }) => {
    setForm(f => ({ ...f, clientId: client.clientId, clientName: client.clientName }));
  };

  const extractTextFromPdf = async (file: File): Promise<string[]> => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(' '));
    }
    return pages;
  };

  const detectInsulationPdf = (text: string): boolean => {
    return (text.includes('Silvercote') || text.includes('SILVERCOTE')) ||
      (text.includes('QUOTATION') && (text.includes('ROOF MATERIAL') || text.includes('WALLS MATERIAL')));
  };

  const parseInsulationPdf = (text: string): number => {
    const totalMatch = text.match(/TOTAL\s*\(CAD\)\s*:?\s*\$?([\d,]+\.?\d*)/i);
    if (totalMatch) return parseFloat(totalMatch[1].replace(/,/g, ''));
    const altMatch = text.match(/Total\s*:?\s*\$?([\d,]+\.?\d*)/i);
    if (altMatch) return parseFloat(altMatch[1].replace(/,/g, ''));
    return 0;
  };

  const parseMbsPdf = (pages: string[]) => {
    const fullText = pages.join('\n');
    let weight = 0, costPerLb = 0, totalCost = 0;
    let pWidth = 0, pLength = 0, pHeight = 0, pPitch = 0;
    let clientName = '', clientId = '', jobId = '';
    const accessories: { name: string; weight: number; cost: number }[] = [];

    const forMatch = fullText.match(/FOR\s*\n?\s*(.+)/i);
    if (forMatch) clientName = forMatch[1].trim();
    const clientIdMatch = fullText.match(/FOR\s*\n?\s*.+\n?\s*(\d{4,})/i);
    if (clientIdMatch) clientId = clientIdMatch[1].trim();
    const jobMatch = fullText.match(/JOB\s*:?\s*(.+)/i);
    if (jobMatch) jobId = jobMatch[1].trim();

    const widthMatch = fullText.match(/Width\s*\(ft\)\s*=\s*([\d.]+)/i);
    const lengthMatch = fullText.match(/Length\s*\(ft\)\s*=\s*([\d.]+)/i);
    const heightMatch = fullText.match(/Eave\s*Height\s*\(ft\)\s*=\s*([\d.]+)/i);
    if (widthMatch) pWidth = parseFloat(widthMatch[1]);
    if (lengthMatch) pLength = parseFloat(lengthMatch[1]);
    if (heightMatch) pHeight = parseFloat(heightMatch[1]);

    // Roof Slope parsing: handles "Roof Slope (rise/12 )= 2.00/ 2.00" and similar formats
    const slopeMatch = fullText.match(/Roof\s*Slope\s*\(?rise\/12\s*\)?\s*=\s*([\d.]+)/i);
    if (slopeMatch) pPitch = parseFloat(slopeMatch[1]);

    const totalMatch = fullText.match(/Total[:\s]+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/i);
    if (totalMatch) {
      weight = parseFloat(totalMatch[1].replace(/,/g, ''));
      totalCost = parseFloat(totalMatch[2].replace(/,/g, ''));
    }

    const pplbMatch = fullText.match(/PRICE\s+PER\s+WEIGHT\s*\(lb\)\s+([\d.]+)/i);
    if (pplbMatch) costPerLb = parseFloat(pplbMatch[1]);

    const lines = fullText.split('\n');
    for (const line of lines) {
      const componentMatch = line.match(/^([A-Za-z][A-Za-z &,]+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/);
      if (componentMatch) {
        const name = componentMatch[1].trim();
        const cWeight = parseFloat(componentMatch[2].replace(/,/g, ''));
        const cCost = parseFloat(componentMatch[3].replace(/,/g, ''));
        if (name.toLowerCase() === 'total') continue;
        if (cCost > 0) accessories.push({ name, weight: cWeight, cost: cCost });
      }
    }

    if (weight && totalCost && !costPerLb) costPerLb = totalCost / weight;
    if (weight && costPerLb && !totalCost) totalCost = weight * costPerLb;

    return { weight, costPerLb, totalCost, pWidth, pLength, pHeight, pPitch, clientName, clientId, jobId, accessories };
  };

  const extractWithAI = async (text: string, filename: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('extract-quote-data', {
        body: { text, filename },
      });
      if (error) throw error;
      if (data?.success && data?.data) return data.data;
      return null;
    } catch (e) {
      console.error('AI extraction error:', e);
      return null;
    }
  };

  const applyAIData = (aiData: any) => {
    if (aiData.width) set('width', String(aiData.width));
    if (aiData.length) set('length', String(aiData.length));
    if (aiData.height) set('height', String(aiData.height));
    if (aiData.roof_pitch) set('pitch', String(aiData.roof_pitch));
    if (aiData.client_name) set('clientName', aiData.client_name);
    if (aiData.client_id) set('clientId', aiData.client_id);
    if (aiData.job_id) set('jobId', aiData.job_id);
    if (aiData.job_name) set('jobName', aiData.job_name);
    if (aiData.province) set('province', aiData.province);
    if (aiData.city) set('city', aiData.city);
    if (aiData.address) set('address', aiData.address);
    if (aiData.postal_code) set('postalCode', aiData.postal_code);
    if (aiData.insulation_grade) set('insulationGrade', aiData.insulation_grade);
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const newParsedFiles: ParsedFile[] = [];
    setAiProcessing(true);

    for (const file of fileArr) {
      try {
        let fullText = '';
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const pages = await extractTextFromPdf(file);
          fullText = pages.join('\n');
        } else {
          fullText = await file.text();
        }

        const aiResult = await extractWithAI(fullText, file.name);

        if (aiResult) {
          const docType = aiResult.document_type || 'unknown';

          if (docType === 'insulation') {
            const total = aiResult.insulation_total || 0;
            set('insulationCost', String(total));
            if (aiResult.insulation_grade) set('insulationGrade', aiResult.insulation_grade);
            newParsedFiles.push({ name: file.name, type: 'insulation', status: 'success', data: aiResult, buildingIndex: activeBuildingIdx });
            toast.success(`🤖 AI extracted insulation: ${formatCurrency(total)}`);
          } else if (docType === 'mbs') {
            applyAIData(aiResult);
            const weight = aiResult.weight || 0;
            const costPerLb = aiResult.cost_per_lb || (aiResult.total_cost && weight ? aiResult.total_cost / weight : 0);
            const totalCost = aiResult.total_cost || weight * costPerLb;
            const components = (aiResult.components || []).map((c: any) => ({
              name: c.name, weight: c.weight || 0, cost: c.cost || 0,
            }));
            setCostData({ steelWeightLbs: weight, supplierCostPerLb: costPerLb, totalSupplierCost: totalCost, accessories: components });
            newParsedFiles.push({ name: file.name, type: 'mbs', status: 'success', data: aiResult, buildingIndex: activeBuildingIdx });
            toast.success(`🤖 AI extracted MBS: ${formatNumber(weight)} lbs @ $${costPerLb.toFixed(2)}/lb`);
          } else {
            applyAIData(aiResult);
            if (aiResult.weight && aiResult.total_cost) {
              setCostData({
                steelWeightLbs: aiResult.weight,
                supplierCostPerLb: aiResult.cost_per_lb || aiResult.total_cost / aiResult.weight,
                totalSupplierCost: aiResult.total_cost,
                accessories: (aiResult.components || []).map((c: any) => ({ name: c.name, weight: c.weight || 0, cost: c.cost || 0 })),
              });
              newParsedFiles.push({ name: file.name, type: 'mbs', status: 'success', data: aiResult, buildingIndex: activeBuildingIdx });
              toast.success(`🤖 AI extracted data from ${file.name}`);
            } else if (aiResult.insulation_total) {
              set('insulationCost', String(aiResult.insulation_total));
              newParsedFiles.push({ name: file.name, type: 'insulation', status: 'success', data: aiResult, buildingIndex: activeBuildingIdx });
              toast.success(`🤖 AI extracted insulation: ${formatCurrency(aiResult.insulation_total)}`);
            } else {
              newParsedFiles.push({ name: file.name, type: 'unknown', status: 'failed', buildingIndex: activeBuildingIdx });
              toast.error(`AI could not extract useful data from ${file.name}`);
            }
          }

          if (aiResult.notes) {
            toast.info(`AI note: ${aiResult.notes}`, { duration: 5000 });
          }
        } else {
          const pages = fullText.split('\n');
          if (detectInsulationPdf(fullText)) {
            const insulationTotal = parseInsulationPdf(fullText);
            set('insulationCost', String(insulationTotal));
            newParsedFiles.push({ name: file.name, type: 'insulation', status: 'success', data: { total: insulationTotal }, buildingIndex: activeBuildingIdx });
            toast.success(`Insulation (regex): ${formatCurrency(insulationTotal)}`);
          } else {
            const parsed = parseMbsPdf(pages);
            if (parsed.weight > 0) {
              if (parsed.pWidth) set('width', String(parsed.pWidth));
              if (parsed.pLength) set('length', String(parsed.pLength));
              if (parsed.pHeight) set('height', String(parsed.pHeight));
              if (parsed.pPitch) set('pitch', String(parsed.pPitch));
              if (parsed.clientName) set('clientName', parsed.clientName);
              if (parsed.clientId) set('clientId', parsed.clientId);
              if (parsed.jobId) set('jobId', parsed.jobId);
              setCostData({
                steelWeightLbs: parsed.weight, supplierCostPerLb: parsed.costPerLb,
                totalSupplierCost: parsed.totalCost, accessories: parsed.accessories,
              });
              newParsedFiles.push({ name: file.name, type: 'mbs', status: 'success', data: parsed, buildingIndex: activeBuildingIdx });
              toast.success(`MBS (regex): ${formatNumber(parsed.weight)} lbs`);
            } else {
              newParsedFiles.push({ name: file.name, type: 'unknown', status: 'failed', buildingIndex: activeBuildingIdx });
              toast.error(`Could not parse: ${file.name}`);
            }
          }
        }

        // Auto freight from postal code
        if (form.postalCode) {
          const est = await estimateFreightFromLocation(form.postalCode);
          if (est) set('distance', est.distanceKm.toString());
        }
      } catch {
        newParsedFiles.push({ name: file.name, type: 'unknown', status: 'failed', buildingIndex: activeBuildingIdx });
        toast.error(`Error parsing ${file.name}`);
      }
    }
    setBuildings(prev => prev.map((b, i) => i === activeBuildingIdx ? { ...b, files: [...b.files, ...newParsedFiles] } : b));
    setAiProcessing(false);
  };

  const removeFile = (fileIndex: number) => {
    setBuildings(prev => prev.map((b, i) => i === activeBuildingIdx ? { ...b, files: b.files.filter((_, fi) => fi !== fileIndex) } : b));
    toast.info('File removed');
  };

  const addBuilding = () => {
    setBuildings(prev => [...prev, {
      label: `Building ${prev.length + 1}`,
      costData: { steelWeightLbs: 0, supplierCostPerLb: 0, totalSupplierCost: 0, accessories: [] },
      files: [],
      width: '', length: '', height: '14', pitch: '1',
    }]);
    setActiveBuildingIdx(buildings.length);
  };

  const removeBuilding = (idx: number) => {
    if (buildings.length <= 1) return;
    setBuildings(prev => prev.filter((_, i) => i !== idx));
    setActiveBuildingIdx(Math.max(0, activeBuildingIdx - 1));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
  };

  const getDefaultJobName = () => {
    const w = parseFloat(form.width) || 0;
    const l = parseFloat(form.length) || 0;
    const h = parseFloat(form.height) || 0;
    if (w && l) return `${w}'x${l}'x${h}'`;
    return '';
  };

  const generate = () => {
    const w = parseFloat(form.width) || 0;
    const l = parseFloat(form.length) || 0;
    const h = parseFloat(form.height) || 14;
    const pitch = parseFloat(form.pitch) || 1;
    const sqft = w * l;
    if (!sqft || !costData.steelWeightLbs || !costData.totalSupplierCost) {
      toast.error('Enter dimensions and steel cost data');
      return;
    }

    const weight = costData.steelWeightLbs;
    const supplierMarkup = parseFloat(supplierMarkupPct) / 100;

    const adjustedCostPerLb = costData.supplierCostPerLb * (1 + supplierMarkup);
    const steelAfterSupplierMarkup = adjustedCostPerLb * weight;
    const tieredMarkupAmount = calcMarkup(steelAfterSupplierMarkup);
    const tieredRate = getMarkupRate(steelAfterSupplierMarkup);
    
    const pitchMult = pitchCostMultiplier(pitch);
    const heightMult = heightCostMultiplier(h);
    
    // Adjusted steel = steel after supplier + tiered markup, then pitch/height adjustments — all baked into "Steel" price
    const adjustedSteel = (steelAfterSupplierMarkup + tieredMarkupAmount) * pitchMult.multiplier * heightMult.multiplier;
    setTieredMarkupInfo({ rate: tieredRate, amount: tieredMarkupAmount });

    const complexity = autoComplexityFactor(w, l, h);
    const engineering = calcEngineeringFromFactor(complexity.factor);
    const foundation = lookupFoundation(sqft, form.foundationType);
    const insulation = parseFloat(form.insulationCost) || 0;
    const guttersVal = parseFloat(form.gutters) || 0;
    const linersVal = parseFloat(form.liners) || 0;
    const freight = calcFreight(parseFloat(form.distance) || 0, weight, form.remoteLevel);

    const combinedTotal = adjustedSteel + engineering + foundation + insulation + guttersVal + linersVal + freight;
    const contingency = combinedTotal * (parseFloat(form.contingencyPct) || 0) / 100;
    const totalPlusCont = combinedTotal + contingency;

    // NO TAX on internal quote
    const gstHst = 0;
    const qst = 0;
    const finalPerLb = adjustedSteel / weight;

    const notes: string[] = [
      `Base Steel (from MBS): ${formatCurrency(costData.totalSupplierCost)} at ${formatNumber(weight)} lbs = $${costData.supplierCostPerLb.toFixed(2)}/lb`,
      `+${supplierMarkupPct}% Supplier: $/lb goes from $${costData.supplierCostPerLb.toFixed(2)} to $${adjustedCostPerLb.toFixed(2)} → steel becomes ${formatCurrency(steelAfterSupplierMarkup)}`,
      `Tiered Markup: tier = ${(tieredRate * 100).toFixed(1)}%, amount = ${formatCurrency(tieredMarkupAmount)}${tieredMarkupAmount === 3000 ? ' ($3K minimum applied)' : ''}`,
      pitchMult.multiplier > 1 ? `Pitch Adjustment: ${pitchMult.note} → ×${pitchMult.multiplier}` : '',
      heightMult.multiplier > 1 ? `Height Adjustment: ${heightMult.note} → ×${heightMult.multiplier}` : '',
      `Adjusted Steel: ${formatCurrency(adjustedSteel)} → final $/lb = $${finalPerLb.toFixed(2)} (${finalPerLb >= 2.15 && finalPerLb <= 2.30 ? 'IN RANGE' : 'CHECK'} vs $2.15–$2.30)`,
      `Engineering: auto-complexity = ${complexity.factor} (${complexity.reason}) → ${formatCurrency(engineering)}`,
      `Foundation: sqft=${formatNumber(sqft)}, type=${form.foundationType}, base=${formatCurrency(foundation - 500)} + $500 = ${formatCurrency(foundation)}`,
      `Insulation: ${formatCurrency(insulation)} (pass-through, no markup)`,
      `Freight: MAX($4,000, ${form.distance}km × $4) + remote(${form.remoteLevel}) + overweight = ${formatCurrency(freight)}`,
      `Tax: EXCLUDED from internal quote`,
      `ALL FIGURES SOURCE: 143 MBS projects for steel tiers, 48 Silvercote quotes for insulation, foundation schedule v1`,
    ].filter(Boolean);
    setComplianceNotes(notes);

    // Default job name to dimensions
    const jobName = form.jobName || getDefaultJobName();

    const q: Quote = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      jobId: form.jobId || `CSB-${Date.now().toString(36).toUpperCase()}`,
      jobName, clientName: form.clientName, clientId: form.clientId,
      salesRep: form.salesRep, estimator: form.estimator,
      province: form.province, city: form.city, address: form.address, postalCode: form.postalCode,
      width: w, length: l, height: h, sqft, weight,
      baseSteelCost: costData.totalSupplierCost, steelAfter12: steelAfterSupplierMarkup,
      markup: tieredMarkupAmount, adjustedSteel,
      engineering, foundation, foundationType: form.foundationType,
      gutters: guttersVal, liners: linersVal, insulation, insulationGrade: form.insulationGrade,
      freight, combinedTotal, perSqft: combinedTotal / sqft, perLb: finalPerLb,
      contingencyPct: parseFloat(form.contingencyPct) || 0, contingency,
      gstHst, qst, grandTotal: totalPlusCont, status: 'Draft',
    };
    setQuote(q);

    // Generate cost-saving tips
    setCostSavingTips(generateCostSavingTips(form, costData, q));
  };

  const saveToLog = () => {
    if (!quote) return;
    addQuote(quote);

    const existingDeal = deals.find(d => d.jobId === quote.jobId);
    if (!existingDeal) {
      addDeal({
        jobId: quote.jobId,
        jobName: quote.jobName,
        clientName: quote.clientName,
        clientId: quote.clientId,
        salesRep: quote.salesRep,
        estimator: quote.estimator,
        teamLead: '',
        province: quote.province,
        city: quote.city,
        address: quote.address,
        postalCode: quote.postalCode,
        width: quote.width,
        length: quote.length,
        height: quote.height,
        sqft: quote.sqft,
        weight: quote.weight,
        taxRate: 0,
        taxType: '',
        orderType: 'New',
        dateSigned: '',
        dealStatus: 'Quoted',
        paymentStatus: 'UNPAID',
        productionStatus: 'Submitted',
        freightStatus: 'Pending',
        insulationStatus: '',
        deliveryDate: '',
        pickupDate: '',
        notes: '',
      });
      toast.success(`Deal ${quote.jobId} auto-created`);
    }

    toast.success('Internal quote saved to Quote Log');
  };

  const downloadPdf = () => {
    if (!quote) return;
    const printContent = document.getElementById('internal-quote-output');
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const pdfTitle = `Internal Quote - ${quote.jobId} - ${quote.clientName} - ${quote.clientId} - ${quote.jobName}`;
    win.document.write(`<html><head><title>${pdfTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; padding: 40px; line-height: 2.2; color: #1a1a1a; }
        .bold { font-weight: 700; }
        .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #333; padding-bottom: 16px; }
        .header h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px 0; }
        .header p { margin: 4px 0; font-size: 13px; color: #555; }
        .row { display: flex; justify-content: space-between; margin: 8px 0; padding: 4px 0; }
        .divider { border-top: 1px solid #ddd; margin: 16px 0; }
        .warning { color: #dc2626; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        .spacer { height: 16px; }
      </style></head><body>`);
    win.document.write(`<div class="header"><h2>INTERNAL SALES QUOTE — ${quote.jobId}</h2><p>${quote.clientName} (ID: ${quote.clientId}) — ${quote.jobName}</p><p class="warning">⚠ Confidential — Internal Use Only</p></div>`);
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const emailQuote = () => {
    if (!quote) return;
    const subject = encodeURIComponent(`Internal Quote — ${quote.jobId} — ${quote.clientName}`);
    const body = encodeURIComponent(
      `INTERNAL SALES QUOTE — ${quote.jobId}\nCONFIDENTIAL — INTERNAL USE ONLY\n\n` +
      `Client: ${quote.clientName} (ID: ${quote.clientId})\nSales Rep: ${quote.salesRep}\n` +
      `Building: ${quote.width}' × ${quote.length}' × ${quote.height}' | ${formatNumber(quote.sqft)} sqft | ${formatNumber(quote.weight)} lbs\n\n` +
      `Adjusted Steel: ${formatCurrency(quote.adjustedSteel)}\nEngineering: ${formatCurrency(quote.engineering)}\nFoundation: ${formatCurrency(quote.foundation)}\n` +
      `Insulation: ${formatCurrency(quote.insulation)}\nFreight: ${formatCurrency(quote.freight)}\n\n` +
      `COMBINED TOTAL: ${formatCurrency(quote.combinedTotal)}\n$/sqft: ${formatCurrency(quote.perSqft)}\n\n` +
      `GRAND TOTAL: ${formatCurrency(quote.grandTotal)}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const perLbCheck = quote ? quote.perLb : null;
  const perLbInRange = perLbCheck !== null && perLbCheck >= 2.15 && perLbCheck <= 2.30;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Internal Quote Builder</h2>
        <p className="text-sm text-muted-foreground mt-1">Drop MBS + insulation cost files, apply markups, generate internal sales quotes</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          {/* Building Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {buildings.map((b, i) => (
              <div key={i} className="flex items-center">
                <Button
                  variant={i === activeBuildingIdx ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveBuildingIdx(i)}
                  className="text-xs"
                >
                  {b.label}
                </Button>
                {buildings.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-0.5" onClick={() => removeBuilding(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBuilding} className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Building
            </Button>
          </div>

          {/* Multi-file Upload */}
          <div
            className={`bg-card border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive ? 'border-accent bg-accent/5' : aiProcessing ? 'border-primary bg-primary/5' : 'border-border'}`}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            {aiProcessing ? (
              <>
                <Loader2 className="h-8 w-8 mx-auto text-primary mb-2 animate-spin" />
                <p className="text-sm font-medium flex items-center justify-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> AI extracting quote data...
                </p>
                <p className="text-xs text-muted-foreground mt-1">Analyzing document structure and extracting all line items</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium flex items-center justify-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> AI-Powered Document Extraction
                </p>
                <p className="text-xs text-muted-foreground mt-1">Drop MBS cost files + insulation quotes — AI extracts all fields automatically</p>
                <label className="mt-3 inline-block">
                  <input type="file" className="hidden" accept=".csv,.txt,.pdf" multiple onChange={e => e.target.files && handleFileUpload(e.target.files)} />
                  <Button variant="outline" size="sm" asChild><span>Or browse files</span></Button>
                </label>
              </>
            )}
          </div>

          {/* Parsed files list with remove option */}
          {parsedFiles.length > 0 && (
            <div className="bg-muted rounded-md p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground mb-1">Uploaded Files — {buildings[activeBuildingIdx]?.label}</p>
              {parsedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {f.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertTriangle className="h-3 w-3 text-destructive" />}
                    <span>{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${f.type === 'mbs' ? 'bg-accent/20 text-accent' : f.type === 'insulation' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                      {f.type === 'mbs' ? 'MBS Cost File' : f.type === 'insulation' ? 'Insulation Quote' : 'Unknown'}
                    </span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove file">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual Cost Entry */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Steel Cost Data</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Weight (lbs)</Label>
                <Input className="input-blue mt-1" type="number" value={costData.steelWeightLbs || ''} onChange={e => setCostData(d => ({ ...d, steelWeightLbs: parseFloat(e.target.value) || 0, totalSupplierCost: (parseFloat(e.target.value) || 0) * d.supplierCostPerLb }))} />
              </div>
              <div>
                <Label className="text-xs">Supplier $/lb</Label>
                <Input className="input-blue mt-1" type="number" step="0.01" value={costData.supplierCostPerLb || ''} onChange={e => setCostData(d => ({ ...d, supplierCostPerLb: parseFloat(e.target.value) || 0, totalSupplierCost: d.steelWeightLbs * (parseFloat(e.target.value) || 0) }))} />
              </div>
              <div>
                <Label className="text-xs">Total Supplier Cost</Label>
                <Input className="input-blue mt-1" type="number" value={costData.totalSupplierCost || ''} readOnly />
              </div>
            </div>
            {costData.accessories.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Parsed Components</p>
                <div className="bg-muted rounded-md p-2 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                  {costData.accessories.map((a, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{a.name}</span>
                      <span className="font-mono">{formatNumber(a.weight)} lbs — {formatCurrency(a.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Markup Controls */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-destructive">Supplier Markup</h3>
            <div>
              <Label className="text-xs">Supplier Markup on $/lb (%)</Label>
              <Input className="input-blue mt-1" type="number" step="0.5" value={supplierMarkupPct} onChange={e => setSupplierMarkupPct(e.target.value)} />
            </div>
            {costData.supplierCostPerLb > 0 && (
              <div className="bg-muted rounded-md p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>Original $/lb:</span><span className="font-mono">${costData.supplierCostPerLb.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold"><span>After {supplierMarkupPct}% supplier:</span><span className="font-mono">${(costData.supplierCostPerLb * (1 + parseFloat(supplierMarkupPct) / 100)).toFixed(2)}</span></div>
              </div>
            )}
          </div>

          {/* Project Info */}
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Project Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Job ID</Label>
                <Input className="input-blue mt-1" value={form.jobId} onChange={e => handleJobIdChange(e.target.value)} placeholder="Auto / type to search" />
              </div>
              <div>
                <Label className="text-xs">Job Name</Label>
                <Input className="input-blue mt-1" value={form.jobName} onChange={e => set('jobName', e.target.value)} placeholder={getDefaultJobName() || 'Auto from dimensions'} />
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
                <PersonnelSelect value={form.salesRep} onValueChange={v => set('salesRep', v)} role="sales_rep" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Estimator</Label>
                <PersonnelSelect value={form.estimator} onValueChange={v => set('estimator', v)} role="estimator" className="mt-1" />
              </div>
            </div>

            {/* Location with auto-lookup */}
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                Location & Auto Freight
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Input className="input-blue" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} placeholder="Postal code" onKeyDown={e => e.key === 'Enter' && void handleLocationLookup()} />
                <Input className="input-blue" value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
                <Button size="sm" variant="outline" onClick={() => void handleLocationLookup()}>Lookup</Button>
              </div>
              {locationSource && <p className="text-[10px] text-muted-foreground">{locationSource}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Province</Label>
                <Select value={form.province} onValueChange={v => set('province', v)}>
                  <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Address</Label><Input className="input-blue mt-1" value={form.address} onChange={e => set('address', e.target.value)} /></div>
              <div><Label className="text-xs">Distance (km)</Label><Input className="input-blue mt-1" value={form.distance} onChange={e => set('distance', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" value={form.width} onChange={e => set('width', e.target.value)} /></div>
              <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" value={form.length} onChange={e => set('length', e.target.value)} /></div>
              <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" value={form.height} onChange={e => set('height', e.target.value)} /></div>
            </div>
            {/* Pitch & Height impact notes */}
            {(parseFloat(form.pitch) > 1 || parseFloat(form.height) > 14) && (
              <div className="bg-muted rounded-md p-3 text-xs space-y-1">
                {parseFloat(form.pitch) > 1 && <p className="text-muted-foreground">📐 {pitchCostMultiplier(parseFloat(form.pitch)).note}</p>}
                {parseFloat(form.height) > 14 && <p className="text-muted-foreground">📏 {heightCostMultiplier(parseFloat(form.height)).note}</p>}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Roof Pitch (:12)</Label><Input className="input-blue mt-1" value={form.pitch} onChange={e => set('pitch', e.target.value)} placeholder="1" /></div>
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
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Contingency %</Label><Input className="input-blue mt-1" value={form.contingencyPct} onChange={e => set('contingencyPct', e.target.value)} /></div>
              <div><Label className="text-xs">Insulation ($)</Label><Input className="input-blue mt-1" value={form.insulationCost} onChange={e => set('insulationCost', e.target.value)} /></div>
              <div><Label className="text-xs">Insulation Grade</Label><Input className="input-blue mt-1" value={form.insulationGrade} onChange={e => set('insulationGrade', e.target.value)} /></div>
            </div>
          </div>

          <Button onClick={generate} className="w-full" size="lg">
            <FileText className="h-4 w-4 mr-2" />Generate Internal Quote
          </Button>
        </div>

        {/* Quote Output */}
        {quote && (
          <div className="space-y-4">
            <div className="bg-card border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Internal Sales Quote</h3>
                <div className="flex gap-2">
                  <Button onClick={downloadPdf} size="sm" variant="outline"><Download className="h-3 w-3 mr-1" />PDF</Button>
                  <Button onClick={emailQuote} size="sm" variant="outline"><Mail className="h-3 w-3 mr-1" />Email</Button>
                  <Button onClick={saveToLog} size="sm" variant="outline">Save to Log</Button>
                </div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-md p-2 text-xs text-destructive font-medium">
                ⚠ CONFIDENTIAL — INTERNAL USE ONLY
              </div>

              {perLbCheck !== null && (
                <div className={`flex items-center gap-2 rounded-md p-2 text-xs font-medium ${perLbInRange ? 'bg-success/10 border border-success/20 text-success' : 'bg-warning/10 border border-warning/20 text-warning'}`}>
                  {perLbInRange
                    ? <><CheckCircle2 className="h-4 w-4" /> $/lb: ${perLbCheck.toFixed(2)} — IN RANGE ($2.15–$2.30)</>
                    : <><AlertTriangle className="h-4 w-4" /> $/lb: ${perLbCheck.toFixed(2)} — CHECK — outside $2.15–$2.30 target</>}
                </div>
              )}

              <div id="internal-quote-output" className="text-sm space-y-3 bg-muted p-5 rounded-md" style={{ lineHeight: '2.2', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <p className="font-bold text-lg">Internal Quote — {quote.jobId}</p>
                <p className="text-sm text-muted-foreground">Client: <strong>{quote.clientName}</strong> (ID: {quote.clientId})</p>
                <p className="text-sm text-muted-foreground">Job Name: <strong>{quote.jobName}</strong></p>
                <p className="text-sm text-muted-foreground">Sales Rep: {quote.salesRep} | Estimator: {quote.estimator}</p>
                <p className="text-sm text-muted-foreground">Building: <strong>{quote.width}′ × {quote.length}′ × {quote.height}′</strong> | {formatNumber(quote.sqft)} sqft | {formatNumber(quote.weight)} lbs | Pitch: {form.pitch}:12</p>
                <p className="text-sm text-muted-foreground">Location: {quote.city}, {quote.province} {quote.postalCode}</p>
                <div className="h-3" />
                <div className="border-b pb-1 mb-2 text-sm font-bold text-foreground">Cost Breakdown</div>
                <QRow label="Steel" value={quote.adjustedSteel} bold />
                <QRow label="Engineering Drawings" value={quote.engineering} />
                <QRow label="Foundation Drawing" value={quote.foundation} />
                {quote.gutters > 0 && <QRow label="Gutters" value={quote.gutters} />}
                {quote.liners > 0 && <QRow label="Liners" value={quote.liners} />}
                {quote.insulation > 0 && <QRow label="Insulation" value={quote.insulation} />}
                <QRow label={`Freight Estimate (${form.distance}km, ${form.remoteLevel})`} value={quote.freight} />
                <div className="h-2" />
                <QRow label="SUBTOTAL" value={quote.combinedTotal} bold />
                <QRow label="$/sqft" value={quote.perSqft} />
                <div className="h-2" />
                {quote.contingency > 0 && <QRow label={`Contingency (${quote.contingencyPct}%)`} value={quote.contingency} />}
                <div className="h-3" />
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>TOTAL</span><span>{formatCurrency(quote.grandTotal)}</span></div>
                <p className="text-xs text-muted-foreground italic">Tax excluded — applied at point of sale</p>
              </div>
            </div>

            {/* Cost-Saving Tips */}
            {costSavingTips.length > 0 && (
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                  <Lightbulb className="h-4 w-4" /> Cost-Saving Opportunities
                </div>
                {costSavingTips.map((tip, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{tip}</p>
                ))}
              </div>
            )}

            {/* Compliance Notes */}
            {complianceNotes.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="w-full">
                  <div className="bg-card border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-semibold text-muted-foreground">Compliance Notes (Audit Trail)</span>
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
        )}
      </div>
    </div>
  );
}

function QRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? 'font-bold text-base' : ''}`} style={{ lineHeight: '2.2' }}>
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );
}
