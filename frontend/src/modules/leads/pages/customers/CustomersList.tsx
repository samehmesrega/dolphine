import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../shared/services/api';
import { useAuth } from '../../../auth/context/AuthContext';

type Customer = {
  id: string;
  number: number;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt: string;
  _count: { leads: number; orders: number };
};

async function fetchCustomers(params: { search?: string; page: number; pageSize: number }) {
  const { data } = await api.get('/customers', { params });
  return data as { total: number; page: number; pageSize: number; customers: Customer[] };
}

export default function CustomersList() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const canBulkDelete = ['super_admin', 'admin', 'sales_manager'].includes(currentUser?.role?.slug ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [deleteError, setDeleteError] = useState('');

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      page,
      pageSize,
    }),
    [search, page]
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['customers', queryParams],
    queryFn: () => fetchCustomers(queryParams),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const bulkDeleteMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      const { data } = await api.post('/customers/bulk-delete', { customerIds });
      return data as { deleted: number };
    },
    onSuccess: (data) => {
      setSelectedIds(new Set());
      setDeleteError('');
      qc.invalidateQueries({ queryKey: ['customers'] });
      alert(`تم حذف ${data.deleted} عميل بنجاح`);
    },
    onError: (err: any) => {
      setDeleteError(err.response?.data?.error || 'خطأ في حذف العملاء');
    },
  });

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} عميل؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    bulkDeleteMutation.mutate([...selectedIds]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.customers) return;
    const allIds = data.customers.map(c => c.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">عملاء</h1>
        {isFetching && <span className="text-sm text-slate-500">جاري التحديث...</span>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="بحث بالاسم أو رقم الجوال..."
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {canBulkDelete && selectedIds.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-red-700 font-medium">تم تحديد {selectedIds.size} عنصر</span>
          <div className="flex items-center gap-3">
            {deleteError && <span className="text-sm text-red-600">{deleteError}</span>}
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-sm text-slate-600 hover:text-slate-800">إلغاء التحديد</button>
            <button type="button" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
              {bulkDeleteMutation.isPending ? 'جاري الحذف...' : 'حذف المحدد'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-slate-500">جاري التحميل...</div>
        ) : !data?.customers?.length ? (
          <div className="p-8 text-slate-500">لا يوجد عملاء.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {canBulkDelete && (
                      <th className="px-3 py-3 w-10">
                        <input type="checkbox" checked={data.customers.every(c => selectedIds.has(c.id))}
                          onChange={toggleSelectAll} className="rounded border-slate-300" />
                      </th>
                    )}
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 hidden md:table-cell">#</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">الاسم</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">الجوال</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 hidden md:table-cell">الليدز</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 hidden md:table-cell">الطلبات</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 hidden md:table-cell">التاريخ</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c) => (
                    <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 ${selectedIds.has(c.id) ? 'bg-blue-50' : ''}`}>
                      {canBulkDelete && (
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-slate-300" />
                        </td>
                      )}
                      <td className="py-3 px-4 text-slate-400 text-sm hidden md:table-cell">#{c.number}</td>
                      <td className="py-3 px-4 text-slate-800">{c.name}</td>
                      <td className="py-3 px-4 text-slate-600 dir-ltr text-right">{c.phone}</td>
                      <td className="py-3 px-4 text-slate-600 hidden md:table-cell">{c._count.leads}</td>
                      <td className="py-3 px-4 text-slate-600 hidden md:table-cell">{c._count.orders}</td>
                      <td className="py-3 px-4 text-slate-500 text-sm hidden md:table-cell">
                        {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/customers/${c.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          تفاصيل
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 p-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2.5 border rounded-lg disabled:opacity-50 text-slate-700 text-sm min-h-[44px]"
                >
                  السابق
                </button>
                <span className="px-3 py-2.5 text-slate-600">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2.5 border rounded-lg disabled:opacity-50 text-slate-700 text-sm min-h-[44px]"
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
