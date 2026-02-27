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

const ORDER_STATUS_STYLE: Record<string, string> = {
  pending_accounts: 'bg-amber-50 text-amber-700 border-amber-200',
  accounts_confirmed: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
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
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">رقم الطلب</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">العميل / الشحن</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الدفع</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {o.wooCommerceId ? (
                          <span className="font-semibold text-blue-700">#{o.wooCommerceId}</span>
                        ) : (
                          <span className="text-slate-500">
                            #{o.number}
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100 mr-1">مؤقت</span>
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
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ORDER_STATUS_STYLE[o.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </td>
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
                  className="px-3 py-1 border rounded disabled:opacity-50 text-slate-700 text-sm transition-colors hover:bg-slate-50"
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
                  className="px-3 py-1 border rounded disabled:opacity-50 text-slate-700 text-sm transition-colors hover:bg-slate-50"
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
