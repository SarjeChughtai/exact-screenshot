import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { MessagesButton } from '@/components/MessagesButton';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DealerOnboardingPrompt from './DealerOnboardingPrompt';

const routeLabelKeys: Record<string, string> = {
  '/': 'layout.dashboard',
  '/estimator': 'layout.quickEstimator',
  '/internal-quote-builder': 'layout.internalQuoteBuilder',
  '/quote-builder': 'layout.salesQuoteBuilder',
  '/quote-log': 'layout.quoteLog',
  '/deals': 'layout.masterDeals',
  '/deal-pl': 'layout.dealPl',
  '/commission': 'layout.commissionProfit',
  '/production': 'layout.productionStatus',
  '/internal-costs': 'layout.internalCosts',
  '/payment-ledger': 'layout.paymentLedger',
  '/client-payments': 'layout.clientPayments',
  '/vendor-payments': 'layout.vendorPayments',
  '/financials': 'layout.projectedFinancials',
  '/monthly-hst': 'layout.monthlyHst',
  '/commission-statement': 'layout.commissionStatement',
  '/freight': 'layout.freightBoard',
  '/rfq': 'layout.rfqBoard',
  '/audit-log': 'layout.auditLog',
  '/import-review': 'layout.importReview',
  '/cost-data': 'layout.costData',
  '/messages': 'layout.messages',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 bg-primary flex items-center px-4 gap-3 shrink-0 border-b">
            <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
            <div className="flex items-center gap-2 text-primary-foreground flex-1">
              <ChevronRight className="h-4 w-4 opacity-50" />
              <span className="text-sm font-medium">
                {t(routeLabelKeys[location.pathname] || 'layout.dashboard')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <MessagesButton />
              <NotificationBell />
            </div>
          </header>
          <DealerOnboardingPrompt />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
