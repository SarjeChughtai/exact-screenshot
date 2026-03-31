import { Fragment, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function ClientPayments() {
  const { deals, payments } = useAppContext();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const rows = deals.map(deal => {
    const clientPayments = payments.filter(payment => payment.jobId === deal.jobId && payment.direction === 'Client Payment IN');
    const totalAmount = clientPayments.reduce((sum, payment) => sum + payment.amountExclTax, 0);
    const totalTax = clientPayments.reduce((sum, payment) => sum + payment.taxAmount, 0);
    const totalWithTax = clientPayments.reduce((sum, payment) => sum + payment.totalInclTax, 0);
    const lastDate = clientPayments.length ? [...clientPayments].sort((a, b) => b.date.localeCompare(a.date))[0].date : '-';
    const status = totalAmount === 0 ? 'UNPAID' : 'PARTIAL';

    return {
      deal,
      clientPayments,
      totalAmount,
      totalTax,
      totalWithTax,
      count: clientPayments.length,
      lastDate,
      status,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Client Payments</h2>
        <p className="text-sm text-muted-foreground mt-1">Amount, HST, and total incl. HST by deal.</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              <th className="px-2 py-2 w-6"></th>
              {['Job ID', 'Client', 'Amount', 'HST', 'Total w/ HST', '# Payments', 'Last Payment', 'Status'].map(header => (
                <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No deals</td></tr>
            ) : rows.map(row => (
              <Fragment key={row.deal.jobId}>
                <tr className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setExpandedJob(current => current === row.deal.jobId ? null : row.deal.jobId)}>
                  <td className="px-2 py-2">{expandedJob === row.deal.jobId ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.deal.jobId}</td>
                  <td className="px-3 py-2">{row.deal.clientName}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(row.totalAmount)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(row.totalTax)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(row.totalWithTax)}</td>
                  <td className="px-3 py-2 text-center">{row.count}</td>
                  <td className="px-3 py-2 text-xs">{row.lastDate}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.status === 'PAID' ? 'status-paid' : row.status === 'PARTIAL' ? 'status-partial' : 'status-unpaid'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
                {expandedJob === row.deal.jobId && (
                  <tr className="bg-muted/30">
                    <td colSpan={9} className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Deal Info</p>
                          <p>Job Name: {row.deal.jobName}</p>
                          <p>Dimensions: {row.deal.width}x{row.deal.length}x{row.deal.height}</p>
                          <p>Province: {row.deal.province}</p>
                          <p>Status: {row.deal.dealStatus}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Location</p>
                          <p>{row.deal.address || '-'}</p>
                          <p>{row.deal.city}, {row.deal.province} {row.deal.postalCode}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Team</p>
                          <p>Sales Rep: {row.deal.salesRep}</p>
                          <p>Client ID: {row.deal.clientId}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1">Production</p>
                          <p>Production: {row.deal.productionStatus}</p>
                          <p>Freight: {row.deal.freightStatus}</p>
                        </div>
                      </div>
                      {row.clientPayments.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Payment History</p>
                          <div className="bg-background rounded border text-xs">
                            <div className="grid grid-cols-6 gap-2 px-3 py-1.5 font-semibold border-b">
                              <span>Date</span><span>Type</span><span>Amount</span><span>HST</span><span>Total</span><span>Method</span>
                            </div>
                            {row.clientPayments.map(payment => (
                              <div key={payment.id} className="grid grid-cols-6 gap-2 px-3 py-1.5 border-b last:border-0">
                                <span>{payment.date}</span>
                                <span>{payment.type}</span>
                                <span className="font-mono">{formatCurrency(payment.amountExclTax)}</span>
                                <span className="font-mono">{formatCurrency(payment.taxAmount)}</span>
                                <span className="font-mono">{formatCurrency(payment.totalInclTax)}</span>
                                <span>{payment.paymentMethod || '-'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
