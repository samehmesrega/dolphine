import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  entity: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
};

async function fetchUnreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.count as number;
}

async function fetchNotifications() {
  const { data } = await api.get('/notifications', { params: { pageSize: 15 } });
  return data.notifications as Notification[];
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 60 * 1000,
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: fetchNotifications,
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const linkFor = (n: Notification) => {
    if (n.entity === 'lead' && n.entityId) return `/leads/${n.entityId}`;
    if (n.entity === 'order' && n.entityId) return `/orders/${n.entityId}`;
    if (n.type === 'order_pending_accounts') return '/orders-pending';
    return null;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-700 text-slate-300"
        aria-label="الإشعارات"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-xs rounded-full">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-hidden bg-white rounded-xl shadow-xl border border-slate-200 z-50 text-right">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-800">الإشعارات</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-72">
            {isLoading ? (
              <div className="p-4 text-slate-500 text-sm">جاري التحميل...</div>
            ) : list.length === 0 ? (
              <div className="p-4 text-slate-500 text-sm">لا توجد إشعارات</div>
            ) : (
              list.map((n) => {
                const to = linkFor(n);
                const content = (
                  <>
                    <p className={`text-sm ${n.isRead ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </>
                );
                return (
                  <div
                    key={n.id}
                    className={`border-b border-slate-100 p-3 hover:bg-slate-50 ${!n.isRead ? 'bg-indigo-50/50' : ''}`}
                  >
                    {to ? (
                      <Link
                        to={to}
                        onClick={() => {
                          if (!n.isRead) markReadMutation.mutate(n.id);
                          setOpen(false);
                        }}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!n.isRead) markReadMutation.mutate(n.id);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (n.isRead ? undefined : markReadMutation.mutate(n.id))}
                      >
                        {content}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
