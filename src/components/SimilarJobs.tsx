import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import type { Deal } from '@/types';

interface SimilarJobsProps {
  width: number;
  length: number;
  height: number;
  tolerance?: number;
}

interface SimilarJob {
  deal: Deal;
  matchReasons: string[];
  sqft: number;
}

/**
 * Shows historical jobs from the database that have dimensions within
 * a tolerance (default 10ft) on ANY side of the input building.
 * Helps sales reps sanity-check estimates against real completed jobs.
 */
export function SimilarJobs({ width, length, height, tolerance = 10 }: SimilarJobsProps) {
  const { deals, quotes } = useAppContext();

  const similarJobs = useMemo(() => {
    if (!width || !length) return [];

    const results: SimilarJob[] = [];

    for (const deal of deals) {
      if (!deal.width || !deal.length) continue;

      const matchReasons: string[] = [];
      const widthDiff = Math.abs(deal.width - width);
      const lengthDiff = Math.abs(deal.length - length);
      const heightDiff = Math.abs((deal.height || 14) - height);

      if (widthDiff <= tolerance) matchReasons.push(`Width: ${deal.width}ft (±${widthDiff}ft)`);
      if (lengthDiff <= tolerance) matchReasons.push(`Length: ${deal.length}ft (±${lengthDiff}ft)`);
      if (heightDiff <= tolerance) matchReasons.push(`Height: ${deal.height || 14}ft (±${heightDiff}ft)`);

      if (matchReasons.length > 0) {
        results.push({
          deal,
          matchReasons,
          sqft: deal.sqft || deal.width * deal.length,
        });
      }
    }

    // Also search quotes for additional data points
    for (const quote of quotes) {
      if (!quote.width || !quote.length) continue;
      // Skip if already matched via deals (same jobId)
      if (results.some(r => r.deal.jobId === quote.jobId)) continue;

      const matchReasons: string[] = [];
      const widthDiff = Math.abs(quote.width - width);
      const lengthDiff = Math.abs(quote.length - length);
      const heightDiff = Math.abs((quote.height || 14) - height);

      if (widthDiff <= tolerance) matchReasons.push(`Width: ${quote.width}ft (±${widthDiff}ft)`);
      if (lengthDiff <= tolerance) matchReasons.push(`Length: ${quote.length}ft (±${lengthDiff}ft)`);
      if (heightDiff <= tolerance) matchReasons.push(`Height: ${quote.height || 14}ft (±${heightDiff}ft)`);

      if (matchReasons.length > 0) {
        // Convert quote to a Deal-like shape for display
        const asDeal: Deal = {
          jobId: quote.jobId,
          jobName: quote.jobName,
          clientName: quote.clientName,
          clientId: quote.clientId,
          salesRep: quote.salesRep,
          estimator: quote.estimator,
          teamLead: '',
          province: quote.province,
          city: quote.city,
          address: quote.address,
          postalCode: quote.postalCode,
          width: quote.width,
          length: quote.length,
          height: quote.height,
          sqft: quote.sqft,
          weight: quote.weight,
          taxRate: 0,
          taxType: '',
          orderType: 'Steel building',
          dateSigned: quote.date,
          dealStatus: 'Quoted',
          paymentStatus: 'UNPAID',
          productionStatus: 'Submitted',
          freightStatus: 'Pending',
          insulationStatus: '',
          deliveryDate: '',
          pickupDate: '',
          notes: `Quote total: ${formatCurrency(quote.grandTotal)} (${quote.status})`,
        };
        results.push({
          deal: asDeal,
          matchReasons,
          sqft: quote.sqft || quote.width * quote.length,
        });
      }
    }

    // Sort by number of matching dimensions (more matches = more relevant)
    results.sort((a, b) => b.matchReasons.length - a.matchReasons.length);

    return results;
  }, [deals, quotes, width, length, height, tolerance]);

  if (!width || !length) return null;
  if (similarJobs.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-4 mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Similar Historical Jobs
        </h3>
        <p className="text-xs text-muted-foreground">
          No historical jobs found within {tolerance}ft of {width}&apos; x {length}&apos; x {height}&apos;.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Similar Historical Jobs
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        {similarJobs.length} job{similarJobs.length !== 1 ? 's' : ''} within {tolerance}ft on any dimension of {width}&apos; x {length}&apos; x {height}&apos;
      </p>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {similarJobs.map((sj, i) => {
          const d = sj.deal;
          const statusColor =
            d.dealStatus === 'Complete' || d.dealStatus === 'Delivered' ? 'text-green-600' :
            d.dealStatus === 'In Progress' || d.dealStatus === 'In Production' ? 'text-blue-600' :
            d.dealStatus === 'Cancelled' ? 'text-red-500' :
            'text-muted-foreground';

          return (
            <div key={`${d.jobId}-${i}`} className="border rounded-md p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{d.jobId || 'N/A'}</span>
                    <span className={`text-[10px] font-medium ${statusColor}`}>{d.dealStatus}</span>
                  </div>
                  <p className="text-xs text-foreground mt-0.5 truncate">{d.clientName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {d.city}{d.province ? `, ${d.province}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold font-mono">
                    {d.width}&apos; x {d.length}&apos; x {d.height || 14}&apos;
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatNumber(sj.sqft)} sqft
                    {d.weight > 0 ? ` | ${formatNumber(d.weight)} lbs` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {sj.matchReasons.map((reason, j) => (
                  <span key={j} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent font-medium">
                    {reason}
                  </span>
                ))}
              </div>
              {d.notes && (
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{d.notes}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
