import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as mktApi from '../services/marketing-api';

export default function LandingPages() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'ai' | 'manual'>('ai');

  const { data: pagesData } = useQuery({
    queryKey: ['landing-pages'],
    queryFn: () => mktApi.getLandingPages(),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => mktApi.getBrands(),
  });

  const pages: any[] = pagesData?.data?.landingPages || [];
  const brands: any[] = brandsData?.data?.brands || [];

  // AI Generate form state
  const [form, setForm] = useState({
    title: '',
    slug: '',
    brandId: '',
    productName: '',
    productDescription: '',
    productPrice: '',
    language: 'ar',
    instructions: '',
    formFields: 'name,phone',
  });

  const generateMutation = useMutation({
    mutationFn: (data: any) => mktApi.generateLandingPage(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      setShowCreate(false);
      const lp = res.data?.landingPage;
      if (lp) navigate(`/marketing/landing-pages/${lp.id}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => mktApi.createLandingPage(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      setShowCreate(false);
      const lp = res.data?.landingPage;
      if (lp) navigate(`/marketing/landing-pages/${lp.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mktApi.deleteLandingPage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['landing-pages'] }),
  });

  const handleSubmit = () => {
    const brandObj = brands.find((b: any) => b.id === form.brandId);
    if (createMode === 'ai') {
      generateMutation.mutate({
        ...form,
        storeName: brandObj?.name || '',
        formFields: form.formFields.split(',').map((f) => f.trim()),
      });
    } else {
      createMutation.mutate({
        title: form.title,
        slug: form.slug,
        brandId: form.brandId,
      });
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    ARCHIVED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">صفحات الهبوط</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
        >
          + صفحة جديدة
        </button>
      </div>

      {/* Pages Grid */}
      {pages.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
          <p className="text-lg mb-2">لا توجد صفحات هبوط بعد</p>
          <p className="text-sm">أنشئ صفحة جديدة باستخدام AI أو يدوياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {pages.map((page: any) => (
            <div
              key={page.id}
              className="bg-white rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/marketing/landing-pages/${page.id}`)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{page.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[page.status] || 'bg-gray-100'}`}>
                    {page.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{page.brand?.name}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>/{page.slug}</span>
                  <span>{page._count?.versions || 0} versions</span>
                </div>
              </div>
              <div className="border-t px-4 py-2 flex justify-end gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('حذف هذه الصفحة؟')) deleteMutation.mutate(page.id);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">صفحة هبوط جديدة</h2>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCreateMode('ai')}
                className={`px-3 py-1 rounded text-sm ${createMode === 'ai' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}
              >
                إنشاء بالـ AI
              </button>
              <button
                onClick={() => setCreateMode('manual')}
                className={`px-3 py-1 rounded text-sm ${createMode === 'manual' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}
              >
                إنشاء يدوي
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">العنوان</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Dual Name - Ramadan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  dir="ltr"
                  placeholder="dual-name-ramadan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">البراند</label>
                <select
                  value={form.brandId}
                  onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">اختر براند</option>
                  {brands.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {createMode === 'ai' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">اسم المنتج</label>
                    <input
                      value={form.productName}
                      onChange={(e) => setForm({ ...form, productName: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">وصف المنتج</label>
                    <textarea
                      value={form.productDescription}
                      onChange={(e) => setForm({ ...form, productDescription: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">السعر</label>
                    <input
                      value={form.productPrice}
                      onChange={(e) => setForm({ ...form, productPrice: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="199 SAR"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">اللغة</label>
                    <select
                      value={form.language}
                      onChange={(e) => setForm({ ...form, language: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="ar">عربي</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">تعليمات إضافية</label>
                    <textarea
                      value={form.instructions}
                      onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={2}
                      placeholder="ألوان محددة، ستايل معين..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">حقول الفورم (مفصولة بفاصلة)</label>
                    <input
                      value={form.formFields}
                      onChange={(e) => setForm({ ...form, formFields: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                      dir="ltr"
                      placeholder="name, phone, email, city"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSubmit}
                disabled={generateMutation.isPending || createMutation.isPending || !form.title || !form.slug || !form.brandId}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {generateMutation.isPending || createMutation.isPending
                  ? 'جاري الإنشاء...'
                  : createMode === 'ai'
                  ? 'إنشاء بالـ AI'
                  : 'إنشاء'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="border px-4 py-2 rounded text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
