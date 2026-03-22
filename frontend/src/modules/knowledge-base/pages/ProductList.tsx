import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import * as kbApi from '../services/kb-api';

export default function ProductList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  // Import modal state
  const [importModal, setImportModal] = useState(false);
  const [showWooImport, setShowWooImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDetails, setImportDetails] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params: Record<string, string> = {};
  if (submittedSearch) params.q = submittedSearch;
  if (category) params.category = category;

  const { data, isLoading } = useQuery({
    queryKey: ['kb-products', params],
    queryFn: () => kbApi.getProducts(params),
  });

  const products = data?.data?.products ?? [];

  const importMutation = useMutation({
    mutationFn: (formData: FormData) => kbApi.importProductFromJson(formData),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['kb-products'] });
      setImportModal(false);
      setImportFile(null);
      setImportError(null);
      setImportDetails([]);
      const newId = res.data?.product?.id;
      if (newId) navigate(`/knowledge-base/products/${newId}`);
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      setImportError(data?.error || 'حدث خطأ أثناء الاستيراد');
      setImportDetails(data?.details || []);
    },
  });

  // WooCommerce import
  const { data: wooData, isLoading: wooLoading, error: wooError } = useQuery({
    queryKey: ['woo-products'],
    queryFn: () => kbApi.getWooProducts(),
    enabled: showWooImport,
  });
  const wooProducts: any[] = wooData?.data?.products || [];

  const importWooMutation = useMutation({
    mutationFn: (wooId: number) => kbApi.importWooProduct(wooId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['kb-products'] });
      setShowWooImport(false);
      const product = res.data?.product;
      if (product) navigate(`/knowledge-base/products/${product.id}`);
    },
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSubmittedSearch(search);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await kbApi.downloadImportTemplate();
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product-template.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setImportError('حدث خطأ أثناء تحميل التمبليت');
    }
  };

  const handleImport = () => {
    if (!importFile) return;
    setImportError(null);
    setImportDetails([]);
    const formData = new FormData();
    formData.append('file', importFile);
    importMutation.mutate(formData);
  };

  const openImportModal = () => {
    setImportModal(true);
    setImportFile(null);
    setImportError(null);
    setImportDetails([]);
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">المنتجات</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWooImport(true)}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            استيراد من WooCommerce
          </button>
          <button
            onClick={openImportModal}
            className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            استيراد منتج
          </button>
          <Link
            to="/knowledge-base/products/new"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            + إضافة منتج
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <input
          type="text"
          placeholder="بحث بالاسم أو SKU... (Enter للبحث)"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <input
          type="text"
          placeholder="فلتر حسب الفئة..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button
          onClick={() => setSubmittedSearch(search)}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
        >
          بحث
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500">جاري التحميل...</div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-lg font-medium text-slate-600 mb-1">لا توجد منتجات</p>
          <p className="text-sm text-slate-400">أضف أول منتج!</p>
          <Link
            to="/knowledge-base/products/new"
            className="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            + إضافة منتج
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: any) => (
            <div
              key={product.id}
              onClick={() => navigate(`/knowledge-base/products/${product.id}`)}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow cursor-pointer group"
            >
              {/* Name & SKU */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                  {product.name}
                </h3>
                {product.sku && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono shrink-0 mr-2">
                    {product.sku}
                  </span>
                )}
              </div>

              {/* Category Badge */}
              {product.category && (
                <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs mb-3">
                  {product.category}
                </span>
              )}

              {/* Description preview */}
              {product.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
              )}

              {/* Counts */}
              <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {product._count?.media ?? product.mediaCount ?? 0} ملف
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {product._count?.faqs ?? product.faqCount ?? 0} سؤال
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {product._count?.variations ?? product.variationCount ?? 0} فاريشن
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setImportModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">استيراد منتج من ملف JSON</h2>
              <button onClick={() => setImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 mb-2">نزّل التمبليت وابعته لـ ChatGPT عشان يملاه ببيانات المنتج</p>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    تحميل التمبليت
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 mb-2">ارفع الملف بعد ما ChatGPT يملاه</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportError(null);
                      setImportDetails([]);
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 border border-dashed border-slate-300 text-slate-600 rounded-lg hover:border-emerald-400 hover:text-emerald-600 text-sm flex items-center gap-1.5 w-full justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {importFile ? importFile.name : 'اختر ملف JSON'}
                  </button>
                </div>
              </div>
            </div>

            {/* Error display */}
            {importError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium">{importError}</p>
                {importDetails.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-red-600 list-disc list-inside">
                    {importDetails.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setImportModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importMutation.isPending}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري الاستيراد...
                  </>
                ) : (
                  'استيراد'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WooCommerce Import Modal */}
      {showWooImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowWooImport(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] flex flex-col"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">استيراد منتج من WooCommerce</h2>
              <button onClick={() => setShowWooImport(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {wooLoading ? (
                <div className="p-8 text-center text-slate-500">
                  <svg className="animate-spin w-8 h-8 mx-auto mb-3 text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري تحميل المنتجات من WooCommerce...
                </div>
              ) : wooError ? (
                <div className="p-6 text-center">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-medium">
                      {(wooError as any)?.response?.data?.error || 'WooCommerce غير مربوط'}
                    </p>
                  </div>
                </div>
              ) : wooProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <p className="text-sm">لا توجد منتجات في WooCommerce</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wooProducts.map((wp: any) => (
                    <div
                      key={wp.id}
                      className="border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-800 truncate">{wp.name}</h3>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            {wp.sku && (
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">
                                SKU: {wp.sku}
                              </span>
                            )}
                            {wp.price && (
                              <span>السعر: {wp.price}</span>
                            )}
                            {wp.variations && wp.variations.length > 0 && (
                              <span>{wp.variations.length} فاريشن</span>
                            )}
                          </div>
                          {importWooMutation.isError && importWooMutation.variables === wp.id && (
                            <p className="mt-2 text-xs text-red-600">
                              {(importWooMutation.error as any)?.response?.data?.error || 'حدث خطأ أثناء الاستيراد'}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => importWooMutation.mutate(wp.id)}
                          disabled={importWooMutation.isPending && importWooMutation.variables === wp.id}
                          className="mr-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                        >
                          {importWooMutation.isPending && importWooMutation.variables === wp.id ? (
                            <>
                              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              جاري الاستيراد...
                            </>
                          ) : (
                            'استيراد'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowWooImport(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
