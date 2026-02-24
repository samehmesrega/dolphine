import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
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
import Reports from './pages/Reports';
import ProductsPage from './pages/ProductsPage';
import UsersPage from './pages/UsersPage';
import ShiftsPage from './pages/ShiftsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import AuditLogPage from './pages/AuditLogPage';
import RolesPage from './pages/RolesPage';

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<LeadsList />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="leads/:id/create-order" element={<CreateOrder />} />
        <Route path="customers" element={<CustomersList />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="orders" element={<OrdersList />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="orders-pending" element={<OrdersPending />} />
        <Route path="reports" element={<Reports />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="roles" element={<RolesPage />} />
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
