import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as mktApi from '../services/marketing-api';
import api from '../../../shared/services/api';

const BREAKDOWN_ICONS: Record<string, string> = { sales: '👤', shift: '🕐', status: '📊' };

function BreakdownRows({ parentId, level, by, params, colCount }: {
  parentId: string; level: string; by: string;
  params: { from?: string; to?: string };
  colCount: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['mb-breakdown', parentId, level, by, params.from, params.to],
    queryFn: async () => {
      const { data } = await api.get('/v1/marketing/media-buying/breakdown', {
        params: { parentId, level, by, from: params.from, to: params.to },
      });
      return data.breakdown as { id: string; name: string; leadCount: number; confirmedCount: number; orderCount: number }[];
    },
  });

  if (isLoading) return (
    <tr><td colSpan={colCount} className="py-1 text-center text-xs text-slate-400">جاري التحميل...</td></tr>
  );
  if (!data?.length) return null;

  const indent = level === 'campaign' ? '2rem' : level === 'adset' ? '3.5rem' : '5rem';
  return (
    <>
      {data.map((row) => (
        <tr key={`${parentId}-${row.id}`} className="border-b bg-amber-50/40">
          <td className="py-1.5" style={{ paddingRight: indent }}>
            <div className="flex items-center gap-1.5 text-xs">
              <span>{BREAKDOWN_ICONS[by]}</span>
              <span className="font-medium text-slate-700">{row.name}</span>
              <span className="text-slate-400">— {row.leadCount} ليد</span>
              {row.confirmedCount > 0 && <span className="text-green-600">({row.confirmedCount} مؤكد)</span>}
            </div>
          </td>
          <td colSpan={colCount - 1}></td>
        </tr>
      ))}
    </>
  );
}

