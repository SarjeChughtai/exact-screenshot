import { useAppContext } from '@/context/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { QuoteStatus, Deal } from '@/types';
import { toast } from 'sonner';
import { getProvinceTax } from '@/lib/calculations';

const STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Follow Up', 'Won', 'Lost', 'Expired'];

export default function QuoteLog() {
  const { quotes, updateQuote, addDeal, updateDeal, deals } = useAppContext();

  const changeStatus = (id: string, status: QuoteStatus) => {
    updateQuote(id, { status });
  };

  const STATUS_LABELS: Record<QuoteStatus, string> = {
    Draft: 'Draft',
    Sent: 'Request for Quote',
    'Follow Up': 'Follow Up',
    Won: 'Won',
    Lost: 'Lost',
    Expired: 'Expired',
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
      jobName: q.jobName,
      clientName: q.clientName,
      clientId: q.clientId,
      salesRep: q.salesRep,
      estimator: q.estimator,
      teamLead: '',
      province: q.province,
      city: q.city,
      address: q.address,
      postalCode: q.postalCode,
      width: q.width,
      length: q.length,
      height: q.height,
      sqft: q.sqft,
      weight: q.weight,
      taxRate: prov.order_rate,
      taxType: prov.type,
      orderType: '',
      dateSigned: new Date().toISOString().split('T')[0],
      dealStatus: 'Quoted',
      paymentStatus: 'UNPAID',
      productionStatus: 'Submitted',
      freightStatus: 'Pending',
      insulationStatus: 'Pending',
      deliveryDate: '',
      pickupDate: '',
      notes: '',
    };

    addDeal(deal);
    toast.success(`Deal created for ${q.jobId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Quote Log</h2>
        <p className="text-sm text-muted-foreground mt-1">{quotes.length} quotes total</p>
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
            {quotes.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No quotes yet</td></tr>
            ) : quotes.map(q => (
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
                  {q.status === 'Won' && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => convertToDeal(q)}>→ Deal</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
