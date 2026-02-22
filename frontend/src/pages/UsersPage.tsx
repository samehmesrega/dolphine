import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

type Role = { id: string; name: string; slug: string };

type User = {
  id: string;
  name: string;
  email: string;
  isActive?: boolean;
  role: Role;
};

async function fetchUsers(includeInactive: boolean) {
  const { data } = await api.get('/users', { params: includeInactive ? { includeInactive: '1' } : {} });
  return data.users as User[];
}

async function fetchRoles() {
  const { data } = await api.get('/users/roles');
  return data.roles as Role[];
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', includeInactive],
    queryFn: () => fetchUsers(includeInactive),
  });
  const { data: roles = [] } = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: fetchRoles,
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; email: string; password: string; roleId: string }) =>
      api.post('/users', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      setForm({ name: '', email: '', password: '', roleId: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      setEditingUser(null);
      setForm({ name: '', email: '', password: '', roleId: '' });
    },
  });

  const openAdd = () => {
    setForm({ name: '', email: '', password: '', roleId: roles[0]?.id ?? '' });
    setEditingUser(null);
    setModal('add');
  };
  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', roleId: u.role.id });
    setModal('edit');
  };
  const submitAdd = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.roleId) return;
    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      roleId: form.roleId,
    });
  };
  const submitEdit = () => {
    if (!editingUser || !form.name.trim() || !form.email.trim() || !form.roleId) return;
    const body: Record<string, unknown> = { name: form.name.trim(), email: form.email.trim(), roleId: form.roleId };
    if (form.password.length >= 6) body.password = form.password;
    updateMutation.mutate({ id: editingUser.id, body });
  };
  const setInactive = (u: User) => {
    if (!window.confirm(`تعطيل المستخدم "${u.name}"؟ لن يتمكن من تسجيل الدخول.`)) return;
    updateMutation.mutate({ id: u.id, body: { isActive: false } });
  };
  const setActive = (u: User) => {
    updateMutation.mutate({ id: u.id, body: { isActive: true } });
  };

  const err = (createMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
    || (updateMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">حسابات</h1>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-300"
          />
          عرض المعطّلين
        </label>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          إضافة مستخدم
        </button>
        {err && <span className="text-red-600 text-sm">{err}</span>}
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-slate-500">جاري التحميل...</div>
        ) : !users?.length ? (
          <div className="p-8 text-slate-500">لا يوجد مستخدمون.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">الاسم</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">البريد</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">الدور</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">الحالة</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700 w-32">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${u.isActive === false ? 'bg-slate-50 opacity-75' : ''}`}
                  >
                    <td className="py-3 px-4 text-slate-800">{u.name}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 text-slate-600">{u.role?.name ?? '—'}</td>
                    <td className="py-3 px-4">
                      {u.isActive === false ? (
                        <span className="text-amber-600">معطّل</span>
                      ) : (
                        <span className="text-green-600">نشط</span>
                      )}
                    </td>
                    <td className="py-3 px-4 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                      >
                        تعديل
                      </button>
                      {u.isActive !== false ? (
                        <button
                          type="button"
                          onClick={() => setInactive(u)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          تعطيل
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActive(u)}
                          className="text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          تفعيل
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة إضافة/تعديل */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {modal === 'add' ? 'إضافة مستخدم' : 'تعديل مستخدم'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الاسم</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="الاسم الكامل"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="user@example.com"
                  disabled={modal === 'edit'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  كلمة المرور {modal === 'edit' && '(اتركها فارغة للإبقاء على الحالية)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={modal === 'add' ? '6 أحرف على الأقل' : '••••••••'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الدور</label>
                <select
                  value={form.roleId}
                  onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => (modal === 'add' ? submitAdd() : submitEdit())}
                disabled={
                  !form.name.trim() || !form.email.trim() || !form.roleId
                  || (modal === 'add' && form.password.length < 6)
                  || createMutation.isPending
                  || updateMutation.isPending
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {modal === 'add' ? (createMutation.isPending ? 'جاري الحفظ...' : 'إضافة') : (updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ')}
              </button>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
