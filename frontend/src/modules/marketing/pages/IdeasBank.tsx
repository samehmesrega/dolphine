import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIdeas, createIdea, updateIdeaStatus, addIdeaComment, getIdea, getProjects } from '../services/marketing-api';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'جديدة', APPROVED: 'معتمدة', IN_PRODUCTION: 'قيد الإنتاج', DONE: 'مكتملة', REJECTED: 'مرفوضة',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-yellow-100 text-yellow-800', APPROVED: 'bg-green-100 text-green-800',
  IN_PRODUCTION: 'bg-blue-100 text-blue-800', DONE: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function IdeasBank() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['marketing', 'projects'],
    queryFn: () => getProjects(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['marketing', 'ideas'],
    queryFn: () => getIdeas(),
  });

  const { data: selectedData } = useQuery({
    queryKey: ['marketing', 'idea', selectedId],
    queryFn: () => getIdea(selectedId!),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: createIdea,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'ideas'] }); setShowForm(false); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateIdeaStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing'] }),
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => addIdeaComment(id, text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'idea', selectedId] }); setComment(''); },
  });

  const ideas = data?.data?.ideas ?? [];
  const projects = projectsData?.data?.projects ?? [];
  const selectedIdea = selectedData?.data?.idea;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      title: fd.get('title'),
      description: fd.get('description'),
      projectId: fd.get('projectId'),
      platform: fd.get('platform') || undefined,
      contentType: fd.get('contentType') || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">بنك الأفكار</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'إلغاء' : '+ فكرة جديدة'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label>
              <input name="title" required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المشروع</label>
              <select name="projectId" required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">اختر</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المنصة</label>
              <select name="platform" className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">غير محدد</option>
                <option value="meta">Meta</option>
                <option value="tiktok">TikTok</option>
                <option value="snapchat">Snapchat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نوع المحتوى</label>
              <select name="contentType" className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">غير محدد</option>
                <option value="UGC">UGC</option>
                <option value="product_shot">Product Shot</option>
                <option value="motion_graphics">Motion Graphics</option>
                <option value="testimonial">Testimonial</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
            <textarea name="description" required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">إضافة الفكرة</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ideas List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
          ) : ideas.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-xl border">لا توجد أفكار</div>
          ) : (
            ideas.map((idea: any) => (
              <div
                key={idea.id}
                onClick={() => setSelectedId(idea.id)}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 ${
                  selectedId === idea.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-slate-800">{idea.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[idea.status]}`}>
                    {STATUS_LABELS[idea.status]}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{idea.description}</p>
                <div className="flex gap-3 mt-2 text-xs text-slate-400">
                  <span>{idea.project?.name}</span>
                  <span>{idea.submitter?.name}</span>
                  <span>{idea._count?.comments ?? 0} تعليق</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Idea Detail Panel */}
        {selectedIdea && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 sticky top-4">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-800">{selectedIdea.title}</h2>
              <select
                value={selectedIdea.status}
                onChange={(e) => statusMutation.mutate({ id: selectedIdea.id, status: e.target.value })}
                className="border rounded px-2 py-1 text-xs"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <p className="text-slate-600 text-sm">{selectedIdea.description}</p>

            {/* Comments */}
            <div className="border-t pt-3 space-y-2">
              <h3 className="font-semibold text-sm text-slate-700">التعليقات</h3>
              {selectedIdea.comments?.map((c: any) => (
                <div key={c.id} className="bg-slate-50 rounded-lg p-2 text-sm">
                  <span className="font-medium text-slate-700">{c.user?.name}: </span>
                  <span className="text-slate-600">{c.text}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="أضف تعليق..."
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => comment && commentMutation.mutate({ id: selectedIdea.id, text: comment })}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm"
                >
                  إرسال
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
