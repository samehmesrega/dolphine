import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './modules/auth/context/AuthContext';
import AppShell from './shared/Layout/AppShell';
import ModuleSwitcher from './shared/Layout/ModuleSwitcher';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ErrorBoundary from './shared/components/ErrorBoundary';
import FloatingBugButton from './shared/components/FloatingBugButton';
import Login from './modules/auth/pages/Login';
import SlackCallback from './modules/auth/pages/SlackCallback';
import Register from './modules/auth/pages/Register';
import ForgotPassword from './modules/auth/pages/ForgotPassword';
import ResetPassword from './modules/auth/pages/ResetPassword';

const LeadsModule = lazy(() => import('./modules/leads'));
const MarketingModule = lazy(() => import('./modules/marketing'));
const KnowledgeBaseModule = lazy(() => import('./modules/knowledge-base'));
const SettingsModule = lazy(() => import('./modules/settings'));
const InboxModule = lazy(() => import('./modules/inbox'));

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
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/slack/callback" element={<SlackCallback />} />

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

      {/* Inbox module (has its own shell) */}
      <Route
        path="/inbox/*"
        element={
          <PrivateRoute>
            <Suspense fallback={<div className="p-8 text-center text-slate-400">جاري التحميل...</div>}>
              <InboxModule />
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

      {/* Settings module (has its own shell) */}
      <Route
        path="/settings/*"
        element={
          <PrivateRoute>
            <Suspense fallback={<div className="p-8 text-center text-slate-400">جاري التحميل...</div>}>
              <SettingsModule />
            </Suspense>
          </PrivateRoute>
        }
      />

      {/* Dual Name — iframe to original app, auth-protected */}
      <Route
        path="/dual-name"
        element={
          <PrivateRoute>
            <iframe
              src="https://dual-letter-illusion.onrender.com"
              style={{ width: '100%', height: '100vh', border: 'none' }}
              title="Dual Name 3D"
            />
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
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId="153436775702-v2adks57l834f2qob1j24i27vid36r9p.apps.googleusercontent.com">
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
              <FloatingBugButton />
            </AuthProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}
