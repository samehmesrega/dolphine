import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type LeadStatus = { id: string; name: string; slug: string };
type User = { id: string; name: string; role: { slug: string; name: string } };
type Communication = {
  id: string;
  type: string;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string };
};
type CallbackRequest = {
  id: string;
  note: string | null;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  requestedFrom: { id: string; name: string };
  requestedBy: { id: string; name: string } | null;
};
type ProductInterest = {
  id: string;
  productId: string | null;
  product: { id: string; name: string } | null;
  quantity: number;
  notes: string | null;
  customFields: Record<string, string> | null;
  createdAt: string;
};
type LeadDetail = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  customFields: Record<string, string> | null;
  source: string;
  sourceDetail: string | null;
  createdAt: string;
  status: LeadStatus;
  assignedTo: { id: string; name: string } | null;
  customer: { id: string; name: string; phone: string } | null;
  communications: Communication[];
  responseRequests: CallbackRequest[];
  productInterests?: ProductInterest[];
};
type MyProfile = { id: string; name: string; whatsappNumber: string | null };

const COMM_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'واتساب',
  call: 'مكالمة',
  physical: 'تواصل فيزيائي',
  email: 'إيميل',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('ar-EG');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${hours}:${mins}`;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mr-1.5 text-slate-400 hover:text-amber-500 transition text-xs px-1 py-0.5 rounded border border-transparent hover:border-slate-200"
      title="نسخ"
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

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

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canAssign = hasPermission('leads.assign');

  const [commForm, setCommForm] = useState({ type: 'call', notes: '', statusId: '' });
  const [commError, setCommError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', whatsapp: '', email: '', address: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [interestForm, setInterestForm] = useState({ productId: '', quantity: 1, notes: '' });
  const [cbForm, setCbForm] = useState({ targetUserId: '', note: '' });
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

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
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data.user as MyProfile;
    },
  });

  const addCommMutation = useMutation({
    mutationFn: (payload: { type: string; notes?: string; statusId?: string }) =>
      api.post(`/leads/${id}/communications`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      setCommForm({ type: 'call', notes: '', statusId: '' });
      setCommError('');
    },
    onError: (err: any) => setCommError(err.response?.data?.error || 'فشل إضافة التواصُل'),
  });

  const updateLeadMutation = useMutation({
    mutationFn: (payload: { name?: string; phone?: string; whatsapp?: string; email?: string; address?: string; statusId?: string; assignedToId?: string | null }) =>
      api.patch(`/leads/${id}`, payload).then((r) => r.data.lead as LeadDetail),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      setEditing(false);
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل تحديث البيانات'),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const statusConfirmed = statuses?.find((s) => s.slug === 'confirmed');
      if (!statusConfirmed) throw new Error('حالة طلب مؤكد غير موجودة');
      return api.patch(`/leads/${id}`, { statusId: statusConfirmed.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل التحويل'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/leads/${id}`),
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
      api.post(`/leads/${id}/product-interests`, payload).then((r) => r.data.productInterest as ProductInterest),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setInterestForm({ productId: '', quantity: 1, notes: '' });
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل إضافة الاهتمام'),
  });

  const removeInterestMutation = useMutation({
    mutationFn: (interestId: string) => api.delete(`/leads/${id}/product-interests/${interestId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const addCallbackMutation = useMutation({
    mutationFn: (data: { targetUserId: string; note?: string }) =>
      api.post(`/leads/${id}/response-requests`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setCbForm({ targetUserId: '', note: '' });
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل إضافة طلب الرد'),
  });

  const deleteCallbackMutation = useMutation({
    mutationFn: (requestId: string) => api.delete(`/leads/${id}/response-requests/${requestId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', id] }),
    onError: (err: any) => setError(err.response?.data?.error || 'فشل حذف طلب الرد'),
  });

  const replyCallbackMutation = useMutation({
    mutationFn: ({ requestId, response }: { requestId: string; response: string }) =>
      api.post(`/leads/${id}/response-requests/${requestId}/reply`, { response }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setReplyTexts({});
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل إضافة الرد'),
  });

  const handleWhatsApp = () => {
    if (!myProfile?.whatsappNumber) {
      setError('أضف رقم واتساب في ملفك الشخصي أولاً');
      return;
    }
    const parts: string[] = [];
    if (lead?.phone) parts.push(`فون: ${lead.phone}`);
    if (lead?.whatsapp && lead.whatsapp !== lead.phone) parts.push(`واتساب: ${lead.whatsapp}`);
    const text = parts.join('\n') || lead?.phone || '';
    const url = `https://wa.me/${myProfile.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleAssign = (userId: string) => {
    updateLeadMutation.mutate({ assignedToId: userId === '' ? null : userId });
  };

  const startEdit = () => {
    if (lead) {
      setEditForm({ name: lead.name, phone: lead.phone, whatsapp: lead.whatsapp ?? '', email: lead.email ?? '', address: lead.address ?? '' });
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

  const handleCommSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCommError('');
    addCommMutation.mutate({
      type: commForm.type,
      notes: commForm.notes.trim() || undefined,
      statusId: commForm.statusId || undefined,
    });
  };

  if (!id) return (
    <div className="p-4">
      <p className="text-slate-500">معرف الليد غير صالح.</p>
      <Link to="/leads" className="text-blue-600 mt-2 inline-block">← العودة للقائمة</Link>
    </div>
  );

  if (isLoading || !lead) return (
    <div className="p-4 text-slate-500">جاري التحميل...</div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Link to="/leads" className="text-slate-600 hover:text-slate-800 text-sm">← ليدز</Link>
          <h1 className="text-2xl font-bold text-slate-800">تفاصيل الليد</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteMutation.isPending}
          className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm"
        >
          حذف الليد
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600 mr-2">×</button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="font-semibold text-slate-800 mb-2">تأكيد الحذف</h3>
            <p className="text-slate-600 text-sm mb-4">هل أنت متأكد من حذف هذا الليد؟ لا يمكن حذف ليد له طلبات مرتبطة.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border rounded-lg text-slate-700 text-sm">إلغاء</button>
              <button type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm">
                {deleteMutation.isPending ? 'جاري...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Lead data */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">بيانات الليد</h2>
            {!editing ? (
              <button type="button" onClick={startEdit} className="text-sm text-blue-600 hover:underline">تعديل</button>
            ) : (
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:underline">إلغاء</button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              {([
                { label: 'الاسم', key: 'name', required: true },
                { label: 'الموبايل', key: 'phone', required: true },
                { label: 'واتساب', key: 'whatsapp', required: false },
                { label: 'الإيميل', key: 'email', required: false },
                { label: 'العنوان', key: 'address', required: false },
              ] as const).map(({ label, key, required }) => (
                <div key={key}>
                  <label className="block text-sm text-slate-600 mb-1">{label}</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={editForm[key]}
                    onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                    required={required}
                  />
                </div>
              ))}
              <button type="submit" disabled={updateLeadMutation.isPending}
                className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm">
                {updateLeadMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </form>
          ) : (
            <dl className="space-y-3 text-sm">
              {([
                { label: 'الاسم', value: lead.name },
                { label: 'الموبايل', value: lead.phone },
                ...(lead.whatsapp ? [{ label: 'واتساب', value: lead.whatsapp }] : []),
                ...(lead.email ? [{ label: 'الإيميل', value: lead.email }] : []),
                ...(lead.address ? [{ label: 'العنوان', value: lead.address }] : []),
              ]).map(({ label, value }) => (
                <div key={label} className="flex items-start">
                  <dt className="text-slate-500 w-24 shrink-0">{label}</dt>
                  <dd className="flex items-center font-medium text-slate-800 flex-wrap">
                    <span>{value}</span>
                    <CopyBtn value={value} />
                  </dd>
                </div>
              ))}

              {lead.customFields && Object.entries(lead.customFields).map(([k, v]) => (
                <div key={k} className="flex items-start">
                  <dt className="text-slate-500 w-24 shrink-0 truncate" title={k}>{k}</dt>
                  <dd className="flex items-center text-slate-700 flex-wrap">
                    <span>{String(v)}</span>
                    <CopyBtn value={String(v)} />
                  </dd>
                </div>
              ))}

              <div className="flex items-start">
                <dt className="text-slate-500 w-24 shrink-0">المصدر</dt>
                <dd className="text-slate-700">{lead.sourceDetail || lead.source}</dd>
              </div>
              <div className="flex items-start">
                <dt className="text-slate-500 w-24 shrink-0">الحالة</dt>
                <dd className="text-slate-700">{lead.status?.name}</dd>
              </div>
              <div className="flex items-start">
                <dt className="text-slate-500 w-24 shrink-0">تاريخ الإنشاء</dt>
                <dd className="text-slate-700">{formatDateTime(lead.createdAt)}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Right: Actions */}
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <h2 className="font-semibold text-slate-700">الإجراءات</h2>

          {canAssign ? (
            <div>
              <label className="block text-sm text-slate-600 mb-1">التعيين</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={lead.assignedTo?.id ?? ''}
                onChange={(e) => handleAssign(e.target.value)}
                disabled={updateLeadMutation.isPending}
              >
                <option value="">— غير معيّن —</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-slate-500">المعيّن له: </span>
              <span className="font-medium text-slate-800">{lead.assignedTo?.name ?? '—'}</span>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              فتح واتساب
            </button>
            {!myProfile?.whatsappNumber && (
              <p className="text-xs text-amber-600 mt-1">
                أضف رقم واتساب في{' '}
                <Link to="/profile" className="underline hover:text-amber-700">ملفك الشخصي</Link>
                {' '}أولاً
              </p>
            )}
          </div>

          {lead.status?.slug !== 'confirmed' ? (
            <div>
              <button
                type="button"
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
              >
                {convertMutation.isPending ? 'جاري...' : 'تحويل لطلب مؤكد'}
              </button>
              <p className="text-xs text-slate-400 mt-1">يغيّر الحالة إلى «طلب مؤكد»</p>
            </div>
          ) : (
            <div>
              <Link
                to={`/leads/${lead.id}/create-order`}
                className="block w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium text-center"
              >
                إنشاء الطلب
              </Link>
              <p className="text-xs text-slate-400 mt-1">إدخال بيانات الشحن والمنتجات</p>
            </div>
          )}
        </div>
      </div>

      {/* Callback Requests */}
      <div className="mt-6 bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-slate-700 mb-4">طلبات الرد</h2>

        <div className="flex flex-wrap gap-3 pb-4 mb-4 border-b border-slate-100">
          <div className="min-w-[180px] flex-1">
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={cbForm.targetUserId}
              onChange={(e) => setCbForm((p) => ({ ...p, targetUserId: e.target.value }))}
            >
              <option value="">— اختر الحساب المطلوب رده —</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role?.name})</option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="جملة توضيحية عن طلب الرد (اختياري)"
              value={cbForm.note}
              onChange={(e) => setCbForm((p) => ({ ...p, note: e.target.value }))}
            />
          </div>
          <button
            type="button"
            disabled={!cbForm.targetUserId || addCallbackMutation.isPending}
            onClick={() => {
              if (!cbForm.targetUserId) return;
              addCallbackMutation.mutate({
                targetUserId: cbForm.targetUserId,
                note: cbForm.note.trim() || undefined,
              });
            }}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm whitespace-nowrap"
          >
            {addCallbackMutation.isPending ? 'جاري...' : '+ إضافة طلب رد'}
          </button>
        </div>

        {!lead.responseRequests?.length ? (
          <p className="text-slate-500 text-sm">لا توجد طلبات رد.</p>
        ) : (
          <ul className="space-y-3">
            {lead.responseRequests.map((rr) => (
              <li key={rr.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">مطلوب من: {rr.requestedFrom?.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {rr.requestedBy && `طلب بواسطة: ${rr.requestedBy.name} · `}
                      {formatDateTime(rr.createdAt)}
                    </p>
                  </div>
                  {!rr.response && (
                    <button
                      type="button"
                      onClick={() => deleteCallbackMutation.mutate(rr.id)}
                      disabled={deleteCallbackMutation.isPending}
                      className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 shrink-0"
                    >
                      حذف
                    </button>
                  )}
                </div>

                {rr.note && (
                  <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded px-3 py-1.5">{rr.note}</p>
                )}

                {rr.response ? (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-green-600 mb-1">الرد:</p>
                    <p className="text-sm text-slate-700">{rr.response}</p>
                    {rr.respondedAt && <p className="text-xs text-slate-400 mt-1">{formatDateTime(rr.respondedAt)}</p>}
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="اكتب الرد هنا..."
                      value={replyTexts[rr.id] ?? ''}
                      onChange={(e) => setReplyTexts((p) => ({ ...p, [rr.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      disabled={!replyTexts[rr.id]?.trim() || replyCallbackMutation.isPending}
                      onClick={() => {
                        const text = replyTexts[rr.id];
                        if (text?.trim()) replyCallbackMutation.mutate({ requestId: rr.id, response: text.trim() });
                      }}
                      className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50"
                    >
                      رد
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Communication Form */}
      <div className="mt-6 bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold text-slate-700 mb-4">إضافة تواصُل</h2>
        <form onSubmit={handleCommSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">نوع التواصُل</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={commForm.type}
              onChange={(e) => setCommForm((p) => ({ ...p, type: e.target.value }))}
            >
              {Object.entries(COMM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">ملاحظات</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 min-h-[80px] text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={commForm.notes}
              onChange={(e) => setCommForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="ملخص ما تم مع الليد..."
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">تحديث الحالة</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={commForm.statusId}
              onChange={(e) => setCommForm((p) => ({ ...p, statusId: e.target.value }))}
            >
              <option value="">— بدون تغيير —</option>
              {statuses?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {commError && <p className="text-sm text-red-600">{commError}</p>}
          <button
            type="submit"
            disabled={addCommMutation.isPending}
            className="w-full py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm font-medium"
          >
            {addCommMutation.isPending ? 'جاري الحفظ...' : 'حفظ التواصُل'}
          </button>
        </form>
      </div>

      {/* Communications List */}
      <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
        <h2 className="font-semibold text-slate-700 p-4 border-b">سجل التواصُل</h2>
        {!lead.communications?.length ? (
          <p className="p-4 text-slate-500 text-sm">لا يوجد تواصُل مسجّل بعد.</p>
        ) : (
          <ul className="divide-y">
            {lead.communications.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm">{COMM_TYPE_LABELS[c.type] || c.type}</span>
                  <span className="text-slate-500 text-xs">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">من: {c.user?.name}</p>
                {c.notes && <p className="mt-2 text-sm text-slate-700">{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Product Interests */}
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={interestForm.quantity}
                onChange={(e) => setInterestForm((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-slate-500 mb-1">ملاحظات</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="ملاحظات"
                value={interestForm.notes}
                onChange={(e) => setInterestForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={addInterestMutation.isPending}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm"
            >
              {addInterestMutation.isPending ? 'جاري...' : 'إضافة'}
            </button>
          </form>
        </div>
        {!lead.productInterests?.length ? (
          <p className="p-4 text-slate-500 text-sm">لا توجد اهتمامات منتجات مسجّلة.</p>
        ) : (
          <ul className="divide-y">
            {(lead.productInterests ?? []).map((pi) => (
              <li key={pi.id} className="p-4 flex justify-between items-start">
                <div>
                  <span className="font-medium text-sm">{pi.product?.name ?? 'منتج (بدون ربط)'}</span>
                  <span className="text-slate-500 text-sm mr-2"> × {pi.quantity}</span>
                  {pi.notes && <p className="text-sm text-slate-600 mt-1">{pi.notes}</p>}
                  {pi.customFields && Object.keys(pi.customFields).length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(pi.customFields).map(([k, v]) => (
                        <p key={k} className="text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{k}:</span> {String(v)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeInterestMutation.mutate(pi.id)}
                  disabled={removeInterestMutation.isPending}
                  className="text-red-500 text-sm hover:underline shrink-0"
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
