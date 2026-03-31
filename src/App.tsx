import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { RoleProvider } from "@/context/RoleContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RoleProvider>
          <SettingsProvider>
            <AppProvider>
              <NotificationsProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/pending" element={<PendingApproval />} />
                  <Route path="*" element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/estimator" element={<QuickEstimator />} />
                          <Route path="/internal-quote-builder" element={<InternalQuoteBuilder />} />
                          <Route path="/internal-quote-log" element={<InternalQuoteLog />} />
                          <Route path="/quote-builder" element={<QuoteBuilder />} />
                          <Route path="/quote-log" element={<QuoteLog />} />
                          <Route path="/estimates-log" element={<EstimatesLog />} />
                          <Route path="/quote-rfq" element={<QuoteRFQ />} />
                          <Route path="/deals" element={<MasterDeals />} />
                          <Route path="/internal-costs" element={<InternalCosts />} />
                          <Route path="/financials" element={<ProjectedFinancials />} />
                          <Route path="/payment-ledger" element={<PaymentLedger />} />
                          <Route path="/client-payments" element={<ClientPayments />} />
                          <Route path="/vendor-payments" element={<VendorPayments />} />
                          <Route path="/deal-pl" element={<DealPL />} />
                          <Route path="/monthly-hst" element={<MonthlyHST />} />
                          <Route path="/freight" element={<FreightBoard />} />
                          <Route path="/rfq" element={<RFQWorkflow />} />
                          <Route path="/production" element={<ProductionStatus />} />
                          <Route path="/commission" element={<CommissionProfit />} />
                          <Route path="/commission-statement" element={<CommissionStatement />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/audit-log" element={<AuditLog />} />
                          <Route path="/dealer-rfq" element={<DealerRFQ />} />
                          <Route path="/dealer-log" element={<DealerLog />} />
                          <Route path="/draft-log" element={<DraftLog />} />
                          <Route path="/master-data" element={<MasterData />} />
                          <Route path="/clients" element={<Clients />} />
                          <Route path="/vendors" element={<Vendors />} />
                          <Route path="/vendor-board" element={<VendorQuoteBoard />} />
                          <Route path="/import-review" element={<ImportReview />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  } />
                </Routes>
              </BrowserRouter>
              </NotificationsProvider>
            </AppProvider>
          </SettingsProvider>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
