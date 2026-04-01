import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { MessagesButton } from '@/components/MessagesButton';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DealerOnboardingPrompt from './DealerOnboardingPrompt';
import { useRoles } from '@/context/RoleContext';

const routeLabelKeys: Record<string, string> = {
  '/': 'layout.dashboard',
  '/estimator': 'layout.quickEstimator',
  '/estimates-log': 'layout.estimatesLog',
  '/internal-quote-builder': 'layout.internalQuoteBuilder',
  '/internal-quote-log': 'layout.internalQuoteLog',
  '/quote-builder': 'layout.salesQuoteBuilder',
  '/quote-log': 'layout.quoteLog',
  '/opportunities': 'layout.opportunities',
  '/quote-rfq': 'layout.quoteRfq',
  '/deals': 'layout.masterDeals',
  '/deal-pl': 'layout.dealPl',
  '/commission': 'layout.commissionProfit',
  '/production': 'layout.productionStatus',
  '/internal-costs': 'layout.internalCosts',
  '/payment-ledger': 'layout.paymentLedger',
  '/clients': 'layout.clients',
  '/vendors': 'layout.vendors',
  '/client-payments': 'layout.clientPayments',
  '/vendor-payments': 'layout.vendorPayments',
  '/financials': 'layout.projectedFinancials',
  '/monthly-hst': 'layout.monthlyHst',
  '/commission-statement': 'layout.commissionStatement',
  '/freight': 'layout.freightBoard',
  '/rfq': 'layout.rfqBoard',
  '/dealer-rfq': 'layout.dealerRfq',
  '/dealer-log': 'layout.dealerLog',
  '/construction-board': 'layout.constructionBoard',
  '/vendor-board': 'layout.vendorBoard',
  '/audit-log': 'layout.auditLog',
  '/import-review': 'layout.importReview',
  '/cost-data': 'layout.costData',
  '/messages': 'layout.messages',
  '/settings': 'layout.settings',
  '/master-data': 'layout.masterData',
};

const routeLabelFallbacks: Record<string, string> = {
  '/': 'Dashboard',
  '/estimator': 'Quick Estimator',
  '/estimates-log': 'Estimates Log',
  '/internal-quote-builder': 'Internal Quote Builder',
  '/internal-quote-log': 'Internal Quote Log',
  '/quote-builder': 'Sales Quote Builder',
  '/quote-log': 'Quote Log',
  '/opportunities': 'Opportunities',
  '/quote-rfq': 'Quote RFQ',
  '/deals': 'Master Deals',
  '/deal-pl': 'Deal P&L',
  '/commission': 'Commission Profit',
  '/production': 'Production Status',
  '/internal-costs': 'Internal Costs',
  '/payment-ledger': 'Payment Ledger',
  '/clients': 'Clients',
  '/vendors': 'Vendors',
  '/client-payments': 'Client Payments',
  '/vendor-payments': 'Vendor Payments',
  '/financials': 'Projected Financials',
  '/monthly-hst': 'Monthly HST',
  '/commission-statement': 'Commission Statement',
  '/freight': 'Freight Board',
  '/rfq': 'RFQ Board',
  '/dealer-rfq': 'Dealer RFQ',
  '/dealer-log': 'Dealer Log',
  '/construction-board': 'Construction Board',
  '/vendor-board': 'Vendor Board',
  '/audit-log': 'Audit Log',
  '/import-review': 'Import Review',
  '/cost-data': 'Cost Data',
  '/messages': 'Messages',
  '/settings': 'Settings',
  '/master-data': 'Master Data',
};

const getRouteTitle = (
  pathname: string,
  t: (key: string) => string,
  {
    isManufacturerView,
  }: {
    isManufacturerView: boolean;
  },
) => {
  const key = pathname === '/vendor-board' && isManufacturerView
    ? 'layout.manufacturerBoard'
    : (routeLabelKeys[pathname] || 'layout.dashboard');
  const translated = t(key);

  if (translated !== key) return translated;
  if (pathname === '/vendor-board' && isManufacturerView) {
    return 'Manufacturer Board';
  }
  return routeLabelFallbacks[pathname] || routeLabelFallbacks['/'];
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { t } = useTranslation();
  const { currentUser } = useRoles();
  const isManufacturerView = currentUser.roles.includes('manufacturer');

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
                {getRouteTitle(location.pathname, t, { isManufacturerView })}
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
