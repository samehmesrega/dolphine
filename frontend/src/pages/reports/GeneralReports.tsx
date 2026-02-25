import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../../services/api';
import DateRangePicker, { DateRange } from '../../components/DateRangePicker';

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

type GeneralStats = {
  from: string;
  to: string;
  totalLeads: number;
  totalOrders: number;
  conversionRate: number;
  totalOrderValue: number;
  leadsOverTime: { date: string; count: number }[];
};

export default function GeneralReports() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'general', range.from, range.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/general', { params: range });
      return data as GeneralStats;
    },
  });

  const cards = [
    {
      label: 'إجمالي الليدز',
      value: isLoading ? '--' : (data?.totalLeads ?? '--'),
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'إجمالي الطلبات',
      value: isLoading ? '--' : (data?.totalOrders ?? '--'),
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'نسبة التحويل',
      value: isLoading ? '--' : (data ? `${data.conversionRate}%` : '--'),
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'إجمالي قيمة الطلبات',
      value: isLoading ? '--' : (data ? `${data.totalOrderValue.toLocaleString()} ج.م` : '--'),
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`bg-white rounded-xl shadow p-6`}>
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">ليدز خلال الفترة</h2>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-500">جاري التحميل...</div>
        ) : !data?.leadsOverTime.length ? (
          <div className="h-64 flex items-center justify-center text-slate-500">لا توجد بيانات لهذه الفترة</div>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.leadsOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number | undefined) => [v ?? 0, 'عدد الليدز']}
                  labelFormatter={(l) => `التاريخ: ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="ليدز"
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
