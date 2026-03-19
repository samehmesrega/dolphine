import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as mktApi from '../services/marketing-api';

interface PostPage {
  id: string;
  socialPage: { id: string; platform: string; pageName: string };
  status: string;
}

interface ScheduledPost {
  id: string;
  caption: string;
  mediaUrl?: string;
  postType: string;
  scheduledAt: string;
  status: string;
  publishedAt?: string;
  error?: string;
  creative?: { id: string; code: string; name: string };
  creator?: { id: string; name: string };
  pages: PostPage[];
}

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-200 text-gray-700',
  SCHEDULED: 'bg-yellow-100 text-yellow-700',
  PUBLISHING: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const platformIcons: Record<string, string> = {
  facebook: 'FB',
  instagram: 'IG',
  tiktok: 'TT',
  snapchat: 'SC',
};

export default function ContentCalendar() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState('');

  const [form, setForm] = useState({
    caption: '',
    mediaUrl: '',
    postType: 'POST',
    scheduledAt: '',
    pageIds: [] as string[],
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const from = firstDay.toISOString();
  const to = lastDay.toISOString();

  const { data: calendarData } = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => mktApi.getCalendarPosts(from, to),
  });

  const { data: pagesData } = useQuery({
    queryKey: ['social-pages'],
    queryFn: () => mktApi.getSocialPages(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => mktApi.createScheduledPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setShowForm(false);
      setForm({ caption: '', mediaUrl: '', postType: 'POST', scheduledAt: '', pageIds: [] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      mktApi.updatePostStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setSelectedPost(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mktApi.deleteScheduledPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setSelectedPost(null);
    },
  });

  const posts: ScheduledPost[] = calendarData?.data?.posts || [];
  const socialPages = pagesData?.data?.pages || [];

  // Group posts by day
  const postsByDay = useMemo(() => {
    const map: Record<number, ScheduledPost[]> = {};
    posts.forEach((p) => {
      const day = new Date(p.scheduledAt).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(p);
    });
    return map;
  }, [posts]);

  // Calendar grid
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const monthName = currentDate.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00:00`;
    setFormDate(dateStr);
    setForm({ ...form, scheduledAt: dateStr });
    setShowForm(true);
  };

  const handleCreate = () => {
    if (!form.caption || !form.scheduledAt) return;
    createMutation.mutate(form);
  };

  const togglePage = (pageId: string) => {
    setForm((prev) => ({
      ...prev,
      pageIds: prev.pageIds.includes(pageId)
        ? prev.pageIds.filter((id) => id !== pageId)
        : [...prev.pageIds, pageId],
    }));
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content Calendar</h1>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="px-3 py-1 border rounded hover:bg-gray-50">&lt;</button>
          <span className="text-lg font-semibold min-w-[200px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="px-3 py-1 border rounded hover:bg-gray-50">&gt;</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0 bg-white rounded-lg border overflow-hidden">
        {/* Header row */}
        {DAYS_AR.map((day) => (
          <div key={day} className="bg-gray-50 p-2 text-center text-sm font-semibold border-b">
            {day}
          </div>
        ))}

        {/* Calendar cells */}
        {calendarDays.map((day, idx) => (
          <div
            key={idx}
            className={`min-h-[120px] border-b border-l p-1 ${day ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'}`}
            onClick={() => day && handleDayClick(day)}
          >
            {day && (
              <>
                <div className="text-xs text-gray-500 mb-1">{day}</div>
                <div className="space-y-1">
                  {(postsByDay[day] || []).slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      className={`text-xs p-1 rounded cursor-pointer ${statusColors[post.status] || 'bg-gray-100'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPost(post);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {post.pages.map((pp) => (
                          <span key={pp.id} className="font-bold">
                            {platformIcons[pp.socialPage.platform] || pp.socialPage.platform}
                          </span>
                        ))}
                        <span className="truncate">{post.caption.substring(0, 20)}</span>
                      </div>
                      <div className="text-[10px] opacity-70">
                        {new Date(post.scheduledAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                  {(postsByDay[day] || []).length > 3 && (
                    <div className="text-[10px] text-gray-400">
                      +{(postsByDay[day] || []).length - 3} more
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Create Post Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">New Post</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Caption *</label>
                <textarea
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Post caption..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Media URL</label>
                <input
                  value={form.mediaUrl}
                  onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Google Drive or direct URL"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Post Type</label>
                  <select
                    value={form.postType}
                    onChange={(e) => setForm({ ...form, postType: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="POST">Post</option>
                    <option value="STORY">Story</option>
                    <option value="REEL">Reel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Scheduled At</label>
                  <input
                    type="datetime-local"
                    value={formDate}
                    onChange={(e) => {
                      setFormDate(e.target.value);
                      setForm({ ...form, scheduledAt: new Date(e.target.value).toISOString() });
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Publish To</label>
                <div className="flex flex-wrap gap-2">
                  {socialPages.length === 0 && (
                    <p className="text-sm text-gray-400">No social pages connected. Connect pages in Settings.</p>
                  )}
                  {socialPages.map((page: any) => (
                    <button
                      key={page.id}
                      onClick={() => togglePage(page.id)}
                      className={`px-3 py-1 rounded-full text-sm border ${
                        form.pageIds.includes(page.id)
                          ? 'bg-purple-100 border-purple-400 text-purple-700'
                          : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      {platformIcons[page.platform] || page.platform} {page.pageName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!form.caption || !form.scheduledAt}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Create Post
              </button>
              <button onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Post Details</h2>
              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[selectedPost.status]}`}>
                {selectedPost.status}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Caption:</span>
                <p className="mt-1 bg-gray-50 p-2 rounded">{selectedPost.caption}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-medium">Type:</span> {selectedPost.postType}</div>
                <div><span className="font-medium">Scheduled:</span> {new Date(selectedPost.scheduledAt).toLocaleString('ar-EG')}</div>
              </div>
              {selectedPost.creative && (
                <div><span className="font-medium">Creative:</span> {selectedPost.creative.code} - {selectedPost.creative.name}</div>
              )}
              <div>
                <span className="font-medium">Pages:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPost.pages.map((pp) => (
                    <span key={pp.id} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                      {platformIcons[pp.socialPage.platform]} {pp.socialPage.pageName}
                      <span className={`ml-1 ${pp.status === 'PUBLISHED' ? 'text-green-600' : pp.status === 'FAILED' ? 'text-red-600' : ''}`}>
                        ({pp.status})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              {selectedPost.error && (
                <div className="bg-red-50 text-red-700 p-2 rounded text-xs">{selectedPost.error}</div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              {(selectedPost.status === 'DRAFT' || selectedPost.status === 'SCHEDULED') && (
                <>
                  <button
                    onClick={() => statusMutation.mutate({ id: selectedPost.id, status: 'SCHEDULED' })}
                    className="bg-yellow-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-yellow-600"
                  >
                    Schedule
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: selectedPost.id, status: 'PUBLISHED' })}
                    className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700"
                  >
                    Mark Published
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(selectedPost.id)}
                    className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600"
                  >
                    Delete
                  </button>
                </>
              )}
              <button onClick={() => setSelectedPost(null)} className="border px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
