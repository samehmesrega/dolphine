import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

type Product = {
  id: string;
  name: string;
  wooCommerceId?: number | null;
};

async function fetchProducts() {
  const { data } = await api.get('/products');
  return data.products as Product[];
}

async function fetchHiddenProducts() {
  const { data } = await api.get('/products/hidden');
  return data.products as Product[];
}

async function syncProductsFromWooCommerce() {
  const { data } = await api.post('/woocommerce/sync-products');
  return data as { success: boolean; synced: number };
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
  const { data: hiddenProducts = [], isLoading: loadingHidden } = useQuery({
    queryKey: ['products-hidden'],
    queryFn: fetchHiddenProducts,
  });

  const invalidateProducts = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['products-hidden'] });
  };

  const syncMutation = useMutation({
    mutationFn: syncProductsFromWooCommerce,
    onSuccess: invalidateProducts,
  });

  const hideMutation = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/hide`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['products'] });
      await qc.cancelQueries({ queryKey: ['products-hidden'] });
      const prevActive = qc.getQueryData<Product[]>(['products']);
      const prevHidden = qc.getQueryData<Product[]>(['products-hidden']);
      const product = prevActive?.find((p) => p.id === id);
      if (product) {
        qc.setQueryData(['products'], (old: Product[] = []) => old.filter((p) => p.id !== id));
        qc.setQueryData(['products-hidden'], (old: Product[] = []) => [...(old || []), product].sort((a, b) => a.name.localeCompare(b.name)));
      }
      return { prevActive, prevHidden };
    },
    onSuccess: () => {
      invalidateProducts();
      // تأكد من إعادة جلب القوائم بعد النجاح
      qc.refetchQueries({ queryKey: ['products'] });
      qc.refetchQueries({ queryKey: ['products-hidden'] });
    },
    onError: (_err, _id, context) => {
      if (context?.prevActive != null) qc.setQueryData(['products'], context.prevActive);
      if (context?.prevHidden != null) qc.setQueryData(['products-hidden'], context.prevHidden);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/restore`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['products'] });
      await qc.cancelQueries({ queryKey: ['products-hidden'] });
      const prevActive = qc.getQueryData<Product[]>(['products']);
      const prevHidden = qc.getQueryData<Product[]>(['products-hidden']);
      const product = prevHidden?.find((p) => p.id === id);
      if (product) {
        qc.setQueryData(['products-hidden'], (old: Product[] = []) => old.filter((p) => p.id !== id));
        qc.setQueryData(['products'], (old: Product[] = []) => [...(old || []), product].sort((a, b) => a.name.localeCompare(b.name)));
      }
      return { prevActive, prevHidden };
    },
    onSuccess: invalidateProducts,
    onError: (_err, _id, context) => {
      if (context?.prevActive != null) qc.setQueryData(['products'], context.prevActive);
      if (context?.prevHidden != null) qc.setQueryData(['products-hidden'], context.prevHidden);
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">منتجات</h1>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <p className="text-slate-500 text-sm">
          المنتجات تُجلب من ووكومرس. استخدم «تحديث من ووكومرس» لمزامنة القائمة.
        </p>
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          {syncMutation.isPending ? 'جاري المزامنة...' : 'تحديث من ووكومرس'}
        </button>
        {syncMutation.isSuccess && <span className="text-green-600 text-sm">تم مزامنة {syncMutation.data?.synced ?? 0} منتج</span>}
        {syncMutation.isError && <span className="text-red-600 text-sm">{(syncMutation.error as any)?.response?.data?.error || 'فشل المزامنة'}</span>}
        {hideMutation.isError && <span className="text-red-600 text-sm">{(hideMutation.error as any)?.response?.data?.error || 'فشل تحويل المنتج لغير نشط'}</span>}
        {restoreMutation.isError && <span className="text-red-600 text-sm">{(restoreMutation.error as any)?.response?.data?.error || 'فشل التفعيل'}</span>}
      </div>

      {/* منتجات نشطة */}
      <section className="bg-white rounded-xl shadow overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-800 p-4 border-b border-slate-200">منتجات نشطة</h2>
        {isLoading ? (
          <div className="p-8 text-slate-500">جاري التحميل...</div>
        ) : !products.length ? (
          <div className="p-8 text-slate-500">لا توجد منتجات نشطة. استخدم «تحديث من ووكومرس» أو استعد منتجات من «منتجات غير نشطة».</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">الاسم</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">معرف ووكومرس</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 w-28">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-800">{p.name}</td>
                    <td className="py-3 px-4 text-slate-600">{p.wooCommerceId ?? '—'}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('تحويل هذا المنتج إلى غير نشط؟ (سيبقى في ووكومرس)')) {
                            hideMutation.mutate(p.id);
                          }
                        }}
                        disabled={hideMutation.isPending}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        {hideMutation.isPending ? 'جاري...' : 'تحويل لغير نشط'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* منتجات غير نشطة */}
      <section className="bg-white rounded-xl shadow overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-800 p-4 border-b border-slate-200">منتجات غير نشطة</h2>
        {loadingHidden ? (
          <div className="p-8 text-slate-500">جاري التحميل...</div>
        ) : !hiddenProducts.length ? (
          <div className="p-8 text-slate-500">لا توجد منتجات غير نشطة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">الاسم</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">معرف ووكومرس</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 w-28">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {hiddenProducts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-600">{p.name}</td>
                    <td className="py-3 px-4 text-slate-500">{p.wooCommerceId ?? '—'}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          restoreMutation.reset();
                          restoreMutation.mutate(p.id);
                        }}
                        disabled={restoreMutation.isPending}
                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        {restoreMutation.isPending ? 'جاري...' : 'تفعيل'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
