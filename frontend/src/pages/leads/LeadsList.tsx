import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

type LeadStatus = {
  id: string;
  name: string;
  slug: string;
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  source: string;
  createdAt: string;
  status: LeadStatus;
  assignedTo?: { id: string; name: string } | null;
};

type User = { id: string; name: string };

async function fetchLeadStatuses(): Promise<LeadStatus[]> {
  const { data } = await api.get('/lead-statuses');
  return data.statuses;
}

async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get('/users');
  return data.users;
}

async function fetchLeads(params: {
  search?: string;
  statusId?: string;
  assignedToId?: string;
  sortBy?: string;
  order?: string;
  page: number;
  pageSize: number;
}) {
  const { data } = await api.get('/leads', { params });
  return data as { total: number; page: number; pageSize: number; leads: Lead[] };
}

function downloadLeadsCsv(leads: Lead[]) {
  const headers = ['الاسم', 'الموبايل', 'الحالة', 'المعيّن له', 'المصدر', 'تاريخ الإنشاء'];
  const rows = leads.map((l) => [
    l.name,
    l.phone,
    l.status?.name ?? '',
    l.assignedTo?.name ?? '',
    l.source,
    new Date(l.createdAt).toLocaleString('ar-EG'),
  ]);
  const BOM = '\uFEFF';
  const csv = BOM + [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function createLead(payload: { name: string; phone: string; whatsapp?: string; email?: string; address?: string }) {
  const { data } = await api.post('/leads', { ...payload, source: 'manual' });
  return data.lead as Lead;
}

export default function LeadsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusId, setStatusId] = useState<string>('');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [order, setOrder] = useState<string>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: statuses } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: fetchLeadStatuses,
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      statusId: statusId || undefined,
      assignedToId: assignedToId || undefined,
      sortBy,
      order,
      page,
      pageSize,
    }),
    [search, statusId, assignedToId, sortBy, order, page]
  );

  const { data, isLoading, isFetching, isError, error: listError } = useQuery({
    queryKey: ['leads', queryParams],
    queryFn: () => fetchLeads(queryParams),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createLead({
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setForm({ name: '', phone: '', whatsapp: '', email: '', address: '' });
      await qc.invalidateQueries({ queryKey: ['leads'] });
    } catch (err: any) {
      setError(err.response?.data?.error || 'فشل إنشاء الليد');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/leads', {
        params: {
          search: search.trim() || undefined,
          statusId: statusId || undefined,
          assignedToId: assignedToId || undefined,
          sortBy,
          order,
          page: 1,
          pageSize: 1000,
        },
      });
      const list = (data as { leads: Lead[] }).leads ?? [];
      if (list.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }
      downloadLeadsCsv(list);
    } catch {
      alert('فشل التصدير');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ليدز</h1>
        {isFetching && <span className="text-sm text-slate-500">جاري التحديث...</span>}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold text-slate-700 mb-3">إضافة ليد يدوي</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="الاسم"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="رقم الموبايل"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="واتساب (اختياري)"
            value={form.whatsapp}
            onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="إيميل (اختياري)"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
          <button
            disabled={submitting}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <input
            className="border rounded-lg px-3 py-2 md:col-span-5"
            placeholder="العنوان (اختياري)"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          />
        </form>
        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="بحث: اسم / فون / إيميل"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <select
            className="border rounded-lg px-3 py-2"
            value={statusId}
            onChange={(e) => {
              setPage(1);
              setStatusId(e.target.value);
            }}
          >
            <option value="">كل الحالات</option>
            {statuses?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="border rounded-lg px-3 py-2"
            value={assignedToId}
            onChange={(e) => {
              setPage(1);
              setAssignedToId(e.target.value);
            }}
          >
            <option value="">كل المعيّنين</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className="border rounded-lg px-3 py-2"
            value={`${sortBy}-${order}`}
            onChange={(e) => {
              const v = e.target.value;
              const [s, o] = v.split('-');
              setPage(1);
              setSortBy(s);
              setOrder(o);
            }}
          >
            <option value="createdAt-desc">الأحدث أولاً</option>
            <option value="createdAt-asc">الأقدم أولاً</option>
            <option value="name-asc">الاسم (أ-ي)</option>
            <option value="name-desc">الاسم (ي-أ)</option>
            <option value="statusId-asc">الحالة</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-slate-700"
          >
            {exporting ? 'جاري التصدير...' : 'تصدير CSV'}
          </button>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>الإجمالي: {data?.total ?? '--'}</span>
            <span>
              صفحة {data?.page ?? page} / {data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : '--'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right p-3">الاسم</th>
              <th className="text-right p-3">الموبايل</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-right p-3">المعيّن له</th>
              <th className="text-right p-3">المصدر</th>
              <th className="text-right p-3">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={6}>
                  جاري التحميل...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td className="p-4 text-red-600" colSpan={6}>
                  فشل تحميل القائمة: {(() => {
                    const e = listError as { response?: { data?: { error?: string }; status?: number }; message?: string };
                    if (e?.response?.data?.error) return e.response.data.error;
                    if (e?.response?.status === 500) return 'خطأ من الخادم (500). تأكد أن الـ Backend يعمل وقاعدة البيانات متصلة.';
                    return e?.message || 'خطأ غير معروف';
                  })()}
                </td>
              </tr>
            ) : (data?.leads?.length ?? 0) === 0 ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={6}>
                  لا يوجد ليدز
                </td>
              </tr>
            ) : (
              data!.leads.map((l) => (
                <tr key={l.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 text-slate-800">
                    <Link to={`/leads/${l.id}`} className="text-blue-600 hover:underline font-medium">
                      {l.name}
                    </Link>
                  </td>
                  <td className="p-3">{l.phone}</td>
                  <td className="p-3">{l.status?.name}</td>
                  <td className="p-3">{l.assignedTo?.name ?? '—'}</td>
                  <td className="p-3">{l.source}</td>
                  <td className="p-3">{new Date(l.createdAt).toLocaleString('ar-EG')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button
          className="px-3 py-2 border rounded-lg disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          السابق
        </button>
        <button
          className="px-3 py-2 border rounded-lg disabled:opacity-50"
          disabled={!!data && page >= Math.ceil(data.total / data.pageSize)}
          onClick={() => setPage((p) => p + 1)}
        >
          التالي
        </button>
      </div>
    </div>
  );
}

