import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import DateRangePicker, { DateRange } from '../../components/DateRangePicker';

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function RateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div
          className="bg-amber-500 h-2 rounded-full"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-left">{value}%</span>
    </div>
  );
}

type AgentStat = {
  userId: string;
  userName: string;
  totalLeads: number;
  confirmedLeads: number;
  confirmationRate: number;
  orderCount: number;
  totalOrderValue: number;
  avgOrderValue: number;
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
};

const TH = 'pb-3 px-2 font-medium text-right';
const TD = 'py-3 px-2 text-slate-600';

export default function SalesReports() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: agentsData, isLoading: loadingAgents } = useQuery({
    queryKey: ['reports', 'agents', range.from, range.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/agents', { params: range });
      return data as { agents: AgentStat[] };
    },
  });

  const { data: shiftsData, isLoading: loadingShifts } = useQuery({
    queryKey: ['reports', 'shifts', range.from, range.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/shifts', { params: range });
      return data as { shifts: ShiftStat[] };
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* أداء الموظفين */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">أداء الموظفين</h2>
        {loadingAgents ? (
          <div className="py-8 text-center text-slate-500">جاري التحميل...</div>
        ) : !agentsData?.agents.length ? (
          <div className="py-8 text-center text-slate-500">لا توجد بيانات لهذه الفترة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="pb-3 pr-2 font-medium text-right">الموظف</th>
                  <th className={TH}>الليدز</th>
                  <th className={TH}>مؤكد</th>
                  <th className="pb-3 px-2 font-medium text-right w-36">نسبة التأكيد</th>
                  <th className={TH}>الطلبات</th>
                  <th className={TH}>القيمة الإجمالية</th>
                  <th className={TH}>متوسط الطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentsData.agents.map((a) => (
                  <tr key={a.userId} className="hover:bg-slate-50">
                    <td className="py-3 pr-2 font-medium text-slate-800">{a.userName}</td>
                    <td className={TD}>{a.totalLeads}</td>
                    <td className={TD}>{a.confirmedLeads}</td>
                    <td className="py-3 px-2">
                      <RateBar value={a.confirmationRate} />
                    </td>
                    <td className={TD}>{a.orderCount}</td>
                    <td className={TD}>{a.totalOrderValue.toLocaleString()}</td>
                    <td className={TD}>{a.avgOrderValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* أداء الشيفتات */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">أداء الشيفتات</h2>
        {loadingShifts ? (
          <div className="py-8 text-center text-slate-500">جاري التحميل...</div>
        ) : !shiftsData?.shifts.length ? (
          <div className="py-8 text-center text-slate-500">لا توجد بيانات لهذه الفترة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="pb-3 pr-2 font-medium text-right">الشيفت</th>
                  <th className={TH}>الليدز</th>
                  <th className={TH}>مؤكد</th>
                  <th className="pb-3 px-2 font-medium text-right w-36">نسبة التأكيد</th>
                  <th className={TH}>الطلبات</th>
                  <th className={TH}>القيمة الإجمالية</th>
                  <th className={TH}>متوسط الطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftsData.shifts.map((s) => (
                  <tr key={s.shiftId} className="hover:bg-slate-50">
                    <td className="py-3 pr-2 font-medium text-slate-800">{s.shiftName}</td>
                    <td className={TD}>{s.totalLeads}</td>
                    <td className={TD}>{s.confirmedLeads}</td>
                    <td className="py-3 px-2">
                      <RateBar value={s.confirmationRate} />
                    </td>
                    <td className={TD}>{s.orderCount}</td>
                    <td className={TD}>{s.totalOrderValue.toLocaleString()}</td>
                    <td className={TD}>{s.avgOrderValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
