import { useAppContext } from '@/context/AppContext';
import { formatCurrency } from '@/lib/calculations';

export default function MonthlyHST() {
  const { payments } = useAppContext();

  // Group by month
  const months: Record<string, { collected: number; paid: number }> = {};
  payments.forEach(p => {
    const month = p.date.substring(0, 7); // YYYY-MM
    if (!months[month]) months[month] = { collected: 0, paid: 0 };
    if (p.direction === 'Client Payment IN') months[month].collected += p.taxAmount;
    if (p.direction === 'Vendor Payment OUT') months[month].paid += p.taxAmount;
  });

  const sortedMonths = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Monthly HST</h2>
        <p className="text-sm text-muted-foreground mt-1">Tax collected vs. paid — net HST position</p>
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {['Month','Tax Collected','Tax Paid','Net Position','Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedMonths.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No payment data</td></tr>
            ) : sortedMonths.map(([month, data]) => {
              const net = data.collected - data.paid;
              return (
                <tr key={month} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono">{month}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(data.collected)}</td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(data.paid)}</td>
                  <td className={`px-3 py-2 font-mono font-semibold ${net >= 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(net)}</td>
                  <td className="px-3 py-2 text-xs">{net >= 0 ? 'Owe CRA' : 'ITC Refund'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
