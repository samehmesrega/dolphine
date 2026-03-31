import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';

export default function PendingUsersPage() {
  const qc = useQueryClient();
  const [approveId, setApproveId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings-pending'],
    queryFn: () => api.get('/settings/users/pending'),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['settings-roles'],
    queryFn: () => api.get('/settings/users/roles'),
  });

  const pendingUsers: any[] = data?.data?.users || [];
  const roles: any[] = (rolesData?.data?.roles || []).filter((r: any) => r.slug !== 'pending');

  const approveMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      api.patch(`/settings/users/${userId}/approve`, { roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-pending'] });
      qc.invalidateQueries({ queryKey: ['settings-pending-count'] });
      setApproveId(null);
      setRoleId('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/settings/users/${userId}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-pending'] });
      qc.invalidateQueries({ queryKey: ['settings-pending-count'] });
    },
  });

  if (isLoading) return <div className="p-8 text-slate-500" dir="rtl">جاري التحميل...</div>;

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-bold mb-6">طلبات التسجيل</h1>

      {pendingUsers.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-slate-400">
          <p className="text-lg mb-1">لا توجد طلبات تسجيل جديدة</p>
          <p className="text-sm">ستظهر هنا عندما يسجّل مستخدم جديد</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-slate-600">الاسم</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">الإيميل</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">الموبايل</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">طريقة التسجيل</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">تاريخ التسجيل</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u: any) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.authMethod === 'google' ? 'bg-blue-100 text-blue-700' : u.authMethod === 'slack' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {u.authMethod === 'google' ? 'Google' : u.authMethod === 'slack' ? 'Slack' : 'إيميل'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    {approveId === u.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={roleId}
                          onChange={(e) => setRoleId(e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="">اختر الدور...</option>
                          {roles.map((r: any) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => roleId && approveMutation.mutate({ userId: u.id, roleId })}
                          disabled={!roleId || approveMutation.isPending}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                        >
                          تأكيد
                        </button>
                        <button
                          onClick={() => { setApproveId(null); setRoleId(''); }}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setApproveId(u.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                        >
                          قبول
                        </button>
                        <button
                          onClick={() => { if (confirm('هل أنت متأكد من رفض هذا المستخدم؟')) rejectMutation.mutate(u.id); }}
                          className="bg-red-50 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-100"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
