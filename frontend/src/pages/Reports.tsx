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

// ===== types =====

type Stats = { totalLeads: number; totalOrders: number; pendingOrders: number };

type AgentStat = {
  userId: string;
  userName: string;
  totalLeads: number;
  confirmedLeads: number;
  confirmationRate: number;
  orderCount: number;
  totalOrderValue: number;
  avgOrderValue: number;
  avgItemsPerOrder: number;
};

type ShiftStat = {
  shiftId: string;
  shiftName: string;
  totalLeads: number;
  confirmedLeads: number;
  confirmationRate: number;
  orderCount: number;
  totalOrderValue: number;
  avgOrderValue: number;
  avgItemsPerOrder: number;
};

type SourceStat = {
  label: string;
  totalLeads: number;
  confirmedLeads: number;
  confirmationRate: number;
  orderCount: number;
  totalOrderValue: number;
  avgOrderValue: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending_accounts: 'بانتظار الحسابات',
  accounts_confirmed: 'مؤكد من الحسابات',
  rejected: 'مرفوض',
};

const CHART_COLORS = ['#0d9488', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

// ===== helpers =====

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('ar-EG', { maximumFractionDigits: decimals });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ===== shared table components =====

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th
      className={`py-2 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap ${
        center ? 'text-center' : 'text-right'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, center, bold }: { children: React.ReactNode; center?: boolean; bold?: boolean }) {
  return (
    <td
      className={`py-2 px-3 text-sm whitespace-nowrap ${center ? 'text-center' : 'text-right'} ${
        bold ? 'font-semibold text-slate-800' : 'text-slate-700'
      }`}
    >
      {children}
    </td>
  );
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 50 ? 'bg-green-500' : rate >= 25 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs text-slate-600">{rate}%</span>
    </div>
  );
}

// ===== مكوّن تقرير موظفين/شيفتات =====

function PerformanceTable({
  rows,
  nameKey,
  nameLabel,
  showAvgItems,
}: {
  rows: (AgentStat | ShiftStat)[];
  nameKey: 'userName' | 'shiftName';
  nameLabel: string;
  showAvgItems: boolean;
}) {
  if (!rows.length) {
    return <p className="text-slate-400 text-sm py-4 text-center">لا توجد بيانات في هذه الفترة</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <Th>{nameLabel}</Th>
            <Th center>إجمالي الليدز</Th>
            <Th center>ليدز مؤكدة</Th>
            <Th center>نسبة التأكيد</Th>
            <Th center>الطلبات</Th>
            <Th center>قيمة الطلبات</Th>
            <Th center>متوسط الطلب</Th>
            {showAvgItems && <Th center>متوسط القطع</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <Td bold>{(r as Record<string, unknown>)[nameKey] as string}</Td>
              <Td center>{fmt(r.totalLeads)}</Td>
              <Td center>{fmt(r.confirmedLeads)}</Td>
              <Td center>
                <RateBar rate={r.confirmationRate} />
              </Td>
              <Td center>{fmt(r.orderCount)}</Td>
              <Td center>{fmt(r.totalOrderValue, 2)}</Td>
              <Td center>{fmt(r.avgOrderValue, 2)}</Td>
              {showAvgItems && (
                <Td center>
                  {fmt('avgItemsPerOrder' in r ? r.avgItemsPerOrder : 0, 1)}
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== مكوّن تقرير المصادر =====

function SourceTable({ rows }: { rows: SourceStat[] }) {
  if (!rows.length) {
    return <p className="text-slate-400 text-sm py-4 text-center">لا توجد بيانات في هذه الفترة</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <Th>المصدر</Th>
            <Th center>إجمالي الليدز</Th>
            <Th center>ليدز مؤكدة</Th>
            <Th center>نسبة التأكيد</Th>
            <Th center>الطلبات</Th>
            <Th center>قيمة الطلبات</Th>
            <Th center>متوسط الطلب</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <Td bold>{r.label}</Td>
              <Td center>{fmt(r.totalLeads)}</Td>
              <Td center>{fmt(r.confirmedLeads)}</Td>
              <Td center>
                <RateBar rate={r.confirmationRate} />
              </Td>
              <Td center>{fmt(r.orderCount)}</Td>
              <Td center>{fmt(r.totalOrderValue, 2)}</Td>
              <Td center>{fmt(r.avgOrderValue, 2)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== الصفحة الرئيسية =====

export default function ReportsPage() {
  // فترة رسوم الداشبورد الحالية
  const [periodDays, setPeriodDays] = useState(30);

  // فترة التقارير التفصيلية
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());

  // تاب المصادر النشط
  const [sourceTab, setSourceTab] = useState<'utm_source' | 'utm_campaign' | 'form'>('utm_source');

  // ===== queries الداشبورد الحالي =====
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<Stats>('/dashboard/stats');
      return data;
    },
  });

  const { data: leadsOverTime, isLoading: loadingLeads } = useQuery({
    queryKey: ['dashboard', 'leads-over-time', periodDays],
    queryFn: async () => {
      const { data } = await api.get<{ data: { date: string; count: number }[] }>(
        '/dashboard/leads-over-time',
        { params: { days: periodDays, groupBy: 'day' } },
      );
      return data;
    },
  });

  const { data: ordersByStatus, isLoading: loadingOrders } = useQuery({
    queryKey: ['dashboard', 'orders-by-status'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { status: string; count: number }[] }>(
        '/dashboard/orders-by-status',
      );
      return data;
    },
  });

  // ===== queries التقارير التفصيلية =====
  const { data: agentsData, isLoading: loadingAgents } = useQuery({
    queryKey: ['reports', 'agents', from, to],
    queryFn: async () => {
      const { data } = await api.get<{ agents: AgentStat[] }>('/reports/agents', {
        params: { from, to },
      });
      return data.agents;
    },
  });

  const { data: shiftsData, isLoading: loadingShifts } = useQuery({
    queryKey: ['reports', 'shifts', from, to],
    queryFn: async () => {
      const { data } = await api.get<{ shifts: ShiftStat[] }>('/reports/shifts', {
        params: { from, to },
      });
      return data.shifts;
    },
  });

  const { data: sourcesData, isLoading: loadingSources } = useQuery({
    queryKey: ['reports', 'sources', from, to],
    queryFn: async () => {
      const { data } = await api.get<{
        byUtmSource: SourceStat[];
        byUtmCampaign: SourceStat[];
        byForm: SourceStat[];
      }>('/reports/sources', { params: { from, to } });
      return data;
    },
  });

  const leadsData = leadsOverTime?.data ?? [];
  const ordersData = (ordersByStatus?.data ?? []).map((r) => ({
    name: STATUS_LABELS[r.status] ?? r.status,
    value: r.count,
  }));

  const setPreset = (days: number) => {
    setFrom(daysAgo(days));
    setTo(today());
  };

  const activeSourceRows =
    sourceTab === 'utm_source'
      ? (sourcesData?.byUtmSource ?? [])
      : sourceTab === 'utm_campaign'
      ? (sourcesData?.byUtmCampaign ?? [])
      : (sourcesData?.byForm ?? []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">تقارير</h1>

      {/* ===== ملخص عام ===== */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-slate-700 mb-4">ملخص عام</h2>
        {isLoading ? (
          <p className="text-slate-500">جاري التحميل...</p>
        ) : (
          <ul className="space-y-2 text-slate-700">
            <li>
              إجمالي الليدز: <strong>{fmt(stats?.totalLeads ?? 0)}</strong>
            </li>
            <li>
              إجمالي الطلبات: <strong>{fmt(stats?.totalOrders ?? 0)}</strong>
            </li>
            <li>
              طلبات بانتظار تأكيد الحسابات: <strong>{fmt(stats?.pendingOrders ?? 0)}</strong>
            </li>
          </ul>
        )}
        <Link to="/orders-pending" className="mt-4 inline-block text-amber-600 hover:underline">
          → طلبات بانتظار الحسابات
        </Link>
      </div>

      {/* ===== ليدز خلال الفترة ===== */}
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
                  periodDays === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          <div className="h-64 flex items-center justify-center text-slate-500">
            لا توجد بيانات لهذه الفترة
          </div>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number | undefined) => [v ?? 0, 'عدد الليدز']}
                  labelFormatter={(l) => `التاريخ: ${l}`}
                />
                <Bar dataKey="count" name="ليدز" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ===== توزيع الطلبات ===== */}
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
                <Tooltip formatter={(v: number | undefined) => [v ?? 0, 'العدد']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ===== فاصل + فلتر الفترة للتقارير التفصيلية ===== */}
      <div className="border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-3">التقارير التفصيلية</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">من:</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">إلى:</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-1.5">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPreset(d)}
                    className="px-2.5 py-1.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    {d}يوم
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== تقرير موظفي السيلز ===== */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">أداء موظفي السيلز</h3>
          {loadingAgents ? (
            <p className="text-slate-500 text-sm">جاري التحميل...</p>
          ) : (
            <PerformanceTable
              rows={agentsData ?? []}
              nameKey="userName"
              nameLabel="الموظف"
              showAvgItems
            />
          )}
        </div>

        {/* ===== تقرير الشيفتات ===== */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">أداء الشيفتات</h3>
          {loadingShifts ? (
            <p className="text-slate-500 text-sm">جاري التحميل...</p>
          ) : (
            <PerformanceTable
              rows={shiftsData ?? []}
              nameKey="shiftName"
              nameLabel="الشيفت"
              showAvgItems
            />
          )}
        </div>

        {/* ===== تقرير المصادر (UTM) ===== */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">تقرير المصادر</h3>

          {/* تابات المصادر */}
          <div className="flex gap-1 mb-4 border-b border-slate-200">
            {(
              [
                { key: 'utm_source', label: 'مصدر الزيارة' },
                { key: 'utm_campaign', label: 'الحملة الإعلانية' },
                { key: 'form', label: 'مصدر النموذج' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSourceTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  sourceTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingSources ? (
            <p className="text-slate-500 text-sm">جاري التحميل...</p>
          ) : (
            <SourceTable rows={activeSourceRows} />
          )}
        </div>
      </div>
    </div>
  );
}
