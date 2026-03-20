import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KbShell from './components/KbShell';

const ProductList = lazy(() => import('./pages/ProductList'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));

export default function KnowledgeBaseModule() {
  return (
    <KbShell>
      <Suspense fallback={<div className="text-center py-12 text-slate-500">جاري التحميل...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="products" replace />} />
          <Route path="products" element={<ProductList />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
        </Routes>
      </Suspense>
    </KbShell>
  );
}
