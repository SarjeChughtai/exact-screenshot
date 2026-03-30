import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { ChevronRight } from 'lucide-react';

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/estimator': 'Quick Estimator',
  '/internal-quote-builder': 'Internal Quote Builder',
  '/quote-builder': 'Sales Quote Builder',
  '/quote-log': 'Quote Log',
  '/deals': 'Master Deals',
  '/deal-pl': 'Deal P&L',
  '/commission': 'Commission & Profit',
  '/production': 'Production Status',
  '/internal-costs': 'Internal Costs',
  '/payment-ledger': 'Payment Ledger',
  '/client-payments': 'Client Payments',
  '/vendor-payments': 'Vendor Payments',
  '/financials': 'Projected Financials',
  '/monthly-hst': 'Monthly HST',
  '/commission-statement': 'Commission Statement',
  '/freight': 'Freight Board',
  '/rfq': 'RFQ Board',
  '/audit-log': 'Audit Log',
  '/import-review': 'Import Review',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

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
                {routeLabels[location.pathname] || 'Dashboard'}
              </span>
            </div>
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
