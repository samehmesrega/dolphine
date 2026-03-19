import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCreative, updateCreative } from '../services/marketing-api';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط', TESTING: 'تجربة', WINNER: 'فائز', LOSER: 'خاسر', PAUSED: 'متوقف',
};

const STATUSES = ['ACTIVE', 'TESTING', 'WINNER', 'LOSER', 'PAUSED'];

const TYPE_LABELS: Record<string, string> = {
  REEL: 'ريل', VIDEO: 'فيديو', STORY: 'ستوري', IMAGE: 'صورة', SESSION: 'سيشن',
};

function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  // Format: /file/d/FILE_ID or /file/u/0/d/FILE_ID
  const m1 = url.match(/\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

function getDriveThumbnail(url: string): string | null {
  const fileId = extractDriveFileId(url);
  return fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w600` : null;
}

function getDriveVideoUrl(url: string): string | null {
  const fileId = extractDriveFileId(url);
  return fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : null;
}

function getDrivePreviewUrl(url: string): string | null {
  const fileId = extractDriveFileId(url);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
}

export default function CreativeDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['marketing', 'creative', id],
    queryFn: () => getCreative(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateCreative(id!, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'creative', id] }),
  });

  if (isLoading) return <div className="p-8 text-slate-500">جاري التحميل...</div>;

  const creative = data?.data?.creative;
  if (!creative) return <div className="p-8 text-red-500">الكرييتيف غير موجود</div>;

  const performances = creative.performances ?? [];
  const totalSpend = performances.reduce((s: number, p: any) => s + p.spend, 0);
  const totalLeads = performances.reduce((s: number, p: any) => s + p.leads, 0);
  const totalOrders = performances.reduce((s: number, p: any) => s + p.orders, 0);
  const totalRevenue = performances.reduce((s: number, p: any) => s + p.revenue, 0);

  const thumb = creative.thumbnailUrl || getDriveThumbnail(creative.driveUrl);
  const previewUrl = getDrivePreviewUrl(creative.driveUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/marketing/creatives" className="hover:text-blue-600">مكتبة الكرييتيف</Link>
        <span>/</span>
        <span>{creative.code}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Preview / Thumbnail */}
          {(thumb || previewUrl) && (
            <div
              className="bg-black rounded-xl overflow-hidden cursor-pointer relative group"
              onClick={() => previewUrl && setShowPreview(true)}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={creative.name}
                  className="w-full max-h-[500px] object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="aspect-video bg-slate-900 flex items-center justify-center text-slate-500">
                  اضغط للمشاهدة
                </div>
              )}
              {previewUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-800 mr-[-3px]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{creative.name}</h1>
                <p className="text-sm text-slate-500 font-mono mt-1">{creative.code}</p>
              </div>
              <select
                value={creative.status}
                onChange={(e) => statusMutation.mutate(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {creative.description && (
              <p className="text-slate-600 mt-3">{creative.description}</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <span className="text-slate-500">المشروع</span>
                <p className="font-medium">{creative.project?.name}</p>
              </div>
              <div>
                <span className="text-slate-500">المنتج</span>
                <p className="font-medium">{creative.product?.name ?? '—'}</p>
              </div>
              <div>
                <span className="text-slate-500">النوع</span>
                <p className="font-medium">{TYPE_LABELS[creative.type] ?? creative.type}</p>
              </div>
              <div>
                <span className="text-slate-500">اللغة</span>
                <p className="font-medium">{creative.language === 'ar' ? 'عربي' : 'English'}</p>
              </div>
              <div>
                <span className="text-slate-500">المصور</span>
                <p className="font-medium">{creative.photographerName || '—'}</p>
              </div>
              <div>
                <span className="text-slate-500">التاريخ</span>
                <p className="font-medium">{new Date(creative.createdAt).toLocaleDateString('ar-SA')}</p>
              </div>
            </div>

            {creative.driveUrl && (
              <button
                onClick={() => previewUrl && setShowPreview(true)}
                className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
              >
                مشاهدة الكرييتيف
              </button>
            )}
          </div>

          {/* Tags */}
          {creative.tags?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-700 mb-2">التاجز</h3>
              <div className="flex flex-wrap gap-2">
                {creative.tags.map((ct: any) => (
                  <span key={ct.id} className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
                    {ct.tag?.category?.name ? `${ct.tag.category.name}: ` : ''}{ct.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Performance Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-700 mb-3">الأداء (آخر 30 يوم)</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">الإنفاق</span>
                <span className="font-medium">${totalSpend.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">ليدز</span>
                <span className="font-medium">{totalLeads}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">طلبات</span>
                <span className="font-medium">{totalOrders}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">إيرادات</span>
                <span className="font-medium">${totalRevenue.toFixed(2)}</span>
              </div>
              {totalSpend > 0 && (
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-slate-500">ROAS</span>
                  <span className="font-bold text-green-600">
                    {(totalRevenue / totalSpend).toFixed(2)}x
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (() => {
        const isImage = creative.type === 'IMAGE';
        return (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowPreview(false)}
          >
            <div
              className="relative w-full max-w-2xl bg-black rounded-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-3 left-3 z-10 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
              >
                ✕
              </button>

              {isImage && thumb ? (
                <img src={thumb} alt="" className="w-full max-h-[80vh] object-contain" referrerPolicy="no-referrer" />
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full aspect-[9/16] max-h-[80vh]"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : thumb ? (
                <img src={thumb} alt="" className="w-full max-h-[80vh] object-contain" referrerPolicy="no-referrer" />
              ) : null}

              {/* Bottom bar with info + open in Drive */}
              <div className="bg-slate-900 p-3 flex items-center justify-between">
                <div className="text-white text-sm">
                  <span className="font-medium">{creative.name}</span>
                  <span className="text-slate-400 text-xs mr-2">({creative.code})</span>
                </div>
                {creative.driveUrl && (
                  <a
                    href={creative.driveUrl}
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
