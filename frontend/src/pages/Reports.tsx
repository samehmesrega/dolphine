import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
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

const CHART_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

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

export default function ReportsPage() {
  const [periodDays, setPeriodDays] = useState(30);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchStats,
  });

  const { data: leadsOverTime, isLoading: loadingLeads } = useQuery({
    queryKey: ['dashboard', 'leads-over-time', periodDays],
    queryFn: () => fetchLeadsOverTime(periodDays),
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
      <h1 className="text-2xl font-bold text-slate-800 mb-6">تقارير</h1>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-slate-700 mb-4">ملخص عام</h2>
        {isLoading ? (
          <p className="text-slate-500">جاري التحميل...</p>
        ) : (
          <ul className="space-y-2 text-slate-700">
            <li>إجمالي الليدز: <strong>{stats?.totalLeads ?? 0}</strong></li>
            <li>إجمالي الطلبات: <strong>{stats?.totalOrders ?? 0}</strong></li>
            <li>طلبات بانتظار تأكيد الحسابات: <strong>{stats?.pendingOrders ?? 0}</strong></li>
          </ul>
        )}
        <Link to="/orders-pending" className="mt-4 inline-block text-amber-600 hover:underline">
          → طلبات بانتظار الحسابات
        </Link>
      </div>

      {/* ليدز خلال الفترة — مع فلتر الفترة */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-800">ليدز خلال الفترة</h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPeriodDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  periodDays === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                آخر {d} يوم
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
              <BarChart data={leadsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [value, 'عدد الليدز']}
                  labelFormatter={(label) => `التاريخ: ${label}`}
                />
                <Bar dataKey="count" name="ليدز" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
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
                <Tooltip formatter={(value: number) => [value, 'العدد']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
