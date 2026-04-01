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
import api from '../../../shared/services/api';

type Stats = { totalLeads: number; totalOrders: number; pendingOrders: number };

type PeriodStats = {
  totalOrders: number;
  avgTrustScore: number;
  lowTrustCount: number;
  mediumTrustCount: number;
  highTrustCount: number;
  blacklistHits: number;
  duplicateImages: number;
  duplicatePhones: number;
};

type FraudStats = {
  today: PeriodStats;
  thisWeek: PeriodStats;
  thisMonth: PeriodStats;
  topSuspiciousAgents: Array<{
    name: string;
    orderCount: number;
    rejectionRate: number;
    avgTrustScore: number;
  }>;
  topSuspiciousPhones: Array<{
    phone: string;
    count: number;
    lastUsed: string | null;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار الحسابات',
  confirmed: 'مؤكد من الحسابات',
  rejected: 'مرفوض',
  active: 'نشط',
  cancelled: 'ملغي',
  // Backwards compatibility
  pending_accounts: 'بانتظار الحسابات',
  accounts_confirmed: 'مؤكد من الحسابات',
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

async function fetchFraudStats() {
  const { data } = await api.get('/orders/fraud-stats');
  return data as FraudStats;
}

export default function Dashboard() {
  const [leadsDays, setLeadsDays] = useState(30);
  const [fraudPeriod, setFraudPeriod] = useState<'today' | 'thisWeek' | 'thisMonth'>('today');

  const PERIOD_LABELS: Record<string, string> = { today: 'اليوم', thisWeek: 'هذا الأسبوع', thisMonth: 'هذا الشهر' };

  const { data: stats, isLoading, isError } = useQuery({
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

  const { data: fraudStats, isLoading: loadingFraud } = useQuery({
    queryKey: ['dashboard', 'fraud-stats'],
    queryFn: fetchFraudStats,
  });

  const leadsData = leadsOverTime?.data ?? [];
  const ordersData = (ordersByStatus?.data ?? []).map((r) => ({
    name: STATUS_LABELS[r.status] ?? r.status,
    value: r.count,
    status: r.status,
  }));

  if (isError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 bg-red-50 inline-block px-6 py-3 rounded-lg">حدث خطأ في تحميل بيانات الداشبورد. حاول مرة أخرى.</p>
      </div>
    );
  }

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
                  formatter={(value: any) => [Number(value) || 0, 'عدد الليدز']}
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
                <Tooltip formatter={(value: any) => [Number(value) || 0, 'العدد']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* إحصائيات الحماية */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-800">إحصائيات الحماية</h2>
          <div className="flex gap-2">
            {([['today', 'اليوم'], ['thisWeek', 'هذا الأسبوع'], ['thisMonth', 'هذا الشهر']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFraudPeriod(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  fraudPeriod === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loadingFraud ? (
          <div className="h-32 flex items-center justify-center text-slate-500">جاري التحميل...</div>
        ) : !fraudStats ? (
          <div className="h-32 flex items-center justify-center text-slate-500">لا توجد بيانات</div>
        ) : (() => {
          const period = fraudStats[fraudPeriod];
          return (
            <div className="space-y-6">
              {/* Trust Score Distribution Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-slate-500">إجمالي الطلبات</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{period.totalOrders}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-green-600">ثقة عالية (80+)</p>
                  <p className="text-xl font-bold text-green-700 mt-1">{period.highTrustCount}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-yellow-600">ثقة متوسطة (50-79)</p>
                  <p className="text-xl font-bold text-yellow-700 mt-1">{period.mediumTrustCount}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-red-600">ثقة منخفضة (&lt;50)</p>
                  <p className="text-xl font-bold text-red-700 mt-1">{period.lowTrustCount}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-blue-600">متوسط Trust Score</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{period.avgTrustScore}%</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-red-600">أرقام محظورة</p>
                  <p className="text-xl font-bold text-red-700 mt-1">{period.blacklistHits}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-orange-600">صور مكررة</p>
                  <p className="text-xl font-bold text-orange-700 mt-1">{period.duplicateImages}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-purple-600">أرقام محوّل مكررة</p>
                  <p className="text-xl font-bold text-purple-700 mt-1">{period.duplicatePhones}</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Top Suspicious Agents */}
      {!loadingFraud && fraudStats && fraudStats.topSuspiciousAgents.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">سيلز مشتبه بهم ({PERIOD_LABELS[fraudPeriod]})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-right py-2 pr-2">الاسم</th>
                  <th className="text-center py-2">عدد الطلبات</th>
                  <th className="text-center py-2">نسبة الرفض</th>
                  <th className="text-center py-2">متوسط Trust Score</th>
                </tr>
              </thead>
              <tbody>
                {fraudStats.topSuspiciousAgents.map((agent, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-2 font-medium">{agent.name}</td>
                    <td className="py-2 text-center">{agent.orderCount}</td>
                    <td className="py-2 text-center">
                      <span className={agent.rejectionRate > 30 ? 'text-red-600 font-bold' : 'text-yellow-600'}>
                        {agent.rejectionRate}%
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className={
                        agent.avgTrustScore >= 80 ? 'text-green-600' :
                        agent.avgTrustScore >= 50 ? 'text-yellow-600' : 'text-red-600 font-bold'
                      }>
                        {agent.avgTrustScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Suspicious Phones */}
      {!loadingFraud && fraudStats && fraudStats.topSuspiciousPhones.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">أرقام محوّل متكررة ({PERIOD_LABELS[fraudPeriod]})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-right py-2 pr-2">رقم المحوّل</th>
                  <th className="text-center py-2">عدد الاستخدامات</th>
                  <th className="text-center py-2">آخر استخدام</th>
                </tr>
              </thead>
              <tbody>
                {fraudStats.topSuspiciousPhones.map((phone, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-2 font-mono" dir="ltr">{phone.phone}</td>
                    <td className="py-2 text-center">
                      <span className={phone.count >= 5 ? 'text-red-600 font-bold' : 'text-yellow-600'}>
                        {phone.count}
                      </span>
                    </td>
                    <td className="py-2 text-center text-slate-600">{phone.lastUsed || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-slate-500">
        مرحباً بك في دولفين. استخدم القائمة الجانبية للتنقل بين الأقسام.
      </p>
    </div>
  );
}
