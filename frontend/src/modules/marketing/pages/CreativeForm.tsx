import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  createCreative,
  getProjects,
  getProjectProducts,
  getTags,
  getCreativeCodeConfig,
} from '../services/marketing-api';

const TYPE_OPTIONS = [
  { value: 'REEL', label: 'ريل' },
  { value: 'VIDEO', label: 'فيديو' },
  { value: 'STORY', label: 'ستوري' },
  { value: 'IMAGE', label: 'صورة' },
  { value: 'SESSION', label: 'سيشن' },
];

const LANG_OPTIONS = [
  { value: 'ar', label: 'عربي' },
  { value: 'en', label: 'إنجليزي' },
];

// Map form field values to code config segment values
function buildCodeSegments(
  segments: any[],
  language: string,
  projectName: string,
  productName: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const seg of segments) {
    const segNameLower = seg.name.toLowerCase();
    let match: any;

    if (segNameLower.includes('lang')) {
      // Match by label: "Arabic" → ar, "English" → en
      match = seg.values.find((v: any) => {
        const label = v.label.toLowerCase();
        if (language === 'ar') return label.includes('arab');
        if (language === 'en') return label.includes('eng');
        return false;
      });
    } else if (segNameLower.includes('project')) {
      match = seg.values.find(
        (v: any) => v.label.toLowerCase() === projectName.toLowerCase(),
      );
    } else if (segNameLower.includes('product')) {
      match = seg.values.find(
        (v: any) => v.label.toLowerCase() === productName.toLowerCase(),
      );
    }

    if (match) {
      result[seg.name] = match.code;
    }
  }
  return result;
}

export default function CreativeForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'REEL',
    driveUrl: '',
    projectId: '',
    productId: '',
    language: 'ar',
    photographerName: '',
    tagIds: [] as string[],
  });

  const { data: projectsData } = useQuery({
    queryKey: ['marketing', 'projects'],
    queryFn: () => getProjects(),
  });

  const { data: productsData } = useQuery({
    queryKey: ['marketing', 'products', form.projectId],
    queryFn: () => getProjectProducts(form.projectId),
    enabled: !!form.projectId,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['marketing', 'tags'],
    queryFn: () => getTags(),
  });

  const { data: codeConfigData } = useQuery({
    queryKey: ['marketing', 'creative-code-config'],
    queryFn: () => getCreativeCodeConfig(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => createCreative(data),
    onSuccess: () => navigate('/marketing/creatives'),
  });

  const projects = projectsData?.data?.projects ?? [];
  const products = productsData?.data?.products ?? [];
  const tagCategories = tagsData?.data?.categories ?? [];
  const segments: any[] = codeConfigData?.data?.config?.segments ?? [];

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const selectedProject = projects.find((p: any) => p.id === form.projectId);
  const selectedProduct = products.find((p: any) => p.id === form.productId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-build codeSegments from selected language/project/product
    const codeSegments = buildCodeSegments(
      segments,
      form.language,
      selectedProject?.name ?? '',
      selectedProduct?.name ?? '',
    );

    mutation.mutate({
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      driveUrl: form.driveUrl || undefined,
      photographerName: form.photographerName || undefined,
      projectId: form.projectId,
      productId: form.productId || undefined,
      language: form.language,
      tagIds: form.tagIds.length ? form.tagIds : undefined,
      codeSegments,
    });
  };

  const toggleTag = (tagId: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter((t) => t !== tagId)
        : [...f.tagIds, tagId],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">كرييتيف جديد</h1>
        <button
          onClick={() => navigate('/marketing/creatives')}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          رجوع
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الاسم *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="اسم الكرييتيف"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="وصف اختياري"
          />
        </div>

        {/* Type + Language */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">النوع *</label>
            <select
              required
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اللغة *</label>
            <select
              required
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Project + Product */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المشروع *</label>
            <select
              required
              value={form.projectId}
              onChange={(e) => {
                set('projectId', e.target.value);
                set('productId', '');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">اختر المشروع</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المنتج</label>
            <select
              value={form.productId}
              onChange={(e) => set('productId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              disabled={!form.projectId}
            >
              <option value="">اختر المنتج (اختياري)</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drive URL */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">رابط Google Drive</label>
          <input
            type="url"
            value={form.driveUrl}
            onChange={(e) => set('driveUrl', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://drive.google.com/..."
            dir="ltr"
          />
        </div>

        {/* Photographer */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">المصور</label>
          <input
            type="text"
            value={form.photographerName}
            onChange={(e) => set('photographerName', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="اسم المصور (اختياري)"
          />
        </div>

        {/* Tags */}
        {tagCategories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">التاجز</label>
            <div className="space-y-3">
              {tagCategories.map((cat: any) => (
                <div key={cat.id}>
                  <p className="text-xs text-slate-500 mb-1">{cat.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {(cat.tags ?? []).map((tag: any) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1 rounded-full text-xs border transition ${
                          form.tagIds.includes(tag.id)
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {mutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {(mutation.error as any)?.response?.data?.error || 'حدث خطأ'}
          </p>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'إنشاء الكرييتيف'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/marketing/creatives')}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
