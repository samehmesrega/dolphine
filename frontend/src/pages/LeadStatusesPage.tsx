import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

type LeadStatus = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  orderNum: number;
  isActive: boolean;
};

const PROTECTED_SLUGS = ['new', 'confirmed'];

export default function LeadStatusesPage() {
  const qc = useQueryClient();
  const [newForm, setNewForm] = useState({ name: '', slug: '', color: '#6b7280', orderNum: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '', orderNum: 0 });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['lead-statuses-all'],
    queryFn: async () => {
      const { data } = await api.get('/lead-statuses?all=true');
      return data.statuses as LeadStatus[];
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/lead-statuses', {
        name: newForm.name.trim(),
        slug: newForm.slug.trim() || newForm.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, ''),
        color: newForm.color,
        orderNum: Number(newForm.orderNum),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-statuses-all'] });
      qc.invalidateQueries({ queryKey: ['lead-statuses'] });
      setNewForm({ name: '', slug: '', color: '#6b7280', orderNum: 0 });
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل الإنشاء'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string; orderNum?: number } }) =>
      api.patch(`/lead-statuses/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-statuses-all'] });
      qc.invalidateQueries({ queryKey: ['lead-statuses'] });
      setEditingId(null);
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل التحديث'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/lead-statuses/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-statuses-all'] });
      qc.invalidateQueries({ queryKey: ['lead-statuses'] });
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل التعديل'),
  });

  const startEdit = (s: LeadStatus) => {
    setEditingId(s.id);
    setEditForm({ name: s.name, color: s.color ?? '#6b7280', orderNum: s.orderNum });
    setError('');
  };

  if (isLoading) return <div className="p-4 text-slate-500">جاري التحميل...</div>;

  const active = data?.filter((s) => s.isActive) ?? [];
  const inactive = data?.filter((s) => !s.isActive) ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">حالات الليد</h1>

      {/* Add form */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-slate-700 mb-4">إضافة حالة جديدة</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">الاسم *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="مثال: قيد المراجعة"
              value={newForm.name}
              onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs text-slate-500 mb-1">slug (اختياري)</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="under_review"
              value={newForm.slug}
              onChange={(e) => setNewForm((p) => ({ ...p, slug: e.target.value }))}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">اللون</label>
            <input
              type="color"
              className="h-9 w-14 border border-slate-300 rounded-lg px-1 py-1 cursor-pointer"
              value={newForm.color}
              onChange={(e) => setNewForm((p) => ({ ...p, color: e.target.value }))}
            />
          </div>
          <div className="w-20">
            <label className="block text-xs text-slate-500 mb-1">الترتيب</label>
            <input
              type="number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={newForm.orderNum}
              onChange={(e) => setNewForm((p) => ({ ...p, orderNum: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <button
            type="button"
            disabled={!newForm.name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
          >
            {createMutation.isPending ? 'جاري...' : '+ إضافة'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Active statuses */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h2 className="font-semibold text-slate-700 p-4 border-b">الحالات النشطة ({active.length})</h2>
        {active.length === 0 ? (
          <p className="p-4 text-slate-500 text-sm">لا توجد حالات نشطة.</p>
        ) : (
          <ul className="divide-y">
            {active.map((s) => (
              <li key={s.id} className="p-4">
                {editingId === s.id ? (
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[120px]">
                      <input
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <input
                        type="color"
                        className="h-9 w-14 border border-slate-300 rounded-lg px-1 py-1 cursor-pointer"
                        value={editForm.color}
                        onChange={(e) => setEditForm((p) => ({ ...p, color: e.target.value }))}
                      />
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        value={editForm.orderNum}
                        onChange={(e) => setEditForm((p) => ({ ...p, orderNum: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: s.id, data: { name: editForm.name, color: editForm.color, orderNum: editForm.orderNum } })}
                      className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
                    >
                      حفظ
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-2 border rounded-lg text-slate-600 text-sm">
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.color ?? '#6b7280' }}
                      />
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{s.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{s.slug} · ترتيب: {s.orderNum}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        تعديل
                      </button>
                      {!PROTECTED_SLUGS.includes(s.slug) && (
                        <button
                          type="button"
                          onClick={() => toggleMutation.mutate({ id: s.id, isActive: false })}
                          disabled={toggleMutation.isPending}
                          className="text-sm text-red-500 hover:underline"
                        >
                          تعطيل
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Inactive statuses */}
      {inactive.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h2 className="font-semibold text-slate-700 p-4 border-b text-sm text-slate-500">
            حالات معطّلة ({inactive.length})
          </h2>
          <ul className="divide-y">
            {inactive.map((s) => (
              <li key={s.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0 opacity-40"
                    style={{ backgroundColor: s.color ?? '#6b7280' }}
                  />
                  <div>
                    <p className="font-medium text-slate-500 text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.slug}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate({ id: s.id, isActive: true })}
                  disabled={toggleMutation.isPending}
                  className="text-sm text-green-600 hover:underline"
                >
                  تفعيل
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
