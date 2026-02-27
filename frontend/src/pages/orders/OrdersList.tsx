import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

type Order = {
  id: string;
  number: number;
  wooCommerceId?: number | null;
  status: string;
  paymentType: string;
  shippingName: string;
  shippingPhone: string;
  createdAt: string;
  lead?: { id: string; name: string };
  customer?: { id: string; name: string; phone: string };
  orderItems: { quantity: number; price: number; product?: { name: string }; productName?: string | null }[];
};

async function fetchOrders(params: { status?: string; page: number; pageSize: number }) {
  const { data } = await api.get('/orders', { params });
  return data as { total: number; page: number; pageSize: number; orders: Order[] };
}

const STATUS_LABELS: Record<string, string> = {
  pending_accounts: 'بانتظار الحسابات',
  accounts_confirmed: 'مؤكد من الحسابات',
  rejected: 'مرفوض',
};

export default function OrdersList({ defaultStatus }: { defaultStatus?: string }) {
  const [status, setStatus] = useState(defaultStatus ?? '');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const queryParams = useMemo(
    () => ({
      status: status || undefined,
      page,
      pageSize,
    }),
    [status, page]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['orders', queryParams],
    queryFn: () => fetchOrders(queryParams),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {defaultStatus === 'pending_accounts' ? 'طلبات بانتظار الحسابات' : 'طلبات'}
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          {!defaultStatus && (
            <select
              className="border rounded-lg px-3 py-2"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">كل الحالات</option>
              <option value="pending_accounts">بانتظار الحسابات</option>
              <option value="accounts_confirmed">مؤكد من الحسابات</option>
              <option value="rejected">مرفوض</option>
            </select>
          )}
          <span className="text-slate-500 text-sm">الإجمالي: {data?.total ?? '--'}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-slate-500">جاري التحميل...</div>
        ) : !data?.orders?.length ? (
          <div className="p-8 text-slate-500">لا توجد طلبات.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">رقم الطلب</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">التاريخ</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">العميل / الشحن</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الحالة</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الدفع</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs">
                        {o.wooCommerceId ? (
                          <span className="text-blue-700 font-semibold">#{o.wooCommerceId}</span>
                        ) : (
                          <span className="text-slate-500">
                            #{o.number} <span className="text-orange-400 text-[10px]">مؤقت</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(o.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">{o.shippingName}</span>
                        <span className="text-slate-500 text-xs block">{o.shippingPhone}</span>
                      </td>
                      <td className="py-3 px-4">{STATUS_LABELS[o.status] ?? o.status}</td>
                      <td className="py-3 px-4">{o.paymentType === 'full' ? 'كامل' : 'جزئي'}</td>
                      <td className="py-3 px-4">
                        <Link to={`/orders/${o.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
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
