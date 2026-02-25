import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

type ChildItem = { to: string; label: string; permission?: string };
type SimpleEntry = { type: 'item'; to: string; label: string; permission?: string };
type GroupEntry = { type: 'group'; label: string; children: ChildItem[] };
type NavEntry = SimpleEntry | GroupEntry;

const NAV: NavEntry[] = [
  { type: 'item', to: '/', label: 'داشبورد', permission: 'dashboard.view' },
  { type: 'item', to: '/leads', label: 'ليدز', permission: 'leads.view' },
  { type: 'item', to: '/customers', label: 'عملاء', permission: 'customers.view' },
  {
    type: 'group',
    label: 'طلبات',
    children: [
      { to: '/orders', label: 'كل الطلبات', permission: 'orders.view' },
      { to: '/orders-pending', label: 'بانتظار الحسابات', permission: 'orders.view' },
    ],
  },
  { type: 'item', to: '/reports', label: 'تقارير', permission: 'reports.view' },
  { type: 'item', to: '/products', label: 'منتجات', permission: 'products.view' },
  {
    type: 'group',
    label: 'إعدادات',
    children: [
      { to: '/shifts', label: 'شيفتات', permission: 'shifts.manage' },
      { to: '/integrations', label: 'الربط (ووردبريس)', permission: 'integrations.manage' },
      { to: '/lead-statuses', label: 'حالات الليد', permission: 'shifts.manage' },
    ],
  },
  {
    type: 'group',
    label: 'حسابات',
    children: [
      { to: '/users', label: 'المستخدمين', permission: 'users.manage' },
      { to: '/roles', label: 'الأدوار والصلاحيات', permission: 'users.manage' },
    ],
  },
  { type: 'item', to: '/audit', label: 'سجل التدقيق', permission: 'audit.view' },
];

function GroupNav({
  group,
  hasPermission,
}: {
  group: GroupEntry;
  hasPermission: (p: string) => boolean;
}) {
  const location = useLocation();
  const visibleChildren = group.children.filter(
    (c) => !c.permission || hasPermission(c.permission),
  );
  if (!visibleChildren.length) return null;

  const isAnyChildActive = visibleChildren.some((c) =>
    location.pathname === c.to || location.pathname.startsWith(c.to + '/'),
  );
  const [open, setOpen] = useState(isAnyChildActive);

  useEffect(() => {
    if (isAnyChildActive) setOpen(true);
  }, [isAnyChildActive]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition text-sm"
      >
        <span>{group.label}</span>
        <svg
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="mt-0.5 ml-3 pl-2 border-l border-slate-700">
          {visibleChildren.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-lg mb-0.5 transition text-sm ${
                  isActive
                    ? 'bg-amber-600 text-white font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-amber-400">دولفين</h1>
          <p className="text-sm text-slate-400 mt-1">نظام إدارة الليدز</p>
        </div>
        <NotificationBell />
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {NAV.map((entry, i) => {
          if (entry.type === 'item') {
            if (entry.permission && !hasPermission(entry.permission)) return null;
            return (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.to === '/'}
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg mb-1 transition text-sm ${
                    isActive
                      ? 'bg-amber-600 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {entry.label}
              </NavLink>
            );
          }
          return <GroupNav key={i} group={entry} hasPermission={hasPermission} />;
        })}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <p className="text-sm text-slate-300 font-medium">{user?.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{user?.role?.name}</p>
        <div className="mt-2 flex items-center gap-3">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}`
            }
          >
            ملفي الشخصي
          </NavLink>
          <span className="text-slate-700">·</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-400 hover:text-red-300"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </aside>
  );
}