function formatCurrency(val: number) {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

type ReportTab = 'overview' | 'reports';

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'reports', label: 'تقارير' },
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
  const [breakdownBy, setBreakdownBy] = useState<'' | 'sales' | 'shift' | 'status'>('');
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('mb_columns');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      spend: true, leads: true, cpl: true, confirmedOrders: true, cpp: true, roas: true,
      cpm: false, outboundCtr: false, frequency: false, clicks: false,
      impressions: false, reach: false, outboundClicks: false, revenue: false, status: false,
    };
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

  const { data: overviewData, isError: overviewError } = useQuery({
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
    enabled: activeTab === 'overview' || activeTab === 'reports',
  });
  const { data: adSetsData } = useQuery({
    queryKey: ['mb-adsets', filterKey],
    queryFn: () => mktApi.getMediaBuyingAdSets(params),
    enabled: activeTab === 'reports',
  });
  const { data: adsData } = useQuery({
    queryKey: ['mb-ads', filterKey],
    queryFn: () => mktApi.getMediaBuyingAds(params),
    enabled: activeTab === 'reports',
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

  // === Tree View State ===
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [searchLevel, setSearchLevel] = useState<'campaign' | 'adset' | 'ad'>('campaign');

  const passesActivityFilter = (item: any) => {
    if (filterStatus && item.status !== filterStatus) return false;
    if (filterActivity) {
      const hasActivity = item.spend > 0 || item.impressions > 0 || (item.reach || 0) > 0;
      if (filterActivity === 'active' && !hasActivity) return false;
      if (filterActivity === 'zero' && hasActivity) return false;
    }
    return true;
  };

  const sorter = (a: any, b: any) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
  };

  // Build hierarchical tree from flat arrays
  const treeData = useMemo(() => {
    const adSetsByCampaign = new Map<string, any[]>();
    for (const as of adSets) {
      const list = adSetsByCampaign.get(as.campaignId) || [];
      list.push(as);
      adSetsByCampaign.set(as.campaignId, list);
    }
    const adsByAdSet = new Map<string, any[]>();
    for (const ad of ads) {
      const list = adsByAdSet.get(ad.adSetId) || [];
      list.push(ad);
      adsByAdSet.set(ad.adSetId, list);
    }
    return campaigns.map((c: any) => ({
      ...c,
      _adSets: (adSetsByCampaign.get(c.id) || []).map((as: any) => ({
        ...as,
        _ads: adsByAdSet.get(as.id) || [],
      })),
    }));
  }, [campaigns, adSets, ads]);

  // Apply search filter + auto-expand
  const { filteredTree, autoExpandCampaigns, autoExpandAdSets } = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const noExpand = { filteredTree: treeData, autoExpandCampaigns: new Set<string>(), autoExpandAdSets: new Set<string>() };
    if (!q) return noExpand;

    const aec = new Set<string>();
    const aeas = new Set<string>();

    if (searchLevel === 'campaign') {
      return { filteredTree: treeData.filter((c: any) => c.name.toLowerCase().includes(q) || c.id.includes(q)), autoExpandCampaigns: aec, autoExpandAdSets: aeas };
    }
    if (searchLevel === 'adset') {
      const filtered = treeData.map((c: any) => {
        const matching = c._adSets.filter((as: any) => as.name.toLowerCase().includes(q) || as.id.includes(q));
        if (matching.length === 0) return null;
        aec.add(c.id);
        return { ...c, _adSets: matching };
      }).filter(Boolean);
      return { filteredTree: filtered, autoExpandCampaigns: aec, autoExpandAdSets: aeas };
    }
    // ad level
    const filtered = treeData.map((c: any) => {
      const matchingAS = c._adSets.map((as: any) => {
        const matchingAds = as._ads.filter((ad: any) => ad.name.toLowerCase().includes(q) || ad.id.includes(q));
        if (matchingAds.length === 0) return null;
        aeas.add(as.id);
        aec.add(c.id);
        return { ...as, _ads: matchingAds };
      }).filter(Boolean);
      if (matchingAS.length === 0) return null;
      return { ...c, _adSets: matchingAS };
    }).filter(Boolean);
    return { filteredTree: filtered, autoExpandCampaigns: aec, autoExpandAdSets: aeas };
  }, [treeData, searchText, searchLevel]);

  // Apply status/activity filter + sort
  const sortedTree = useMemo(() => {
    return filteredTree
      .filter(passesActivityFilter)
      .map((c: any) => ({
        ...c,
        _adSets: c._adSets
          .filter(passesActivityFilter)
          .map((as: any) => ({ ...as, _ads: [...as._ads].filter(passesActivityFilter).sort(sorter) }))
          .sort(sorter),
      }))
      .sort(sorter);
  }, [filteredTree, filterStatus, filterActivity, sortKey, sortDir]);

  const isCampaignExpanded = (id: string) => expandedCampaigns.has(id) || autoExpandCampaigns.has(id);
  const isAdSetExpanded = (id: string) => expandedAdSets.has(id) || autoExpandAdSets.has(id);

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAdSet = (id: string) => {
    setExpandedAdSets((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const expandAll = () => {
    setExpandedCampaigns(new Set(sortedTree.map((c: any) => c.id)));
    setExpandedAdSets(new Set(sortedTree.flatMap((c: any) => c._adSets.map((as: any) => as.id))));
  };
  const collapseAll = () => { setExpandedCampaigns(new Set()); setExpandedAdSets(new Set()); };

  // Metric cells renderer for any level
  const renderMetricCells = (item: any, level: 'campaign' | 'adset' | 'ad') => (
    <>
      {visibleColumns.status && (
        <td className="py-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : item.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'}`}>
            {item.status === 'ACTIVE' ? 'نشط' : item.status === 'PAUSED' ? 'متوقف' : item.status}
          </span>
        </td>
      )}
      {visibleColumns.spend && <td className="py-2">{formatCurrency(item.spend || 0)}</td>}
      {visibleColumns.cpm && <td className="py-2">{formatCurrency(item.cpm || 0)}</td>}
      {visibleColumns.outboundCtr && <td className="py-2">{(item.outboundCtr || 0).toFixed(2)}%</td>}
      {visibleColumns.frequency && <td className="py-2">{(item.frequency || 0).toFixed(2)}</td>}
      {visibleColumns.leads && <td className="py-2">{formatNumber(item.leads || 0)}</td>}
      {visibleColumns.cpl && <td className="py-2">{formatCurrency(item.cpl || 0)}</td>}
      {visibleColumns.confirmedOrders && <td className="py-2">{level === 'ad' ? '—' : formatNumber(item.confirmedOrders || 0)}</td>}
      {visibleColumns.cpp && <td className="py-2">{level === 'ad' ? '—' : formatCurrency(item.cpp || 0)}</td>}
      {visibleColumns.impressions && <td className="py-2">{formatNumber(item.impressions || 0)}</td>}
      {visibleColumns.reach && <td className="py-2">{formatNumber(item.reach || 0)}</td>}
      {visibleColumns.clicks && <td className="py-2">{formatNumber(item.clicks || 0)}</td>}
      {visibleColumns.outboundClicks && <td className="py-2">{formatNumber(item.outboundClicks || 0)}</td>}
      {visibleColumns.roas && (
        <td className="py-2">
          <span className={`font-semibold ${(item.roas || 0) >= 3 ? 'text-green-600' : (item.roas || 0) >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
            {(item.roas || 0).toFixed(1)}x
          </span>
        </td>
      )}
      {visibleColumns.revenue && <td className="py-2">{formatCurrency(item.revenue || 0)}</td>}
    </>
  );

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
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
          <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-slate-700">
            <option value="">كل المنصات</option>
            {['meta', 'google', 'tiktok', 'snapchat'].map((p) => (
              <option key={p} value={p}>{platformLabels[p]}</option>
            ))}
          </select>

          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-slate-700">
            <option value="">كل البراندات</option>
            {brandsList.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-slate-700">
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
            className="border rounded-lg px-2 py-1.5 text-sm text-slate-700 col-span-2 md:col-span-1">
            <option value="|active">نشطة فعلاً (فيها صرف أو ظهور)</option>
            <option value="|">الكل</option>
            <option value="ACTIVE|">نشطة (ACTIVE)</option>
            <option value="PAUSED|">متوقفة (PAUSED)</option>
            <option value="|zero">بدون نشاط</option>
          </select>

          <select
            value={breakdownBy}
            onChange={(e) => { setBreakdownBy(e.target.value as any); setExpandedBreakdowns(new Set()); }}
            className="border rounded-lg px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="">بدون تقسيم</option>
            <option value="sales">تقسيم بالسيلز</option>
            <option value="shift">تقسيم بالشيفت</option>
            <option value="status">تقسيم بحالة الليد</option>
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

      {overviewError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-4">
          تعذر تحميل البيانات من Meta — تأكد من اتصال حسابات الإعلانات.
        </div>
      )}

      {/* Overview Metrics */}
      <div className="space-y-4">
        {/* Row 1: Spend + Leads + CPL */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">الإنفاق</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(overview.totalSpend || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">الليدز</p>
            <p className="text-2xl font-bold text-blue-600">{formatNumber(overview.dolphinLeads || 0)}</p>
            <p className="text-xs text-slate-400">ميتا: {formatNumber(overview.metaLeads || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">تكلفة الليد (CPL)</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(overview.cpl || 0)}</p>
          </div>
        </div>

        {/* Row 2: Confirmed Orders */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">الطلبات المؤكدة</p>
            <p className="text-2xl font-bold text-green-600">{formatNumber(overview.totalConfirmedOrders || 0)}</p>
            <p className="text-xs text-slate-400">{(overview.confirmedRate || 0).toFixed(0)}% من الليدز</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">تكلفة المؤكد</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(overview.confirmedCost || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">م. القيمة (متوقع)</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(overview.estAov || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">ROAS متوقع</p>
            <p className="text-2xl font-bold text-purple-600">{(overview.estRoas || 0).toFixed(2)}x</p>
          </div>
        </div>

        {/* Row 3: Delivered (placeholder) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50">
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4 relative">
            <span className="absolute top-2 left-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">قريباً</span>
            <p className="text-sm text-slate-500">الطلبات المُوصّلة</p>
            <p className="text-2xl font-bold text-slate-400">—</p>
          </div>
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-sm text-slate-500">تكلفة التوصيلة</p>
            <p className="text-2xl font-bold text-slate-400">—</p>
          </div>
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-sm text-slate-500">م. القيمة (فعلي)</p>
            <p className="text-2xl font-bold text-slate-400">—</p>
          </div>
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-sm text-slate-500">ROAS فعلي</p>
            <p className="text-2xl font-bold text-slate-400">—</p>
          </div>
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

      {/* Reports Tab — Hierarchical Tree View */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          {/* Toolbar: Search + Column Picker */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <input
                  type="text"
                  placeholder="بحث بالاسم أو ID..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-64"
                />
                {searchText && (
                  <button onClick={() => setSearchText('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                    ✕
                  </button>
                )}
              </div>
              <select
                value={searchLevel}
                onChange={(e) => setSearchLevel(e.target.value as 'campaign' | 'adset' | 'ad')}
                className="border rounded-lg px-2 py-2 text-sm text-slate-700"
              >
                <option value="campaign">بحث في: الحملات</option>
                <option value="adset">بحث في: الأد سيت</option>
                <option value="ad">بحث في: الإعلانات</option>
              </select>
              <button onClick={expandAll} className="px-3 py-2 text-xs border rounded-lg text-slate-600 hover:bg-slate-50">توسيع الكل</button>
              <button onClick={collapseAll} className="px-3 py-2 text-xs border rounded-lg text-slate-600 hover:bg-slate-50">طي الكل</button>
            </div>
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
                        onChange={(e) => setVisibleColumns((prev) => {
                          const next = { ...prev, [key]: e.target.checked };
                          try { localStorage.setItem('mb_columns', JSON.stringify(next)); } catch { /* */ }
                          return next;
                        })}
                        className="rounded"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sortedTree.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">
              {campaigns.length === 0 ? 'لا يوجد حملات. اربط حساب إعلاني واعمل مزامنة.' : 'لا توجد نتائج مطابقة.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-right py-2 whitespace-nowrap min-w-[250px]">الاسم</th>
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
                  {sortedTree.map((c: any) => (
                    <Fragment key={c.id}>
                      {/* Campaign Row */}
                      <tr className="border-b hover:bg-slate-50 bg-white">
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleCampaign(c.id)} className="p-0.5 hover:bg-slate-100 rounded flex-shrink-0">
                              <svg className={`w-4 h-4 text-slate-400 transition-transform ${isCampaignExpanded(c.id) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <div>
                              <div className="font-semibold text-slate-800">{c.name}</div>
                              {c.brand && <div className="text-xs text-slate-400">{c.brand}</div>}
                            </div>
                          </div>
                        </td>
                        {renderMetricCells(c, 'campaign')}
                      </tr>

                      {/* Breakdown rows for campaign */}
                      {breakdownBy && isCampaignExpanded(c.id) && (
                        <BreakdownRows parentId={c.id} level="campaign" by={breakdownBy} params={params} colCount={Object.values(visibleColumns).filter(Boolean).length + 1} />
                      )}

                      {/* Ad Set Rows (nested) */}
                      {isCampaignExpanded(c.id) && c._adSets.map((as: any) => (
                        <Fragment key={as.id}>
                          <tr className="border-b hover:bg-blue-50/30 bg-slate-50/50">
                            <td className="py-2" style={{ paddingRight: '2rem' }}>
                              <div className="flex items-center gap-1">
                                <button onClick={() => toggleAdSet(as.id)} className="p-0.5 hover:bg-slate-100 rounded flex-shrink-0">
                                  <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isAdSetExpanded(as.id) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                                <div className="font-medium text-slate-700 text-sm">{as.name}</div>
                              </div>
                            </td>
                            {renderMetricCells(as, 'adset')}
                          </tr>

                          {/* Breakdown rows for adset */}
                          {breakdownBy && isAdSetExpanded(as.id) && (
                            <BreakdownRows parentId={as.id} level="adset" by={breakdownBy} params={params} colCount={Object.values(visibleColumns).filter(Boolean).length + 1} />
                          )}

                          {/* Ad Rows (leaf) */}
                          {isAdSetExpanded(as.id) && as._ads.map((ad: any) => (
                            <tr key={ad.id} className="border-b hover:bg-blue-50/20 bg-slate-50/30">
                              <td className="py-2" style={{ paddingRight: '3.5rem' }}>
                                <div className="text-sm text-slate-600">{ad.name}</div>
                              </td>
                              {renderMetricCells(ad, 'ad')}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                {(() => { const t = calcTotals(sortedTree); const o = overview; return (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-slate-600">
                    <td className="py-2 font-medium">إجمالي الظاهر ({sortedTree.length} حملة)</td>
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
                  <tr className="border-t-2 border-slate-300 bg-blue-50 font-bold text-slate-800">
                    <td className="py-2">الإجمالي الفعلي (من Meta)</td>
                    {visibleColumns.status && <td className="py-2"></td>}
                    {visibleColumns.spend && <td className="py-2">{formatCurrency(o.totalSpend || 0)}</td>}
                    {visibleColumns.cpm && <td className="py-2">—</td>}
                    {visibleColumns.outboundCtr && <td className="py-2">—</td>}
                    {visibleColumns.frequency && <td className="py-2">—</td>}
                    {visibleColumns.leads && <td className="py-2">{formatNumber(o.totalLeads || 0)}</td>}
                    {visibleColumns.cpl && <td className="py-2">{formatCurrency(o.overallCPL || 0)}</td>}
                    {visibleColumns.confirmedOrders && <td className="py-2">{formatNumber(o.totalConfirmedOrders || 0)}</td>}
                    {visibleColumns.cpp && <td className="py-2">{formatCurrency(o.overallCPP || 0)}</td>}
                    {visibleColumns.impressions && <td className="py-2">—</td>}
                    {visibleColumns.reach && <td className="py-2">—</td>}
                    {visibleColumns.clicks && <td className="py-2">—</td>}
                    {visibleColumns.outboundClicks && <td className="py-2">—</td>}
                    {visibleColumns.roas && <td className="py-2">{(o.overallROAS || 0).toFixed(1)}x</td>}
                    {visibleColumns.revenue && <td className="py-2">—</td>}
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
