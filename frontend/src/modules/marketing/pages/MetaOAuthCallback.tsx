import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { metaOAuthCallback, connectMetaAdAccount, getBrands } from '../services/marketing-api';

interface MetaAdAccount {
  id: string;
  accountId: string;
  name: string;
  currency: string;
  timezone: string;
  status: number;
}

export default function MetaOAuthCallback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [accessToken, setAccessToken] = useState('');
  const [brandMap, setBrandMap] = useState<Record<string, string>>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectingAll, setConnectingAll] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [defaultBrandId, setDefaultBrandId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);

  const code = searchParams.get('code');

  const { data: brandsData } = useQuery({
    queryKey: ['marketing', 'brands'],
    queryFn: () => getBrands(),
  });
  const brands: any[] = brandsData?.data?.brands ?? [];

  const codeUsed = useRef(false);

  useEffect(() => {
    if (!code || codeUsed.current || accessToken) return;
    codeUsed.current = true;
    setLoading(true);
    setError('');

    // Show "slow" message after 8 seconds
    const slowTimer = setTimeout(() => setSlowLoad(true), 8000);

    metaOAuthCallback(code)
      .then((res) => {
        setAccessToken(res.data.accessToken);
        setAdAccounts(res.data.adAccounts || []);
        // Remove code from URL so refresh doesn't retry
        setSearchParams({}, { replace: true });
      })
      .catch((err: any) => {
        setError(err.response?.data?.error || err.message || 'فشل في الربط مع Meta');
      })
      .finally(() => {
        setLoading(false);
        setSlowLoad(false);
        clearTimeout(slowTimer);
      });
  }, [code]);

  const handleConnect = async (acc: MetaAdAccount) => {
    const brandId = brandMap[acc.accountId];
    if (!brandId) {
      setError('اختر البراند المرتبط بالحساب أولا');
      return;
    }
    setConnectingId(acc.accountId);
    setError('');
    try {
      await connectMetaAdAccount({
        accountId: acc.accountId,
        accountName: acc.name,
        accessToken,
        brandId,
      });
      setConnectedIds((prev) => new Set([...prev, acc.accountId]));
    } catch (err: any) {
      setError(err.response?.data?.error || 'فشل في ربط الحساب');
    } finally {
      setConnectingId(null);
    }
  };

  const handleConnectAll = async () => {
    if (!defaultBrandId) {
      setError('اختر البراند الافتراضي أولا');
      return;
    }
    setConnectingAll(true);
    setError('');
    const remaining = adAccounts.filter((a) => !connectedIds.has(a.accountId));
    for (const acc of remaining) {
      const brandId = brandMap[acc.accountId] || defaultBrandId;
      try {
        await connectMetaAdAccount({
          accountId: acc.accountId,
          accountName: acc.name,
          accessToken,
          brandId,
        });
        setConnectedIds((prev) => new Set([...prev, acc.accountId]));
      } catch (err: any) {
        setError(`فشل ربط ${acc.name}: ${err.response?.data?.error || err.message}`);
      }
    }
    setConnectingAll(false);
  };

  const allConnected = adAccounts.length > 0 && adAccounts.every((a) => connectedIds.has(a.accountId));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600">جاري الربط مع Meta...</p>
          {slowLoad && (
            <p className="text-xs text-slate-400">الاتصال بياخد وقت أطول من المتوقع...</p>
          )}
          <button
            onClick={() => navigate('/marketing/media-buying')}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  if (error && adAccounts.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-red-600">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/marketing/media-buying')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
          >
            رجوع للميديا باينج
          </button>
          <button
            onClick={() => {
              navigate('/marketing/media-buying');
              // Small delay then trigger OAuth again
              setTimeout(() => {
                const btn = document.querySelector('[data-connect-meta]') as HTMLButtonElement;
                btn?.click();
              }, 500);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  // No code and no accounts — user landed here directly
  if (!code && adAccounts.length === 0 && !accessToken) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-4">
        <p className="text-slate-500">لا يوجد كود ربط. اذهب لصفحة الميديا باينج واضغط "ربط حساب Meta".</p>
        <button
          onClick={() => navigate('/marketing/media-buying')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          رجوع للميديا باينج
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">ربط حسابات Meta الإعلانية</h1>
        <button
          onClick={() => navigate('/marketing/media-buying')}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          رجوع
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
      )}

      {adAccounts.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
          لم يتم العثور على حسابات إعلانية. تأكد من صلاحيات الوصول.
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            تم العثور على <strong>{adAccounts.length}</strong> حساب إعلاني. اختر البراند لكل حساب ثم اضغط ربط.
          </p>

          {/* Connect All */}
          {adAccounts.some((a) => !connectedIds.has(a.accountId)) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-blue-800 font-medium">ربط كل الحسابات دفعة واحدة:</span>
                <select
                  value={defaultBrandId}
                  onChange={(e) => setDefaultBrandId(e.target.value)}
                  className="border rounded-lg px-2 py-1.5 text-sm min-w-[140px]"
                >
                  <option value="">اختر البراند</option>
                  {brands.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleConnectAll}
                disabled={connectingAll || !defaultBrandId}
                className="px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {connectingAll ? 'جاري الربط...' : `ربط الكل (${adAccounts.filter((a) => !connectedIds.has(a.accountId)).length})`}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {adAccounts.map((acc) => {
              const isConnected = connectedIds.has(acc.accountId);
              const isConnecting = connectingId === acc.accountId;

              return (
                <div
                  key={acc.accountId}
                  className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-4 ${
                    isConnected ? 'border-green-300 bg-green-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                        f
                      </span>
                      <div>
                        <p className="font-medium text-slate-800 truncate">{acc.name}</p>
                        <p className="text-xs text-slate-400">
                          ID: {acc.accountId} - {acc.currency} - {acc.timezone}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!isConnected ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={brandMap[acc.accountId] || ''}
                        onChange={(e) => setBrandMap((m) => ({ ...m, [acc.accountId]: e.target.value }))}
                        className="border rounded-lg px-2 py-1.5 text-sm min-w-[120px]"
                      >
                        <option value="">اختر البراند</option>
                        {brands.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleConnect(acc)}
                        disabled={isConnecting || !brandMap[acc.accountId]}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isConnecting ? 'جاري الربط...' : 'ربط'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      تم الربط
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {allConnected && (
            <div className="text-center pt-4">
              <button
                onClick={() => navigate('/marketing/media-buying')}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                تم - الرجوع للميديا باينج
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
