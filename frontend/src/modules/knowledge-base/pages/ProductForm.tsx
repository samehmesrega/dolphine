import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as kbApi from '../services/kb-api';

function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FF\w-]/g, '') // keep Arabic, alphanumeric, dashes
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  sku: '',
  description: '',
  category: '',
  dimensions: '',
  weight: '',
  driveFolderUrl: '',
};

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState(EMPTY_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Load existing product for edit mode
  const { data: existingData, isLoading: loadingExisting } = useQuery({
    queryKey: ['kb-product', id],
    queryFn: () => kbApi.getProduct(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingData?.data?.product) {
      const p = existingData.data.product;
      setForm({
        name: p.name ?? '',
        slug: p.slug ?? '',
        sku: p.sku ?? '',
        description: p.description ?? '',
        category: p.category ?? '',
        dimensions: p.dimensions ?? '',
        weight: p.weight != null ? String(p.weight) : '',
        driveFolderUrl: p.driveFolderUrl ?? '',
      });
      setSlugManuallyEdited(true); // Don't overwrite existing slug
    }
  }, [existingData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.createProduct(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['kb-products'] });
      const newId = res.data?.product?.id;
      navigate(newId ? `/knowledge-base/products/${newId}` : '/knowledge-base/products');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => kbApi.updateProduct(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-product', id] });
      qc.invalidateQueries({ queryKey: ['kb-products'] });
      navigate(`/knowledge-base/products/${id}`);
    },
  });

  const mutation = isEdit ? updateMutation : createMutation;

  const set = (key: string, val: string) => {
    setForm((f) => {
      const updated = { ...f, [key]: val };
      // Auto-generate slug from name unless manually edited
      if (key === 'name' && !slugManuallyEdited) {
        updated.slug = generateSlug(val);
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name,
      slug: form.slug || generateSlug(form.name),
      sku: form.sku || undefined,
      description: form.description || undefined,
      category: form.category || undefined,
      dimensions: form.dimensions || undefined,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      driveFolderUrl: form.driveFolderUrl || undefined,
    };
    mutation.mutate(payload);
  };

  if (isEdit && loadingExisting) {
    return <div className="p-8 text-slate-500" dir="rtl">جاري التحميل...</div>;
  }

  return (
    <div dir="rtl" className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          {isEdit ? 'تعديل المنتج' : 'منتج جديد'}
        </h1>
        <button
          onClick={() => navigate(isEdit ? `/knowledge-base/products/${id}` : '/knowledge-base/products')}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          رجوع
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">اسم المنتج *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="اسم المنتج"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              set('slug', e.target.value);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
            dir="ltr"
            placeholder="auto-generated-from-name"
          />
          <p className="text-xs text-slate-400 mt-1">يتم توليده تلقائياً من الاسم. يمكنك تعديله يدوياً.</p>
        </div>

        {/* SKU + Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
              dir="ltr"
              placeholder="PRD-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الفئة</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="مثال: إلكترونيات"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="وصف تفصيلي للمنتج..."
          />
        </div>

        {/* Dimensions + Weight */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الأبعاد</label>
            <input
              type="text"
              value={form.dimensions}
              onChange={(e) => set('dimensions', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="20x15x10 سم"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الوزن (كجم)</label>
            <input
              type="number"
              step="0.01"
              value={form.weight}
              onChange={(e) => set('weight', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="0.5"
            />
          </div>
        </div>

        {/* Drive Folder URL */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">رابط مجلد Google Drive</label>
          <input
            type="url"
            value={form.driveFolderUrl}
            onChange={(e) => set('driveFolderUrl', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            dir="ltr"
            placeholder="https://drive.google.com/drive/folders/..."
          />
        </div>

        {/* Error */}
        {mutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {(mutation.error as any)?.response?.data?.error || 'حدث خطأ أثناء الحفظ'}
          </p>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
          >
            {mutation.isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إنشاء المنتج'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/knowledge-base/products/${id}` : '/knowledge-base/products')}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
