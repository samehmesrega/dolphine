import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';

type BlacklistedPhone = {
  id: string;
  phone: string;
  reason: string | null;
  createdAt: string;
  creator: { id: string; name: string };
};

function useBlacklist() {
  return useQuery({
    queryKey: ['blacklist'],
    queryFn: async () => {
      const { data } = await api.get<{ phones: BlacklistedPhone[] }>('/blacklist');
      return data.phones;
    },
  });
}

export default function BlacklistPage() {
  const queryClient = useQueryClient();
  const { data: phones = [], isLoading } = useBlacklist();
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');

  const addMutation = useMutation({
    mutationFn: async (body: { phone: string; reason?: string }) => {
      const { data } = await api.post<{ phone: BlacklistedPhone }>('/blacklist', body);
      return data.phone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      setPhone('');
      setReason('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/blacklist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blacklist'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">الأرقام المحظورة</h1>

      {/* Add form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-semibold text-slate-700 mb-4">إضافة رقم للقائمة السوداء</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">رقم الجوال</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="border border-slate-300 rounded-lg px-3 py-2 w-48"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">السبب (اختياري)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب الحظر..."
              className="border border-slate-300 rounded-lg px-3 py-2 w-64"
            />
          </div>
          <button
            type="button"
            onClick={() => phone.trim() && addMutation.mutate({ phone: phone.trim(), reason: reason.trim() || undefined })}
            disabled={!phone.trim() || addMutation.isPending}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {addMutation.isPending ? 'جاري الإضافة...' : 'إضافة للقائمة'}
          </button>
        </div>
        {addMutation.isError && (
          <p className="text-red-600 text-sm mt-2">
            {(addMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'حدث خطأ'}
          </p>
        )}
        {addMutation.isSuccess && (
          <p className="text-green-600 text-sm mt-2">تمت الإضافة بنجاح.</p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-slate-500">جاري التحميل...</div>
        ) : phones.length === 0 ? (
          <div className="p-6 text-slate-500">لا توجد أرقام محظورة.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-right px-4 py-3 font-medium">الرقم</th>
                <th className="text-right px-4 py-3 font-medium">السبب</th>
                <th className="text-right px-4 py-3 font-medium">أضافه</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {phones.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono" dir="ltr">{p.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{p.reason || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.creator?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(p.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => window.confirm('حذف هذا الرقم من القائمة؟') && deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      حذف
                    </button>
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
