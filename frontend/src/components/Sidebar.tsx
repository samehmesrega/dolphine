import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const navItems: { to: string; label: string; permission?: string }[] = [
  { to: '/', label: 'داشبورد', permission: 'dashboard.view' },
  { to: '/leads', label: 'ليدز', permission: 'leads.view' },
  { to: '/customers', label: 'عملاء', permission: 'customers.view' },
  { to: '/orders', label: 'طلبات', permission: 'orders.view' },
  { to: '/orders-pending', label: 'طلبات بانتظار الحسابات', permission: 'orders.view' },
  { to: '/reports', label: 'تقارير', permission: 'reports.view' },
  { to: '/products', label: 'منتجات', permission: 'products.view' },
  { to: '/shifts', label: 'شيفتات', permission: 'shifts.manage' },
  { to: '/users', label: 'حسابات', permission: 'users.manage' },
  { to: '/roles', label: 'الأدوار والصلاحيات', permission: 'users.manage' },
  { to: '/integrations', label: 'الربط (ووردبريس / ووكومرس)', permission: 'integrations.manage' },
  { to: '/audit', label: 'سجل التدقيق', permission: 'audit.view' },
];

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <aside className="w-64 bg-slate-800 text-white flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">دولفين</h1>
          <p className="text-sm text-slate-400 mt-1">نظام إدارة الليدز</p>
        </div>
        <NotificationBell />
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-4 py-2 rounded-lg mb-1 transition ${
                isActive ? 'bg-slate-600' : 'hover:bg-slate-700'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-sm text-slate-300">{user?.name}</p>
        <p className="text-xs text-slate-500">{user?.role?.name}</p>
        <button
          onClick={handleLogout}
          className="mt-2 text-sm text-red-400 hover:text-red-300"
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
