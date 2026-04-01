import { Suspense, lazy } from "react";
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

const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const PendingApproval = lazy(() => import("@/pages/PendingApproval"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const QuickEstimator = lazy(() => import("@/pages/QuickEstimator"));
const QuoteBuilder = lazy(() => import("@/pages/QuoteBuilder"));
const InternalQuoteBuilder = lazy(() => import("@/pages/InternalQuoteBuilder"));
const InternalQuoteLog = lazy(() => import("@/pages/InternalQuoteLog"));
const QuoteLog = lazy(() => import("@/pages/QuoteLog"));
const EstimatesLog = lazy(() => import("@/pages/EstimatesLog"));
const Opportunities = lazy(() => import("@/pages/Opportunities"));
const MasterDeals = lazy(() => import("@/pages/MasterDeals"));
const InternalCosts = lazy(() => import("@/pages/InternalCosts"));
const ProjectedFinancials = lazy(() => import("@/pages/ProjectedFinancials"));
const PaymentLedger = lazy(() => import("@/pages/PaymentLedger"));
const ClientPayments = lazy(() => import("@/pages/ClientPayments"));
const VendorPayments = lazy(() => import("@/pages/VendorPayments"));
const DealPL = lazy(() => import("@/pages/DealPL"));
const MonthlyHST = lazy(() => import("@/pages/MonthlyHST"));
const FreightBoard = lazy(() => import("@/pages/FreightBoard"));
const RFQWorkflow = lazy(() => import("@/pages/RFQWorkflow"));
const QuoteRFQ = lazy(() => import("@/pages/QuoteRFQ"));
const ProductionStatus = lazy(() => import("@/pages/ProductionStatus"));
const CommissionProfit = lazy(() => import("@/pages/CommissionProfit"));
const CommissionStatement = lazy(() => import("@/pages/CommissionStatement"));
const AuditLog = lazy(() => import("@/pages/AuditLog"));
const Settings = lazy(() => import("@/pages/Settings"));
const DealerRFQ = lazy(() => import("@/pages/DealerRFQ"));
const DealerLog = lazy(() => import("@/pages/DealerLog"));
const ConstructionBoard = lazy(() => import("@/pages/ConstructionBoard"));
const DraftLog = lazy(() => import("@/pages/DraftLog"));
const MasterData = lazy(() => import("@/pages/MasterData"));
const Clients = lazy(() => import("@/pages/Clients"));
const Vendors = lazy(() => import("@/pages/Vendors"));
const VendorQuoteBoard = lazy(() => import("@/pages/VendorQuoteBoard"));
const ImportReview = lazy(() => import("@/pages/ImportReview"));
const CostData = lazy(() => import("@/pages/CostData"));
const Messages = lazy(() => import("@/pages/Messages"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const withModule = (module: string, element: React.ReactNode) => (
  <ModuleRoute module={module}>
    <Suspense fallback={<RouteLoading />}>{element}</Suspense>
  </ModuleRoute>
);

const RouteLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
    Loading...
  </div>
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
                  <Route path="/auth" element={<Suspense fallback={<RouteLoading />}><Auth /></Suspense>} />
                  <Route path="/reset-password" element={<Suspense fallback={<RouteLoading />}><ResetPassword /></Suspense>} />
                  <Route path="/pending" element={<Suspense fallback={<RouteLoading />}><PendingApproval /></Suspense>} />
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
                          <Route path="/opportunities" element={withModule('opportunities', <Opportunities />)} />
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
                          <Route path="/construction-board" element={withModule('vendor-board', <ConstructionBoard />)} />
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
