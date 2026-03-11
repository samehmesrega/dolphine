import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRequests, createRequest, updateRequestStatus, getProjects } from '../services/marketing-api';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد',
  IN_PRODUCTION: 'قيد الإنتاج',
  DONE: 'مكتمل',
  CANCELLED: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-yellow-100 text-yellow-800',
  IN_PRODUCTION: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function CreativeRequests() {
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['marketing', 'projects'],
    queryFn: () => getProjects(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['marketing', 'requests', statusFilter],
    queryFn: () => getRequests(statusFilter ? { status: statusFilter } : {}),
  });

  const createMutation = useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing', 'requests'] });
      setShowForm(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateRequestStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'requests'] }),
  });

  const requests = data?.data?.requests ?? [];
  const projects = projectsData?.data?.projects ?? [];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      title: fd.get('title'),
      projectId: fd.get('projectId'),
      platform: fd.get('platform'),
      language: fd.get('language'),
      instructions: fd.get('instructions'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">طلبات الكرييتيف</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showForm ? 'إلغاء' : '+ طلب جديد'}
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2">
        {['', 'NEW', 'IN_PRODUCTION', 'DONE', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s === '' ? 'الكل' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* New Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label>
              <input name="title" required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المشروع</label>
              <select name="projectId" required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">اختر المشروع</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المنصة</label>
              <select name="platform" required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="meta">Meta</option>
                <option value="tiktok">TikTok</option>
                <option value="snapchat">Snapchat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اللغة</label>
              <select name="language" required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="ar">عربي</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التعليمات</label>
            <textarea name="instructions" required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            إرسال الطلب
          </button>
        </form>
      )}

      {/* Requests List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-xl border">لا توجد طلبات</div>
        ) : (
          requests.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{r.title}</h3>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                    <span>{r.project?.name}</span>
                    <span>{r.platform}</span>
                    <span>طلب من: {r.requester?.name}</span>
                    {r.assignee && <span>معين لـ: {r.assignee.name}</span>}
                    <span>{r._count?.creatives ?? 0} كرييتيف</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  <select
                    value={r.status}
                    onChange={(e) => statusMutation.mutate({ id: r.id, status: e.target.value })}
                    className="border rounded px-2 py-1 text-xs"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{r.instructions}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
