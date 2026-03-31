import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { RoleProvider } from "@/context/RoleContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { MessagesProvider } from "@/context/MessagesContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ModuleRoute from "@/components/ModuleRoute";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import PendingApproval from "@/pages/PendingApproval";
import Dashboard from "@/pages/Dashboard";
import QuickEstimator from "@/pages/QuickEstimator";
import QuoteBuilder from "@/pages/QuoteBuilder";
import InternalQuoteBuilder from "@/pages/InternalQuoteBuilder";
import InternalQuoteLog from "@/pages/InternalQuoteLog";
import QuoteLog from "@/pages/QuoteLog";
import EstimatesLog from "@/pages/EstimatesLog";
import MasterDeals from "@/pages/MasterDeals";
import InternalCosts from "@/pages/InternalCosts";
import ProjectedFinancials from "@/pages/ProjectedFinancials";
import PaymentLedger from "@/pages/PaymentLedger";
import ClientPayments from "@/pages/ClientPayments";
import VendorPayments from "@/pages/VendorPayments";
import DealPL from "@/pages/DealPL";
import MonthlyHST from "@/pages/MonthlyHST";
import FreightBoard from "@/pages/FreightBoard";
import RFQWorkflow from "@/pages/RFQWorkflow";
import QuoteRFQ from "@/pages/QuoteRFQ";
import ProductionStatus from "@/pages/ProductionStatus";
import CommissionProfit from "@/pages/CommissionProfit";
import CommissionStatement from "@/pages/CommissionStatement";
import AuditLog from "@/pages/AuditLog";
import Settings from "@/pages/Settings";
import DealerRFQ from "@/pages/DealerRFQ";
import DealerLog from "@/pages/DealerLog";
import DraftLog from "@/pages/DraftLog";
import MasterData from "@/pages/MasterData";
import Clients from "@/pages/Clients";
import Vendors from "@/pages/Vendors";
import VendorQuoteBoard from "@/pages/VendorQuoteBoard";
import ImportReview from "@/pages/ImportReview";
import CostData from "@/pages/CostData";
import Messages from "@/pages/Messages";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const withModule = (module: string, element: React.ReactNode) => (
  <ModuleRoute module={module}>{element}</ModuleRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RoleProvider>
          <SettingsProvider>
            <AppProvider>
              <NotificationsProvider>
              <MessagesProvider>
              <Toaster />
              <Sonner />
              <SpeedInsights />
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/pending" element={<PendingApproval />} />
                  <Route path="*" element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={withModule('dashboard', <Dashboard />)} />
                          <Route path="/estimator" element={withModule('estimator', <QuickEstimator />)} />
                          <Route path="/internal-quote-builder" element={withModule('internal-quote-builder', <InternalQuoteBuilder />)} />
                          <Route path="/internal-quote-log" element={withModule('internal-quote-log', <InternalQuoteLog />)} />
                          <Route path="/quote-builder" element={withModule('quote-builder', <QuoteBuilder />)} />
                          <Route path="/quote-log" element={withModule('quote-log', <QuoteLog />)} />
                          <Route path="/estimates-log" element={withModule('estimator', <EstimatesLog />)} />
                          <Route path="/quote-rfq" element={withModule('quote-log', <QuoteRFQ />)} />
                          <Route path="/deals" element={withModule('deals', <MasterDeals />)} />
                          <Route path="/internal-costs" element={withModule('internal-costs', <InternalCosts />)} />
                          <Route path="/financials" element={withModule('financials', <ProjectedFinancials />)} />
                          <Route path="/payment-ledger" element={withModule('payment-ledger', <PaymentLedger />)} />
                          <Route path="/client-payments" element={withModule('client-payments', <ClientPayments />)} />
                          <Route path="/vendor-payments" element={withModule('vendor-payments', <VendorPayments />)} />
                          <Route path="/deal-pl" element={withModule('deal-pl', <DealPL />)} />
                          <Route path="/monthly-hst" element={withModule('monthly-hst', <MonthlyHST />)} />
                          <Route path="/freight" element={withModule('freight', <FreightBoard />)} />
                          <Route path="/rfq" element={withModule('rfq', <RFQWorkflow />)} />
                          <Route path="/production" element={withModule('production', <ProductionStatus />)} />
                          <Route path="/commission" element={withModule('commission', <CommissionProfit />)} />
                          <Route path="/commission-statement" element={withModule('commission-statement', <CommissionStatement />)} />
                          <Route path="/settings" element={withModule('settings', <Settings />)} />
                          <Route path="/audit-log" element={withModule('settings', <AuditLog />)} />
                          <Route path="/dealer-rfq" element={withModule('dealer-rfq', <DealerRFQ />)} />
                          <Route path="/dealer-log" element={withModule('dealer-log', <DealerLog />)} />
                          <Route path="/draft-log" element={withModule('draft-log', <DraftLog />)} />
                          <Route path="/master-data" element={withModule('master-data', <MasterData />)} />
                          <Route path="/clients" element={withModule('payment-ledger', <Clients />)} />
                          <Route path="/vendors" element={withModule('payment-ledger', <Vendors />)} />
                          <Route path="/vendor-board" element={withModule('vendor-board', <VendorQuoteBoard />)} />
                          <Route path="/import-review" element={withModule('internal-quote-builder', <ImportReview />)} />
                          <Route path="/cost-data" element={withModule('cost-data', <CostData />)} />
                          <Route path="/messages" element={withModule('messages', <Messages />)} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  } />
                </Routes>
              </BrowserRouter>
              </MessagesProvider>
              </NotificationsProvider>
            </AppProvider>
          </SettingsProvider>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
