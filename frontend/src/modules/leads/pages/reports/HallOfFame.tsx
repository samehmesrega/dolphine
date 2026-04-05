import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../shared/services/api';
import DateRangePicker, { DateRange } from '../../../../shared/components/DateRangePicker';

function defaultRange(): DateRange {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: fmt(from), to: fmt(to) };
}

type AgentStat = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  totalLeads: number;
  orderCount: number;
  totalOrderValue: number;
};

type MonthWinner = {
  month: number;
  monthName: string;
  winner: {
    userId: string;
    userName: string;
    avatarUrl: string | null;
    orderCount: number;
    totalLeads: number;
    confirmationRate: number;
    totalOrderValue: number;
  } | null;
};

function Avatar({ url, name, size = 'md' }: { url: string | null; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-xl', xl: 'w-28 h-28 text-3xl' };
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (url) {
    return <img src={url} alt={name} className={`${sizes[size]} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold`}>
      {initials}
    </div>
  );
}

function RateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-left">{Math.min(value, 100)}%</span>
    </div>
  );
}

export default function HallOfFame() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: agentsData, isLoading: loadingAgents } = useQuery({
    queryKey: ['reports', 'agents', range.from, range.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/agents', { params: range });
      return data as { agents: AgentStat[] };
    },
  });

  const { data: hofData, isLoading: loadingHof } = useQuery({
    queryKey: ['reports', 'hall-of-fame', year],
    queryFn: async () => {
      const { data } = await api.get('/reports/hall-of-fame', { params: { year } });
      return data as { year: number; months: MonthWinner[] };
    },
  });

  // Sort agents by orderCount for leaderboard
  const sorted = [...(agentsData?.agents || [])].sort((a, b) => b.orderCount - a.orderCount);
  const top3 = sorted.slice(0, 3);
  const champion = top3[0];

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="bg-white rounded-xl shadow p-4">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loadingAgents ? (
        <div className="py-16 text-center text-slate-500">جاري التحميل...</div>
      ) : !champion || champion.orderCount === 0 ? (
        <div className="py-16 text-center text-slate-500">لا توجد بيانات لهذه الفترة</div>
      ) : (
        <>
          {/* A. Hero Section — Champion */}
          <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl shadow-lg border border-amber-200 p-8 text-center">
            <div className="inline-block mb-4">
              <div className="relative">
                <div className="ring-4 ring-amber-400 ring-offset-4 ring-offset-amber-50 rounded-full inline-block">
                  <Avatar url={champion.avatarUrl} name={champion.userName} size="xl" />
                </div>
                <div className="absolute -top-3 -right-3 text-4xl">&#x1F451;</div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-amber-800 mt-2">{champion.userName}</h2>
            <p className="text-amber-600 font-medium text-lg mt-1">&#x2B50; نجم السيلز &#x2B50;</p>
            <div className="flex justify-center gap-8 mt-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-700">{champion.orderCount}</div>
                <div className="text-sm text-amber-600">طلب مؤكد</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-700">
                  {champion.totalLeads > 0 ? Math.round((champion.orderCount / champion.totalLeads) * 100) : 0}%
                </div>
                <div className="text-sm text-amber-600">نسبة التأكيد</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-700">{champion.totalOrderValue.toLocaleString()}</div>
                <div className="text-sm text-amber-600">قيمة الطلبات</div>
              </div>
            </div>
          </div>

          {/* B. Podium — Top 3 */}
          {top3.length >= 2 && (
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">&#x1F3C6; المنصة</h3>
              <div className="flex items-end justify-center gap-4 max-w-lg mx-auto">
                {/* 2nd place */}
                {top3[1] && (
                  <div className="flex-1 text-center">
                    <div className="mb-2">
                      <div className="ring-2 ring-slate-300 rounded-full inline-block">
                        <Avatar url={top3[1].avatarUrl} name={top3[1].userName} size="lg" />
                      </div>
                    </div>
                    <div className="text-2xl mb-1">&#x1F948;</div>
                    <div className="font-semibold text-slate-700 text-sm">{top3[1].userName}</div>
                    <div className="text-xs text-slate-500 mt-1">{top3[1].orderCount} طلب</div>
                    <div className="bg-slate-200 rounded-t-lg h-20 mt-2 flex items-center justify-center">
                      <span className="text-2xl font-bold text-slate-400">2</span>
                    </div>
                  </div>
                )}

                {/* 1st place */}
                <div className="flex-1 text-center">
                  <div className="mb-2">
                    <div className="ring-2 ring-amber-400 rounded-full inline-block">
                      <Avatar url={top3[0].avatarUrl} name={top3[0].userName} size="lg" />
                    </div>
                  </div>
                  <div className="text-2xl mb-1">&#x1F947;</div>
                  <div className="font-semibold text-slate-800 text-sm">{top3[0].userName}</div>
                  <div className="text-xs text-slate-500 mt-1">{top3[0].orderCount} طلب</div>
                  <div className="bg-amber-400 rounded-t-lg h-28 mt-2 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">1</span>
                  </div>
                </div>

                {/* 3rd place */}
                {top3[2] && (
                  <div className="flex-1 text-center">
                    <div className="mb-2">
                      <div className="ring-2 ring-orange-300 rounded-full inline-block">
                        <Avatar url={top3[2].avatarUrl} name={top3[2].userName} size="lg" />
                      </div>
                    </div>
                    <div className="text-2xl mb-1">&#x1F949;</div>
                    <div className="font-semibold text-slate-700 text-sm">{top3[2].userName}</div>
                    <div className="text-xs text-slate-500 mt-1">{top3[2].orderCount} طلب</div>
                    <div className="bg-orange-200 rounded-t-lg h-14 mt-2 flex items-center justify-center">
                      <span className="text-2xl font-bold text-orange-400">3</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* D. Full Leaderboard */}
          <div className="bg-white rounded-2xl shadow p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">&#x1F4CA; الترتيب الكامل</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="pb-3 pr-2 font-medium text-right w-10">#</th>
                    <th className="pb-3 px-2 font-medium text-right">الموظف</th>
                    <th className="pb-3 px-2 font-medium text-right">الليدز</th>
                    <th className="pb-3 px-2 font-medium text-right">الطلبات</th>
                    <th className="pb-3 px-2 font-medium text-right">القيمة</th>
                    <th className="pb-3 px-2 font-medium text-right w-40">نسبة التأكيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((a, i) => {
                    const rate = a.totalLeads > 0 ? Math.round((a.orderCount / a.totalLeads) * 100) : 0;
                    return (
                      <tr key={a.userId} className="hover:bg-slate-50">
                        <td className="py-3 pr-2 font-bold text-slate-400">{i + 1}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Avatar url={a.avatarUrl} name={a.userName} size="sm" />
                            <span className="font-medium text-slate-800">{a.userName}</span>
                            {i === 0 && <span className="text-sm">&#x1F451;</span>}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-slate-600">{a.totalLeads}</td>
                        <td className="py-3 px-2 text-slate-600 font-medium">{a.orderCount}</td>
                        <td className="py-3 px-2 text-slate-600">{a.totalOrderValue.toLocaleString()}</td>
                        <td className="py-3 px-2">
                          <RateBar value={rate} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* C. Monthly Honor Board */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">&#x1F3C5; لوحة الشرف الشهرية</h3>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {loadingHof ? (
          <div className="py-8 text-center text-slate-500">جاري التحميل...</div>
        ) : !hofData?.months.length ? (
          <div className="py-8 text-center text-slate-500">لا توجد بيانات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="pb-3 pr-2 font-medium text-right">الشهر</th>
                  <th className="pb-3 px-2 font-medium text-right">نجم الشهر</th>
                  <th className="pb-3 px-2 font-medium text-right">الطلبات</th>
                  <th className="pb-3 px-2 font-medium text-right">نسبة التأكيد</th>
                  <th className="pb-3 px-2 font-medium text-right">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hofData.months.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50">
                    <td className="py-3 pr-2 font-medium text-slate-700">{m.monthName}</td>
                    {m.winner ? (
                      <>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Avatar url={m.winner.avatarUrl} name={m.winner.userName} size="sm" />
                            <span className="font-medium text-slate-800">{m.winner.userName}</span>
                            <span className="text-sm">&#x2B50;</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-slate-600 font-medium">{m.winner.orderCount}</td>
                        <td className="py-3 px-2 text-slate-600">{m.winner.confirmationRate}%</td>
                        <td className="py-3 px-2 text-slate-600">{m.winner.totalOrderValue.toLocaleString()}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="py-3 px-2 text-slate-400 text-center">لا توجد بيانات</td>
                    )}
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
