import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/layout/Layout';

import { AdminRoute } from '@/components/AdminRoute';
import { ResellerAuthProvider } from '@/contexts/ResellerAuthContext';
import { ResellerProtectedRoute } from '@/components/ResellerProtectedRoute';
import { ResellerLoginPage } from '@/pages/reseller/ResellerLoginPage';
import { ResellerPosPage } from '@/pages/reseller/ResellerPosPage';
import { ResellerOperatorsPage } from '@/pages/reseller/ResellerOperatorsPage';
import { ResellerHubsPage } from '@/pages/reseller/ResellerHubsPage';
import { ResellerHubDetailPage } from '@/pages/reseller/ResellerHubDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EventsPage } from '@/pages/EventsPage';
import { EventDetailsPage } from '@/pages/EventDetailsPage';
import { TicketSalesPage } from '@/pages/TicketSalesPage';
import { SalesHistoryPage } from '@/pages/SalesHistoryPage';
import { EntryScanPage } from '@/pages/EntryScanPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ResellersPage } from '@/pages/ResellersPage';
import { ResellerDetailPage } from '@/pages/ResellerDetailPage';
import { HubDetailPage } from '@/pages/HubDetailPage';
import { OrganizerPayoutsPage } from '@/pages/OrganizerPayoutsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <div className="w-full h-screen">
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="events" element={<EventsPage />} />
                  <Route path="events/:id" element={<EventDetailsPage />} />
                  <Route path="sell-tickets" element={<TicketSalesPage />} />
                  <Route path="sales-history" element={<SalesHistoryPage />} />
                  <Route path="entry-scan" element={<EntryScanPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                  <Route path="resellers" element={<AdminRoute><ResellersPage /></AdminRoute>} />
                  <Route path="resellers/:id" element={<AdminRoute><ResellerDetailPage /></AdminRoute>} />
                  <Route path="resellers/:id/hubs/:hubId" element={<AdminRoute><HubDetailPage /></AdminRoute>} />
                  <Route path="payouts" element={<AdminRoute><OrganizerPayoutsPage /></AdminRoute>} />
                </Route>
                <Route path="/reseller/login" element={<ResellerLoginPage />} />
                <Route
                  path="/reseller/operators"
                  element={
                    <ResellerAuthProvider>
                      <ResellerProtectedRoute>
                        <ResellerOperatorsPage />
                      </ResellerProtectedRoute>
                    </ResellerAuthProvider>
                  }
                />
                <Route path="/reseller/hubs" element={
                  <ResellerAuthProvider><ResellerProtectedRoute><ResellerHubsPage /></ResellerProtectedRoute></ResellerAuthProvider>
                } />
                <Route path="/reseller/hubs/:hubId" element={
                  <ResellerAuthProvider><ResellerProtectedRoute><ResellerHubDetailPage /></ResellerProtectedRoute></ResellerAuthProvider>
                } />
                <Route
                  path="/reseller"
                  element={
                    <ResellerAuthProvider>
                      <ResellerProtectedRoute>
                        <ResellerPosPage />
                      </ResellerProtectedRoute>
                    </ResellerAuthProvider>
                  }
                />
              </Routes>
              <Toaster position="top-right" richColors />
            </div>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
