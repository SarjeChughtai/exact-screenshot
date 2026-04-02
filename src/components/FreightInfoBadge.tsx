import type { QuoteFreightResult } from '@/lib/quoteFreightEstimator';
import { formatCurrency } from '@/lib/calculations';
import { MapPin, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  high: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-600', icon: CheckCircle2 },
  moderate: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-600', icon: Info },
  low: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-500', icon: AlertTriangle },
};

interface FreightInfoBadgeProps {
  result: QuoteFreightResult | null;
  overrideFreight?: string;
  compact?: boolean;
}

export function FreightInfoBadge({ result, overrideFreight, compact }: FreightInfoBadgeProps) {
  if (!result) return null;

  const hasOverride = overrideFreight != null && overrideFreight.trim() !== '' && !isNaN(parseFloat(overrideFreight));
  const style = CONFIDENCE_STYLES[result.confidence] || CONFIDENCE_STYLES.low;
  const Icon = style.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>{result.distanceKm > 0 ? `${result.distanceKm} km` : '—'}</span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-medium ${style.bg} ${style.text}`}>
          <Icon className="h-2.5 w-2.5" />
          {result.confidence}
        </span>
        {hasOverride && <span className="text-amber-600">(manual override)</span>}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-2.5 space-y-1 ${style.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">
            {result.distanceKm > 0 ? `${result.distanceKm} km` : 'Route unknown'}
          </span>
          {result.resolvedProvince && (
            <span className="text-[10px] text-muted-foreground">({result.resolvedProvince})</span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${style.bg} ${style.text}`}>
          <Icon className="h-3 w-3" />
          {result.confidence} confidence
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">{result.basisNote}</p>
      {result.comparableCount > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {result.comparableCount} comparable deliveries used
        </p>
      )}
      {result.status === 'manual_required' && (
        <p className="text-[10px] text-amber-600 font-medium">
          ⚠ Could not estimate freight — enter manually
        </p>
      )}
      {hasOverride && (
        <p className="text-[10px] text-amber-600">
          Manual override: {formatCurrency(parseFloat(overrideFreight!))} (estimate was {formatCurrency(result.estimatedFreight)})
        </p>
      )}
    </div>
  );
}
