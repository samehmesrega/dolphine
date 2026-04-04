import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as inboxApi from '../services/inbox-api';

export default function ChannelSettings() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [oauthMessage, setOauthMessage] = useState('');
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [oauthToken, setOauthToken] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  const { data: brandsRes } = useQuery({ queryKey: ['brands'], queryFn: inboxApi.getBrands });
  const brands = brandsRes?.data?.brands || [];

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;

    setOauthStatus('processing');
    setOauthMessage('جاري جلب الصفحات...');

    inboxApi.oauthCallback(code)
      .then(({ data }) => {
        if (data.pages && data.pages.length > 0) {
          setAvailablePages(data.pages);
          setOauthToken(data._token || '');
          setOauthStatus('success');
          setOauthMessage(`تم العثور على ${data.pages.length} صفحة. اختر البراند واضغط ربط.`);
        } else {
          setOauthStatus('error');
          setOauthMessage('لم يتم العثور على صفحات');
        }
        navigate('/inbox/settings', { replace: true });
      })
      .catch((err) => {
        setOauthStatus('error');
        setOauthMessage(err.response?.data?.error || 'فشل في جلب الصفحات');
        navigate('/inbox/settings', { replace: true });
      });
  }, [searchParams]);

  const connectPage = async (page: any) => {
    if (!oauthToken) {
      alert('انتهت الجلسة — جرب ربط صفحة جديدة مرة تانية');
      return;
    }
    if (!selectedBrandId) {
      alert('اختر البراند الأول');
      return;
    }
    try {
      await inboxApi.connectPages({
        pages: [{ pageId: page.id, pageName: page.name, instagramBusinessAccountId: page.instagramId }],
        token: oauthToken,
        brandId: selectedBrandId,
      });
      setAvailablePages((prev) => prev.filter((p) => p.id !== page.id));
      queryClient.invalidateQueries({ queryKey: ['inbox', 'channels'] });
    } catch (err: any) {
      alert(err.response?.data?.error || 'فشل في ربط الصفحة');
    }
  };

  const { data: channelsRes, isLoading } = useQuery({
    queryKey: ['inbox', 'channels'],
    queryFn: inboxApi.getChannels,
  });
  const channels = channelsRes?.data || [];

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => inboxApi.deactivateChannel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox', 'channels'] }),
  });

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { data } = await inboxApi.getOAuthUrl();
      window.location.href = data.url;
    } catch (err) {
      alert('فشل في الحصول على رابط الربط');
    } finally {
      setConnecting(false);
    }
  };

  const platformLabel: Record<string, string> = {
    messenger: 'Messenger',
    instagram_dm: 'Instagram DM',
    facebook_comments: 'Facebook Comments',
    instagram_comments: 'Instagram Comments',
  };

  const platformColor: Record<string, string> = {
    messenger: 'bg-blue-50 text-blue-700',
    instagram_dm: 'bg-purple-50 text-purple-700',
    facebook_comments: 'bg-blue-50/50 text-blue-600',
    instagram_comments: 'bg-purple-50/50 text-purple-600',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto font-body">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-display font-bold text-ds-on-surface">إعدادات الربط</h1>
          <p className="text-sm text-ds-on-surface-v mt-1">ربط صفحات فيسبوك وأكاونتات انستجرام لاستقبال الرسائل والتعليقات</p>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="bg-gradient-to-l from-ds-primary to-ds-primary-c text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
        >
          {connecting ? 'جاري التحميل...' : 'ربط صفحة جديدة'}
        </button>
      </div>

      {/* OAuth Status — tonal alerts, no hard borders */}
      {oauthStatus === 'processing' && (
        <div className="bg-ds-primary/5 rounded-2xl p-4 mb-6 text-sm text-ds-primary flex items-center gap-2">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          {oauthMessage}
        </div>
      )}
      {oauthStatus === 'error' && (
        <div className="bg-red-50 rounded-2xl p-4 mb-6 text-sm text-red-700">{oauthMessage}</div>
      )}
      {oauthStatus === 'success' && oauthMessage && !availablePages.length && (
        <div className="bg-green-50 rounded-2xl p-4 mb-6 text-sm text-green-700">{oauthMessage}</div>
      )}

      {/* Available Pages to Connect */}
      {availablePages.length > 0 && (
        <div className="bg-ds-surface-card rounded-3xl p-5 mb-6 shadow-ambient">
          <h2 className="font-display font-semibold text-sm mb-4 text-ds-on-surface">{oauthMessage}</h2>
          <div className="mb-4">
            <label className="text-sm text-ds-on-surface-v mb-1.5 block">اختر البراند:</label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="bg-ds-surface-card border border-ds-outline/15 rounded-xl px-3 py-2 text-sm w-full max-w-xs text-ds-on-surface focus:outline-none focus:border-ds-primary/40 transition"
            >
              <option value="">-- اختر البراند --</option>
              {brands.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {availablePages.map((page: any) => (
              <div key={page.id} className="flex items-center justify-between p-3.5 bg-ds-surface-low rounded-2xl">
                <div>
                  <p className="font-medium text-sm text-ds-on-surface">{page.name}</p>
                  <p className="text-xs text-ds-on-surface-v">
                    ID: {page.id} {page.hasInstagram && ' — Instagram متصل'}
                  </p>
                </div>
                <button
                  onClick={() => connectPage(page)}
                  disabled={!selectedBrandId}
                  className="bg-gradient-to-l from-ds-primary to-ds-primary-c text-white px-3.5 py-1.5 rounded-xl text-xs font-medium hover:opacity-90 disabled:opacity-40 transition"
                >
                  ربط
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-ds-on-surface-v py-12">جاري التحميل...</div>
      ) : channels.length === 0 ? (
        <div className="bg-ds-surface-card rounded-3xl p-12 text-center shadow-[0_1px_8px_rgba(25,28,29,0.04)]">
          <svg className="w-16 h-16 mx-auto mb-4 text-ds-outline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-ds-on-surface-v mb-4">لم يتم ربط أي صفحة بعد</p>
          <button
            onClick={handleConnect}
            className="bg-gradient-to-l from-ds-primary to-ds-primary-c text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            ربط صفحة فيسبوك
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch: any) => (
            <div key={ch.id} className="bg-ds-surface-card rounded-2xl p-4 flex items-center justify-between shadow-[0_1px_4px_rgba(25,28,29,0.04)] hover:shadow-[0_2px_12px_rgba(25,28,29,0.06)] transition-shadow">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${platformColor[ch.platform] || 'bg-ds-surface-low text-ds-on-surface-v'}`}>
                  {platformLabel[ch.platform] || ch.platform}
                </span>
                <div>
                  <p className="font-medium text-sm text-ds-on-surface">{ch.socialPage?.pageName}</p>
                  <p className="text-xs text-ds-on-surface-v">
                    {ch.socialPage?.brand?.name} {ch.lastSyncAt ? `— آخر مزامنة: ${new Date(ch.lastSyncAt).toLocaleString('ar-EG')}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.textContent = 'جاري المزامنة...';
                    btn.disabled = true;
                    try {
                      const { data } = await inboxApi.syncChannel(ch.id);
                      btn.textContent = `تم (${data.synced || 0})`;
                      queryClient.invalidateQueries({ queryKey: ['inbox', 'channels'] });
                      setTimeout(() => { btn.textContent = 'مزامنة'; btn.disabled = false; }, 3000);
                    } catch (err: any) {
                      const msg = err.response?.data?.error || 'فشل';
                      btn.textContent = msg.length > 30 ? 'فشل' : msg;
                      alert('خطأ في المزامنة: ' + msg);
                      setTimeout(() => { btn.textContent = 'مزامنة'; btn.disabled = false; }, 3000);
                    }
                  }}
                  className="text-xs text-ds-primary hover:underline disabled:opacity-50 font-medium"
                >
                  مزامنة
                </button>
                <button
                  onClick={() => { if (confirm('هل أنت متأكد من فصل هذه القناة؟')) deactivateMutation.mutate(ch.id); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  فصل
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
