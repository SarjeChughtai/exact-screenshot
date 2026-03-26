import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, CreditCard, FileText, Package, AlertCircle,
  CheckCircle2, Info, ArrowRight
} from 'lucide-react';

type NotificationType = 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  category: string;
  title: string;
  description: string;
  relatedJobId?: string;
  linkTo?: string;
  linkLabel?: string;
}

const TYPE_STYLES: Record<NotificationType, { bg: string; icon: typeof AlertTriangle; color: string }> = {
  error: { bg: 'bg-red-50 border-red-200', icon: AlertCircle, color: 'text-red-600' },
  warning: { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, color: 'text-amber-600' },
  info: { bg: 'bg-blue-50 border-blue-200', icon: Info, color: 'text-blue-600' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { deals, payments, internalCosts, quotes, production } = useAppContext();
  const { settings } = useSettings();

  const notifications = useMemo(() => {
    const items: Notification[] = [];
    let idx = 0;
    const nextId = () => `notif-${++idx}`;

    // --- Missing Payment Info ---
    deals.forEach(d => {
      if (d.dealStatus === 'Cancelled' || d.dealStatus === 'Lead') return;

      const jobPayments = payments.filter(p => p.jobId === d.jobId);
      const ic = internalCosts.find(c => c.jobId === d.jobId);

      // Auto-created payment records needing completion
      const incompletePayments = jobPayments.filter(
        p => p.amountExclTax === 0 && p.notes?.includes('Auto-created')
      );
      incompletePayments.forEach(p => {
        items.push({
          id: nextId(),
          type: 'error',
          category: 'Payment',
          title: `Incomplete payment record for ${d.jobId}`,
          description: `An auto-created payment record needs the amount, method, and reference filled in.`,
          relatedJobId: d.jobId,
          linkTo: '/payment-ledger',
          linkLabel: 'Go to Payment Ledger',
        });
      });

      // No payment records at all for active deals past Quoted
      if (
        jobPayments.length === 0 &&
        ['Pending Payment', 'In Progress', 'In Production', 'Shipped', 'Delivered'].includes(d.dealStatus)
      ) {
        items.push({
          id: nextId(),
          type: 'warning',
          category: 'Payment',
          title: `No payment records for ${d.jobId}`,
          description: `Deal is in "${d.dealStatus}" but has no payment records. Consider adding a deposit.`,
          relatedJobId: d.jobId,
          linkTo: '/payment-ledger',
          linkLabel: 'Add Payment',
        });
      }

      // Missing internal costs for active deals
      if (!ic && !['Lead', 'Quoted', 'Cancelled'].includes(d.dealStatus)) {
        items.push({
          id: nextId(),
          type: 'warning',
          category: 'Costs',
          title: `No internal costs for ${d.jobId}`,
          description: `Deal is active but has no internal cost breakdown set up.`,
          relatedJobId: d.jobId,
          linkTo: '/internal-costs',
          linkLabel: 'Set Up Costs',
        });
      }

      // Sale price is 0 when internal costs exist
      if (ic && ic.salePrice === 0) {
        items.push({
          id: nextId(),
          type: 'warning',
          category: 'Costs',
          title: `Sale price is $0 for ${d.jobId}`,
          description: `Internal costs are set up but sale price is missing. Commission and P&L cannot be calculated.`,
          relatedJobId: d.jobId,
          linkTo: '/internal-costs',
          linkLabel: 'Update Sale Price',
        });
      }

      // Missing required deal fields
      const missingFields: string[] = [];
      if (!d.clientName) missingFields.push('Client Name');
      if (!d.province) missingFields.push('Province');
      if (!d.salesRep) missingFields.push('Sales Rep');
      if (!d.width || !d.length) missingFields.push('Building Dimensions');

      if (missingFields.length > 0) {
        items.push({
          id: nextId(),
          type: 'info',
          category: 'Data',
          title: `Missing fields for ${d.jobId}`,
          description: `Missing: ${missingFields.join(', ')}`,
          relatedJobId: d.jobId,
          linkTo: '/deals',
          linkLabel: 'View Deal',
        });
      }

      // Payment vs deal status mismatch
      const totalPaid = jobPayments
        .filter(p => p.direction === 'Client Payment IN')
        .reduce((sum, p) => sum + p.amountExclTax, 0);
      const salePrice = ic?.salePrice || 0;

      if (d.paymentStatus === 'PAID' && salePrice > 0 && totalPaid < salePrice * 0.90) {
        items.push({
          id: nextId(),
          type: 'error',
          category: 'Sync',
          title: `Payment mismatch for ${d.jobId}`,
          description: `Deal marked as PAID but only ${formatCurrency(totalPaid)} of ${formatCurrency(salePrice)} received (${((totalPaid / salePrice) * 100).toFixed(0)}%).`,
          relatedJobId: d.jobId,
          linkTo: '/deals',
          linkLabel: 'Check Deal',
        });
      }

      // Production status mismatch
      const prodRecord = production.find(p => p.jobId === d.jobId);
      if (prodRecord?.delivered && d.dealStatus !== 'Complete' && d.dealStatus !== 'Delivered') {
        items.push({
          id: nextId(),
          type: 'info',
          category: 'Sync',
          title: `${d.jobId} delivered but deal not updated`,
          description: `Production shows delivered but deal status is "${d.dealStatus}".`,
          relatedJobId: d.jobId,
          linkTo: '/deals',
          linkLabel: 'Update Deal',
        });
      }
    });

    // --- Quote parsing issues ---
    quotes.forEach(q => {
      if (!q.width || !q.length || q.sqft <= 0) {
        items.push({
          id: nextId(),
          type: 'warning',
          category: 'Quote',
          title: `Quote ${q.jobId} has invalid dimensions`,
          description: `Width: ${q.width}, Length: ${q.length}. The quote may not calculate correctly.`,
          relatedJobId: q.jobId,
          linkTo: '/quote-log',
          linkLabel: 'View Quote',
        });
      }

      // Unassigned quotes waiting in queue
      if (
        (q.status === 'New Request' || q.status === 'Draft') &&
        !q.assignedEstimator
      ) {
        items.push({
          id: nextId(),
          type: 'info',
          category: 'Quote',
          title: `Quote ${q.jobId} needs estimator assignment`,
          description: `This quote is in "${q.status}" and has no estimator assigned yet.`,
          relatedJobId: q.jobId,
          linkTo: '/quote-log',
          linkLabel: 'Assign Estimator',
        });
      }
    });

    // Sort: errors first, then warnings, then info
    const priority: Record<NotificationType, number> = { error: 0, warning: 1, info: 2 };
    items.sort((a, b) => priority[a.type] - priority[b.type]);

    return items;
  }, [deals, payments, internalCosts, quotes, production]);

  const errorCount = notifications.filter(n => n.type === 'error').length;
  const warningCount = notifications.filter(n => n.type === 'warning').length;
  const infoCount = notifications.filter(n => n.type === 'info').length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Notifications & Errors</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Missing data, incomplete records, and sync issues that need attention
        </p>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        {errorCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {errorCount} Error{errorCount !== 1 ? 's' : ''}
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200">
            {warningCount} Warning{warningCount !== 1 ? 's' : ''}
          </Badge>
        )}
        {infoCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {infoCount} Info
          </Badge>
        )}
        {notifications.length === 0 && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">All clear — no issues found</span>
          </div>
        )}
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        {notifications.map(n => {
          const style = TYPE_STYLES[n.type];
          const Icon = style.icon;

          return (
            <div key={n.id} className={`border rounded-lg p-3 flex items-start gap-3 ${style.bg}`}>
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {n.category}
                  </span>
                  {n.relatedJobId && (
                    <span className="font-mono text-xs text-muted-foreground">{n.relatedJobId}</span>
                  )}
                </div>
                <p className="text-sm font-medium mt-0.5">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
              </div>
              {n.linkTo && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs shrink-0 h-7"
                  onClick={() => navigate(n.linkTo!)}
                >
                  {n.linkLabel || 'View'} <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
