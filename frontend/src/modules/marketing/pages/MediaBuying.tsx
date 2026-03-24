import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as mktApi from '../services/marketing-api';

function formatCurrency(val: number) {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function formatNumber(val: number) {
  return val.toLocaleString('en-US');
}

type DatePreset = 'today' | 'yesterday' | '7d' | '14d' | 'this_month' | 'last_month' | 'this_year' | 'custom';

function getDateRange(preset: DatePreset, custom: { from: string; to: string }) {
  const now = new Date();
  // Use YYYY-MM-DD format — no timezone offset issues with Meta API dates stored as midnight UTC
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };

  switch (preset) {
    case 'today':
      return { from: fmt(now), to: fmt(now) };
    case 'yesterday': {
      return { from: fmt(daysAgo(1)), to: fmt(daysAgo(1)) };
    }
    case '7d':
      return { from: fmt(daysAgo(7)), to: fmt(daysAgo(1)) };
    case '14d':
      return { from: fmt(daysAgo(14)), to: fmt(daysAgo(1)) };
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(s), to: fmt(now) };
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case 'this_year': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { from: fmt(s), to: fmt(now) };
    }
    case 'custom':
      return { from: custom.from || '', to: custom.to || '' };
    default:
      return { from: fmt(daysAgo(30)), to: fmt(now) };
  }
}

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'yesterday', label: 'أمس' },
  { key: '7d', label: 'آخر 7 أيام' },
  { key: '14d', label: 'آخر 14 يوم' },
  { key: 'this_month', label: 'الشهر الحالي' },
  { key: 'last_month', label: 'الشهر الماضي' },
  { key: 'this_year', label: 'العام الحالي' },
  { key: 'custom', label: 'مخصص' },
];

const platformLabels: Record<string, string> = {
  meta: 'Meta',
  google: 'Google Ads',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
};

const platformColors: Record<string, string> = {
  meta: 'bg-blue-500',
  google: 'bg-red-500',
  tiktok: 'bg-black',
  snapchat: 'bg-yellow-400',
};

