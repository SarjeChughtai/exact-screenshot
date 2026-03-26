import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { RoleProvider } from "@/context/RoleContext";
import { SettingsProvider } from "@/context/SettingsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import QuickEstimator from "@/pages/QuickEstimator";
import QuoteBuilder from "@/pages/QuoteBuilder";
import InternalQuoteBuilder from "@/pages/InternalQuoteBuilder";
import QuoteLog from "@/pages/QuoteLog";
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
import RFQBuilder from "@/pages/RFQBuilder";
import ProductionStatus from "@/pages/ProductionStatus";
import CommissionProfit from "@/pages/CommissionProfit";
import CommissionStatement from "@/pages/CommissionStatement";
import AuditLog from "@/pages/AuditLog";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RoleProvider>
          <SettingsProvider>
            <AppProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="*" element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/estimator" element={<QuickEstimator />} />
                          <Route path="/internal-quote-builder" element={<InternalQuoteBuilder />} />
                          <Route path="/quote-builder" element={<QuoteBuilder />} />
                          <Route path="/quote-log" element={<QuoteLog />} />
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
                          <Route path="/rfq-builder" element={<RFQBuilder />} />
                          <Route path="/production" element={<ProductionStatus />} />
                          <Route path="/commission" element={<CommissionProfit />} />
                          <Route path="/commission-statement" element={<CommissionStatement />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/audit-log" element={<AuditLog />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  } />
                </Routes>
              </BrowserRouter>
            </AppProvider>
          </SettingsProvider>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
