import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as mktApi from '../services/marketing-api';
import api from '../../../shared/services/api';

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

  // Fetch KB products for AI generation form
  const { data: kbProductsData } = useQuery({
    queryKey: ['kb-products-for-lp'],
    queryFn: () => api.get('/knowledge-base/products'),
    enabled: showCreate && createMode === 'ai',
  });

  // Fetch order form templates for AI generation form
  const { data: orderFormsData } = useQuery({
    queryKey: ['order-forms-for-lp'],
    queryFn: () => mktApi.getOrderForms(),
    enabled: showCreate && createMode === 'ai',
  });

  // Fetch AI models grouped by provider
  const { data: aiModelsData } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => mktApi.getAiModels(),
    enabled: showCreate && createMode === 'ai',
  });

  const pages: any[] = pagesData?.data?.landingPages || [];
  const brands: any[] = brandsData?.data?.brands || [];
  const kbProducts: any[] = kbProductsData?.data?.products || [];
  const orderForms: any[] = orderFormsData?.data?.templates || orderFormsData?.data?.orderForms || [];
  const aiModelsGroups: any[] = aiModelsData?.data?.models || [];

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
    kbProductId: '',
    formTemplateId: '',
    aiProvider: '',
    aiModel: '',
    codPayment: true,
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

  const handleKbProductSelect = (productId: string) => {
    if (productId) {
      const product = kbProducts.find((p: any) => p.id === productId);
      if (product) {
        const slug = product.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        setForm({
          ...form,
          kbProductId: productId,
          title: product.name,
          slug,
          productName: '',
          productDescription: '',
          productPrice: '',
        });
      }
    } else {
      setForm({ ...form, kbProductId: '', title: '', slug: '' });
    }
  };

  const handleFormTemplateSelect = (templateId: string) => {
    setForm({
      ...form,
      formTemplateId: templateId,
      formFields: templateId ? '' : 'name,phone',
      codPayment: true,
    });
  };

  const handleAiModelSelect = (value: string) => {
    // value format: "provider::modelId"
    if (value) {
      const [provider, model] = value.split('::');
      setForm({ ...form, aiProvider: provider, aiModel: model });
    } else {
      setForm({ ...form, aiProvider: '', aiModel: '' });
    }
  };

  const selectedTemplate = orderForms.find((t: any) => t.id === form.formTemplateId);

  const handleSubmit = () => {
    const brandObj = brands.find((b: any) => b.id === form.brandId);
    if (createMode === 'ai') {
      generateMutation.mutate({
        ...form,
        storeName: brandObj?.name || '',
        formFields: form.formTemplateId
          ? undefined
          : form.formFields.split(',').map((f) => f.trim()),
        kbProductId: form.kbProductId || undefined,
        formTemplateId: form.formTemplateId || undefined,
        aiProvider: form.aiProvider || undefined,
        aiModel: form.aiModel || undefined,
        codPayment: form.formTemplateId ? form.codPayment : undefined,
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
              {/* KB Product Picker — AI mode only, at the top */}
              {createMode === 'ai' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    اختر منتج من بنك المعلومات (اختياري)
                  </label>
                  <select
                    value={form.kbProductId}
                    onChange={(e) => handleKbProductSelect(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">— بدون —</option>
                    {kbProducts.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {!form.kbProductId && (
                    <p className="text-xs text-gray-400 mt-1">أو أدخل البيانات يدوياً</p>
                  )}
                </div>
              )}

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
                  {/* Manual product fields — hidden when KB product selected */}
                  {!form.kbProductId && (
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
                    </>
                  )}

                  {/* Order Form Template Picker */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      اختر نموذج الشراء (اختياري)
                    </label>
                    <select
                      value={form.formTemplateId}
                      onChange={(e) => handleFormTemplateSelect(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="">— بدون نموذج —</option>
                      {orderForms.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {selectedTemplate?.fields && selectedTemplate.fields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedTemplate.fields.map((f: any, i: number) => (
                          <span
                            key={i}
                            className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full"
                          >
                            {f.fieldName || f.label || f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Method — shown only when form template is selected */}
                  {form.formTemplateId && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="codPayment"
                        checked={form.codPayment}
                        onChange={(e) => setForm({ ...form, codPayment: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="codPayment" className="text-sm">
                        الدفع عند الاستلام
                      </label>
                    </div>
                  )}

                  {/* AI Model Picker */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      اختر موديل الذكاء الاصطناعي
                    </label>
                    <select
                      value={form.aiProvider && form.aiModel ? `${form.aiProvider}::${form.aiModel}` : ''}
                      onChange={(e) => handleAiModelSelect(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="">اختر موديل</option>
                      {aiModelsGroups.map((group: any) => (
                        <optgroup key={group.provider} label={`— ${group.provider} —`}>
                          {(group.models || []).map((m: any) => (
                            <option key={m.id} value={`${group.provider}::${m.id}`}>
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
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

                  {/* Manual form fields — hidden when form template selected */}
                  {!form.formTemplateId && (
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
                  )}
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
