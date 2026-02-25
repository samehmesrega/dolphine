import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/reports', label: 'تقارير عامة', end: true },
  { to: '/reports/sales', label: 'تقارير تيم السيلز', end: false },
  { to: '/reports/marketing', label: 'تقارير الماركتينج', end: false },
];

export default function ReportsLayout() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">التقارير</h1>
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                isActive
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
