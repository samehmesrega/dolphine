import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCreatives, deleteCreative, getProjects, getTags } from '../services/marketing-api';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  TESTING: 'تجربة',
  WINNER: 'فائز',
  LOSER: 'خاسر',
  PAUSED: 'متوقف',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  TESTING: 'bg-orange-100 text-orange-800',
  WINNER: 'bg-emerald-100 text-emerald-800',
  LOSER: 'bg-red-100 text-red-800',
  PAUSED: 'bg-slate-100 text-slate-800',
};

const TYPE_LABELS: Record<string, string> = {
  REEL: 'ريل',
  VIDEO: 'فيديو',
  STORY: 'ستوري',
  IMAGE: 'صورة',
  SESSION: 'سيشن',
};

// Extract Google Drive file ID from various URL formats
function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  // Format: /file/d/FILE_ID/... or /file/u/0/d/FILE_ID/...
  const match1 = url.match(/\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  // Format: ?id=FILE_ID
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  // Format: /open?id=FILE_ID
  const match3 = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
  if (match3) return match3[1];
  return null;
}

function getDriveThumbnail(url: string): string | null {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;
  return `https://lh3.googleusercontent.com/d/${fileId}=w400`;
}

function getDrivePreviewUrl(url: string): string | null {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export default function CreativeLibrary() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [previewCreative, setPreviewCreative] = useState<any>(null);
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['marketing', 'projects'],
    queryFn: () => getProjects(),
  });

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

      {/* Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
      ) : creatives.length === 0 ? (
        <div className="p-8 text-center text-slate-500">لا يوجد كرييتيف</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {creatives.map((c: any) => {
            const thumb = c.thumbnailUrl || getDriveThumbnail(c.driveUrl);
            const preview = getDrivePreviewUrl(c.driveUrl);
            const isVideo = ['VIDEO', 'REEL', 'STORY'].includes(c.type);

            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden group hover:shadow-lg transition-shadow"
              >
                {/* Thumbnail */}
                <div
                  className="relative aspect-[9/16] bg-slate-100 cursor-pointer overflow-hidden"
                  onClick={() => (preview || c.driveUrl) && setPreviewCreative(c)}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={c.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </div>
                  )}

                  {/* Video play icon overlay */}
                  {isVideo && preview && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-800 mr-[-2px]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Type badge */}
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 text-white rounded text-xs">
                    {TYPE_LABELS[c.type] ?? c.type}
                  </span>

                  {/* Status badge */}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-800'}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>

                {/* Info */}
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/marketing/creatives/${c.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-blue-600 truncate"
                    >
                      {c.name}
                    </Link>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 mr-2">{c.code}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{c.project?.name}</span>
                    <span>{c.photographerName || ''}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                    <button
                      onClick={() => { if (confirm('حذف هذا الكرييتيف؟')) deleteMutation.mutate(c.id); }}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-500">
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

      {/* Preview Modal */}
      {previewCreative && (() => {
        const pUrl = getDrivePreviewUrl(previewCreative.driveUrl);
        const pThumb = previewCreative.thumbnailUrl || getDriveThumbnail(previewCreative.driveUrl);
        const isImage = previewCreative.type === 'IMAGE';
        return (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewCreative(null)}
          >
            <div
              className="relative w-full max-w-2xl bg-black rounded-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewCreative(null)}
                className="absolute top-3 left-3 z-10 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
              >
                ✕
              </button>

              {/* Image type: show thumbnail directly */}
              {isImage && pThumb ? (
                <img src={pThumb} alt="" className="w-full max-h-[80vh] object-contain" referrerPolicy="no-referrer" />
              ) : pUrl ? (
                <iframe
                  src={pUrl}
                  className="w-full aspect-[9/16] max-h-[80vh]"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : pThumb ? (
                <img src={pThumb} alt="" className="w-full max-h-[80vh] object-contain" referrerPolicy="no-referrer" />
              ) : null}

              {/* Bottom bar with info + open in Drive */}
              <div className="bg-slate-900 p-3 flex items-center justify-between">
                <div className="text-white text-sm">
                  <span className="font-medium">{previewCreative.name}</span>
                  <span className="text-slate-400 text-xs mr-2">({previewCreative.code})</span>
                </div>
                {previewCreative.driveUrl && (
                  <a
                    href={previewCreative.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20"
                  >
                    فتح في Drive
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
