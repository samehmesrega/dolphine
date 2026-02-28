import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeadsList from './pages/leads/LeadsList';
import LeadDetail from './pages/leads/LeadDetail';
import CreateOrder from './pages/leads/CreateOrder';
import CustomersList from './pages/customers/CustomersList';
import CustomerDetail from './pages/customers/CustomerDetail';
import OrdersList from './pages/orders/OrdersList';
import OrderDetail from './pages/orders/OrderDetail';
import OrdersPending from './pages/orders/OrdersPending';
import ReportsLayout from './pages/reports/ReportsLayout';
import GeneralReports from './pages/reports/GeneralReports';
import SalesReports from './pages/reports/SalesReports';
import MarketingReports from './pages/reports/MarketingReports';
import ProductsPage from './pages/ProductsPage';
import UsersPage from './pages/UsersPage';
import ShiftsPage from './pages/ShiftsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import AuditLogPage from './pages/AuditLogPage';
import RolesPage from './pages/RolesPage';
import ProfilePage from './pages/ProfilePage';
import LeadStatusesPage from './pages/LeadStatusesPage';
import TasksPage from './pages/TasksPage';
import TaskRulesPage from './pages/TaskRulesPage';

// تقليل إعادة جلب البيانات: البيانات تعتبر «حديثة» لمدة دقيقة
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 دقيقة
      refetchOnWindowFocus: false,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ترتيب الأولوية للصفحة الرئيسية — أول إدخال مسموح بيه يُعرض
const HOME_PRIORITY: Array<{ permission: string | null; to: string }> = [
  { permission: 'dashboard.view', to: '__dashboard__' },
  { permission: null,             to: '/tasks' },
  { permission: 'leads.view',     to: '/leads' },
  { permission: 'orders.view',    to: '/orders' },
  { permission: 'reports.view',   to: '/reports' },
];

function HomeRedirect() {
  const { hasPermission } = useAuth();

  for (const entry of HOME_PRIORITY) {
    if (!entry.permission || hasPermission(entry.permission)) {
      if (entry.to === '__dashboard__') return <Dashboard />;
      return <Navigate to={entry.to} replace />;
    }
  }

  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* صفحات عامة */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />

      {/* صفحات التطبيق — محمية */}
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<HomeRedirect />} />
        <Route path="/leads" element={<LeadsList />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/leads/:id/create-order" element={<CreateOrder />} />
        <Route path="/customers" element={<CustomersList />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/orders" element={<OrdersList />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/orders-pending" element={<OrdersPending />} />
        <Route path="/reports" element={<ReportsLayout />}>
          <Route index element={<GeneralReports />} />
          <Route path="sales" element={<SalesReports />} />
          <Route path="marketing" element={<MarketingReports />} />
        </Route>
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/lead-statuses" element={<LeadStatusesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/task-rules" element={<TaskRulesPage />} />
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
