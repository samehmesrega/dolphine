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
  const brands = brandsRes?.data?.brands || [];

  const params: Record<string, string> = { from: dateRange.from, to: dateRange.to };
  if (brandFilter) params.brandId = brandFilter;

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ['inbox', 'stats', 'team', params],
    queryFn: () => inboxApi.getTeamStats(params),
  });
  const stats = statsRes?.data;

  const overviewCards = [
    { label: 'إجمالي المحادثات', value: stats?.overview?.totalConversations ?? 0, icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'primary' },
    { label: 'إجمالي الردود', value: (stats?.overview?.totalMessagesSent ?? 0) + (stats?.overview?.totalCommentReplies ?? 0), icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6', color: 'blue' },
    { label: 'متوسط وقت الاستجابة', value: stats?.overview?.avgResponseTime != null ? `${stats.overview.avgResponseTime} د` : '—', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'amber' },
    { label: 'تحويلات لطلبات', value: stats?.overview?.ordersCreated ?? 0, icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: 'green' },
  ];

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    primary: { bg: 'bg-ds-primary/5', text: 'text-ds-primary', icon: 'text-ds-primary' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto font-body">
      {/* Header + Filters */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-display font-bold text-ds-on-surface">إحصائيات الفريق</h1>
        <div className="flex items-center gap-3">
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="text-sm bg-ds-surface-card border border-ds-outline/15 rounded-xl px-3 py-1.5 text-ds-on-surface focus:outline-none focus:border-ds-primary/40 transition"
          >
            <option value="">كل البراندات</option>
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {/* Period switcher — tonal surface */}
          <div className="flex bg-ds-surface-low rounded-xl p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                  period === opt.value
                    ? 'bg-ds-surface-card shadow-sm text-ds-on-surface font-medium'
                    : 'text-ds-on-surface-v'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-ds-on-surface-v py-12">جاري التحميل...</div>
      ) : (
        <>
          {/* Overview Cards — floating surfaces, Manrope KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {overviewCards.map((card) => {
              const colors = colorClasses[card.color];
              return (
                <div key={card.label} className="bg-ds-surface-card rounded-3xl p-5 shadow-[0_1px_8px_rgba(25,28,29,0.04)]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-ds-on-surface-v">{card.label}</span>
                    <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center`}>
                      <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                      </svg>
                    </div>
                  </div>
                  <p className={`text-3xl font-display font-bold ${colors.text}`}>{card.value}</p>
                </div>
              );
            })}
          </div>

          {/* Team Table — surface card, no borders between rows */}
          <div className="bg-ds-surface-card rounded-3xl overflow-hidden shadow-[0_1px_8px_rgba(25,28,29,0.04)]">
            <div className="px-5 py-4">
              <h2 className="font-display font-semibold text-ds-on-surface">أداء الفريق</h2>
            </div>
            {!stats?.agents?.length ? (
              <div className="p-8 text-center text-ds-on-surface-v text-sm">لا توجد بيانات في الفترة المحددة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="bg-ds-surface-low text-ds-on-surface-v">
                      <th className="text-right px-5 py-3 font-medium">الموظف</th>
                      <th className="text-center px-4 py-3 font-medium">محادثات مُعالجة</th>
                      <th className="text-center px-4 py-3 font-medium">رسائل مبعوتة</th>
                      <th className="text-center px-4 py-3 font-medium">ردود تعليقات</th>
                      <th className="text-center px-4 py-3 font-medium">avg رد</th>
                      <th className="text-center px-4 py-3 font-medium">تحويل لليدز</th>
                      <th className="text-center px-4 py-3 font-medium">تحويل لطلبات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.agents.map((agent: any, i: number) => (
                      <tr key={agent.userId} className={`transition-colors hover:bg-ds-surface-low ${i > 0 ? '' : ''}`}>
                        <td className="px-5 py-3.5 font-medium text-ds-on-surface">{agent.userName}</td>
                        <td className="px-4 py-3.5 text-center text-ds-on-surface-v">{agent.conversationsHandled}</td>
                        <td className="px-4 py-3.5 text-center text-ds-on-surface-v">{agent.messagesSent}</td>
                        <td className="px-4 py-3.5 text-center text-ds-on-surface-v">{agent.commentReplies}</td>
                        <td className="px-4 py-3.5 text-center text-ds-on-surface-v">
                          {agent.avgResponseTimeMinutes != null ? `${agent.avgResponseTimeMinutes} د` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg text-xs font-medium">{agent.leadsConverted}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="bg-green-50 text-green-700 px-2.5 py-0.5 rounded-lg text-xs font-medium">{agent.ordersConverted}</span>
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
