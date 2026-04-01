import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { useRoles } from '@/context/RoleContext';
import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';
import { Trash2, ArrowRight, ChevronDown, ChevronRight, Pencil } from 'lucide-react';

export default function EstimatesLog() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { hasAnyRole } = useRoles();
  const { estimates, deleteEstimate } = useAppContext();
  const navigate = useNavigate();
  const isAdminOwner = hasAnyRole('admin', 'owner');

  const remove = async (id: string) => {
    await deleteEstimate(id);
    toast.success('Estimate removed');
  };

  const importToRfq = (estimateId: string) => {
    navigate(`/quote-rfq?estimateId=${estimateId}`);
  };

  const editEstimate = (estimateId: string) => {
    navigate(`/estimator?estimateId=${estimateId}`);
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
              {['Label', 'Date', 'Client', 'Sales Rep', 'Dimensions', 'Sqft', 'Estimated Total', 'Grand Total', 'Actions'].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {estimates.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No estimates saved yet. Use the Quick Estimator to create one.</td></tr>
            ) : estimates.map(estimate => (
              <Fragment key={estimate.id}>
                <tr className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setExpanded(prev => prev === estimate.id ? null : estimate.id)}>
                  <td className="px-3 py-2">{expanded === estimate.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{estimate.label}</td>
                  <td className="px-3 py-2 text-xs">{estimate.date}</td>
                  <td className="px-3 py-2">{estimate.clientName}</td>
                  <td className="px-3 py-2 text-xs">{estimate.salesRep}</td>
                  <td className="px-3 py-2 text-xs">{estimate.width}x{estimate.length}x{estimate.height}</td>
                  <td className="px-3 py-2 font-mono">{formatNumber(estimate.sqft)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(estimate.estimatedTotal)}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{formatCurrency(estimate.grandTotal)}</td>
                  <td className="px-3 py-2" onClick={event => event.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => editEstimate(estimate.id)}>
                        <Pencil className="h-3 w-3 mr-1" />Edit
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => importToRfq(estimate.id)}>
                        <ArrowRight className="h-3 w-3 mr-1" />Import to RFQ
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => void remove(estimate.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
                {expanded === estimate.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={10} className="px-6 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Estimate Payload</p>
                          <p className="text-xs">City: {estimate.city || 'Not set'}</p>
                          <p className="text-xs">Province: {estimate.province}</p>
                          <p className="text-xs">Postal Code: {estimate.postalCode || 'Not set'}</p>
                          <p className="text-xs">Pitch: {estimate.pitch}:12</p>
                          <p className="text-xs">Client ID: {estimate.clientId || 'Not set'}</p>
                        </div>
                        {isAdminOwner && estimate.auditNotes.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Audit Notes</p>
                            {estimate.auditNotes.map((note, index) => (
                              <p key={index} className="text-xs text-muted-foreground font-mono">{note}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
