import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

type MyProfile = {
  id: string;
  name: string;
  email: string;
  whatsappNumber: string | null;
  role: { id: string; name: string; slug: string };
};

export default function ProfilePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', whatsappNumber: '', password: '', confirmPassword: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data.user as MyProfile;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm((p) => ({
        ...p,
        name: profile.name,
        whatsappNumber: profile.whatsappNumber ?? '',
      }));
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.password && form.password !== form.confirmPassword) {
        throw new Error('كلمة المرور غير متطابقة');
      }
      const payload: { name?: string; whatsappNumber?: string | null; password?: string } = {};
      if (form.name.trim()) payload.name = form.name.trim();
      payload.whatsappNumber = form.whatsappNumber.trim() || null;
      if (form.password.trim()) payload.password = form.password.trim();
      const { data } = await api.patch('/users/me', payload);
      return data.user as MyProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      setSaved(true);
      setError('');
      setForm((p) => ({ ...p, password: '', confirmPassword: '' }));
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || err.response?.data?.error || 'فشل الحفظ');
    },
  });

  if (isLoading) {
    return <div className="p-4 text-slate-500">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">ملفي الشخصي</h1>

      <div className="bg-white rounded-xl shadow p-6 space-y-5">
        <div>
          <p className="text-xs text-slate-500 mb-1">الدور الوظيفي</p>
          <p className="text-sm font-medium text-slate-700">{profile?.role?.name}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-1">البريد الإلكتروني</p>
          <p className="text-sm text-slate-700">{profile?.email}</p>
        </div>

        <hr className="border-slate-100" />

        <div>
          <label className="block text-sm text-slate-600 mb-1">الاسم</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">
            رقم واتساب الخاص بك
            <span className="text-slate-400 text-xs mr-1">(يُستخدم لفتح محادثة مع الليدز)</span>
          </label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="مثال: 201001234567"
            value={form.whatsappNumber}
            onChange={(e) => setForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
            dir="ltr"
          />
          <p className="text-xs text-slate-400 mt-1">أدخل الرقم بدون + مع كود الدولة (مثال: 201001234567)</p>
        </div>

        <hr className="border-slate-100" />

        <div>
          <label className="block text-sm text-slate-600 mb-1">كلمة مرور جديدة (اختياري)</label>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="اتركه فارغاً للإبقاء على الحالي"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          />
        </div>

        {form.password && (
          <div>
            <label className="block text-sm text-slate-600 mb-1">تأكيد كلمة المرور</label>
            <input
              type="password"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                form.confirmPassword && form.password !== form.confirmPassword
                  ? 'border-red-400'
                  : 'border-slate-300'
              }`}
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">تم الحفظ بنجاح ✓</p>}

        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
        >
          {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>
    </div>
  );
}
