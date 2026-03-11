import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompetitors, createCompetitor, deleteCompetitor } from '../services/marketing-api';

export default function CompetitorLibrary() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['marketing', 'competitors'],
    queryFn: () => getCompetitors(),
  });

  const createMutation = useMutation({
    mutationFn: createCompetitor,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing', 'competitors'] }); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompetitor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'competitors'] }),
  });

  const references = data?.data?.references ?? [];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      title: fd.get('title'),
      url: fd.get('url'),
      competitorName: fd.get('competitorName') || undefined,
      platform: fd.get('platform'),
      notes: fd.get('notes') || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">مراجع المنافسين</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'إلغاء' : '+ مرجع جديد'}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">الرابط</label>
              <input name="url" type="url" required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اسم المنافس</label>
              <input name="competitorName" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المنصة</label>
              <select name="platform" required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="meta">Meta</option>
                <option value="tiktok">TikTok</option>
                <option value="snapchat">Snapchat</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea name="notes" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">إضافة المرجع</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-slate-500">جاري التحميل...</div>
        ) : references.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-xl border">لا توجد مراجع</div>
        ) : (
          references.map((ref: any) => (
            <div key={ref.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-slate-800">{ref.title}</h3>
                <button
                  onClick={() => { if (confirm('حذف هذا المرجع؟')) deleteMutation.mutate(ref.id); }}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  حذف
                </button>
              </div>
              {ref.competitorName && <p className="text-xs text-slate-500 mt-1">{ref.competitorName}</p>}
              <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{ref.platform}</span>
              {ref.notes && <p className="text-sm text-slate-600 mt-2 line-clamp-3">{ref.notes}</p>}
              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="block mt-3 text-blue-600 hover:underline text-sm">
                فتح الرابط
              </a>
              <p className="text-xs text-slate-400 mt-2">بواسطة {ref.adder?.name}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
