import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../shared/services/api';

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  productName?: string | null;
  product?: { id: string; name: string } | null;
};

type Order = {
  id: string;
  number: number;
  status: string;
  accountsStatus: string;
  wooCommerceId?: number | null;
  paymentType: string;
  transferImage?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress?: string | null;
  notes?: string | null;
  accountsConfirmed: boolean;
  rejectedReason?: string | null;
  createdAt: string;
  trackingNumber?: string | null;
  bostaStatus?: string | null;
  bostaError?: string | null;
  senderPhone?: string | null;
  noTransferImage?: boolean;
  noImageReason?: string | null;
  lead?: { id: string; name: string; phone: string };
  customer?: { id: string; name: string; phone: string };
  orderItems: OrderItem[];
};

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  cancelled: 'ملغي',
  // Backwards compatibility
  pending_accounts: 'بانتظار الحسابات',
  accounts_confirmed: 'مؤكد من الحسابات',
};

const ACCOUNTS_STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار الحسابات',
  confirmed: 'مؤكد من الحسابات',
  rejected: 'مرفوض',
};

const ACCOUNTS_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border border-green-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
};

const ORDER_STATUS_STYLE: Record<string, string> = {
  active: 'bg-blue-50 text-blue-700 border border-blue-200',
  cancelled: 'bg-slate-100 text-slate-600 border border-slate-200',
  pending_accounts: 'bg-amber-50 text-amber-700 border border-amber-200',
  accounts_confirmed: 'bg-green-50 text-green-700 border border-green-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
};

async function fetchOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return data.order as Order;
}

async function confirmOrder(id: string) {
  const { data } = await api.patch(`/orders/${id}`, { action: 'confirm' });
  return data.order as Order;
}

async function rejectOrder(id: string, rejectedReason: string) {
  const { data } = await api.patch(`/orders/${id}`, { action: 'reject', rejectedReason });
  return data.order as Order;
}

async function pushOrderToWooCommerce(id: string) {
  const { data } = await api.post(`/orders/${id}/push-to-woocommerce`);
  return data.order as Order;
}

