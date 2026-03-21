import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCreativeCodeConfig, getProjects, createProject, getAdAccounts, disconnectAdAccount, getMetaOAuthUrl, getMetaAvailableAccounts, connectMetaExisting, getBrands, getSyncSchedule, setSyncSchedule, getAiProviders, saveAiProvider, deleteAiProvider } from '../services/marketing-api';
import { useState } from 'react';

const AI_PROVIDER_CONFIG = [
  { provider: 'anthropic', name: 'Anthropic', description: 'Claude Sonnet, Claude Opus', color: 'bg-orange-500' },
  { provider: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-4o Mini', color: 'bg-green-500' },
  { provider: 'google', name: 'Google AI', description: 'Gemini Pro, Gemini Flash', color: 'bg-blue-500' },
];

const PLATFORMS = [
  { key: 'all', label: 'الكل' },
  { key: 'meta', label: 'ميتا' },
  { key: 'google', label: 'جوجل' },
  { key: 'tiktok', label: 'تيك توك' },
  { key: 'snapchat', label: 'سناب شات' },
];

const PLATFORM_COLORS: Record<string, string> = {
  meta: 'bg-blue-100 text-blue-700',
  google: 'bg-red-100 text-red-700',
  tiktok: 'bg-slate-800 text-white',
  snapchat: 'bg-yellow-100 text-yellow-700',
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'ميتا',
  google: 'جوجل',
  tiktok: 'تيك توك',
  snapchat: 'سناب شات',
};

export default function MarketingSettings() {
  const qc = useQueryClient();
  const [newProject, setNewProject] = useState({ name: '', slug: '', language: 'ar' });
  const [activePlatform, setActivePlatform] = useState('all');
  const [brandSelect, setBrandSelect] = useState<Record<string, string>>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [aiKeyInputs, setAiKeyInputs] = useState<Record<string, string>>({});

  const { data: aiProvidersData } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => getAiProviders(),
  });

  const [aiError, setAiError] = useState('');

  const saveAiMutation = useMutation({
    mutationFn: (data: { provider: string; name: string; apiKey: string }) => saveAiProvider(data),
    onSuccess: () => {
      setAiError('');
      qc.invalidateQueries({ queryKey: ['ai-providers'] });
      setAiKeyInputs({});
    },
    onError: (err: any) => setAiError(err.response?.data?.error || err.message),
  });

  const deleteAiMutation = useMutation({
    mutationFn: (id: string) => deleteAiProvider(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-providers'] });
    },
  });

  const aiProviders: any[] = aiProvidersData?.data?.providers ?? [];

  const { data: configData } = useQuery({
    queryKey: ['marketing', 'creative-code-config'],
    queryFn: () => getCreativeCodeConfig(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['marketing', 'projects'],
    queryFn: () => getProjects(),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['marketing', 'brands'],
    queryFn: () => getBrands(),
  });

  const [projectError, setProjectError] = useState('');

  const createProjectMutation = useMutation({
    mutationFn: () => createProject(newProject),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing', 'projects'] });
      setNewProject({ name: '', slug: '', language: 'ar' });
      setProjectError('');
    },
    onError: (err: any) => {
      setProjectError(err.response?.data?.error || 'حدث خطأ في إنشاء المشروع');
    },
  });

  const { data: metaAvailableData, isLoading: metaLoading } = useQuery({
    queryKey: ['marketing', 'meta-available-accounts'],
    queryFn: () => getMetaAvailableAccounts(),
    retry: false,
  });

  const { data: adAccountsData, isLoading: adAccountsLoading } = useQuery({
    queryKey: ['marketing', 'ad-accounts'],
    queryFn: () => getAdAccounts(),
    enabled: !metaAvailableData,
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => disconnectAdAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing', 'ad-accounts'] });
      qc.invalidateQueries({ queryKey: ['marketing', 'meta-available-accounts'] });
    },
  });

  const connectExistingMutation = useMutation({
    mutationFn: (data: { accountId: string; accountName: string; brandId: string }) =>
      connectMetaExisting(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing', 'meta-available-accounts'] });
      setConnectingId(null);
    },
  });

  const handleMetaConnect = async () => {
    const res = await getMetaOAuthUrl();
    window.location.href = res.data.url;
  };

  const { data: syncScheduleData } = useQuery({
    queryKey: ['marketing', 'sync-schedule'],
    queryFn: () => getSyncSchedule(),
  });

  const [scheduleForm, setScheduleForm] = useState<{ enabled: boolean; unit: string; value: number } | null>(null);
  const schedule = scheduleForm ?? (syncScheduleData?.data?.schedule || { enabled: false, unit: 'hours', value: 6 });

  const saveScheduleMutation = useMutation({
    mutationFn: () => setSyncSchedule(schedule),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'sync-schedule'] }),
  });

  const config = configData?.data?.config;
  const projects = projectsData?.data?.projects ?? [];
  const brands: any[] = brandsData?.data?.brands ?? [];

  // Use meta-available-accounts if we have any connected account, otherwise fall back to connected-only list
  const metaAccounts: any[] = metaAvailableData?.data?.accounts ?? [];
  const hasMetaAvailable = metaAccounts.length > 0;
  const connectedOnlyAccounts: any[] = adAccountsData?.data?.accounts ?? [];

  // Build display list
  const allDisplayAccounts = hasMetaAvailable
    ? metaAccounts.map((a: any) => ({ ...a, platform: 'meta' }))
    : connectedOnlyAccounts;

  const isLoading = hasMetaAvailable ? metaLoading : adAccountsLoading;

  const filteredAccounts = activePlatform === 'all'
    ? allDisplayAccounts
    : allDisplayAccounts.filter((a: any) => a.platform === activePlatform);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">إعدادات التسويق</h1>

      {/* AI Providers */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">إعدادات الذكاء الاصطناعي</h2>
        {aiError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{aiError}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_PROVIDER_CONFIG.map((cfg) => {
            const existing = aiProviders.find((p: any) => p.provider === cfg.provider);
            const hasKey = !!existing;
            return (
              <div key={cfg.provider} className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${cfg.color}`} />
                    <div>
                      <p className="font-medium text-slate-800">{cfg.name}</p>
                      <p className="text-xs text-slate-400">{cfg.description}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${hasKey ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {hasKey ? 'متصل' : 'غير متصل'}
                  </span>
                </div>

                {hasKey ? (
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono" dir="ltr">
                      {existing.maskedKey}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const val = aiKeyInputs[cfg.provider];
                          if (val) {
                            saveAiMutation.mutate({ provider: cfg.provider, name: cfg.name, apiKey: val });
                          } else {
                            setAiKeyInputs((prev) => ({ ...prev, [cfg.provider]: '' }));
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        تحديث
                      </button>
                      <button
                        onClick={() => deleteAiMutation.mutate(existing.id)}
                        disabled={deleteAiMutation.isPending}
                        className="flex-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        حذف
                      </button>
                    </div>
                    {aiKeyInputs[cfg.provider] !== undefined && (
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={aiKeyInputs[cfg.provider] || ''}
                          onChange={(e) => setAiKeyInputs((prev) => ({ ...prev, [cfg.provider]: e.target.value }))}
                          placeholder="أدخل المفتاح الجديد"
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                          dir="ltr"
                        />
                        <button
                          onClick={() => {
                            const val = aiKeyInputs[cfg.provider];
                            if (val) {
                              saveAiMutation.mutate({ provider: cfg.provider, name: cfg.name, apiKey: val });
                            }
                          }}
                          disabled={!aiKeyInputs[cfg.provider] || saveAiMutation.isPending}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          حفظ
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={aiKeyInputs[cfg.provider] || ''}
                      onChange={(e) => setAiKeyInputs((prev) => ({ ...prev, [cfg.provider]: e.target.value }))}
                      placeholder="أدخل API Key"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                      dir="ltr"
                    />
                    <button
                      onClick={() => {
                        const val = aiKeyInputs[cfg.provider];
                        if (val) {
                          saveAiMutation.mutate({ provider: cfg.provider, name: cfg.name, apiKey: val });
                        }
                      }}
                      disabled={!aiKeyInputs[cfg.provider] || saveAiMutation.isPending}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saveAiMutation.isPending ? 'جاري...' : 'حفظ'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ad Accounts */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">حسابات الإعلانات</h2>

        {/* Platform Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-4">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePlatform(p.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activePlatform === p.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Accounts List */}
        <div className="space-y-2 mb-4">
          {isLoading ? (
            <p className="text-sm text-slate-400 py-4 text-center">جاري التحميل...</p>
          ) : filteredAccounts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">لا توجد حسابات</p>
          ) : (
            filteredAccounts.map((account: any) => {
              const isConnected = account.isConnected !== undefined ? account.isConnected : true;
              const accountKey = account.accountId ?? account.id;
              return (
                <div key={accountKey} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[account.platform] ?? 'bg-slate-100 text-slate-600'}`}>
                      {PLATFORM_LABELS[account.platform] ?? account.platform}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{account.accountName ?? account.name}</p>
                      <p className="text-xs text-slate-400">{account.accountId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isConnected ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-slate-500">مربوط{account.brandName ? ` · ${account.brandName}` : ''}</span>
                        <button
                          onClick={() => disconnectMutation.mutate(account.connectedId ?? account.id)}
                          disabled={disconnectMutation.isPending}
                          className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          فك الربط
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        <select
                          value={brandSelect[accountKey] ?? ''}
                          onChange={(e) => setBrandSelect((prev) => ({ ...prev, [accountKey]: e.target.value }))}
                          className="border rounded-lg px-2 py-1 text-xs text-slate-700"
                        >
                          <option value="">اختر البراند</option>
                          {brands.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const brandId = brandSelect[accountKey];
                            if (!brandId) return;
                            setConnectingId(accountKey);
                            connectExistingMutation.mutate({
                              accountId: account.accountId,
                              accountName: account.name,
                              brandId,
                            });
                          }}
                          disabled={!brandSelect[accountKey] || connectingId === accountKey}
                          className="px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                        >
                          {connectingId === accountKey ? 'جاري...' : 'ربط'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Connect Buttons */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 mb-3">ربط حساب جديد:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleMetaConnect}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <span>+ ربط ميتا</span>
            </button>
            {['google', 'tiktok', 'snapchat'].map((p) => (
              <button
                key={p}
                disabled
                className="px-4 py-2 text-sm border border-slate-200 text-slate-400 rounded-lg flex items-center gap-2 cursor-not-allowed"
              >
                <span>+ ربط {PLATFORM_LABELS[p]}</span>
                <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">قريباً</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">المشاريع</h2>
        <div className="space-y-2 mb-4">
          {projects.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="text-slate-500 text-xs mr-2">({p.slug})</span>
              </div>
              <span className="text-xs text-slate-500">{p._count?.creatives ?? 0} كرييتيف</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newProject.name}
            onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
            placeholder="اسم المشروع"
            className="border rounded-lg px-3 py-2 text-sm flex-1"
          />
          <select
            value={newProject.language}
            onChange={(e) => setNewProject((p) => ({ ...p, language: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="ar">عربي</option>
            <option value="en">English</option>
          </select>
          <button
            onClick={() => {
              if (!newProject.name.trim()) return;
              setProjectError('');
              createProjectMutation.mutate();
            }}
            disabled={createProjectMutation.isPending || !newProject.name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {createProjectMutation.isPending ? 'جاري...' : 'إضافة'}
          </button>
        </div>
        {projectError && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">{projectError}</p>
        )}
      </div>

      {/* Auto Sync Schedule */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">جدول المزامنة التلقائية</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setScheduleForm({ ...schedule, enabled: !schedule.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${schedule.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${schedule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-700">تفعيل المزامنة التلقائية</span>
          </label>

          {schedule.enabled && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-600">كل</span>
              <input
                type="number"
                min={1}
                value={schedule.value}
                onChange={(e) => setScheduleForm({ ...schedule, value: Number(e.target.value) })}
                className="border rounded-lg px-3 py-2 text-sm w-20"
              />
              <select
                value={schedule.unit}
                onChange={(e) => setScheduleForm({ ...schedule, unit: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="minutes">دقائق</option>
                <option value="hours">ساعات</option>
                <option value="days">أيام</option>
                <option value="months">أشهر</option>
                <option value="years">سنوات</option>
              </select>
            </div>
          )}

          <button
            onClick={() => saveScheduleMutation.mutate()}
            disabled={saveScheduleMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saveScheduleMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
          {saveScheduleMutation.isSuccess && (
            <p className="text-xs text-green-600">تم الحفظ ✓</p>
          )}
        </div>
      </div>

      {/* Creative Code Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">إعدادات كود الكرييتيف</h2>
        {config ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              <p>الفاصل: <code className="bg-slate-100 px-1 rounded">{config.separator}</code></p>
              <p>عدد الأرقام التسلسلية: {config.seqDigits}</p>
            </div>
            <div>
              <h3 className="font-medium text-slate-700 mb-2">الأقسام:</h3>
              {(config.segments as any[]).sort((a: any, b: any) => a.order - b.order).map((seg: any, i: number) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 mb-2">
                  <span className="font-medium">{seg.name}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {seg.values.map((v: any) => (
                      <span key={v.code} className="px-2 py-0.5 bg-white border rounded text-xs">
                        {v.code} = {v.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              مثال: 1-2-3-001 (عربي - Print In - Dual Name - تسلسلي)
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">جاري التحميل...</p>
        )}
      </div>
    </div>
  );
}
