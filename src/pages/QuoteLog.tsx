import { useAppContext } from '@/context/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { QuoteStatus, Deal } from '@/types';
import { toast } from 'sonner';
import { getProvinceTax } from '@/lib/calculations';
import { Trash2, RotateCcw, Archive } from 'lucide-react';
import { useState } from 'react';

const STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Follow Up', 'Won', 'Lost', 'Expired'];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  Draft: 'Draft',
  Sent: 'Request for Quote',
  'Follow Up': 'Follow Up',
  Won: 'Won',
  Lost: 'Lost',
  Expired: 'Expired',
};

export default function QuoteLog() {
  const { quotes, updateQuote, deleteQuote, restoreQuote, addDeal, updateDeal, deals } = useAppContext();
  const [showTrash, setShowTrash] = useState(false);

  const changeStatus = (id: string, status: QuoteStatus) => {
    updateQuote(id, { status });
  };

  const convertToDeal = (q: typeof quotes[0]) => {
    const prov = getProvinceTax(q.province);
    const existing = deals.find(d => d.jobId === q.jobId);

    const dealUpdates: Partial<Deal> = {
      jobName: q.jobName, clientName: q.clientName, clientId: q.clientId,
      salesRep: q.salesRep, estimator: q.estimator, teamLead: '',
      province: q.province, city: q.city, address: q.address, postalCode: q.postalCode,
      width: q.width, length: q.length, height: q.height, sqft: q.sqft, weight: q.weight,
      taxRate: prov.order_rate, taxType: prov.type,
      orderType: '', dateSigned: new Date().toISOString().split('T')[0],
      dealStatus: 'Quoted',
      paymentStatus: 'UNPAID',
      productionStatus: 'Submitted', freightStatus: 'Pending',
      insulationStatus: 'Pending', deliveryDate: '', pickupDate: '', notes: '',
    };
    if (existing) {
      updateDeal(q.jobId, dealUpdates);
      toast.success(`Deal updated for ${q.jobId}`);
      return;
    }

    const deal: Deal = {
      jobId: q.jobId,
      jobName: q.jobName, clientName: q.clientName, clientId: q.clientId,
      salesRep: q.salesRep, estimator: q.estimator, teamLead: '',
      province: q.province, city: q.city, address: q.address, postalCode: q.postalCode,
      width: q.width, length: q.length, height: q.height, sqft: q.sqft, weight: q.weight,
      taxRate: prov.order_rate, taxType: prov.type,
      orderType: '', dateSigned: new Date().toISOString().split('T')[0],
      dealStatus: 'Quoted', paymentStatus: 'UNPAID',
      productionStatus: 'Submitted', freightStatus: 'Pending',
      insulationStatus: 'Pending', deliveryDate: '', pickupDate: '', notes: '',
    };

    addDeal(deal);
    toast.success(`Deal created for ${q.jobId}`);
  };

  // Separate into groups
  const activeQuotes = quotes.filter(q => !q.isDeleted);
  const deletedQuotes = quotes.filter(q => q.isDeleted);

  const rfqInProgress = activeQuotes.filter(q => q.status === 'Sent');
  const quotesReturned = activeQuotes.filter(q => q.status === 'Follow Up');
  const otherQuotes = activeQuotes.filter(q => !['Sent', 'Follow Up'].includes(q.status));

  const renderTable = (title: string, subtitle: string, items: typeof quotes, isTrash = false) => (
    <div className="space-y-2">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle} — {items.length} items</p>
      </div>
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Job ID','Date','Client','Sales Rep','Dimensions','Sq Ft','Combined','$/sqft','Status','Actions'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground text-xs">None</td></tr>
            ) : items.map(q => (
              <tr key={q.id} className={`border-b hover:bg-muted/50 ${q.status === 'Lost' || q.status === 'Expired' ? 'status-cancelled' : ''}`}>
                <td className="px-3 py-2 font-mono text-xs">{q.jobId}</td>
                <td className="px-3 py-2 text-xs">{q.date}</td>
                <td className="px-3 py-2">{q.clientName}</td>
                <td className="px-3 py-2">{q.salesRep}</td>
                <td className="px-3 py-2 text-xs">{q.width}×{q.length}×{q.height}</td>
                <td className="px-3 py-2 font-mono">{formatNumber(q.sqft)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(q.combinedTotal)}</td>
                <td className="px-3 py-2 font-mono">{formatCurrency(q.perSqft)}</td>
                <td className="px-3 py-2">
                  <Select 
                    value={q.status} 
                    onValueChange={v => changeStatus(q.id, v as QuoteStatus)}
                    disabled={isTrash}
                  >
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {isTrash ? (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          restoreQuote(q.id);
                          toast.success(`Quote ${q.jobId} restored`);
                        }}
                        title="Restore Quote"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <>
                        {deals.find(d => d.jobId === q.jobId) ? (
                          <span className="text-xs text-muted-foreground mr-2">Deal exists</span>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => convertToDeal(q)}>→ Convert to Deal</Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            deleteQuote(q.id);
                            toast.success(`Quote ${q.jobId} moved to trash`);
                          }}
                          title="Delete Quote"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Quote Log</h2>
        <p className="text-sm text-muted-foreground mt-1">{quotes.length} quotes total</p>
      </div>

      {renderTable('RFQs In Progress', 'Quotes submitted as RFQ — awaiting factory response', rfqInProgress)}
      {renderTable('Quotes Returned', 'Quotes sent back / follow up required', quotesReturned)}
      {renderTable('All Other Quotes', 'Draft, Won, Lost, Expired', otherQuotes)}

      <div className="pt-8 border-t">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-muted-foreground">Recently Deleted</h3>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowTrash(!showTrash)}
            className="text-xs"
          >
            {showTrash ? 'Hide Trash' : `Show Trash (${deletedQuotes.length})`}
          </Button>
        </div>
        
        {showTrash && renderTable('', 'Quotes moved to trash — can be restored', deletedQuotes, true)}
      </div>
    </div>
  );
}
