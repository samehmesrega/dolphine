import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

type Customer = {
  id: string;
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">عملاء</h1>
        {isFetching && <span className="text-sm text-slate-500">جاري التحديث...</span>}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="بحث بالاسم أو رقم الجوال..."
            className="border rounded-lg px-3 py-2 min-w-[200px]"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-slate-500">جاري التحميل...</div>
        ) : !data?.customers?.length ? (
          <div className="p-8 text-slate-500">لا يوجد عملاء.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الاسم</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الجوال</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الليدز</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الطلبات</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">التاريخ</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-800">{c.name}</td>
                      <td className="py-3 px-4 text-slate-600 dir-ltr text-right">{c.phone}</td>
                      <td className="py-3 px-4 text-slate-600">{c._count.leads}</td>
                      <td className="py-3 px-4 text-slate-600">{c._count.orders}</td>
                      <td className="py-3 px-4 text-slate-500 text-sm">
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
                  className="px-3 py-1 border rounded disabled:opacity-50 text-slate-700"
                >
                  السابق
                </button>
                <span className="px-3 py-1 text-slate-600">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50 text-slate-700"
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
