import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCreative, updateCreative } from '../services/marketing-api';

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'مطلوب', IN_PRODUCTION: 'قيد الإنتاج', DONE: 'جاهز',
  PUBLISHED: 'منشور', TESTING: 'تجربة', WINNER: 'فائز', LOSER: 'خاسر',
};

const STATUSES = ['REQUESTED', 'IN_PRODUCTION', 'DONE', 'PUBLISHED', 'TESTING', 'WINNER', 'LOSER'];

export default function CreativeDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

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
                <p className="font-medium">{creative.type}</p>
              </div>
              <div>
                <span className="text-slate-500">اللغة</span>
                <p className="font-medium">{creative.language === 'ar' ? 'عربي' : 'English'}</p>
              </div>
              <div>
                <span className="text-slate-500">المنشئ</span>
                <p className="font-medium">{creative.creator?.name}</p>
              </div>
              <div>
                <span className="text-slate-500">التاريخ</span>
                <p className="font-medium">{new Date(creative.createdAt).toLocaleDateString('ar-SA')}</p>
              </div>
            </div>

            {creative.driveUrl && (
              <a
                href={creative.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
              >
                فتح في Google Drive
              </a>
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
    </div>
  );
}
