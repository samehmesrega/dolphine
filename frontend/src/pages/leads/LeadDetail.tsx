import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '../../services/api';

type LeadStatus = { id: string; name: string; slug: string };
type User = { id: string; name: string; role: { slug: string; name: string } };
type Communication = {
  id: string;
  type: string;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string };
};
type ResponseRequest = {
  id: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  requestedFrom: { id: string; name: string };
};
type ProductInterest = {
  id: string;
  productId: string | null;
  product: { id: string; name: string } | null;
  quantity: number;
  notes: string | null;
  createdAt: string;
};

type LeadDetail = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  source: string;
  sourceDetail: string | null;
  createdAt: string;
  status: LeadStatus;
  assignedTo: { id: string; name: string } | null;
  customer: { id: string; name: string; phone: string } | null;
  communications: Communication[];
  responseRequests: ResponseRequest[];
  productInterests?: ProductInterest[];
};

const COMM_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'واتساب',
  call: 'مكالمة',
  physical: 'تواصل فيزيائي',
  email: 'إيميل',
};

async function fetchLead(id: string) {
  const { data } = await api.get(`/leads/${id}`);
  return data.lead as LeadDetail;
}

async function fetchLeadStatuses() {
  const { data } = await api.get('/lead-statuses');
  return data.statuses as LeadStatus[];
}

async function fetchUsers() {
  const { data } = await api.get('/users');
  return data.users as User[];
}

async function addCommunication(leadId: string, payload: { type: string; notes?: string; statusId?: string; requestResponseFromIds?: string[] }) {
  const { data } = await api.post(`/leads/${leadId}/communications`, payload);
  return data;
}

async function updateLead(leadId: string, payload: { name?: string; phone?: string; whatsapp?: string; email?: string; address?: string; statusId?: string; assignedToId?: string | null }) {
  const { data } = await api.patch(`/leads/${leadId}`, payload);
  return data.lead as LeadDetail;
}

async function deleteLead(leadId: string) {
  await api.delete(`/leads/${leadId}`);
}

async function addProductInterest(leadId: string, payload: { productId?: string | null; quantity?: number; notes?: string }) {
  const { data } = await api.post(`/leads/${leadId}/product-interests`, payload);
  return data.productInterest as ProductInterest;
}

