import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

// ============ أيقونات SVG ============
const ICONS: Record<string, string> = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  userGroup: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  shoppingBag: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  chartBar: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  cube: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  userCircle: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 19l-7-7 7-7',
  chevronDown: 'M19 9l-7 7-7-7',
};

function NavIcon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const path = ICONS[name] ?? ICONS.cube;
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      {path.split(' M').map((seg, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

// ============ تعريف القائمة مع الأيقونات ============
type ChildItem = { to: string; label: string; permission?: string };
type SimpleEntry = { type: 'item'; to: string; label: string; icon: string; permission?: string };
type GroupEntry = { type: 'group'; label: string; icon: string; children: ChildItem[] };
type NavEntry = SimpleEntry | GroupEntry;

const NAV: NavEntry[] = [
  { type: 'item', to: '/', label: 'داشبورد', icon: 'home', permission: 'dashboard.view' },
  { type: 'item', to: '/leads', label: 'ليدز', icon: 'users', permission: 'leads.view' },
  { type: 'item', to: '/customers', label: 'عملاء', icon: 'userGroup', permission: 'customers.view' },
  {
    type: 'group',
    label: 'طلبات',
    icon: 'shoppingBag',
    children: [
      { to: '/orders', label: 'كل الطلبات', permission: 'orders.view' },
      { to: '/orders-pending', label: 'بانتظار الحسابات', permission: 'orders.view' },
    ],
  },
  { type: 'item', to: '/reports', label: 'تقارير', icon: 'chartBar', permission: 'reports.view' },
  { type: 'item', to: '/products', label: 'منتجات', icon: 'cube', permission: 'products.view' },
  {
    type: 'group',
    label: 'إعدادات',
    icon: 'cog',
    children: [
      { to: '/shifts', label: 'شيفتات', permission: 'shifts.manage' },
      { to: '/integrations', label: 'الربط (ووردبريس)', permission: 'integrations.manage' },
      { to: '/lead-statuses', label: 'حالات الليد', permission: 'shifts.manage' },
    ],
  },
  {
    type: 'group',
    label: 'حسابات',
    icon: 'shield',
    children: [
      { to: '/users', label: 'المستخدمين', permission: 'users.manage' },
      { to: '/roles', label: 'الأدوار والصلاحيات', permission: 'users.manage' },
    ],
  },
  { type: 'item', to: '/audit', label: 'سجل التدقيق', icon: 'clipboard', permission: 'audit.view' },
];

// ============ GroupNav (expanded mode) ============
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
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition text-sm"
      >
        <div className="flex items-center gap-2.5">
          <NavIcon name={group.icon} />
          <span>{group.label}</span>
        </div>
        <NavIcon
          name="chevronDown"
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 mr-7 pr-2 border-r border-slate-700">
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

// ============ GroupIcon (collapsed mode) ============
function GroupIcon({
  group,
  hasPermission,
}: {
  group: GroupEntry;
  hasPermission: (p: string) => boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const visibleChildren = group.children.filter(
    (c) => !c.permission || hasPermission(c.permission),
  );
  if (!visibleChildren.length) return null;

  const isAnyChildActive = visibleChildren.some((c) =>
    location.pathname === c.to || location.pathname.startsWith(c.to + '/'),
  );

  return (
    <button
      type="button"
      title={group.label}
      onClick={() => navigate(visibleChildren[0].to)}
      className={`w-full flex items-center justify-center p-2.5 rounded-lg mb-1 transition ${
        isAnyChildActive
          ? 'bg-amber-600 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <NavIcon name={group.icon} />
    </button>
  );
}

// ============ Sidebar ============
export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('sidebar_collapsed', String(next)); } catch { /* */ }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-64'} bg-slate-900 text-white flex flex-col transition-all duration-200 shrink-0`}
    >
      {/* Header */}
      <div className={`border-b border-slate-800 flex items-center shrink-0 ${collapsed ? 'flex-col gap-2 py-3 px-2' : 'p-4 justify-between gap-2'}`}>
        {!collapsed && (
          <div>
            <h1 className="text-xl font-bold text-amber-400">دولفين</h1>
            <p className="text-xs text-slate-400 mt-0.5">نظام إدارة الليدز</p>
          </div>
        )}
        {collapsed && <NotificationBell />}
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          {!collapsed && <NotificationBell />}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <NavIcon name={collapsed ? 'chevronLeft' : 'chevronRight'} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto min-h-0 ${collapsed ? 'p-1.5' : 'p-2'}`}>
        {NAV.map((entry, i) => {
          if (entry.type === 'item') {
            if (entry.permission && !hasPermission(entry.permission)) return null;
            if (collapsed) {
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.to === '/'}
                  title={entry.label}
                  className={({ isActive }) =>
                    `flex items-center justify-center p-2.5 rounded-lg mb-1 transition ${
                      isActive
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <NavIcon name={entry.icon} />
                </NavLink>
              );
            }
            return (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 transition text-sm ${
                    isActive
                      ? 'bg-amber-600 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <NavIcon name={entry.icon} />
                <span>{entry.label}</span>
              </NavLink>
            );
          }
          if (collapsed) {
            return <GroupIcon key={i} group={entry} hasPermission={hasPermission} />;
          }
          return <GroupNav key={i} group={entry} hasPermission={hasPermission} />;
        })}
      </nav>

      {/* Account section - always visible */}
      <div className={`border-t border-slate-800 shrink-0 ${collapsed ? 'p-2' : 'p-4'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <NavLink
              to="/profile"
              title="ملفي الشخصي"
              className={({ isActive }) =>
                `p-2 rounded-lg transition ${isActive ? 'text-amber-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
              }
            >
              <NavIcon name="userCircle" />
            </NavLink>
            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-slate-800 transition"
            >
              <NavIcon name="logout" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-300 font-medium truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user?.role?.name}</p>
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
          </>
        )}
      </div>
    </aside>
  );
}
