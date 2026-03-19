import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getLeadsBySource } from '../services/marketing-api';

function formatCurrency(val: number) {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function MarketingDashboard() {
  const [dateRange, setDateRange] = useState('30');

  const getDateParams = () => {
    const to = new Date().toISOString();
    const from = new Date(Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  };

  const params = getDateParams();

  const { data: statsData } = useQuery({
    queryKey: ['mkt-dashboard', dateRange],
    queryFn: () => getDashboardStats(params),
  });

  const { data: sourcesData } = useQuery({
    queryKey: ['mkt-leads-source', dateRange],
    queryFn: () => getLeadsBySource(params),
  });

  const stats = statsData?.data;
  const content = stats?.content || {};
  const performance = stats?.performance || {};
  const topCreatives: any[] = stats?.topCreatives || [];
  const recentLeads: any[] = stats?.recentLeads || [];
  const bySource: any[] = sourcesData?.data?.bySource || [];
  const byUtmSource: any[] = sourcesData?.data?.byUtmSource || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">دولفين ماركتينج</h1>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="7">آخر 7 أيام</option>
          <option value="14">آخر 14 يوم</option>
          <option value="30">آخر 30 يوم</option>
          <option value="60">آخر 60 يوم</option>
          <option value="90">آخر 90 يوم</option>
        </select>
      </div>

      {/* Content Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="الكرييتيف" value={content.totalCreatives || 0} color="bg-blue-500" />
        <StatCard label="طلبات جديدة" value={content.pendingRequests || 0} color="bg-orange-500" />
        <StatCard label="أفكار جديدة" value={content.newIdeas || 0} color="bg-green-500" />
        <StatCard label="السكريبتات" value={content.totalScripts || 0} color="bg-indigo-500" />
        <StatCard label="صفحات الهبوط" value={content.totalLandingPages || 0} color="bg-purple-500" sub={`${content.publishedLPs || 0} منشور`} />
        <StatCard label="ليدز من التسويق" value={performance.leadsFromMarketing || 0} color="bg-teal-500" />
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">إجمالي الإنفاق</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(performance.totalAdSpend || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">إجمالي الليدز (إعلانات)</p>
          <p className="text-2xl font-bold text-blue-600">{(performance.totalAdLeads || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400">CPL: {formatCurrency(performance.overallCPL || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">الأوردرات من التسويق</p>
          <p className="text-2xl font-bold text-green-600">{(performance.ordersFromMarketing || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">ROAS</p>
          <p className="text-2xl font-bold text-purple-600">{(performance.overallROAS || 0).toFixed(1)}x</p>
          <p className="text-xs text-gray-400">Revenue: {formatCurrency(performance.totalAdRevenue || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Creatives by Leads */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">أعلى كرييتيف (بعدد الليدز)</h3>
          {topCreatives.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-2">
              {topCreatives.map((tc: any, i: number) => (
                <div key={tc.creativeCode} className="flex items-center justify-between py-1 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                    <span className="font-mono text-sm">{tc.creativeCode}</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{tc.leadCount} lead</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leads by Source */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">الليدز حسب المصدر</h3>
          {bySource.length === 0 && byUtmSource.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-3">
              {bySource.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">حسب المصدر</p>
                  {bySource.map((s: any) => (
                    <div key={s.source} className="flex justify-between text-sm py-1">
                      <span>{s.source}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {byUtmSource.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1 mt-2">حسب UTM Source</p>
                  {byUtmSource.map((s: any) => (
                    <div key={s.utmSource} className="flex justify-between text-sm py-1">
                      <span>{s.utmSource}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Marketing Leads */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold mb-3">آخر الليدز من التسويق</h3>
        {recentLeads.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">لا توجد ليدز من التسويق بعد</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="text-right py-2">الاسم</th>
                <th className="text-right py-2">الهاتف</th>
                <th className="text-right py-2">المصدر</th>
                <th className="text-right py-2">كود الكرييتيف</th>
                <th className="text-right py-2">UTM</th>
                <th className="text-right py-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead: any) => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2">{lead.name}</td>
                  <td className="py-2 font-mono text-xs" dir="ltr">{lead.phone}</td>
                  <td className="py-2">{lead.source}</td>
                  <td className="py-2 font-mono text-xs">{lead.creativeCode || '-'}</td>
                  <td className="py-2 text-xs">{lead.utmSource || '-'}</td>
                  <td className="py-2 text-xs text-gray-500">
                    {new Date(lead.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
