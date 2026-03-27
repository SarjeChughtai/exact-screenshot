import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MasterData() {
  const { quotes, deals, rfqs, freight, payments } = useAppContext();
  const { settings } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Master Data</h2>
        <p className="text-sm text-muted-foreground mt-1">Owner overview of all system datasets</p>
      </div>

      <Tabs defaultValue="deals">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
          <TabsTrigger value="rfqs">Freight RFQs ({rfqs.length})</TabsTrigger>
          <TabsTrigger value="freight">Freight Board ({freight.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="personnel">Personnel ({settings.personnel.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="deals">
          <div className="bg-card border rounded-lg overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-primary text-primary-foreground text-xs">
                {['Job ID','Client','Rep','Province','Status','Deal Status','Sqft','Weight'].map(h=><th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {deals.map(d=>(
                  <tr key={d.jobId} className="border-b hover:bg-muted/50 text-xs">
                    <td className="px-2 py-1.5 font-mono">{d.jobId}</td>
                    <td className="px-2 py-1.5">{d.clientName}</td>
                    <td className="px-2 py-1.5">{d.salesRep}</td>
                    <td className="px-2 py-1.5">{d.province}</td>
                    <td className="px-2 py-1.5">{d.paymentStatus}</td>
                    <td className="px-2 py-1.5">{d.dealStatus}</td>
                    <td className="px-2 py-1.5">{formatNumber(d.sqft)}</td>
                    <td className="px-2 py-1.5">{formatNumber(d.weight)} lbs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="quotes">
          <div className="bg-card border rounded-lg overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-primary text-primary-foreground text-xs">
                {['Date','Job ID','Client','Rep','Province','Status','Grand Total'].map(h=><th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {quotes.map(q=>(
                  <tr key={q.id} className="border-b hover:bg-muted/50 text-xs">
                    <td className="px-2 py-1.5">{q.date}</td>
                    <td className="px-2 py-1.5 font-mono">{q.jobId}</td>
                    <td className="px-2 py-1.5">{q.clientName}</td>
                    <td className="px-2 py-1.5">{q.salesRep}</td>
                    <td className="px-2 py-1.5">{q.province}</td>
                    <td className="px-2 py-1.5">{q.status}</td>
                    <td className="px-2 py-1.5 font-mono">{formatCurrency(q.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="rfqs">
          <div className="bg-card border rounded-lg overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-primary text-primary-foreground text-xs">
                {['Job ID','Client','Status','Weight','Est Freight','Sent Date'].map(h=><th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {rfqs.map(r=>(
                  <tr key={r.id} className="border-b hover:bg-muted/50 text-xs">
                    <td className="px-2 py-1.5 font-mono">{r.jobId}</td>
                    <td className="px-2 py-1.5">{r.clientName}</td>
                    <td className="px-2 py-1.5">{r.status}</td>
                    <td className="px-2 py-1.5">{formatNumber(r.weight)} lbs</td>
                    <td className="px-2 py-1.5 font-mono">{formatCurrency(r.selectedPrice)}</td>
                    <td className="px-2 py-1.5">{r.sentDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="freight">
          <div className="bg-card border rounded-lg overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-primary text-primary-foreground text-xs">
                {['Job ID','Client','Status','Weight','Est Freight','Actual Freight','Carrier'].map(h=><th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {freight.map(f=>(
                  <tr key={f.jobId} className="border-b hover:bg-muted/50 text-xs">
                    <td className="px-2 py-1.5 font-mono">{f.jobId}</td>
                    <td className="px-2 py-1.5">{f.clientName}</td>
                    <td className="px-2 py-1.5">{f.status}</td>
                    <td className="px-2 py-1.5">{formatNumber(f.weight)} lbs</td>
                    <td className="px-2 py-1.5 font-mono">{formatCurrency(f.estFreight)}</td>
                    <td className="px-2 py-1.5 font-mono">{formatCurrency(f.actualFreight)}</td>
                    <td className="px-2 py-1.5">{f.carrier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="bg-card border rounded-lg overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-primary text-primary-foreground text-xs">
                {['Date','Job ID','Client/Vendor','Direction','Type','Amount (excl tax)','Province'].map(h=><th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {payments.map(p=>(
                  <tr key={p.id} className="border-b hover:bg-muted/50 text-xs">
                    <td className="px-2 py-1.5">{p.date}</td>
                    <td className="px-2 py-1.5 font-mono">{p.jobId}</td>
                    <td className="px-2 py-1.5">{p.clientVendorName}</td>
                    <td className="px-2 py-1.5">{p.direction}</td>
                    <td className="px-2 py-1.5">{p.type}</td>
                    <td className="px-2 py-1.5 font-mono">{formatCurrency(p.amountExclTax)}</td>
                    <td className="px-2 py-1.5">{p.province}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="personnel">
          <div className="bg-card border rounded-lg overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-primary text-primary-foreground text-xs">
                {['Name','Email','Roles'].map(h=><th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {settings.personnel.map(p=>(
                  <tr key={p.id} className="border-b hover:bg-muted/50 text-xs">
                    <td className="px-2 py-1.5">{p.name}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{p.email}</td>
                    <td className="px-2 py-1.5">{(p.roles || [p.role]).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
