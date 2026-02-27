import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

type LeadStatus = { id: string; name: string; slug: string };
type TaskRule = {
  id: string;
  name: string;
  statusSlug: string;
  afterDays: number;
  isActive: boolean;
  createdAt: string;
};

async function fetchRules() {
  const { data } = await api.get('/task-rules');
  return data.rules as TaskRule[];
}

async function fetchStatuses() {
  const { data } = await api.get('/lead-statuses');
  return data.statuses as LeadStatus[];
}

export default function TaskRulesPage() {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [statusSlug, setStatusSlug] = useState('');
  const [afterDays, setAfterDays] = useState(3);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDays, setEditDays] = useState(3);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['task-rules'],
    queryFn: fetchRules,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: fetchStatuses,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['task-rules'] });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/task-rules', body),
    onSuccess: () => {
      setName(''); setStatusSlug(''); setAfterDays(3);
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.patch(`/task-rules/${id}`, body),
    onSuccess: () => { setEditId(null); invalidate(); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/task-rules/${id}`, { isActive }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/task-rules/${id}`),
    onSuccess: invalidate,
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !statusSlug || afterDays < 1) return;
    createMutation.mutate({ name: name.trim(), statusSlug, afterDays });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    updateMutation.mutate({
      id: editId,
      body: { name: editName.trim(), statusSlug: editSlug, afterDays: editDays },
    });
  };

  const startEdit = (rule: TaskRule) => {
    setEditId(rule.id);
    setEditName(rule.name);
    setEditSlug(rule.statusSlug);
    setEditDays(rule.afterDays);
  };

  const getStatusName = (slug: string) =>
    statuses.find((s) => s.slug === slug)?.name ?? slug;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">قواعد إعادة التواصل</h1>
      </div>

      <p className="text-slate-500 text-sm mb-6">
        عند فتح صفحة المهام، يتم تلقائياً إنشاء مهام لليدز التي مضى عليها أكثر من المدة المحددة في حالة معينة بدون تواصل.
      </p>

      {/* Create Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
        <h2 className="font-semibold text-slate-700 mb-4">إضافة قاعدة جديدة</h2>
        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">اسم القاعدة</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                placeholder="مثال: ليد مكسوب بدون تواصل"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">حالة الليد</label>
              <select
                value={statusSlug}
                onChange={(e) => setStatusSlug(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                required
              >
                <option value="">اختر الحالة</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">عدد الأيام بدون تواصل</label>
              <input
                type="number"
                min={1}
                value={afterDays}
                onChange={(e) => setAfterDays(parseInt(e.target.value, 10))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {createMutation.isPending ? 'جاري الإضافة...' : '+ إضافة قاعدة'}
          </button>
        </form>
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <h2 className="font-semibold text-slate-700 p-4 border-b">
          القواعد الحالية ({rules.length})
        </h2>

        {isLoading ? (
          <div className="p-8 text-slate-400 text-center">جاري التحميل...</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-slate-400 text-center">لا توجد قواعد بعد.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4">
                {editId === rule.id ? (
                  <form onSubmit={handleUpdate}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                        required
                      />
                      <select
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                        required
                      >
                        {statuses.map((s) => (
                          <option key={s.id} value={s.slug}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={editDays}
                        onChange={(e) => setEditDays(parseInt(e.target.value, 10))}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
                      >
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="border border-slate-300 text-slate-600 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-800">{rule.name}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            rule.isActive
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {rule.isActive ? 'مفعّلة' : 'معطّلة'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        الحالة:{' '}
                        <span className="font-medium text-slate-700">{getStatusName(rule.statusSlug)}</span>
                        {' · '}
                        بعد{' '}
                        <span className="font-medium text-slate-700">{rule.afterDays}</span>{' '}
                        أيام بدون تواصل
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })
                        }
                        disabled={toggleMutation.isPending}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                          rule.isActive
                            ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {rule.isActive ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button
                        onClick={() => startEdit(rule)}
                        className="border border-slate-300 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذه القاعدة؟')) {
                            deleteMutation.mutate(rule.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="bg-red-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-40"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
