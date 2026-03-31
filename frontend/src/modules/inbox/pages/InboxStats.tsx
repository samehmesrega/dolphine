import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as inboxApi from '../services/inbox-api';

const PERIOD_OPTIONS = [
  { label: 'اليوم', value: 'today' },
  { label: 'هذا الأسبوع', value: 'week' },
  { label: 'هذا الشهر', value: 'month' },
];

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      from = new Date(now);
      from.setDate(from.getDate() - 7);
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      from = new Date(now);
      from.setDate(from.getDate() - 7);
  }

  return { from: from.toISOString(), to };
}

export default function InboxStats() {
  const [period, setPeriod] = useState('week');
  const [brandFilter, setBrandFilter] = useState('');
  const dateRange = getDateRange(period);

  const { data: brandsRes } = useQuery({ queryKey: ['brands'], queryFn: inboxApi.getBrands });
  const brands = brandsRes?.data || [];

  const params: Record<string, string> = { from: dateRange.from, to: dateRange.to };
  if (brandFilter) params.brandId = brandFilter;

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ['inbox', 'stats', 'team', params],
    queryFn: () => inboxApi.getTeamStats(params),
  });
  const stats = statsRes?.data;

  const overviewCards = [
    { label: 'إجمالي المحادثات', value: stats?.overview?.totalConversations ?? 0, icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'violet' },
    { label: 'إجمالي الردود', value: (stats?.overview?.totalMessagesSent ?? 0) + (stats?.overview?.totalCommentReplies ?? 0), icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6', color: 'blue' },
    { label: 'متوسط وقت الاستجابة', value: stats?.overview?.avgResponseTime != null ? `${stats.overview.avgResponseTime} د` : '—', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'amber' },
    { label: 'تحويلات لطلبات', value: stats?.overview?.ordersCreated ?? 0, icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: 'green' },
  ];

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    violet: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'text-violet-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header + Filters */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">إحصائيات الفريق</h1>
        <div className="flex items-center gap-3">
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5"
          >
            <option value="">كل البراندات</option>
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1 rounded-md text-sm transition ${
                  period === opt.value ? 'bg-white shadow text-slate-800 font-medium' : 'text-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-12">جاري التحميل...</div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {overviewCards.map((card) => {
              const colors = colorClasses[card.color];
              return (
                <div key={card.label} className={`${colors.bg} rounded-xl p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-600">{card.label}</span>
                    <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                    </svg>
                  </div>
                  <p className={`text-2xl font-bold ${colors.text}`}>{card.value}</p>
                </div>
              );
            })}
          </div>

          {/* Team Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-700">أداء الفريق</h2>
            </div>
            {!stats?.agents?.length ? (
              <div className="p-8 text-center text-slate-400 text-sm">لا توجد بيانات في الفترة المحددة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="text-right px-4 py-3 font-medium">الموظف</th>
                      <th className="text-center px-4 py-3 font-medium">محادثات مُعالجة</th>
                      <th className="text-center px-4 py-3 font-medium">رسائل مبعوتة</th>
                      <th className="text-center px-4 py-3 font-medium">ردود تعليقات</th>
                      <th className="text-center px-4 py-3 font-medium">avg رد</th>
                      <th className="text-center px-4 py-3 font-medium">تحويل لليدز</th>
                      <th className="text-center px-4 py-3 font-medium">تحويل لطلبات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.agents.map((agent: any) => (
                      <tr key={agent.userId} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{agent.userName}</td>
                        <td className="px-4 py-3 text-center">{agent.conversationsHandled}</td>
                        <td className="px-4 py-3 text-center">{agent.messagesSent}</td>
                        <td className="px-4 py-3 text-center">{agent.commentReplies}</td>
                        <td className="px-4 py-3 text-center">
                          {agent.avgResponseTimeMinutes != null ? `${agent.avgResponseTimeMinutes} د` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{agent.leadsConverted}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{agent.ordersConverted}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
