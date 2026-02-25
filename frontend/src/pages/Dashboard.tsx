import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '../services/api';

type Stats = { totalLeads: number; totalOrders: number; pendingOrders: number };

const STATUS_LABELS: Record<string, string> = {
  pending_accounts: 'بانتظار الحسابات',
  accounts_confirmed: 'مؤكد من الحسابات',
  rejected: 'مرفوض',
};

const CHART_COLORS = ['#0d9488', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

async function fetchStats() {
  const { data } = await api.get('/dashboard/stats');
  return data as Stats;
}

async function fetchLeadsOverTime(days: number) {
  const { data } = await api.get('/dashboard/leads-over-time', { params: { days, groupBy: 'day' } });
  return data as { data: { date: string; count: number }[] };
}

async function fetchOrdersByStatus() {
  const { data } = await api.get('/dashboard/orders-by-status');
  return data as { data: { status: string; count: number }[] };
}

export default function Dashboard() {
  const [leadsDays, setLeadsDays] = useState(30);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchStats,
  });

  const { data: leadsOverTime, isLoading: loadingLeads } = useQuery({
    queryKey: ['dashboard', 'leads-over-time', leadsDays],
    queryFn: () => fetchLeadsOverTime(leadsDays),
  });

  const { data: ordersByStatus, isLoading: loadingOrders } = useQuery({
    queryKey: ['dashboard', 'orders-by-status'],
    queryFn: fetchOrdersByStatus,
  });

  const leadsData = leadsOverTime?.data ?? [];
  const ordersData = (ordersByStatus?.data ?? []).map((r) => ({
    name: STATUS_LABELS[r.status] ?? r.status,
    value: r.count,
    status: r.status,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">داشبورد</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-slate-500 text-sm">إجمالي الليدز</h3>
          <p className="text-2xl font-bold mt-2 text-blue-600">
            {isLoading ? '--' : stats?.totalLeads ?? '--'}
          </p>
          <Link to="/leads" className="text-sm text-blue-600 mt-2 inline-block hover:underline">عرض الليدز</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-slate-500 text-sm">إجمالي الطلبات</h3>
          <p className="text-2xl font-bold mt-2 text-green-600">
            {isLoading ? '--' : stats?.totalOrders ?? '--'}
          </p>
          <Link to="/orders" className="text-sm text-green-600 mt-2 inline-block hover:underline">عرض الطلبات</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-slate-500 text-sm">بانتظار الحسابات</h3>
          <p className="text-2xl font-bold mt-2 text-amber-600">
            {isLoading ? '--' : stats?.pendingOrders ?? '--'}
          </p>
          <Link to="/orders-pending" className="text-sm text-amber-600 mt-2 inline-block hover:underline">عرض الطلبات</Link>
        </div>
      </div>

      {/* ليدز خلال الفترة */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-800">ليدز خلال الفترة</h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setLeadsDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  leadsDays === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d} يوم
              </button>
            ))}
          </div>
        </div>
        {loadingLeads ? (
          <div className="h-64 flex items-center justify-center text-slate-500">جاري التحميل...</div>
        ) : !leadsData.length ? (
          <div className="h-64 flex items-center justify-center text-slate-500">لا توجد بيانات لهذه الفترة</div>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number | undefined) => [value ?? 0, 'عدد الليدز']}
                  labelFormatter={(label) => `التاريخ: ${label}`}
                />
                <Line type="monotone" dataKey="count" name="ليدز" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* توزيع الطلبات حسب الحالة */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">توزيع الطلبات حسب الحالة</h2>
        {loadingOrders ? (
          <div className="h-64 flex items-center justify-center text-slate-500">جاري التحميل...</div>
        ) : !ordersData.length ? (
          <div className="h-64 flex items-center justify-center text-slate-500">لا توجد طلبات</div>
        ) : (
          <div className="h-64 max-w-sm mx-auto" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ordersData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {ordersData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'العدد']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p className="text-slate-500">
        مرحباً بك في دولفين. استخدم القائمة الجانبية للتنقل بين الأقسام.
      </p>
    </div>
  );
}