async function pushOrderToBosta(id: string) {
  const { data } = await api.post(`/orders/${id}/push-to-bosta`);
  return data.order as Order;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrder(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectOrder(id!, rejectReason),
    onSuccess: () => {
      setShowRejectModal(false);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const pushToWooMutation = useMutation({
    mutationFn: () => pushOrderToWooCommerce(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const pushToBostaMutation = useMutation({
    mutationFn: () => pushOrderToBosta(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (!id) {
    return (
      <div className="p-4">
        <p className="text-slate-500">معرف الطلب غير صالح.</p>
        <Link to="/orders" className="text-blue-600 mt-2 inline-block">← طلبات</Link>
      </div>
    );
  }

  if (isLoading || !order) {
    return <div className="p-4 text-slate-500">جاري التحميل...</div>;
  }

  const totalAmount = order.orderItems.reduce((s, i) => s + i.quantity * i.price, 0);
  const canConfirmReject = order.accountsStatus === 'pending';

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Link to="/orders" className="text-slate-600 hover:text-slate-800">← طلبات</Link>
          <h1 className="text-xl font-bold text-slate-800">
            {order.wooCommerceId ? (
              <>تفاصيل الطلب <span className="font-mono font-semibold text-blue-700">#{order.wooCommerceId}</span></>
            ) : (
              <>
                تفاصيل الطلب <span className="text-slate-500 font-mono">#{order.number}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100 mr-2">مؤقت</span>
              </>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${ACCOUNTS_STATUS_STYLE[order.accountsStatus] ?? ORDER_STATUS_STYLE[order.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {ACCOUNTS_STATUS_LABELS[order.accountsStatus] ?? STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">بيانات الشحن</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-slate-500">الاسم</dt><dd className="font-medium">{order.shippingName}</dd></div>
            <div><dt className="text-slate-500">الجوال</dt><dd dir="ltr" className="text-right">{order.shippingPhone}</dd></div>
            {order.shippingAddress && (
              <div><dt className="text-slate-500">العنوان</dt><dd>{order.shippingAddress}</dd></div>
            )}
            <div><dt className="text-slate-500">نوع الدفع</dt><dd>{order.paymentType === 'full' ? 'دفع كامل' : 'دفع جزئي'}</dd></div>
            {order.lead && (
              <div>
                <dt className="text-slate-500">الليد</dt>
                <dd><Link to={`/leads/leads/${order.lead.id}`} className="text-blue-600 hover:underline">{order.lead.name}</Link></dd>
              </div>
            )}
          </dl>
          {order.transferImage && (
            <div className="mt-4">
              <span className="text-slate-500 text-sm block mb-2">صورة التحويل</span>
              <a href={`/uploads/${order.transferImage}`} target="_blank" rel="noreferrer">
                <img
                  src={`/uploads/${order.transferImage}`}
                  alt="صورة التحويل"
                  className="max-w-full max-h-[400px] rounded-lg border border-slate-200 object-contain"
                />
              </a>
            </div>
          )}
          {order.notes && <p className="mt-4 text-slate-600 text-sm">{order.notes}</p>}
          {order.rejectedReason && (
            <p className="mt-4 p-3 bg-red-50 text-red-800 rounded text-sm">سبب الرفض: {order.rejectedReason}</p>
          )}

          {canConfirmReject && (
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {confirmMutation.isPending ? 'جاري...' : 'تأكيد من الحسابات'}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                رفض
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3 items-start">
            {/* WooCommerce */}
            <div>
              {order.wooCommerceId ? (
                <p className="text-sm text-green-700">مرفوع إلى ووكومرس (طلب # {order.wooCommerceId})</p>
              ) : (
                <button
                  type="button"
                  onClick={() => pushToWooMutation.mutate()}
                  disabled={pushToWooMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {pushToWooMutation.isPending ? 'جاري الرفع...' : 'إعادة الرفع إلى ووكومرس'}
                </button>
              )}
              {pushToWooMutation.isError && (
                <p className="mt-1 text-sm text-red-600">{(pushToWooMutation.error as any)?.response?.data?.error || 'فشل الرفع'}</p>
              )}
            </div>
            {/* Bosta */}
            <div>
              {order.trackingNumber ? (
                <p className="text-sm text-green-700">بوسطة: {order.trackingNumber} ({order.bostaStatus || '—'})</p>
              ) : (
                <button
                  type="button"
                  onClick={() => pushToBostaMutation.mutate()}
                  disabled={pushToBostaMutation.isPending}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm"
                >
                  {pushToBostaMutation.isPending ? 'جاري الرفع...' : 'إعادة الرفع إلى بوسطة'}
                </button>
              )}
              {order.bostaError && !order.trackingNumber && (
                <p className="mt-1 text-sm text-red-600">خطأ سابق: {order.bostaError}</p>
              )}
              {pushToBostaMutation.isError && (
                <p className="mt-1 text-sm text-red-600">{(pushToBostaMutation.error as any)?.response?.data?.error || 'فشل الرفع'}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">عناصر الطلب</h2>
          <ul className="space-y-2">
            {order.orderItems.map((item) => (
              <li key={item.id} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                <span>{item.product?.name ?? item.productName ?? '—'} × {item.quantity}</span>
                <span className="font-medium">{(item.quantity * item.price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-semibold text-slate-800">الإجمالي: {totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="font-semibold text-slate-800 mb-2">رفض الطلب</h3>
            <label className="block text-sm text-slate-600 mb-2">سبب الرفض (مطلوب)</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 min-h-[80px]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="أدخل سبب الرفض..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                type="button"
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="px-4 py-2 border rounded-lg text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => rejectMutation.mutate()}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'جاري...' : 'رفض'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
