import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './modules/auth/context/AuthContext';
import AppShell from './shared/Layout/AppShell';
import ModuleSwitcher from './shared/Layout/ModuleSwitcher';
import Login from './modules/auth/pages/Login';

const LeadsModule = lazy(() => import('./modules/leads'));
const MarketingModule = lazy(() => import('./modules/marketing'));
const KnowledgeBaseModule = lazy(() => import('./modules/knowledge-base'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Marketing module (has its own shell) */}
      <Route
        path="/marketing/*"
        element={
          <PrivateRoute>
            <Suspense fallback={<div className="p-8 text-center text-slate-400">جاري التحميل...</div>}>
              <MarketingModule />
            </Suspense>
          </PrivateRoute>
        }
      />

      {/* Knowledge Base module (has its own shell) */}
      <Route
        path="/knowledge-base/*"
        element={
          <PrivateRoute>
            <Suspense fallback={<div className="p-8 text-center text-slate-400">جاري التحميل...</div>}>
              <KnowledgeBaseModule />
            </Suspense>
          </PrivateRoute>
        }
      />

      {/* Module switcher / landing page (public) */}
      <Route path="/" element={<ModuleSwitcher />} />

      {/* Leads module (with AppShell sidebar) */}
      <Route
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      >
        {/* Leads module */}
        <Route
          path="/leads/*"
          element={
            <Suspense fallback={<div className="p-8 text-center text-slate-400">جاري التحميل...</div>}>
              <LeadsModule />
            </Suspense>
          }
        />

        {/* Backwards compatibility: old routes redirect to /leads/* */}
        <Route path="/dashboard" element={<Navigate to="/leads/dashboard" replace />} />
        <Route path="/customers" element={<Navigate to="/leads/customers" replace />} />
        <Route path="/customers/:id" element={<Navigate to="/leads/customers/:id" replace />} />
        <Route path="/orders" element={<Navigate to="/leads/orders" replace />} />
        <Route path="/orders/:id" element={<Navigate to="/leads/orders/:id" replace />} />
        <Route path="/orders-pending" element={<Navigate to="/leads/orders-pending" replace />} />
        <Route path="/reports/*" element={<Navigate to="/leads/reports" replace />} />
        <Route path="/products" element={<Navigate to="/leads/products" replace />} />
        <Route path="/shifts" element={<Navigate to="/leads/shifts" replace />} />
        <Route path="/users" element={<Navigate to="/leads/users" replace />} />
        <Route path="/integrations" element={<Navigate to="/leads/integrations" replace />} />
        <Route path="/audit" element={<Navigate to="/leads/audit" replace />} />
        <Route path="/roles" element={<Navigate to="/leads/roles" replace />} />
        <Route path="/profile" element={<Navigate to="/leads/profile" replace />} />
        <Route path="/lead-statuses" element={<Navigate to="/leads/lead-statuses" replace />} />
        <Route path="/tasks" element={<Navigate to="/leads/tasks" replace />} />
        <Route path="/task-rules" element={<Navigate to="/leads/task-rules" replace />} />
        <Route path="/dual-name" element={<Navigate to="/leads/dual-name" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
