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
  // Use YYYY-MM-DD in LOCAL timezone (not UTC) to avoid off-by-one day errors
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

type ReportTab = 'overview' | 'campaigns' | 'adsets' | 'ads';

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'campaigns', label: 'تقارير الحملات' },
  { key: 'adsets', label: 'تقارير الأد سيت' },
  { key: 'ads', label: 'تقارير الإعلانات' },
];

export default function MediaBuying() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterActivity, setFilterActivity] = useState<'' | 'active' | 'zero'>('active');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [sortKey, setSortKey] = useState<string>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    spend: true,
    leads: true,
    cpl: true,
    confirmedOrders: true,
    cpp: true,
    roas: true,
    cpm: false,
    outboundCtr: false,
    frequency: false,
    clicks: false,
    impressions: false,
    reach: false,
    outboundClicks: false,
    revenue: false,
    status: false,
  });

  const COLUMN_LABELS: Record<string, string> = {
    spend: 'الإنفاق',
    cpm: 'CPM',
    outboundCtr: 'Outbound CTR',
    frequency: 'التكرار',
    leads: 'ليدز',
    cpl: 'CPL (تكلفة الليد)',
    confirmedOrders: 'طلبات مؤكدة',
    cpp: 'CPP (تكلفة الطلب المؤكد)',
    clicks: 'النقرات',
    impressions: 'الظهور',
    reach: 'الوصول',
    outboundClicks: 'نقرات خارجية',
    roas: 'ROAS',
    revenue: 'الإيرادات',
    status: 'الحالة',
  };

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
    queryFn: () => mktApi.getMediaBuyingCampaigns({ ...params, pageSize: '500' }),
    enabled: activeTab === 'overview' || activeTab === 'campaigns',
  });
  const { data: adSetsData } = useQuery({
    queryKey: ['mb-adsets', filterKey],
    queryFn: () => mktApi.getMediaBuyingAdSets(params),
    enabled: activeTab === 'adsets',
  });
  const { data: adsData } = useQuery({
    queryKey: ['mb-ads', filterKey],
    queryFn: () => mktApi.getMediaBuyingAds(params),
    enabled: activeTab === 'ads',
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
  const adSets: any[] = adSetsData?.data?.adSets || [];
  const ads: any[] = adsData?.data?.ads || [];
  const accounts: any[] = accountsData?.data?.accounts || [];
  const brandsList: any[] = brandsData?.data?.brands || [];
  const totalPlatformSpend = platforms.reduce((sum, p) => sum + p.spend, 0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key: string) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  // Totals helper
  const calcTotals = (items: any[]) => {
    const t = items.reduce((acc, c) => ({
      spend: acc.spend + (c.spend || 0),
      impressions: acc.impressions + (c.impressions || 0),
      reach: acc.reach + (c.reach || 0),
      clicks: acc.clicks + (c.clicks || 0),
      outboundClicks: acc.outboundClicks + (c.outboundClicks || 0),
      leads: acc.leads + (c.leads || 0),
      confirmedOrders: acc.confirmedOrders + (c.confirmedOrders || 0),
      revenue: acc.revenue + (c.revenue || 0),
    }), { spend: 0, impressions: 0, reach: 0, clicks: 0, outboundClicks: 0, leads: 0, confirmedOrders: 0, revenue: 0 });
    return {
      ...t,
      cpm: t.impressions > 0 ? +((t.spend / t.impressions) * 1000).toFixed(2) : 0,
      outboundCtr: t.impressions > 0 ? +((t.outboundClicks / t.impressions) * 100).toFixed(2) : 0,
      frequency: t.reach > 0 ? +(t.impressions / t.reach).toFixed(2) : 0,
      cpl: t.leads > 0 ? +(t.spend / t.leads).toFixed(2) : 0,
      cpp: t.confirmedOrders > 0 ? +(t.spend / t.confirmedOrders).toFixed(2) : 0,
      roas: t.spend > 0 ? +(t.revenue / t.spend).toFixed(2) : 0,
    };
  };

  const filteredCampaigns = campaigns
    .filter((c) => !filterStatus || c.status === filterStatus)
    .filter((c) => {
      if (!filterActivity) return true;
      const hasActivity = c.spend > 0 || c.impressions > 0 || (c.reach || 0) > 0;
      return filterActivity === 'active' ? hasActivity : !hasActivity;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
    });

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">تقارير الحملات</h1>
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

          <select value={`${filterStatus}|${filterActivity}`} onChange={(e) => {
            const [s, a] = e.target.value.split('|');
            setFilterStatus(s);
            setFilterActivity(a as '' | 'active' | 'zero');
          }}
            className="border rounded-lg px-3 py-1.5 text-sm text-slate-700 min-w-[180px]">
            <option value="|active">نشطة فعلاً (فيها صرف أو ظهور)</option>
            <option value="|">الكل</option>
            <option value="ACTIVE|">نشطة (ACTIVE)</option>
            <option value="PAUSED|">متوقفة (PAUSED)</option>
            <option value="|zero">بدون نشاط</option>
          </select>

          {(filterPlatform || filterBrand || filterAccount || filterStatus || filterActivity) && (
            <button
              onClick={() => { setFilterPlatform(''); setFilterBrand(''); setFilterAccount(''); setFilterStatus(''); setFilterActivity(''); }}
              className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              مسح الفلاتر ✕
            </button>
          )}
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && <>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">إجمالي الإنفاق</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(overview.totalSpend || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">ليدز</p>
          <p className="text-2xl font-bold text-blue-600">{formatNumber(overview.totalLeads || 0)}</p>
          <p className="text-xs text-slate-400">CPL: {formatCurrency(overview.overallCPL || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">طلبات مؤكدة</p>
          <p className="text-2xl font-bold text-green-600">{formatNumber(overview.totalConfirmedOrders || 0)}</p>
          <p className="text-xs text-slate-400">CPP: {formatCurrency(overview.overallCPP || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">ROAS</p>
          <p className="text-2xl font-bold text-purple-600">{(overview.overallROAS || 0).toFixed(1)}x</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">AOVL</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(overview.aovl || 0)}</p>
          <p className="text-xs text-slate-400">متوسط قيمة طلب الليد</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">AOVP</p>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(overview.aovp || 0)}</p>
          <p className="text-xs text-slate-400">متوسط قيمة الطلب المؤكد</p>
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

      </>}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700">الحملات</h3>
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg text-slate-600 hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              تخصيص الأعمدة
            </button>
            {showColumnPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-3 z-10 min-w-[200px]">
                {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-slate-50 px-1 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns[key] ?? false}
                      onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">لا يوجد حملات. اربط حساب إعلاني واعمل مزامنة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-right py-2 whitespace-nowrap">الحملة</th>
                  {visibleColumns.status && <th className="text-right py-2">الحالة</th>}
                  {visibleColumns.spend && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('spend')}>الإنفاق{sortArrow('spend')}</th>}
                  {visibleColumns.cpm && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('cpm')}>CPM{sortArrow('cpm')}</th>}
                  {visibleColumns.outboundCtr && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('outboundCtr')}>Outbound CTR{sortArrow('outboundCtr')}</th>}
                  {visibleColumns.frequency && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('frequency')}>التكرار{sortArrow('frequency')}</th>}
                  {visibleColumns.leads && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('leads')}>ليدز{sortArrow('leads')}</th>}
                  {visibleColumns.cpl && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('cpl')}>CPL{sortArrow('cpl')}</th>}
                  {visibleColumns.confirmedOrders && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('confirmedOrders')}>طلبات مؤكدة{sortArrow('confirmedOrders')}</th>}
                  {visibleColumns.cpp && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('cpp')}>CPP{sortArrow('cpp')}</th>}
                  {visibleColumns.impressions && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('impressions')}>الظهور{sortArrow('impressions')}</th>}
                  {visibleColumns.reach && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('reach')}>الوصول{sortArrow('reach')}</th>}
                  {visibleColumns.clicks && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('clicks')}>النقرات{sortArrow('clicks')}</th>}
                  {visibleColumns.outboundClicks && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('outboundClicks')}>نقرات خارجية{sortArrow('outboundClicks')}</th>}
                  {visibleColumns.roas && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('roas')}>ROAS{sortArrow('roas')}</th>}
                  {visibleColumns.revenue && <th className="text-right py-2 cursor-pointer hover:text-slate-700" onClick={() => handleSort('revenue')}>الإيرادات{sortArrow('revenue')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2">
                      <div className="font-medium">{c.name}</div>
                      {c.brand && <div className="text-xs text-slate-400">{c.brand}</div>}
                    </td>
                    {visibleColumns.status && (
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          c.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>{c.status === 'ACTIVE' ? 'نشطة' : c.status === 'PAUSED' ? 'متوقفة' : c.status}</span>
                      </td>
                    )}
                    {visibleColumns.spend && <td className="py-2">{formatCurrency(c.spend)}</td>}
                    {visibleColumns.cpm && <td className="py-2">{formatCurrency(c.cpm || 0)}</td>}
                    {visibleColumns.outboundCtr && <td className="py-2">{(c.outboundCtr || 0).toFixed(2)}%</td>}
                    {visibleColumns.frequency && <td className="py-2">{(c.frequency || 0).toFixed(2)}</td>}
                    {visibleColumns.leads && <td className="py-2">{formatNumber(c.leads)}</td>}
                    {visibleColumns.cpl && <td className="py-2">{formatCurrency(c.cpl || 0)}</td>}
                    {visibleColumns.confirmedOrders && <td className="py-2">{formatNumber(c.confirmedOrders || 0)}</td>}
                    {visibleColumns.cpp && <td className="py-2">{formatCurrency(c.cpp || 0)}</td>}
                    {visibleColumns.impressions && <td className="py-2">{formatNumber(c.impressions)}</td>}
                    {visibleColumns.reach && <td className="py-2">{formatNumber(c.reach || 0)}</td>}
                    {visibleColumns.clicks && <td className="py-2">{formatNumber(c.clicks)}</td>}
                    {visibleColumns.outboundClicks && <td className="py-2">{formatNumber(c.outboundClicks || 0)}</td>}
                    {visibleColumns.roas && (
                      <td className="py-2">
                        <span className={`font-semibold ${c.roas >= 3 ? 'text-green-600' : c.roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {(c.roas || 0).toFixed(1)}x
                        </span>
                      </td>
                    )}
                    {visibleColumns.revenue && <td className="py-2">{formatCurrency(c.revenue || 0)}</td>}
                  </tr>
                ))}
              </tbody>
              {(() => { const t = calcTotals(filteredCampaigns); return (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-700">
                  <td className="py-2">الإجمالي ({filteredCampaigns.length})</td>
                  {visibleColumns.status && <td className="py-2"></td>}
                  {visibleColumns.spend && <td className="py-2">{formatCurrency(t.spend)}</td>}
                  {visibleColumns.cpm && <td className="py-2">{formatCurrency(t.cpm)}</td>}
                  {visibleColumns.outboundCtr && <td className="py-2">{t.outboundCtr.toFixed(2)}%</td>}
                  {visibleColumns.frequency && <td className="py-2">{t.frequency.toFixed(2)}</td>}
                  {visibleColumns.leads && <td className="py-2">{formatNumber(t.leads)}</td>}
                  {visibleColumns.cpl && <td className="py-2">{formatCurrency(t.cpl)}</td>}
                  {visibleColumns.confirmedOrders && <td className="py-2">{formatNumber(t.confirmedOrders)}</td>}
                  {visibleColumns.cpp && <td className="py-2">{formatCurrency(t.cpp)}</td>}
                  {visibleColumns.impressions && <td className="py-2">{formatNumber(t.impressions)}</td>}
                  {visibleColumns.reach && <td className="py-2">{formatNumber(t.reach)}</td>}
                  {visibleColumns.clicks && <td className="py-2">{formatNumber(t.clicks)}</td>}
                  {visibleColumns.outboundClicks && <td className="py-2">{formatNumber(t.outboundClicks)}</td>}
                  {visibleColumns.roas && <td className="py-2">{t.roas.toFixed(1)}x</td>}
                  {visibleColumns.revenue && <td className="py-2">{formatCurrency(t.revenue)}</td>}
                </tr>
              </tfoot>
              ); })()}
            </table>
          </div>
        )}
      </div>}

      {/* Ad Sets Tab */}
      {activeTab === 'adsets' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-4">تقارير الأد سيت</h3>
          {adSets.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا يوجد بيانات. اعمل مزامنة أولاً.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-right py-2">الأد سيت</th>
                    <th className="text-right py-2">الحملة</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('spend')}>الإنفاق{sortArrow('spend')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('cpm')}>CPM{sortArrow('cpm')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('outboundCtr')}>Outbound CTR{sortArrow('outboundCtr')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('frequency')}>التكرار{sortArrow('frequency')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('leads')}>ليدز{sortArrow('leads')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('cpl')}>CPL{sortArrow('cpl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {adSets
                    .filter((a) => !filterStatus || a.status === filterStatus)
                    .filter((a) => !filterActivity || (filterActivity === 'active' ? a.spend > 0 || a.impressions > 0 : a.spend === 0 && a.impressions === 0))
                    .sort((a, b) => { const av = a[sortKey] ?? 0; const bv = b[sortKey] ?? 0; return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1); })
                    .map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2 font-medium">{a.name}</td>
                      <td className="py-2 text-xs text-slate-400">{a.campaignName}</td>
                      <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status === 'ACTIVE' ? 'نشط' : 'متوقف'}</span></td>
                      <td className="py-2">{formatCurrency(a.spend)}</td>
                      <td className="py-2">{formatCurrency(a.cpm || 0)}</td>
                      <td className="py-2">{(a.outboundCtr || 0).toFixed(2)}%</td>
                      <td className="py-2">{(a.frequency || 0).toFixed(2)}</td>
                      <td className="py-2">{formatNumber(a.leads)}</td>
                      <td className="py-2">{formatCurrency(a.cpl || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                {(() => { const filtered = adSets.filter((a) => !filterStatus || a.status === filterStatus).filter((a) => !filterActivity || (filterActivity === 'active' ? a.spend > 0 || a.impressions > 0 : a.spend === 0 && a.impressions === 0)); const t = calcTotals(filtered); return (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-700">
                    <td className="py-2">الإجمالي ({filtered.length})</td>
                    <td className="py-2"></td>
                    <td className="py-2"></td>
                    <td className="py-2">{formatCurrency(t.spend)}</td>
                    <td className="py-2">{formatCurrency(t.cpm)}</td>
                    <td className="py-2">{t.outboundCtr.toFixed(2)}%</td>
                    <td className="py-2">{t.frequency.toFixed(2)}</td>
                    <td className="py-2">{formatNumber(t.leads)}</td>
                    <td className="py-2">{formatCurrency(t.cpl)}</td>
                  </tr>
                </tfoot>
                ); })()}
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ads Tab */}
      {activeTab === 'ads' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-4">تقارير الإعلانات</h3>
          {ads.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا يوجد بيانات. اعمل مزامنة أولاً.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-right py-2">الإعلان</th>
                    <th className="text-right py-2">الأد سيت</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('spend')}>الإنفاق{sortArrow('spend')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('cpm')}>CPM{sortArrow('cpm')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('outboundCtr')}>Outbound CTR{sortArrow('outboundCtr')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('frequency')}>التكرار{sortArrow('frequency')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('leads')}>ليدز{sortArrow('leads')}</th>
                    <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('cpl')}>CPL{sortArrow('cpl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ads
                    .filter((a) => !filterStatus || a.status === filterStatus)
                    .filter((a) => !filterActivity || (filterActivity === 'active' ? a.spend > 0 || a.impressions > 0 : a.spend === 0 && a.impressions === 0))
                    .sort((a, b) => { const av = a[sortKey] ?? 0; const bv = b[sortKey] ?? 0; return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1); })
                    .map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2 font-medium">{a.name}</td>
                      <td className="py-2 text-xs text-slate-400">{a.adSetName}</td>
                      <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status === 'ACTIVE' ? 'نشط' : 'متوقف'}</span></td>
                      <td className="py-2">{formatCurrency(a.spend)}</td>
                      <td className="py-2">{formatCurrency(a.cpm || 0)}</td>
                      <td className="py-2">{(a.outboundCtr || 0).toFixed(2)}%</td>
                      <td className="py-2">{(a.frequency || 0).toFixed(2)}</td>
                      <td className="py-2">{formatNumber(a.leads)}</td>
                      <td className="py-2">{formatCurrency(a.cpl || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                {(() => { const filtered = ads.filter((a) => !filterStatus || a.status === filterStatus).filter((a) => !filterActivity || (filterActivity === 'active' ? a.spend > 0 || a.impressions > 0 : a.spend === 0 && a.impressions === 0)); const t = calcTotals(filtered); return (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-700">
                    <td className="py-2">الإجمالي ({filtered.length})</td>
                    <td className="py-2"></td>
                    <td className="py-2"></td>
                    <td className="py-2">{formatCurrency(t.spend)}</td>
                    <td className="py-2">{formatCurrency(t.cpm)}</td>
                    <td className="py-2">{t.outboundCtr.toFixed(2)}%</td>
                    <td className="py-2">{t.frequency.toFixed(2)}</td>
                    <td className="py-2">{formatNumber(t.leads)}</td>
                    <td className="py-2">{formatCurrency(t.cpl)}</td>
                  </tr>
                </tfoot>
                ); })()}
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
