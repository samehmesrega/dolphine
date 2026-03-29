import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../shared/services/api';
import { useAuth } from '../../../auth/context/AuthContext';

type LeadStatus = {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
};

type Lead = {
  id: string;
  number: number;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  source: string;
  createdAt: string;
  status: LeadStatus;
  assignedTo?: { id: string; name: string } | null;
  communications?: Array<{ type: string; notes: string | null; createdAt: string; user: { name: string } }>;
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
  from?: string;
  to?: string;
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
  const { user: currentUser } = useAuth();
  const canBulkDelete = ['super_admin', 'admin', 'sales_manager'].includes(currentUser?.role?.slug ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusId, setStatusId] = useState<string>('');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const today = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayStr = fmt(today);
    if (preset === 'today') { setFromDate(todayStr); setToDate(todayStr); }
    else if (preset === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate()-1); const ys = fmt(y);
      setFromDate(ys); setToDate(ys);
    }
    else if (preset === '7d') {
      const d = new Date(today); d.setDate(d.getDate()-6);
      setFromDate(fmt(d)); setToDate(todayStr);
    }
    else if (preset === '30d') {
      const d = new Date(today); d.setDate(d.getDate()-29);
      setFromDate(fmt(d)); setToDate(todayStr);
    }
    else if (preset === 'this_month') {
      setFromDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`); setToDate(todayStr);
    }
    else if (preset === 'last_month') {
      const s = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(fmt(s)); setToDate(fmt(e));
    }
    else { setFromDate(''); setToDate(''); }
  };
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [order, setOrder] = useState<string>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [deleteError, setDeleteError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const bulkDeleteMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data } = await api.post('/leads/bulk-delete', { leadIds });
      return data as { deleted: number };
    },
    onSuccess: (data) => {
      setSelectedIds(new Set());
      setDeleteError('');
      qc.invalidateQueries({ queryKey: ['leads'] });
      alert(`تم حذف ${data.deleted} ليد بنجاح`);
    },
    onError: (err: any) => {
      setDeleteError(err.response?.data?.error || 'خطأ في حذف الليدز');
    },
  });

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} ليد؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
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
    if (!data?.leads) return;
    const allIds = data.leads.map(l => l.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

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
      from: fromDate || undefined,
      to: toDate || undefined,
      sortBy,
      order,
      page,
      pageSize,
    }),
    [search, statusId, assignedToId, fromDate, toDate, sortBy, order, page]
  );

  const { data, isLoading, isFetching, isError, error: listError } = useQuery({
    queryKey: ['leads', queryParams],
    queryFn: () => fetchLeads(queryParams),
    refetchInterval: 30000, // تحديث تلقائي كل 30 ثانية
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

  const handleExportSelected = () => {
    if (!data?.leads || selectedIds.size === 0) return;
    const selected = data.leads.filter(l => selectedIds.has(l.id));
    if (selected.length === 0) return;
    downloadLeadsCsv(selected);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ليدز</h1>
        <div className="flex items-center gap-3">
          {isFetching && <span className="text-sm text-slate-500">جاري التحديث...</span>}
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ['leads'] })}
            className="border border-slate-300 text-slate-600 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
            title="مزامنة الليدز"
          >
            🔄 مزامنة
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showAddForm ? 'إخفاء' : 'إضافة ليد'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <h2 className="font-semibold text-slate-700 mb-3">إضافة ليد يدوي</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
              placeholder="الاسم"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
              placeholder="رقم الموبايل"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              required
            />
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
              placeholder="واتساب (اختياري)"
              value={form.whatsapp}
              onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
            />
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
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
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors md:col-span-5"
              placeholder="العنوان (اختياري)"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
          </form>
          {error && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
        {/* Date filter — compact row */}
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-100">
          <span className="text-xs text-slate-500 font-medium">الفترة:</span>
          {[
            { key: '', label: 'الكل' },
            { key: 'today', label: 'اليوم' },
            { key: 'yesterday', label: 'أمس' },
            { key: '7d', label: '٧ أيام' },
            { key: '30d', label: '٣٠ يوم' },
            { key: 'this_month', label: 'هذا الشهر' },
            { key: 'last_month', label: 'الشهر الماضي' },
          ].map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyDatePreset(p.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                datePreset === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={fromDate}
            onChange={e => { setFromDate(e.target.value); setDatePreset('custom'); setPage(1); }}
            className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={toDate}
            onChange={e => { setToDate(e.target.value); setDatePreset('custom'); setPage(1); }}
            className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          {fromDate && (
            <span className="text-xs text-blue-600 font-semibold mr-2">
              {data?.total ?? '...'} ليد
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
            placeholder="بحث: اسم / فون / إيميل / رقم الليد"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
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
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
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
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
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
        </div>
      </div>

      {canBulkDelete && selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">تم تحديد {selectedIds.size} عنصر</span>
          <div className="flex items-center gap-3">
            {deleteError && <span className="text-sm text-red-600">{deleteError}</span>}
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-sm text-slate-600 hover:text-slate-800">إلغاء التحديد</button>
            <button type="button" onClick={handleExportSelected}
              className="border border-slate-300 bg-white text-slate-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              تصدير CSV
            </button>
            <button type="button" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}
              className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
              {bulkDeleteMutation.isPending ? 'جاري الحذف...' : 'حذف المحدد'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {canBulkDelete && (
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={!!data?.leads?.length && data.leads.every(l => selectedIds.has(l.id))}
                    onChange={toggleSelectAll} className="rounded border-slate-300" />
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 hidden md:table-cell">#</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الاسم</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الموبايل</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 hidden lg:table-cell">المعيّن له</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 hidden md:table-cell">المصدر</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 hidden md:table-cell">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="p-4 text-slate-500" colSpan={canBulkDelete ? 8 : 7}>
                  جاري التحميل...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td className="p-4 text-red-600" colSpan={canBulkDelete ? 8 : 7}>
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
                <td className="p-4 text-slate-500" colSpan={canBulkDelete ? 8 : 7}>
                  لا يوجد ليدز
                </td>
              </tr>
            ) : (
              data!.leads.map((l) => (
                <tr key={l.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedIds.has(l.id) ? 'bg-blue-50' : ''}`}>
                  {canBulkDelete && (
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} className="rounded border-slate-300" />
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">#{l.number}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <Link to={`/leads/leads/${l.id}`} className="text-blue-600 hover:underline font-medium">
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l.phone}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                      style={{
                        backgroundColor: l.status?.color ? l.status.color + '20' : '#f1f5f9',
                        color: l.status?.color || '#64748b',
                        borderColor: l.status?.color ? l.status.color + '40' : '#e2e8f0',
                      }}
                    >
                      {l.status?.name}
                    </span>
                    {l.communications?.[0] && (
                      <span className="mr-1 relative group">
                        <span className="cursor-help text-slate-400 hover:text-slate-600 text-xs">💬</span>
                        <span className="absolute hidden group-hover:block z-50 bottom-full right-0 mb-1 w-64 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg leading-relaxed whitespace-pre-wrap">
                          {l.communications[0].user?.name || '—'}: {l.communications[0].notes || '(بدون ملاحظات)'}
                          <br />
                          <span className="text-slate-400">{new Date(l.communications[0].createdAt).toLocaleString('ar-EG')}</span>
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 hidden lg:table-cell">{l.assignedTo?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700 hidden md:table-cell">{l.source}</td>
                  <td className="px-4 py-3 text-slate-700 hidden md:table-cell">{new Date(l.createdAt).toLocaleString('ar-EG')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>الإجمالي: {data?.total ?? '--'}</span>
          <span className="text-slate-300">|</span>
          <span>صفحة {data?.page ?? page} / {data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : '--'}</span>
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2.5 border rounded-lg disabled:opacity-50 text-sm min-h-[44px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </button>
          <button
            className="px-4 py-2.5 border rounded-lg disabled:opacity-50 text-sm min-h-[44px]"
            disabled={!!data && page >= Math.ceil(data.total / data.pageSize)}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </button>
        </div>
      </div>
    </div>
  );
}