export default function MediaBuying() {
  const qc = useQueryClient();
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const { from, to } = getDateRange(datePreset, customRange);

  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (filterPlatform) params.platform = filterPlatform;
  if (filterBrand) params.brandId = filterBrand;
  if (filterAccount) params.adAccountId = filterAccount;

  const filterKey = JSON.stringify(params);

  const { data: overviewData } = useQuery({
    queryKey: ['mb-overview', filterKey],
    queryFn: () => mktApi.getMediaBuyingOverview(params),
  });
  const { data: platformData } = useQuery({
    queryKey: ['mb-platform', filterKey],
    queryFn: () => mktApi.getMediaBuyingByPlatform(params),
  });
  const { data: brandData } = useQuery({
    queryKey: ['mb-brand', filterKey],
    queryFn: () => mktApi.getMediaBuyingByBrand(params),
  });
  const { data: campaignsData } = useQuery({
    queryKey: ['mb-campaigns', filterKey],
    queryFn: () => mktApi.getMediaBuyingCampaigns(params),
  });
  const { data: accountsData } = useQuery({
    queryKey: ['marketing', 'ad-accounts'],
    queryFn: () => mktApi.getAdAccounts(),
  });
  const { data: brandsData } = useQuery({
    queryKey: ['marketing', 'brands'],
    queryFn: () => mktApi.getBrands(),
  });

  const syncMutation = useMutation({
    mutationFn: () => mktApi.syncAccounts(filterAccount || undefined),
    onMutate: () => { setSyncing(true); setSyncResult(null); },
    onSuccess: (res) => {
      setSyncing(false);
      const results = res.data?.results || [];
      const ok = results.filter((r: any) => r.status === 'success').length;
      const fail = results.filter((r: any) => r.status === 'error').length;
      setSyncResult(`تمت المزامنة: ${ok} ناجح${fail > 0 ? `, ${fail} فشل` : ''}`);
      qc.invalidateQueries({ queryKey: ['mb-overview'] });
      qc.invalidateQueries({ queryKey: ['mb-platform'] });
      qc.invalidateQueries({ queryKey: ['mb-brand'] });
      qc.invalidateQueries({ queryKey: ['mb-campaigns'] });
    },
    onError: (err: any) => {
      setSyncing(false);
      setSyncResult(`فشل: ${err.response?.data?.error || err.message}`);
    },
  });

  const overview = overviewData?.data || {};
  const platforms: any[] = platformData?.data?.platforms || [];
  const brands: any[] = brandData?.data?.brands || [];
  const campaigns: any[] = campaignsData?.data?.campaigns || [];
  const accounts: any[] = accountsData?.data?.accounts || [];
  const brandsList: any[] = brandsData?.data?.brands || [];
  const totalPlatformSpend = platforms.reduce((sum, p) => sum + p.spend, 0);

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">ميديا باينج</h1>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs px-3 py-1 rounded-full ${syncResult.startsWith('فشل') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {syncResult}
            </span>
          )}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-60"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'جاري المزامنة...' : 'مزامنة'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Date Presets */}
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setDatePreset(p.key)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                datePreset === p.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-slate-500">من:</label>
            <input type="date" value={customRange.from} onChange={(e) => setCustomRange((p) => ({ ...p, from: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm" />
            <label className="text-xs text-slate-500">إلى:</label>
            <input type="date" value={customRange.to} onChange={(e) => setCustomRange((p) => ({ ...p, to: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>
        )}

        {/* Dropdowns */}
        <div className="flex flex-wrap gap-2">
          <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-slate-700 min-w-[130px]">
            <option value="">كل المنصات</option>
            {['meta', 'google', 'tiktok', 'snapchat'].map((p) => (
              <option key={p} value={p}>{platformLabels[p]}</option>
            ))}
          </select>

          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-slate-700 min-w-[130px]">
            <option value="">كل البراندات</option>
            {brandsList.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-slate-700 min-w-[160px]">
            <option value="">كل الحسابات</option>
            {accounts.map((a: any) => (
              <option key={a.id} value={a.id}>{a.accountName}</option>
            ))}
          </select>

          {(filterPlatform || filterBrand || filterAccount) && (
            <button
              onClick={() => { setFilterPlatform(''); setFilterBrand(''); setFilterAccount(''); }}
              className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              مسح الفلاتر ✕
            </button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">إجمالي الإنفاق</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(overview.totalSpend || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">إجمالي الليدز</p>
          <p className="text-2xl font-bold text-blue-600">{formatNumber(overview.totalLeads || 0)}</p>
          <p className="text-xs text-slate-400">CPL: {formatCurrency(overview.overallCPL || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">إجمالي الطلبات</p>
          <p className="text-2xl font-bold text-green-600">{formatNumber(overview.totalOrders || 0)}</p>
          <p className="text-xs text-slate-400">CPA: {formatCurrency(overview.overallCPA || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">ROAS</p>
          <p className="text-2xl font-bold text-purple-600">{(overview.overallROAS || 0).toFixed(1)}x</p>
          <p className="text-xs text-slate-400">الإيرادات: {formatCurrency(overview.totalRevenue || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Platform */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-4">الإنفاق حسب المنصة</h3>
          {platforms.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا يوجد بيانات.</p>
          ) : (
            <div className="space-y-3">
              {platforms.map((p) => {
                const pct = totalPlatformSpend > 0 ? (p.spend / totalPlatformSpend) * 100 : 0;
                return (
                  <div key={p.platform}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{platformLabels[p.platform] || p.platform}</span>
                      <span>{formatCurrency(p.spend)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${platformColors[p.platform] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500 mt-1">
                      <span>ليدز: {formatNumber(p.leads)}</span>
                      <span>طلبات: {formatNumber(p.orders)}</span>
                      <span>ROAS: {p.roas.toFixed(1)}x</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* By Brand */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-4">حسب البراند</h3>
          {brands.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا يوجد بيانات.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-right py-2">البراند</th>
                  <th className="text-right py-2">الإنفاق</th>
                  <th className="text-right py-2">ليدز</th>
                  <th className="text-right py-2">طلبات</th>
                  <th className="text-right py-2">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.brandId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{b.brandName}</td>
                    <td className="py-2">{formatCurrency(b.spend)}</td>
                    <td className="py-2">{formatNumber(b.leads)}</td>
                    <td className="py-2">{formatNumber(b.orders)}</td>
                    <td className="py-2">
                      <span className={`font-semibold ${b.roas >= 3 ? 'text-green-600' : b.roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {b.roas.toFixed(1)}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Campaigns */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-700 mb-4">الحملات</h3>
        {campaigns.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">لا يوجد حملات. اربط حساب إعلاني واعمل مزامنة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-right py-2">الحملة</th>
                  <th className="text-right py-2">المنصة</th>
                  <th className="text-right py-2">الحالة</th>
                  <th className="text-right py-2">الإنفاق</th>
                  <th className="text-right py-2">ليدز</th>
                  <th className="text-right py-2">طلبات</th>
                  <th className="text-right py-2">ROAS</th>
                  <th className="text-right py-2">CPL</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2">
                      <div className="font-medium">{c.name}</div>
                      {c.brand && <div className="text-xs text-slate-400">{c.brand}</div>}
                    </td>
                    <td className="py-2">{platformLabels[c.platform] || c.platform}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        c.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>{c.status}</span>
                    </td>
                    <td className="py-2">{formatCurrency(c.spend)}</td>
                    <td className="py-2">{formatNumber(c.leads)}</td>
                    <td className="py-2">{formatNumber(c.orders)}</td>
                    <td className="py-2">
                      <span className={`font-semibold ${c.roas >= 3 ? 'text-green-600' : c.roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {c.roas.toFixed(1)}x
                      </span>
                    </td>
                    <td className="py-2">{formatCurrency(c.cpl)}</td>
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