async function removeProductInterest(leadId: string, interestId: string) {
  await api.delete(`/leads/${leadId}/product-interests/${interestId}`);
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: 'call', notes: '', statusId: '', requestResponseFromIds: [] as string[] });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', whatsapp: '', email: '', address: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [interestForm, setInterestForm] = useState({ productId: '', quantity: 1, notes: '' });

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => fetchLead(id!),
    enabled: !!id,
  });

  const { data: statuses } = useQuery({ queryKey: ['lead-statuses'], queryFn: fetchLeadStatuses });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/products');
      return data.products as { id: string; name: string }[];
    },
  });

  const addCommMutation = useMutation({
    mutationFn: (payload: { type: string; notes?: string; statusId?: string; requestResponseFromIds?: string[] }) =>
      addCommunication(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      setForm({ type: 'call', notes: '', statusId: '', requestResponseFromIds: [] });
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'فشل إضافة التواصُل');
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateLead>[1]) => updateLead(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      setEditing(false);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'فشل تحديث البيانات');
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const statusConfirmed = statuses?.find((s) => s.slug === 'confirmed');
      if (!statusConfirmed) throw new Error('حالة طلب مؤكد غير موجودة');
      return updateLead(id!, { statusId: statusConfirmed.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLead(id!),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      qc.invalidateQueries({ queryKey: ['leads'] });
      navigate('/leads');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'فشل حذف الليد');
      setShowDeleteConfirm(false);
    },
  });

  const addInterestMutation = useMutation({
    mutationFn: (payload: { productId?: string | null; quantity?: number; notes?: string }) =>
      addProductInterest(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setInterestForm({ productId: '', quantity: 1, notes: '' });
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل إضافة الاهتمام'),
  });

  const removeInterestMutation = useMutation({
    mutationFn: (interestId: string) => removeProductInterest(id!, interestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    addCommMutation.mutate({
      type: form.type,
      notes: form.notes.trim() || undefined,
      statusId: form.statusId || undefined,
      requestResponseFromIds: form.requestResponseFromIds.length ? form.requestResponseFromIds : undefined,
    });
  };

  const toggleRequestResponse = (userId: string) => {
    setForm((p) => ({
      ...p,
      requestResponseFromIds: p.requestResponseFromIds.includes(userId)
        ? p.requestResponseFromIds.filter((x) => x !== userId)
        : [...p.requestResponseFromIds, userId],
    }));
  };

  const allowedRoles = ['sales_manager', 'operations', 'accounts'];
  const usersForRequest = users?.filter((u) => allowedRoles.includes(u.role?.slug)) ?? [];

  const startEdit = () => {
    if (lead) {
      setEditForm({
        name: lead.name,
        phone: lead.phone,
        whatsapp: lead.whatsapp ?? '',
        email: lead.email ?? '',
        address: lead.address ?? '',
      });
      setEditing(true);
      setError('');
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    updateLeadMutation.mutate({
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      whatsapp: editForm.whatsapp.trim() || undefined,
      email: editForm.email.trim() || undefined,
      address: editForm.address.trim() || undefined,
    });
  };

  const handleAssign = (userId: string) => {
    const value = userId === '' ? null : userId;
    updateLeadMutation.mutate({ assignedToId: value });
  };

  if (!id) {
    return (
      <div className="p-4">
        <p className="text-slate-500">معرف الليد غير صالح.</p>
        <Link to="/leads" className="text-blue-600 mt-2 inline-block">← العودة للقائمة</Link>
      </div>
    );
  }

  if (isLoading || !lead) {
    return (
      <div className="p-4">
        <p className="text-slate-500">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Link to="/leads" className="text-slate-600 hover:text-slate-800">← ليدز</Link>
          <h1 className="text-2xl font-bold text-slate-800">تفاصيل الليد</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteMutation.isPending}
          className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          حذف الليد
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="font-semibold text-slate-800 mb-2">تأكيد الحذف</h3>
            <p className="text-slate-600 text-sm mb-4">
              هل أنت متأكد من حذف هذا الليد؟ لا يمكن حذف ليد له طلبات مرتبطة.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border rounded-lg text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">بيانات الليد</h2>
            {!editing ? (
              <button type="button" onClick={startEdit} className="text-sm text-blue-600 hover:underline">
                تعديل البيانات
              </button>
            ) : (
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:underline">
                إلغاء
              </button>
            )}
          </div>
          {editing ? (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">الاسم</label>
                <input className="w-full border rounded-lg px-3 py-2" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">الموبايل</label>
                <input className="w-full border rounded-lg px-3 py-2" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">واتساب</label>
                <input className="w-full border rounded-lg px-3 py-2" value={editForm.whatsapp} onChange={(e) => setEditForm((p) => ({ ...p, whatsapp: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">الإيميل</label>
                <input type="email" className="w-full border rounded-lg px-3 py-2" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">العنوان</label>
                <input className="w-full border rounded-lg px-3 py-2" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <button type="submit" disabled={updateLeadMutation.isPending} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {updateLeadMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </form>
          ) : (
            <>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-slate-500">الاسم</dt><dd className="font-medium">{lead.name}</dd></div>
                <div><dt className="text-slate-500">الموبايل</dt><dd>{lead.phone}</dd></div>
                {lead.whatsapp && <div><dt className="text-slate-500">واتساب</dt><dd>{lead.whatsapp}</dd></div>}
                {lead.email && <div><dt className="text-slate-500">الإيميل</dt><dd>{lead.email}</dd></div>}
                {lead.address && <div><dt className="text-slate-500">العنوان</dt><dd>{lead.address}</dd></div>}
                <div><dt className="text-slate-500">المصدر</dt><dd>{lead.source}</dd></div>
                <div><dt className="text-slate-500">الحالة</dt><dd>{lead.status?.name}</dd></div>
                <div>
                  <dt className="text-slate-500">المعيّن له</dt>
                  <dd>
                    <select
                      className="border rounded px-2 py-1 text-sm mt-1"
                      value={lead.assignedTo?.id ?? ''}
                      onChange={(e) => handleAssign(e.target.value)}
                      disabled={updateLeadMutation.isPending}
                    >
                      <option value="">— غير معيّن —</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div><dt className="text-slate-500">تاريخ الإنشاء</dt><dd>{new Date(lead.createdAt).toLocaleString('ar-EG')}</dd></div>
              </dl>
              {lead.phone && (
                <a
                  href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  فتح واتساب
                </a>
              )}
              {lead.status?.slug !== 'confirmed' && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => convertMutation.mutate()}
                    disabled={convertMutation.isPending}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {convertMutation.isPending ? 'جاري...' : 'تحويل لعميل (طلب مؤكد)'}
                  </button>
                  <p className="text-xs text-slate-500 mt-1">يغيّر الحالة إلى طلب مؤكد ثم إنشاء الطلب من الزر أدناه.</p>
                </div>
              )}
              {lead.status?.slug === 'confirmed' && (
                <div className="mt-4">
                  <Link
                    to={`/leads/${lead.id}/create-order`}
                    className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    إنشاء الطلب
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">إدخال بيانات الشحن والمنتجات وصورة التحويل.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-slate-700 mb-4">إضافة تواصُل</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">نوع التواصُل</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                {Object.entries(COMM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">ملخص / ملاحظات</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 min-h-[80px]"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="ملخص ما تم مع الليد..."
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">تحديث الحالة</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={form.statusId}
                onChange={(e) => setForm((p) => ({ ...p, statusId: e.target.value }))}
              >
                <option value="">— بدون تغيير —</option>
                {statuses?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">طلب رد من</label>
              <div className="flex flex-wrap gap-2">
                {usersForRequest.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.requestResponseFromIds.includes(u.id)}
                      onChange={() => toggleRequestResponse(u.id)}
                    />
                    <span className="text-sm">{u.name} ({u.role?.name})</span>
                  </label>
                ))}
                {usersForRequest.length === 0 && <span className="text-slate-500 text-sm">لا يوجد مستخدمون لهذا الدور</span>}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={addCommMutation.isPending}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {addCommMutation.isPending ? 'جاري الحفظ...' : 'حفظ التواصُل'}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
        <h2 className="font-semibold text-slate-700 p-4 border-b">سجل التواصُل</h2>
        {lead.communications?.length === 0 ? (
          <p className="p-4 text-slate-500">لا يوجد تواصُل مسجّل بعد.</p>
        ) : (
          <ul className="divide-y">
            {lead.communications?.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex justify-between items-start">
                  <span className="font-medium">{COMM_TYPE_LABELS[c.type] || c.type}</span>
                  <span className="text-slate-500 text-sm">{new Date(c.createdAt).toLocaleString('ar-EG')}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">من: {c.user?.name}</p>
                {c.notes && <p className="mt-2 text-slate-700">{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {lead.responseRequests?.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
          <h2 className="font-semibold text-slate-700 p-4 border-b">طلبات الرد</h2>
          <ul className="divide-y">
            {lead.responseRequests.map((rr) => (
              <li key={rr.id} className="p-4">
                <span className="font-medium">مطلوب من: {rr.requestedFrom?.name}</span>
                <span className="text-slate-500 text-sm mr-2">{new Date(rr.createdAt).toLocaleString('ar-EG')}</span>
                {rr.respondedAt && <p className="text-sm text-green-600 mt-1">تم الرد</p>}
                {rr.response && <p className="mt-1 text-slate-700">{rr.response}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
        <h2 className="font-semibold text-slate-700 p-4 border-b">اهتمامات المنتجات</h2>
        <div className="p-4 border-b bg-slate-50">
          <form
            className="flex flex-wrap gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              addInterestMutation.mutate({
                productId: interestForm.productId || null,
                quantity: interestForm.quantity,
                notes: interestForm.notes.trim() || undefined,
              });
            }}
          >
            <div className="min-w-[180px]">
              <label className="block text-xs text-slate-500 mb-1">المنتج</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={interestForm.productId}
                onChange={(e) => setInterestForm((p) => ({ ...p, productId: e.target.value }))}
              >
                <option value="">— وصف في الملاحظات —</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="block text-xs text-slate-500 mb-1">الكمية</label>
              <input
                type="number"
                min={1}
                className="w-full border rounded-lg px-3 py-2"
                value={interestForm.quantity}
                onChange={(e) => setInterestForm((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-slate-500 mb-1">ملاحظات</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="ملاحظات عن الاهتمام"
                value={interestForm.notes}
                onChange={(e) => setInterestForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={addInterestMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {addInterestMutation.isPending ? 'جاري...' : 'إضافة'}
            </button>
          </form>
        </div>
        {lead.productInterests?.length === 0 ? (
          <p className="p-4 text-slate-500">لا توجد اهتمامات منتجات مسجّلة.</p>
        ) : (
          <ul className="divide-y">
            {(lead.productInterests ?? []).map((pi) => (
              <li key={pi.id} className="p-4 flex justify-between items-center">
                <div>
                  <span className="font-medium">{pi.product?.name ?? 'منتج (بدون ربط)'}</span>
                  <span className="text-slate-500 text-sm mr-2"> × {pi.quantity}</span>
                  {pi.notes && <p className="text-sm text-slate-600 mt-1">{pi.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeInterestMutation.mutate(pi.id)}
                  disabled={removeInterestMutation.isPending}
                  className="text-red-600 text-sm hover:underline"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
