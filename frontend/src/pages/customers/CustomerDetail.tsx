import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

type LeadStatus = { id: string; name: string; slug: string };
type Lead = {
  id: string;
  name: string;
  phone: string;
  source: string;
  createdAt: string;
  status: LeadStatus;
  assignedTo?: { id: string; name: string } | null;
};

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  productName?: string | null;
  product?: { id: string; name: string } | null;
};

type Order = {
  id: string;
  status: string;
  paymentType: string;
  shippingName: string;
  shippingPhone: string;
  createdAt: string;
  lead?: { id: string; name: string };
  orderItems: OrderItem[];
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt: string;
  leads: Lead[];
  orders: Order[];
};

async function fetchCustomer(id: string) {
  const { data } = await api.get(`/customers/${id}`);
  return data.customer as Customer;
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
  });

  if (!id) {
    return (
      <div className="p-4">
        <p className="text-slate-500">معرف العميل غير صالح.</p>
        <Link to="/customers" className="text-blue-600 mt-2 inline-block">← عملاء</Link>
      </div>
    );
  }

  if (isLoading || !customer) {
    return (
      <div className="p-4 text-slate-500">
        {error ? 'فشل تحميل العميل.' : 'جاري التحميل...'}
        <Link to="/customers" className="mr-2 text-blue-600 block mt-2">← عملاء</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/customers" className="text-slate-600 hover:text-slate-800">← عملاء</Link>
        <h1 className="text-2xl font-bold text-slate-800">تفاصيل العميل</h1>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-slate-700 mb-4">البيانات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-slate-500 text-sm">الاسم</span>
            <p className="font-medium text-slate-800">{customer.name}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">الجوال</span>
            <p className="font-medium text-slate-800 dir-ltr text-right">{customer.phone}</p>
          </div>
          {customer.whatsapp && (
            <div>
              <span className="text-slate-500 text-sm">واتساب</span>
              <p className="font-medium text-slate-800 dir-ltr text-right">{customer.whatsapp}</p>
            </div>
          )}
          {customer.email && (
            <div>
              <span className="text-slate-500 text-sm">البريد</span>
              <p className="font-medium text-slate-800">{customer.email}</p>
            </div>
          )}
          {customer.address && (
            <div className="md:col-span-2">
              <span className="text-slate-500 text-sm">العنوان</span>
              <p className="font-medium text-slate-800">{customer.address}</p>
            </div>
          )}
          <div>
            <span className="text-slate-500 text-sm">تاريخ الإنشاء</span>
            <p className="text-slate-700">{new Date(customer.createdAt).toLocaleDateString('ar-EG')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
        <h2 className="font-semibold text-slate-700 p-4 border-b">الليدز ({customer.leads.length})</h2>
        {customer.leads.length === 0 ? (
          <p className="p-4 text-slate-500">لا توجد ليدز مرتبطة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">الاسم</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">المصدر</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">الحالة</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">التاريخ</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {customer.leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-4 text-slate-800">{lead.name}</td>
                    <td className="py-2 px-4 text-slate-600">{lead.source}</td>
                    <td className="py-2 px-4 text-slate-600">{lead.status?.name ?? '—'}</td>
                    <td className="py-2 px-4 text-slate-500 text-sm">
                      {new Date(lead.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-2 px-4">
                      <Link to={`/leads/${lead.id}`} className="text-blue-600 hover:text-blue-800">
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h2 className="font-semibold text-slate-700 p-4 border-b">الطلبات ({customer.orders.length})</h2>
        {customer.orders.length === 0 ? (
          <p className="p-4 text-slate-500">لا يوجد طلبات.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">التاريخ</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">الحالة</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">الدفع</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">الشحن</th>
                  <th className="text-right py-2 px-4 font-semibold text-slate-700">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-4 text-slate-600 text-sm">
                      {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-2 px-4 text-slate-600">{order.status}</td>
                    <td className="py-2 px-4 text-slate-600">
                      {order.paymentType === 'full' ? 'كامل' : 'جزئي'}
                    </td>
                    <td className="py-2 px-4 text-slate-600">
                      {order.shippingName} — {order.shippingPhone}
                    </td>
                    <td className="py-2 px-4">
                      <Link to={`/orders/${order.id}`} className="text-blue-600 hover:text-blue-800">
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
