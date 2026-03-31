import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as inboxApi from '../services/inbox-api';

export default function ChannelSettings() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: channelsRes, isLoading } = useQuery({
    queryKey: ['inbox', 'channels'],
    queryFn: inboxApi.getChannels,
  });
  const channels = channelsRes?.data || [];

  const { data: _brandsRes } = useQuery({ queryKey: ['brands'], queryFn: inboxApi.getBrands });

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
    messenger: 'bg-blue-100 text-blue-700',
    instagram_dm: 'bg-purple-100 text-purple-700',
    facebook_comments: 'bg-blue-50 text-blue-600',
    instagram_comments: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">إعدادات الربط</h1>
          <p className="text-sm text-slate-500 mt-1">ربط صفحات فيسبوك وأكاونتات انستجرام لاستقبال الرسائل والتعليقات</p>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {connecting ? 'جاري التحميل...' : 'ربط صفحة جديدة'}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-12">جاري التحميل...</div>
      ) : channels.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-slate-500 mb-4">لم يتم ربط أي صفحة بعد</p>
          <button
            onClick={handleConnect}
            className="bg-violet-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-violet-700"
          >
            ربط صفحة فيسبوك
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch: any) => (
            <div key={ch.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${platformColor[ch.platform] || 'bg-slate-100 text-slate-600'}`}>
                  {platformLabel[ch.platform] || ch.platform}
                </span>
                <div>
                  <p className="font-medium text-sm">{ch.socialPage?.pageName}</p>
                  <p className="text-xs text-slate-400">
                    {ch.socialPage?.brand?.name} {ch.lastSyncAt ? `— آخر مزامنة: ${new Date(ch.lastSyncAt).toLocaleString('ar-EG')}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => inboxApi.syncChannel(ch.id)}
                  className="text-xs text-violet-600 hover:underline"
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
