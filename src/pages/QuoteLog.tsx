import { useAppContext } from '@/context/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { QuoteStatus, Deal } from '@/types';
import { toast } from 'sonner';
import { getProvinceTax } from '@/lib/calculations';

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
  const { quotes, updateQuote, addDeal, updateDeal, deals } = useAppContext();

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
  const rfqInProgress = quotes.filter(q => q.status === 'Sent');
  const quotesReturned = quotes.filter(q => q.status === 'Follow Up');
  const otherQuotes = quotes.filter(q => !['Sent', 'Follow Up'].includes(q.status));

  const renderTable = (title: string, subtitle: string, items: typeof quotes, highlight?: string) => (
    <div className="space-y-2">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle} — {items.length} items</p>
      </div>
      <div className={`bg-card border rounded-lg overflow-x-auto ${highlight ? `border-${highlight}` : ''}`}>
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
                  <Select value={q.status} onValueChange={v => changeStatus(q.id, v as QuoteStatus)}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  {deals.find(d => d.jobId === q.jobId) ? (
                    <span className="text-xs text-muted-foreground">Deal exists</span>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => convertToDeal(q)}>→ Convert to Deal</Button>
                  )}
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
    </div>
  );
}
