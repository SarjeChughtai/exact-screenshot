import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { useRoles } from '@/context/RoleContext';
import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';
import { Trash2, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Quote } from '@/types';

interface SavedEstimate {
  id: string;
  label: string;
  date: string;
  clientName: string;
  clientId: string;
  salesRep: string;
  width: number;
  length: number;
  height: number;
  leftEaveHeight?: number;
  rightEaveHeight?: number;
  pitch: number;
  province: string;
  grandTotal: number;
  sqft: number;
  estimatedTotal: number;
  notes: string;
  auditNotes: string[];
  allData: Record<string, any>;
}

function getEstimates(): SavedEstimate[] {
  try { return JSON.parse(localStorage.getItem('csb_estimates') || '[]'); } catch { return []; }
}

function saveEstimates(estimates: SavedEstimate[]) {
  localStorage.setItem('csb_estimates', JSON.stringify(estimates));
}

export default function EstimatesLog() {
  const [estimates, setEstimates] = useState<SavedEstimate[]>(getEstimates());
  const [expanded, setExpanded] = useState<string | null>(null);
  const { hasAnyRole } = useRoles();
  const { addQuote } = useAppContext();
  const navigate = useNavigate();
  const isAdminOwner = hasAnyRole('admin', 'owner');

  const remove = (id: string) => {
    const updated = estimates.filter(e => e.id !== id);
    saveEstimates(updated);
    setEstimates(updated);
    toast.success('Estimate removed');
  };

  const convertToQuote = async (est: SavedEstimate) => {
    const jobId = `CSB-${Date.now().toString(36).toUpperCase()}`;
    const r = est.allData?.result;
    if (!r) {
      toast.error('Estimate data incomplete — cannot convert');
      return;
    }

    const quote: Quote = {
      id: crypto.randomUUID(),
      date: est.date,
      jobId,
      jobName: `${est.width}x${est.length} Steel Building`,
      clientName: est.clientName,
      clientId: est.clientId,
      salesRep: est.salesRep,
      estimator: est.salesRep,
      province: est.province,
      city: '',
      address: '',
      postalCode: '',
      width: est.width,
      length: est.length,
      height: est.height,
      ...(est.leftEaveHeight != null && est.rightEaveHeight != null ? { leftEaveHeight: est.leftEaveHeight, rightEaveHeight: est.rightEaveHeight, isSingleSlope: true } : {}),
      pitch: est.pitch,
      sqft: est.sqft,
      weight: r.weight || 0,
      baseSteelCost: r.steelCost || 0,
      steelAfter12: r.steelCost || 0,
      markup: r.markupAmount || 0,
      adjustedSteel: r.steelWithMargin || 0,
      engineering: r.engineering || 0,
      foundation: r.foundation || 0,
      foundationType: est.allData?.foundationType || 'slab',
      gutters: r.gutters || 0,
      liners: r.liners || 0,
      insulation: r.insulation || 0,
      insulationGrade: est.allData?.insulationGrade || '',
      freight: r.freight || 0,
      combinedTotal: r.subtotal || 0,
      perSqft: r.subtotal ? r.subtotal / est.sqft : 0,
      perLb: r.weight ? (r.steelWithMargin || 0) / r.weight : 0,
      contingencyPct: parseFloat(est.allData?.contingencyPct) || 5,
      contingency: r.contingency || 0,
      gstHst: r.gstHst || 0,
      qst: r.qst || 0,
      grandTotal: est.grandTotal,
      status: 'Draft',
    };

    await addQuote(quote);
    toast.success(`Quote created from ${est.label} — see Quote Log`);
    navigate('/quote-log');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Estimates Log</h2>
        <p className="text-sm text-muted-foreground mt-1">{estimates.length} saved estimates</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-3 py-2 w-6"></th>
              {['Label', 'Date', 'Client', 'Sales Rep', 'Dimensions', 'Sqft', 'Estimated Total', 'Grand Total', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estimates.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No estimates saved yet. Use the Quick Estimator to create one.</td></tr>
            ) : estimates.map(est => (
              <>
                <tr key={est.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setExpanded(prev => prev === est.id ? null : est.id)}>
                  <td className="px-3 py-2">{expanded === est.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{est.label}</td>
                  <td className="px-3 py-2 text-xs">{est.date}</td>
                  <td className="px-3 py-2">{est.clientName}</td>
                  <td className="px-3 py-2 text-xs">{est.salesRep}</td>
                  <td className="px-3 py-2 text-xs">{est.width}×{est.length}×{est.height}{est.leftEaveHeight && est.rightEaveHeight && est.leftEaveHeight !== est.rightEaveHeight ? ` (${est.leftEaveHeight}′/${est.rightEaveHeight}′)` : ''}</td>
                  <td className="px-3 py-2 font-mono">{formatNumber(est.sqft)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(est.estimatedTotal)}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(est.grandTotal)}</td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => void convertToQuote(est)}>
                        <ArrowRight className="h-3 w-3 mr-1" />Quote
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => remove(est.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
                {expanded === est.id && isAdminOwner && est.auditNotes.length > 0 && (
                  <tr key={`${est.id}-audit`} className="bg-muted/30">
                    <td colSpan={10} className="px-6 py-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">🔒 Audit Notes (Owner View)</p>
                      {est.auditNotes.map((note, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{note}</p>
                      ))}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
