import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency, formatNumber, PROVINCES, getProvinceTax, calcFreight, calcEngineeringFromFactor, lookupFoundation, calcMarkup, getMarkupRate } from '@/lib/calculations';
import { estimateFreightFromLocation } from '@/lib/freightEstimate';
import type { Quote } from '@/types';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, AlertTriangle, Download, Mail, ChevronDown, X, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
}

export default function InternalQuoteBuilder() {
  const { addQuote, deals, quotes } = useAppContext();
  const { settings, getSalesReps } = useSettings();

  const [form, setForm] = useState({
    jobId: '', jobName: '', clientName: '', clientId: '',
    salesRep: '', estimator: '', province: 'ON',
    city: '', address: '', postalCode: '',
    width: '', length: '', height: '14',
    distance: '200', remoteLevel: 'none',
    complexityFactor: '1.0',
    foundationType: 'slab' as 'slab' | 'frost_wall',
    insulationCost: '0', insulationGrade: '',
    gutters: '0', liners: '0',
    contingencyPct: '5',
    notes: '',
  });

  const [supplierMarkupPct, setSupplierMarkupPct] = useState(String(settings.supplierIncreasePct));
  const [internalMarkupPct, setInternalMarkupPct] = useState('0');
  const [costData, setCostData] = useState<CostFileData>({ steelWeightLbs: 0, supplierCostPerLb: 0, totalSupplierCost: 0, accessories: [] });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [tieredMarkupInfo, setTieredMarkupInfo] = useState<{ rate: number; amount: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [complianceNotes, setComplianceNotes] = useState<string[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

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
    let pWidth = 0, pLength = 0, pHeight = 0;
    let clientName = '', clientId = '', jobId = '';
    const accessories: { name: string; weight: number; cost: number }[] = [];

    // Page 2+ project info
    const forMatch = fullText.match(/FOR\s*\n?\s*(.+)/i);
    if (forMatch) clientName = forMatch[1].trim();
    const clientIdMatch = fullText.match(/FOR\s*\n?\s*.+\n?\s*(\d{4,})/i);
    if (clientIdMatch) clientId = clientIdMatch[1].trim();
    const jobMatch = fullText.match(/JOB\s*:?\s*(.+)/i);
    if (jobMatch) jobId = jobMatch[1].trim();

    // Dimensions
    const widthMatch = fullText.match(/Width\s*\(ft\)\s*=\s*([\d.]+)/i);
    const lengthMatch = fullText.match(/Length\s*\(ft\)\s*=\s*([\d.]+)/i);
    const heightMatch = fullText.match(/Eave\s*Height\s*\(ft\)\s*=\s*([\d.]+)/i);
    if (widthMatch) pWidth = parseFloat(widthMatch[1]);
    if (lengthMatch) pLength = parseFloat(lengthMatch[1]);
    if (heightMatch) pHeight = parseFloat(heightMatch[1]);

    // Cost summary — Total line
    const totalMatch = fullText.match(/Total[:\s]+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/i);
    if (totalMatch) {
      weight = parseFloat(totalMatch[1].replace(/,/g, ''));
      totalCost = parseFloat(totalMatch[2].replace(/,/g, ''));
    }

    // PRICE PER WEIGHT
    const pplbMatch = fullText.match(/PRICE\s+PER\s+WEIGHT\s*\(lb\)\s+([\d.]+)/i);
    if (pplbMatch) costPerLb = parseFloat(pplbMatch[1]);

    // Component line items
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

    // Fallbacks
    if (weight && totalCost && !costPerLb) costPerLb = totalCost / weight;
    if (weight && costPerLb && !totalCost) totalCost = weight * costPerLb;

    return { weight, costPerLb, totalCost, pWidth, pLength, pHeight, clientName, clientId, jobId, accessories };
  };

  const identifyMbsWithLLM = async (text: string, filename: string) => {
    const url = import.meta.env.VITE_LOVABLE_PDF_IDENTIFY_URL as string | undefined;
    if (!url) return null;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, text }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json as any;
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const newParsedFiles: ParsedFile[] = [];

    for (const file of fileArr) {
      try {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const pages = await extractTextFromPdf(file);
          const fullText = pages.join('\n');

          if (detectInsulationPdf(fullText)) {
            const insulationTotal = parseInsulationPdf(fullText);
            set('insulationCost', String(insulationTotal));
            newParsedFiles.push({ name: file.name, type: 'insulation', status: 'success', data: { total: insulationTotal } });
            toast.success(`Insulation: ${formatCurrency(insulationTotal)}`);
          } else if (fullText.includes('BUILDING WEIGHT') || fullText.includes('PRICE PER WEIGHT') || fullText.includes('Total:')) {
            const parsed = parseMbsPdf(pages);
            let finalParsed: typeof parsed = parsed;

            // Regex extraction can miss IDs/names; fall back to an LLM when critical fields are missing.
            const needsLLM = !parsed.clientId || !parsed.jobId || !parsed.clientName;
            if (needsLLM) {
              let llm: any = null;
              try {
                llm = await identifyMbsWithLLM(fullText, file.name);
              } catch {
                llm = null;
              }
              if (llm) {
                finalParsed = {
                  ...parsed,
                  clientName: llm.clientName || llm.client_name || parsed.clientName,
                  clientId: llm.clientId || llm.client_id || parsed.clientId,
                  jobId: llm.jobId || llm.job_id || parsed.jobId,
                  pWidth: llm.pWidth ?? llm.width ?? parsed.pWidth,
                  pLength: llm.pLength ?? llm.length ?? parsed.pLength,
                  pHeight: llm.pHeight ?? llm.height ?? parsed.pHeight,
                  // Optional: only override cost figures if LLM provides them.
                  weight: llm.weight ?? parsed.weight,
                  costPerLb: llm.costPerLb ?? llm.cost_per_lb ?? parsed.costPerLb,
                  totalCost: llm.totalCost ?? llm.total_cost ?? parsed.totalCost,
                  accessories: llm.accessories ?? parsed.accessories,
                };
              }
            }

            if (finalParsed.pWidth) set('width', String(finalParsed.pWidth));
            if (finalParsed.pLength) set('length', String(finalParsed.pLength));
            if (finalParsed.pHeight) set('height', String(finalParsed.pHeight));
            if (finalParsed.clientName) set('clientName', finalParsed.clientName);
            if (finalParsed.clientId) set('clientId', finalParsed.clientId);
            if (finalParsed.jobId) set('jobId', finalParsed.jobId);
            setCostData({
              steelWeightLbs: finalParsed.weight,
              supplierCostPerLb: finalParsed.costPerLb,
              totalSupplierCost: finalParsed.totalCost,
              accessories: finalParsed.accessories,
            });
            newParsedFiles.push({ name: file.name, type: 'mbs', status: 'success', data: finalParsed });

            // Auto freight from postal code if available
            if (form.postalCode) {
              const est = await estimateFreightFromLocation(form.postalCode);
              if (est) set('distance', est.distanceKm.toString());
            }

            toast.success(`MBS: ${formatNumber(finalParsed.weight)} lbs @ $${finalParsed.costPerLb.toFixed(2)}/lb | ${finalParsed.pWidth}×${finalParsed.pLength}×${finalParsed.pHeight}`);
          } else {
            newParsedFiles.push({ name: file.name, type: 'unknown', status: 'failed' });
            toast.error(`Could not identify: ${file.name}`);
          }
        } else {
          const text = await file.text();
          // Attempt MBS text parse
          const parsed = parseMbsPdf([text]);
          if (parsed.weight > 0) {
            setCostData({ steelWeightLbs: parsed.weight, supplierCostPerLb: parsed.costPerLb, totalSupplierCost: parsed.totalCost, accessories: parsed.accessories });
            newParsedFiles.push({ name: file.name, type: 'mbs', status: 'success' });
          } else {
            newParsedFiles.push({ name: file.name, type: 'unknown', status: 'failed' });
          }
        }
      } catch {
        newParsedFiles.push({ name: file.name, type: 'unknown', status: 'failed' });
        toast.error(`Error parsing ${file.name}`);
      }
    }
    setParsedFiles(prev => [...prev, ...newParsedFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
  };

  const generate = () => {
    const w = parseFloat(form.width) || 0;
    const l = parseFloat(form.length) || 0;
    const h = parseFloat(form.height) || 14;
    const sqft = w * l;
    if (!sqft || !costData.steelWeightLbs || !costData.totalSupplierCost) {
      toast.error('Enter dimensions and steel cost data');
      return;
    }

    const weight = costData.steelWeightLbs;
    const supplierMarkup = parseFloat(supplierMarkupPct) / 100;
    const additionalMarkup = parseFloat(internalMarkupPct) / 100;

    const adjustedCostPerLb = costData.supplierCostPerLb * (1 + supplierMarkup);
    const steelAfterSupplierMarkup = adjustedCostPerLb * weight;
    const tieredMarkupAmount = calcMarkup(steelAfterSupplierMarkup);
    const tieredRate = getMarkupRate(steelAfterSupplierMarkup);
    const adjustedSteel = steelAfterSupplierMarkup + tieredMarkupAmount;
    setTieredMarkupInfo({ rate: tieredRate, amount: tieredMarkupAmount });

    const engineering = calcEngineeringFromFactor(parseFloat(form.complexityFactor) || 1);
    const foundation = lookupFoundation(sqft, form.foundationType);
    const insulation = parseFloat(form.insulationCost) || 0;
    const guttersVal = parseFloat(form.gutters) || 0;
    const linersVal = parseFloat(form.liners) || 0;
    const freight = calcFreight(parseFloat(form.distance) || 0, weight, form.remoteLevel);

    const subtotal = adjustedSteel + engineering + foundation + insulation + guttersVal + linersVal + freight;
    const additionalMarkupAmount = subtotal * additionalMarkup;
    const combinedTotal = subtotal + additionalMarkupAmount;
    const contingency = combinedTotal * (parseFloat(form.contingencyPct) || 0) / 100;
    const totalPlusCont = combinedTotal + contingency;
    const taxes = getProvinceTax(form.province);
    const taxRate = taxes.order_rate;
    const gstHst = totalPlusCont * (taxes.type === 'GST+QST' ? (taxes.gst || 0.05) : taxRate);
    const qst = taxes.type === 'GST+QST' ? totalPlusCont * (taxes.qst || 0.09975) : 0;
    const finalPerLb = adjustedSteel / weight;

    // Build compliance notes
    const notes: string[] = [
      `Base Steel (from MBS): ${formatCurrency(costData.totalSupplierCost)} at ${formatNumber(weight)} lbs = $${costData.supplierCostPerLb.toFixed(2)}/lb`,
      `+${supplierMarkupPct}% Supplier: $/lb goes from $${costData.supplierCostPerLb.toFixed(2)} to $${adjustedCostPerLb.toFixed(2)} → steel becomes ${formatCurrency(steelAfterSupplierMarkup)}`,
      `Tiered Markup: tier = ${(tieredRate * 100).toFixed(1)}%, amount = ${formatCurrency(tieredMarkupAmount)}${tieredMarkupAmount === 3000 ? ' ($3K minimum applied)' : ''}`,
      `Adjusted Steel: ${formatCurrency(adjustedSteel)} → final $/lb = $${finalPerLb.toFixed(2)} (${finalPerLb >= 2.15 && finalPerLb <= 2.30 ? 'IN RANGE' : 'CHECK'} vs $2.15–$2.30)`,
      `Engineering: base $1,200 × factor ${form.complexityFactor} = ${formatCurrency(1200 * (parseFloat(form.complexityFactor) || 1))} + $500 markup = ${formatCurrency(engineering)}`,
      `Foundation: sqft=${formatNumber(sqft)}, type=${form.foundationType}, base=${formatCurrency(foundation - 500)} + $500 = ${formatCurrency(foundation)}`,
      `Insulation: ${formatCurrency(insulation)} (pass-through, no markup)`,
      `Freight: MAX($4,000, ${form.distance}km × $4) + remote + overweight = ${formatCurrency(freight)}`,
      additionalMarkup > 0 ? `Internal Additional: ${internalMarkupPct}% of ${formatCurrency(subtotal)} = ${formatCurrency(additionalMarkupAmount)}` : '',
      `Tax: province = ${form.province}, type = ${taxes.type}, rate = ${(taxRate * 100).toFixed(2)}%`,
      `ALL FIGURES SOURCE: 143 MBS projects for steel tiers, 48 Silvercote quotes for insulation, foundation schedule v1`,
    ].filter(Boolean);
    setComplianceNotes(notes);

    const q: Quote = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      jobId: form.jobId || `CSB-${Date.now().toString(36).toUpperCase()}`,
      jobName: form.jobName, clientName: form.clientName, clientId: form.clientId,
      salesRep: form.salesRep, estimator: form.estimator,
      province: form.province, city: form.city, address: form.address, postalCode: form.postalCode,
      width: w, length: l, height: h, sqft, weight,
      baseSteelCost: costData.totalSupplierCost, steelAfter12: steelAfterSupplierMarkup,
      markup: tieredMarkupAmount + additionalMarkupAmount, adjustedSteel,
      engineering, foundation, foundationType: form.foundationType,
      gutters: guttersVal, liners: linersVal, insulation, insulationGrade: form.insulationGrade,
      freight, combinedTotal, perSqft: combinedTotal / sqft, perLb: finalPerLb,
      contingencyPct: parseFloat(form.contingencyPct) || 0, contingency,
      gstHst, qst, grandTotal: totalPlusCont + gstHst + qst, status: 'Draft',
    };
    setQuote(q);
  };

  const saveToLog = () => {
    if (!quote) return;
    addQuote(quote);
    toast.success('Internal quote saved to Quote Log');
  };

  const downloadPdf = () => {
    if (!quote) return;
    const printContent = document.getElementById('internal-quote-output');
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Internal Quote - ${quote.jobId}</title><style>body{font-family:monospace;font-size:12px;padding:20px;} .bold{font-weight:bold;} .header{text-align:center;margin-bottom:20px;} .row{display:flex;justify-content:space-between;margin:2px 0;} .divider{border-top:1px solid #ccc;margin:8px 0;} .warning{color:red;font-weight:bold;}</style></head><body>`);
    win.document.write(`<div class="header"><h2>INTERNAL SALES QUOTE — ${quote.jobId}</h2><p class="warning">CONFIDENTIAL — INTERNAL USE ONLY</p></div>`);
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
      `COMBINED TOTAL: ${formatCurrency(quote.combinedTotal)}\n$/sqft: ${formatCurrency(quote.perSqft)}\n$/lb: $${quote.perLb.toFixed(2)}\n\n` +
      `GRAND TOTAL (incl tax): ${formatCurrency(quote.grandTotal)}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const perLbCheck = quote ? quote.perLb : null;
  const perLbInRange = perLbCheck !== null && perLbCheck >= 2.15 && perLbCheck <= 2.30;
  const salesReps = getSalesReps();

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Internal Quote Builder</h2>
        <p className="text-sm text-muted-foreground mt-1">Drop MBS + insulation cost files, apply markups, generate internal sales quotes</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          {/* Multi-file Upload */}
          <div
            className={`bg-card border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive ? 'border-accent bg-accent/5' : 'border-border'}`}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop MBS cost files + insulation quotes</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, CSV, TXT — drop multiple files at once</p>
            <label className="mt-3 inline-block">
              <input type="file" className="hidden" accept=".csv,.txt,.pdf" multiple onChange={e => e.target.files && handleFileUpload(e.target.files)} />
              <Button variant="outline" size="sm" asChild><span>Or browse files</span></Button>
            </label>
          </div>

          {/* Parsed files list */}
          {parsedFiles.length > 0 && (
            <div className="bg-muted rounded-md p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground mb-1">Uploaded Files</p>
              {parsedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {f.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertTriangle className="h-3 w-3 text-destructive" />}
                    <span>{f.name}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${f.type === 'mbs' ? 'bg-accent/20 text-accent' : f.type === 'insulation' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {f.type === 'mbs' ? 'MBS Cost File' : f.type === 'insulation' ? 'Insulation Quote' : 'Unknown'}
                  </span>
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-destructive">Markup Controls</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Supplier Markup on $/lb (%)</Label>
                <Input className="input-blue mt-1" type="number" step="0.5" value={supplierMarkupPct} onChange={e => setSupplierMarkupPct(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Additional Internal Markup (%)</Label>
                <Input className="input-blue mt-1" type="number" step="0.5" value={internalMarkupPct} onChange={e => setInternalMarkupPct(e.target.value)} />
                <p className="text-[10px] text-muted-foreground mt-1">Extra margin beyond tiered steel markup (default 0%)</p>
              </div>
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
              <div><Label className="text-xs">Job Name</Label><Input className="input-blue mt-1" value={form.jobName} onChange={e => set('jobName', e.target.value)} /></div>
              <div><Label className="text-xs">Client Name</Label><Input className="input-blue mt-1" value={form.clientName} onChange={e => set('clientName', e.target.value)} /></div>
              <div><Label className="text-xs">Client ID</Label><Input className="input-blue mt-1" value={form.clientId} onChange={e => set('clientId', e.target.value)} /></div>
              <div>
                <Label className="text-xs">Sales Rep</Label>
                {salesReps.length > 0 ? (
                  <Select value={form.salesRep} onValueChange={v => set('salesRep', v)}>
                    <SelectTrigger className="input-blue mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {salesReps.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <Input className="input-blue mt-1" value={form.salesRep} onChange={e => set('salesRep', e.target.value)} />}
              </div>
              <div><Label className="text-xs">Estimator</Label><Input className="input-blue mt-1" value={form.estimator} onChange={e => set('estimator', e.target.value)} /></div>
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
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" value={form.width} onChange={e => set('width', e.target.value)} /></div>
              <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" value={form.length} onChange={e => set('length', e.target.value)} /></div>
              <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" value={form.height} onChange={e => set('height', e.target.value)} /></div>
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
              <div><Label className="text-xs">Complexity Factor</Label><Input className="input-blue mt-1" value={form.complexityFactor} onChange={e => set('complexityFactor', e.target.value)} /></div>
              <div><Label className="text-xs">Contingency %</Label><Input className="input-blue mt-1" value={form.contingencyPct} onChange={e => set('contingencyPct', e.target.value)} /></div>
              <div><Label className="text-xs">Insulation ($)</Label><Input className="input-blue mt-1" value={form.insulationCost} onChange={e => set('insulationCost', e.target.value)} /></div>
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

              <div id="internal-quote-output" className="font-mono text-sm space-y-1 bg-muted p-4 rounded-md">
                <p className="font-bold text-base">Internal Quote — {quote.jobId}</p>
                <p className="text-xs text-muted-foreground">Client: {quote.clientName} (ID: {quote.clientId})</p>
                <p className="text-xs text-muted-foreground">Sales Rep: {quote.salesRep}</p>
                <p className="text-xs text-muted-foreground">Building: {quote.width}′ × {quote.length}′ × {quote.height}′ | {formatNumber(quote.sqft)} sqft | {formatNumber(quote.weight)} lbs</p>
                <p className="text-xs text-muted-foreground">Location: {quote.city}, {quote.province} {quote.postalCode}</p>
                <br />
                <div className="border-b pb-1 mb-1 text-xs font-semibold text-destructive">Cost Breakdown (with markups)</div>
                <QRow label="Raw Supplier Steel" value={costData.totalSupplierCost} />
                <QRow label={`Supplier Markup (${supplierMarkupPct}%)`} value={quote.steelAfter12 - costData.totalSupplierCost} />
                <QRow label="Steel After Supplier Markup" value={quote.steelAfter12} />
                {tieredMarkupInfo && <QRow label={`Tiered Steel Markup (${(tieredMarkupInfo.rate * 100).toFixed(1)}%)`} value={tieredMarkupInfo.amount} />}
                <QRow label="Adjusted Steel Cost" value={quote.adjustedSteel} bold />
                <QRow label="  $/lb after all markups" value={quote.perLb} />
                <br />
                <QRow label="Engineering Fee" value={quote.engineering} />
                <QRow label="Foundation Drawing" value={quote.foundation} />
                <QRow label="Gutters" value={quote.gutters} />
                <QRow label="Liners" value={quote.liners} />
                <QRow label="Insulation" value={quote.insulation} />
                <QRow label="Freight Estimate" value={quote.freight} />
                <br />
                {parseFloat(internalMarkupPct) > 0 && <QRow label={`Additional Internal (${internalMarkupPct}%)`} value={quote.markup - (tieredMarkupInfo?.amount || 0)} />}
                <QRow label="COMBINED TOTAL" value={quote.combinedTotal} bold />
                <QRow label="  $/sqft" value={quote.perSqft} />
                <br />
                <QRow label={`Contingency (${quote.contingencyPct}%)`} value={quote.contingency} />
                <QRow label="GST/HST" value={quote.gstHst} />
                {quote.qst > 0 && <QRow label="QST" value={quote.qst} />}
                <br />
                <div className="flex justify-between font-bold text-base"><span>GRAND TOTAL</span><span>{formatCurrency(quote.grandTotal)}</span></div>
              </div>
            </div>

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
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
