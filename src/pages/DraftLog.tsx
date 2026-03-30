import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface DraftQuote {
  id: string;
  savedAt: string;
  jobId: string;
  jobName: string;
  clientName: string;
  salesRep: string;
  buildings: { label: string; width: string; length: string; height: string; pitch: string }[];
  totalSupplierCost: number;
  grandTotal: number;
  province: string;
}

function getDrafts(): DraftQuote[] {
  try { return JSON.parse(localStorage.getItem('csb_draft_quotes') || '[]'); }
  catch (e) { console.error('Failed to parse draft quotes from localStorage', e); return []; }
}

function saveDrafts(drafts: DraftQuote[]) {
  localStorage.setItem('csb_draft_quotes', JSON.stringify(drafts));
}

export default function DraftLog() {
  const [drafts, setDrafts] = useState<DraftQuote[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  const deleteDraft = (id: string) => {
    const updated = drafts.filter(d => d.id !== id);
    saveDrafts(updated);
    setDrafts(updated);
    toast.success('Draft deleted');
  };

  const loadDraft = (d: any) => {
    // If we have full state (saved with my new implementation), use it
    const stateToSave = {
      form: d.form,
      buildings: d.buildings,
      supplierMarkupPct: d.supplierMarkupPct,
      singleSlope: d.singleSlope,
      leftEaveHeight: d.leftEaveHeight,
      rightEaveHeight: d.rightEaveHeight,
      updatedAt: new Date().toISOString()
    };
    
    // If it's an old draft (saved before this change), try to reconstruct it
    if (!d.form) {
      stateToSave.form = {
        jobId: d.jobId,
        jobName: d.jobName,
        clientName: d.clientName,
        salesRep: d.salesRep,
        province: d.province
      };
      stateToSave.buildings = d.buildings;
    }

    localStorage.setItem('csb_internal_builder_active_state', JSON.stringify(stateToSave));
    toast.success('Draft loaded into Builder');
    navigate('/internal-quote-builder');
  };

  const clearAll = () => {
    saveDrafts([]);
    setDrafts([]);
    toast.success('All drafts cleared');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Draft Log</h2>
          <p className="text-sm text-muted-foreground mt-1">Auto-saved internal quotes — {drafts.length} draft(s)</p>
        </div>
        {drafts.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll}>Clear All</Button>
        )}
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Saved At', 'Job ID', 'Client', 'Sales Rep', 'Province', 'Buildings', 'Grand Total', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drafts.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No drafts saved yet — calculated quotes in Internal Quote Builder are saved here automatically</td></tr>
            ) : [...drafts].reverse().map(d => (
              <tr key={d.id} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(d.savedAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-xs">{d.jobId || '—'}</td>
                <td className="px-3 py-2">{d.clientName || '—'}</td>
                <td className="px-3 py-2 text-xs">{d.salesRep || '—'}</td>
                <td className="px-3 py-2 text-xs">{d.province}</td>
                <td className="px-3 py-2 text-xs">{d.buildings.map(b => `${b.width || '?'}×${b.length || '?'}×${b.height || '?'}`).join(', ')}</td>
                <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(d.grandTotal)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => loadDraft(d)}>
                      <ExternalLink className="h-3 w-3 text-primary" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteDraft(d.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
