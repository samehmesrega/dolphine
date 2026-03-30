import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import { useAuth } from '../../auth/context/AuthContext';

interface TicketComment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface Ticket {
  id: string;
  type: string;
  description: string;
  screenshot: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  status: string;
  priority: string | null;
  createdBy: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  creator: { id: string; name: string; email: string };
  comments?: TicketComment[];
  _count?: { comments: number };
}

const TYPE_MAP: Record<string, { label: string; emoji: string; color: string }> = {
  bug: { label: 'مشكلة', emoji: '\uD83D\uDD34', color: 'bg-red-100 text-red-700' },
  improvement: { label: 'تحسين', emoji: '\uD83D\uDFE1', color: 'bg-yellow-100 text-yellow-700' },
  suggestion: { label: 'اقتراح', emoji: '\uD83D\uDFE2', color: 'bg-green-100 text-green-700' },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: 'جديدة', color: 'bg-blue-100 text-blue-700' },
  reviewing: { label: 'قيد المراجعة', color: 'bg-purple-100 text-purple-700' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-orange-100 text-orange-700' },
  resolved: { label: 'تم الحل', color: 'bg-green-100 text-green-700' },
  closed: { label: 'مغلقة', color: 'bg-slate-100 text-slate-600' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  critical: { label: 'حرجة', color: 'bg-red-100 text-red-700' },
  high: { label: 'عالية', color: 'bg-orange-100 text-orange-700' },
  medium: { label: 'متوسطة', color: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'منخفضة', color: 'bg-slate-100 text-slate-600' },
};

export default function TicketsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);

  const isAdmin =
    user?.role?.slug === 'super_admin' ||
    user?.role?.slug === 'admin' ||
    user?.permissions?.includes('*');

  // Fetch tickets list
  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['tickets', filterType, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      return api.get(`/tickets?${params.toString()}`);
    },
  });

  const tickets: Ticket[] = ticketsData?.data?.tickets || [];

  // Fetch selected ticket detail
  const { data: ticketDetailData } = useQuery({
    queryKey: ['ticket-detail', selectedTicketId],
    queryFn: () => api.get(`/tickets/${selectedTicketId}`),
    enabled: !!selectedTicketId,
  });

  const selectedTicket: Ticket | null = ticketDetailData?.data?.ticket || null;

  // Update ticket mutation (admin)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/tickets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', selectedTicketId] });
    },
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.post(`/tickets/${id}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail', selectedTicketId] });
      setNewComment('');
    },
  });

  const handleAddComment = () => {
    if (!selectedTicketId || !newComment.trim()) return;
    commentMutation.mutate({ id: selectedTicketId, content: newComment.trim() });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">التذاكر</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin ? 'إدارة جميع التذاكر والبلاغات' : 'التذاكر الخاصة بك'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">كل الأنواع</option>
          <option value="bug">مشكلة</option>
          <option value="improvement">تحسين</option>
          <option value="suggestion">اقتراح</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">كل الحالات</option>
          <option value="new">جديدة</option>
          <option value="reviewing">قيد المراجعة</option>
          <option value="in_progress">قيد التنفيذ</option>
          <option value="resolved">تم الحل</option>
          <option value="closed">مغلقة</option>
        </select>
      </div>

      <div className="flex gap-6">
        {/* Tickets Table */}
        <div className={`${selectedTicketId ? 'w-1/2' : 'w-full'} transition-all`}>
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
              <div className="text-4xl mb-3">{'\uD83C\uDF89'}</div>
              <p>لا توجد تذاكر</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">النوع</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">الوصف</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">الحالة</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">الأولوية</th>
                    {isAdmin && (
                      <th className="text-right px-4 py-3 text-slate-500 font-medium">المبلّغ</th>
                    )}
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">التاريخ</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium">تعليقات</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => {
                    const typeInfo = TYPE_MAP[ticket.type] || { label: ticket.type, emoji: '', color: 'bg-slate-100' };
                    const statusInfo = STATUS_MAP[ticket.status] || { label: ticket.status, color: 'bg-slate-100' };
                    const priorityInfo = ticket.priority
                      ? PRIORITY_MAP[ticket.priority] || { label: ticket.priority, color: 'bg-slate-100' }
                      : null;

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id === selectedTicketId ? null : ticket.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          selectedTicketId === ticket.id
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                            {typeInfo.emoji} {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="truncate text-slate-700">{ticket.description}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {priorityInfo ? (
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${priorityInfo.color}`}>
                              {priorityInfo.label}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-slate-600">{ticket.creator.name}</td>
                        )}
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {formatDate(ticket.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-slate-400 text-xs">
                            {ticket._count?.comments || 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ticket Detail Panel */}
        {selectedTicketId && selectedTicket && (
          <div className="w-1/2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">تفاصيل التذكرة</h2>
              <button
                onClick={() => setSelectedTicketId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                {'\u2715'}
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* Type & Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const t = TYPE_MAP[selectedTicket.type];
                  return t ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${t.color}`}>
                      {t.emoji} {t.label}
                    </span>
                  ) : null;
                })()}
                {(() => {
                  const s = STATUS_MAP[selectedTicket.status];
                  return s ? (
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>
                      {s.label}
                    </span>
                  ) : null;
                })()}
                {selectedTicket.priority && (() => {
                  const p = PRIORITY_MAP[selectedTicket.priority];
                  return p ? (
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${p.color}`}>
                      {p.label}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">الوصف</label>
                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">المبلّغ:</span>
                  <span className="text-slate-700 mr-1">{selectedTicket.creator.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">التاريخ:</span>
                  <span className="text-slate-700 mr-1">{formatDate(selectedTicket.createdAt)}</span>
                </div>
                {selectedTicket.pageUrl && (
                  <div className="col-span-2">
                    <span className="text-slate-500">الصفحة:</span>
                    <span className="text-blue-600 mr-1 break-all">{selectedTicket.pageUrl}</span>
                  </div>
                )}
                {selectedTicket.resolvedAt && (
                  <div className="col-span-2">
                    <span className="text-slate-500">تاريخ الحل:</span>
                    <span className="text-green-600 mr-1">{formatDate(selectedTicket.resolvedAt)}</span>
                  </div>
                )}
              </div>

              {/* Screenshot */}
              {selectedTicket.screenshot && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">صورة الشاشة</label>
                  <img
                    src={selectedTicket.screenshot}
                    alt="Screenshot"
                    className="w-full rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setScreenshotModal(selectedTicket.screenshot)}
                  />
                </div>
              )}

              {/* Admin Controls */}
              {isAdmin && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">تحكم المدير</h3>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-1">الحالة</label>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: selectedTicket.id,
                            data: { status: e.target.value },
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="new">جديدة</option>
                        <option value="reviewing">قيد المراجعة</option>
                        <option value="in_progress">قيد التنفيذ</option>
                        <option value="resolved">تم الحل</option>
                        <option value="closed">مغلقة</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-1">الأولوية</label>
                      <select
                        value={selectedTicket.priority || ''}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: selectedTicket.id,
                            data: { priority: e.target.value || null },
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="">بدون</option>
                        <option value="critical">حرجة</option>
                        <option value="high">عالية</option>
                        <option value="medium">متوسطة</option>
                        <option value="low">منخفضة</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  التعليقات ({selectedTicket.comments?.length || 0})
                </h3>

                {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {selectedTicket.comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700">
                            {comment.user.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-4">لا توجد تعليقات بعد</p>
                )}

                {/* Add Comment */}
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="أضف تعليق..."
                    rows={2}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || commentMutation.isPending}
                    className="self-end px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {commentMutation.isPending ? '...' : 'إرسال'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Screenshot Full Modal */}
      {screenshotModal && (
        <div
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-8"
          onClick={() => setScreenshotModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setScreenshotModal(null)}
              className="absolute -top-3 -left-3 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg text-slate-600 hover:text-slate-800"
            >
              {'\u2715'}
            </button>
            <img
              src={screenshotModal}
              alt="Screenshot full"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
