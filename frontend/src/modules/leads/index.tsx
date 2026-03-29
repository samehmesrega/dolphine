import { Routes, Route } from 'react-router-dom';

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
import DualNamePage from './pages/DualNamePage';
import BlacklistPage from './pages/BlacklistPage';

export default function LeadsModule() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="leads" element={<LeadsList />} />
      <Route path="leads/:id" element={<LeadDetail />} />
      <Route path="leads/:id/create-order" element={<CreateOrder />} />
      <Route path="customers" element={<CustomersList />} />
      <Route path="customers/:id" element={<CustomerDetail />} />
      <Route path="orders" element={<OrdersList />} />
      <Route path="orders/:id" element={<OrderDetail />} />
      <Route path="orders-pending" element={<OrdersPending />} />
      <Route path="reports" element={<ReportsLayout />}>
        <Route index element={<GeneralReports />} />
        <Route path="sales" element={<SalesReports />} />
        <Route path="marketing" element={<MarketingReports />} />
      </Route>
      <Route path="products" element={<ProductsPage />} />
      <Route path="shifts" element={<ShiftsPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="integrations" element={<IntegrationsPage />} />
      <Route path="audit" element={<AuditLogPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="lead-statuses" element={<LeadStatusesPage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="task-rules" element={<TaskRulesPage />} />
      <Route path="dual-name" element={<DualNamePage />} />
      <Route path="blacklist" element={<BlacklistPage />} />
    </Routes>
  );
}
