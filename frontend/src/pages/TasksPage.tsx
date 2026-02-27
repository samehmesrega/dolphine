import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

type TaskLead = { id: string; number: number; name: string; phone: string };
type TaskOrder = { id: string; number: number; wooCommerceId?: number | null };
type TaskUser = { id: string; name: string };

type Task = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  status: string;
  assignedTo: TaskUser;
  lead?: TaskLead | null;
  order?: TaskOrder | null;
  snoozedUntil?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

const TASK_TYPE_LABEL: Record<string, string> = {
  new_lead: 'ليد جديد',
  re_contact: 'إعادة تواصل',
  status_followup: 'متابعة حالة',
  callback_replied: 'رد على طلب',
  order_issue: 'مشكلة أوردر',
  manual: 'مهمة يدوية',
};

const TASK_TYPE_COLOR: Record<string, string> = {
  new_lead: 'bg-blue-50 text-blue-700 border-blue-200',
  re_contact: 'bg-amber-50 text-amber-700 border-amber-200',
  status_followup: 'bg-orange-50 text-orange-700 border-orange-200',
  callback_replied: 'bg-purple-50 text-purple-700 border-purple-200',
  order_issue: 'bg-red-50 text-red-700 border-red-200',
  manual: 'bg-slate-100 text-slate-600 border-slate-200',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

async function fetchTasks(params: { status: string; assignedToId?: string }) {
  const { data } = await api.get('/tasks', { params });
  return data.tasks as Task[];
}

async function fetchUsers() {
  const { data } = await api.get('/users');
  return data.users as { id: string; name: string }[];
}

export default function TasksPage() {
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission('tasks.manage') || user?.permissions?.includes('*');
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'pending' | 'snoozed' | 'done'>('pending');
  const [filterUserId, setFilterUserId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newLeadId, setNewLeadId] = useState('');

  const queryParams = {
    status: tab,
    ...(canManage && filterUserId ? { assignedToId: filterUserId } : {}),
  };

  const { data: tasks = [], isLoading, isFetching } = useQuery({
    queryKey: ['tasks', queryParams],
    queryFn: () => fetchTasks(queryParams),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: fetchUsers,
    enabled: !!canManage,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const doneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/done`),
    onSuccess: invalidate,
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      api.patch(`/tasks/${id}/snooze`, { days }),
    onSuccess: () => { setSnoozeTaskId(null); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: invalidate,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/tasks', body),
    onSuccess: () => {
      setShowCreate(false);
      setNewTitle(''); setNewDesc(''); setNewAssignee(''); setNewLeadId('');
      invalidate();
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAssignee) return;
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      assignedToId: newAssignee,
      leadId: newLeadId || undefined,
    });
  };

  const TABS = [
    { key: 'pending', label: 'معلقة' },
    { key: 'snoozed', label: 'مؤجلة' },
    { key: 'done', label: 'مكتملة' },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">المهام</h1>
        <div className="flex items-center gap-3">
          {isFetching && <span className="text-sm text-slate-400">جاري التحديث...</span>}
          {canManage && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + مهمة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showCreate && canManage && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">إنشاء مهمة يدوية</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">العنوان *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                  placeholder="عنوان المهمة"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">الموظف *</label>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                  required
                >
                  <option value="">اختر موظف</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">رابط ليد (اختياري)</label>
                <input
                  type="text"
                  value={newLeadId}
                  onChange={(e) => setNewLeadId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                  placeholder="UUID الليد"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">وصف (اختياري)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
                  placeholder="تفاصيل إضافية"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                {createMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="border border-slate-300 text-slate-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tabs */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Manager filter */}
          {canManage && (
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
            >
              <option value="">كل الموظفين</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}

          <span className="text-slate-400 text-sm mr-auto">
            {tasks.length} مهمة
          </span>
        </div>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="p-8 text-slate-400 text-center">جاري التحميل...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا توجد مهام {tab === 'pending' ? 'معلقة' : tab === 'snoozed' ? 'مؤجلة' : 'مكتملة'}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Type badge + time */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        TASK_TYPE_COLOR[task.type] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {TASK_TYPE_LABEL[task.type] ?? task.type}
                    </span>
                    <span className="text-slate-400 text-xs">{timeAgo(task.createdAt)}</span>
                    {canManage && (
                      <span className="text-slate-400 text-xs">— {task.assignedTo.name}</span>
                    )}
                  </div>

                  {/* Title */}
                  <p className="font-medium text-slate-800 mb-1">{task.title}</p>

                  {/* Description */}
                  {task.description && (
                    <p className="text-sm text-slate-500 mb-2">{task.description}</p>
                  )}

                  {/* Lead/Order link */}
                  {task.lead && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <span>الليد:</span>
                      <span className="font-medium">{task.lead.name}</span>
                      <span className="text-slate-400 text-xs">(#{task.lead.number})</span>
                      <Link
                        to={`/leads/${task.lead.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-1"
                      >
                        فتح الليد ←
                      </Link>
                    </div>
                  )}
                  {task.order && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <span>الأوردر:</span>
                      <span className="font-medium">
                        #{task.order.wooCommerceId ?? task.order.number}
                      </span>
                      <Link
                        to={`/orders/${task.order.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-1"
                      >
                        فتح الأوردر ←
                      </Link>
                    </div>
                  )}

                  {/* Snoozed until */}
                  {task.status === 'snoozed' && task.snoozedUntil && (
                    <p className="text-xs text-amber-600 mt-1">
                      مؤجل حتى: {new Date(task.snoozedUntil).toLocaleDateString('ar-EG')}
                    </p>
                  )}
                  {task.status === 'done' && task.completedAt && (
                    <p className="text-xs text-green-600 mt-1">
                      اكتملت: {new Date(task.completedAt).toLocaleDateString('ar-EG')}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {task.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Snooze dropdown */}
                    {snoozeTaskId === task.id ? (
                      <div className="flex items-center gap-1">
                        {[1, 3, 7].map((d) => (
                          <button
                            key={d}
                            onClick={() => snoozeMutation.mutate({ id: task.id, days: d })}
                            disabled={snoozeMutation.isPending}
                            className="border border-amber-300 text-amber-700 rounded px-2 py-1 text-xs hover:bg-amber-50 transition-colors disabled:opacity-40"
                          >
                            {d} يوم
                          </button>
                        ))}
                        <button
                          onClick={() => setSnoozeTaskId(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSnoozeTaskId(task.id)}
                        className="border border-slate-300 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors"
                      >
                        تأجيل
                      </button>
                    )}

                    <button
                      onClick={() => doneMutation.mutate(task.id)}
                      disabled={doneMutation.isPending}
                      className="bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-40"
                    >
                      ✓ تم
                    </button>
                  </div>
                )}

                {canManage && (
                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
                    disabled={deleteMutation.isPending}
                    className="text-slate-300 hover:text-red-500 transition-colors text-sm flex-shrink-0"
                    title="حذف المهمة"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
