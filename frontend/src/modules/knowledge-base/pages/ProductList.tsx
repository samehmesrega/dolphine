import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import * as kbApi from '../services/kb-api';

export default function ProductList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  const params: Record<string, string> = {};
  if (submittedSearch) params.q = submittedSearch;
  if (category) params.category = category;

  const { data, isLoading } = useQuery({
    queryKey: ['kb-products', params],
    queryFn: () => kbApi.getProducts(params),
  });

  const products = data?.data?.products ?? [];

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSubmittedSearch(search);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">المنتجات</h1>
        <Link
          to="/knowledge-base/products/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
        >
          + إضافة منتج
        </Link>
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
    </div>
  );
}
