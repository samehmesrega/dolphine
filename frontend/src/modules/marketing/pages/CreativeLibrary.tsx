import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCreatives, deleteCreative, getProjects, getTags } from '../services/marketing-api';

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'مطلوب',
  IN_PRODUCTION: 'قيد الإنتاج',
  DONE: 'جاهز',
  PUBLISHED: 'منشور',
  TESTING: 'تجربة',
  WINNER: 'فائز',
  LOSER: 'خاسر',
};

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  IN_PRODUCTION: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
  PUBLISHED: 'bg-purple-100 text-purple-800',
  TESTING: 'bg-orange-100 text-orange-800',
  WINNER: 'bg-emerald-100 text-emerald-800',
  LOSER: 'bg-red-100 text-red-800',
};

const TYPE_LABELS: Record<string, string> = {
  IMAGE: 'صورة',
  VIDEO: 'فيديو',
  CAROUSEL: 'كاروسيل',
  REEL: 'ريل',
};

export default function CreativeLibrary() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['marketing', 'projects'],
    queryFn: () => getProjects(),
  });

  // Tags preloaded for future tag filter
  useQuery({ queryKey: ['marketing', 'tags'], queryFn: () => getTags() });

  const { data, isLoading } = useQuery({
    queryKey: ['marketing', 'creatives', filters, page],
    queryFn: () => getCreatives({ ...filters, page: String(page), pageSize: '25' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCreative,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'creatives'] }),
  });

  const creatives = data?.data?.creatives ?? [];
  const total = data?.data?.total ?? 0;
  const projects = projectsData?.data?.projects ?? [];
  // const categories = tagsData?.data?.categories ?? []; // TODO: use for tag filter

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">مكتبة الكرييتيف</h1>
        <Link
          to="/marketing/creatives/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + كرييتيف جديد
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filters.projectId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setFilters((f) => val ? { ...f, projectId: val } : (() => { const { projectId, ...rest } = f; return rest; })());
            setPage(1);
          }}
        >
          <option value="">كل المشاريع</option>
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filters.status ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setFilters((f) => val ? { ...f, status: val } : (() => { const { status, ...rest } = f; return rest; })());
            setPage(1);
          }}
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={filters.type ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setFilters((f) => val ? { ...f, type: val } : (() => { const { type, ...rest } = f; return rest; })());
            setPage(1);
          }}
        >
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="بحث بالاسم أو الكود..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          value={filters.search ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setFilters((f) => val ? { ...f, search: val } : (() => { const { search, ...rest } = f; return rest; })());
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-right p-3 font-medium text-slate-600">الكود</th>
              <th className="text-right p-3 font-medium text-slate-600">الاسم</th>
              <th className="text-right p-3 font-medium text-slate-600">النوع</th>
              <th className="text-right p-3 font-medium text-slate-600">المشروع</th>
              <th className="text-right p-3 font-medium text-slate-600">الحالة</th>
              <th className="text-right p-3 font-medium text-slate-600">المنشئ</th>
              <th className="text-right p-3 font-medium text-slate-600">التاريخ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
            ) : creatives.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">لا يوجد كرييتيف</td></tr>
            ) : (
              creatives.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs">{c.code}</td>
                  <td className="p-3">
                    <Link to={`/marketing/creatives/${c.id}`} className="text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="p-3">{TYPE_LABELS[c.type] ?? c.type}</td>
                  <td className="p-3">{c.project?.name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ''}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="p-3">{c.creator?.name}</td>
                  <td className="p-3 text-slate-500 text-xs">
                    {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => { if (confirm('حذف هذا الكرييتيف؟')) deleteMutation.mutate(c.id); }}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-slate-200 text-sm text-slate-500">
          <span>الإجمالي: {total}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              السابق
            </button>
            <button
              disabled={creatives.length < 25}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
