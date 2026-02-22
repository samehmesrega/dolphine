import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  oldData: unknown;
  newData: unknown;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};

async function fetchAuditLogs(params: { page: number; pageSize: number; entity?: string; action?: string }) {
  const { data } = await api.get('/audit-logs', { params });
  return data as { total: number; page: number; pageSize: number; logs: AuditLog[] };
}

const ENTITIES: Record<string, string> = {
  lead: 'ليد',
  order: 'طلب',
  user: 'مستخدم',
};

const ACTIONS: Record<string, string> = {
  update: 'تعديل',
  create: 'إنشاء',
  order_confirm: 'تأكيد طلب',
  order_reject: 'رفض طلب',
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, entity, action],
    queryFn: () =>
      fetchAuditLogs({
        page,
        pageSize: 20,
        ...(entity && { entity }),
        ...(action && { action }),
      }),
  });

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">سجل التدقيق</h1>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل الكيانات</option>
          {Object.entries(ENTITIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل الإجراءات</option>
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-slate-500">جاري التحميل...</div>
        ) : !data?.logs?.length ? (
          <div className="p-8 text-slate-500">لا توجد سجلات.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">التاريخ</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">المستخدم</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الإجراء</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">الكيان</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">معرف</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(log.createdAt).toLocaleString('ar-SA')}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {log.user ? `${log.user.name} (${log.user.email})` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-800">{ACTIONS[log.action] ?? log.action}</td>
                      <td className="py-3 px-4 text-slate-800">{ENTITIES[log.entity] ?? log.entity}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-xs">{log.entityId.slice(0, 8)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {total} سجل — صفحة {page} من {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                  >
                    السابق
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
