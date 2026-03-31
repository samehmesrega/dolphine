import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as inboxApi from '../services/inbox-api';

// Format message text — linkify URLs and handle long text
function MessageText({ content, direction }: { content: string; direction: string }) {
  const MAX_LEN = 500;
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > MAX_LEN;
  const displayText = isLong && !expanded ? content.slice(0, MAX_LEN) + '...' : content;

  // Split text by URLs and render links
  const parts = displayText.split(/(https?:\/\/[^\s]+)/g);

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.match(/^https?:\/\//) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${direction === 'inbound' ? 'text-blue-500' : 'text-violet-200'}`}
          >
            🔗 رابط
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`block text-xs mt-1 underline ${direction === 'inbound' ? 'text-blue-500' : 'text-violet-200'}`}
        >
          {expanded ? 'عرض أقل' : 'عرض المزيد'}
        </button>
      )}
    </p>
  );
}

// Platform icons
const PLATFORM_ICON: Record<string, { color: string; label: string }> = {
  messenger: { color: 'text-blue-500', label: 'Messenger' },
  instagram_dm: { color: 'text-purple-500', label: 'Instagram' },
};

export default function InboxLayout() {
  const { id: selectedId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isCommentsTab = location.pathname.startsWith('/inbox/comments');
  const [activeTab, setActiveTab] = useState<'conversations' | 'comments'>(isCommentsTab ? 'comments' : 'conversations');
  const [brandFilter, setBrandFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Brands for filter
  const { data: brandsRes } = useQuery({ queryKey: ['brands'], queryFn: inboxApi.getBrands });
  const brands = brandsRes?.data?.brands || [];

  // Channels for filter
  const { data: channelsRes } = useQuery({ queryKey: ['inbox', 'channels'], queryFn: inboxApi.getChannels });
  const allChannels = channelsRes?.data || [];
  const filteredChannels = brandFilter
    ? allChannels.filter((c: any) => c.socialPage?.brandId === brandFilter)
    : allChannels;

  // Conversations
  const convParams: Record<string, string> = {};
  if (brandFilter) convParams.brandId = brandFilter;
  if (channelFilter) convParams.channelId = channelFilter;

  const { data: convsRes } = useQuery({
    queryKey: ['inbox', 'conversations', convParams],
    queryFn: () => inboxApi.getConversations(convParams),
    refetchInterval: 10000,
    enabled: activeTab === 'conversations',
  });
  const conversations = convsRes?.data?.data || [];

  // Comment threads
  const { data: threadsRes } = useQuery({
    queryKey: ['inbox', 'comment-threads', convParams],
    queryFn: () => inboxApi.getCommentThreads(convParams),
    refetchInterval: 10000,
    enabled: activeTab === 'comments',
  });
  const threads = threadsRes?.data?.data || [];

  // Selected conversation detail
  const { data: convDetail } = useQuery({
    queryKey: ['inbox', 'conversation', selectedId],
    queryFn: () => inboxApi.getConversation(selectedId!),
    enabled: !!selectedId && activeTab === 'conversations',
  });
  const conversation = convDetail?.data;

  // Messages for selected conversation
  const { data: msgsRes } = useQuery({
    queryKey: ['inbox', 'messages', selectedId],
    queryFn: () => inboxApi.getMessages(selectedId!),
    enabled: !!selectedId && activeTab === 'conversations',
    refetchInterval: 5000,
  });
  const messages = msgsRes?.data || [];

  // Selected thread detail
  const { data: threadDetail } = useQuery({
    queryKey: ['inbox', 'thread', selectedId],
    queryFn: () => inboxApi.getCommentThread(selectedId!),
    enabled: !!selectedId && activeTab === 'comments',
  });
  const thread = threadDetail?.data;

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: () => inboxApi.sendMessage(selectedId!, messageText),
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
    },
  });

  // Reply to comment mutation
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const replyMutation = useMutation({
    mutationFn: () => inboxApi.replyToComment(replyingTo!, replyText),
    onSuccess: () => {
      setReplyText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['inbox', 'thread', selectedId] });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Tab switch
  const handleTabSwitch = (tab: 'conversations' | 'comments') => {
    setActiveTab(tab);
    navigate(tab === 'conversations' ? '/inbox/conversations' : '/inbox/comments');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Tab bar + filters */}
      <div className="bg-white border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => handleTabSwitch('conversations')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              activeTab === 'conversations' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            محادثات
          </button>
          <button
            onClick={() => handleTabSwitch('comments')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              activeTab === 'comments' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            تعليقات
          </button>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={brandFilter}
            onChange={(e) => { setBrandFilter(e.target.value); setChannelFilter(''); }}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="">كل البراندات</option>
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {filteredChannels.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() => setChannelFilter('')}
                className={`text-xs px-2 py-1 rounded ${!channelFilter ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}
              >
                الكل
              </button>
              {filteredChannels.map((ch: any) => (
                <button
                  key={ch.id}
                  onClick={() => setChannelFilter(ch.id)}
                  className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                    channelFilter === ch.id ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span className={ch.platform.includes('instagram') ? 'text-purple-500' : 'text-blue-500'}>
                    {ch.platform.includes('instagram') ? 'IG' : 'FB'}
                  </span>
                  {ch.socialPage?.pageName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* List panel */}
        <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto flex-shrink-0">
          {activeTab === 'conversations' ? (
            conversations.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">لا توجد محادثات</div>
            ) : (
              conversations.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/inbox/conversations/${conv.id}`)}
                  className={`w-full text-right p-3 border-b border-slate-100 hover:bg-slate-50 transition ${
                    selectedId === conv.id ? 'bg-violet-50 border-r-2 border-r-violet-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{conv.participantName || 'مجهول'}</span>
                    <div className="flex items-center gap-1">
                      {conv.unreadCount > 0 && (
                        <span className="bg-violet-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                      <span className={`text-xs ${PLATFORM_ICON[conv.platform]?.color || 'text-slate-400'}`}>
                        {conv.platform === 'messenger' ? 'FB' : 'IG'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{conv.messages?.[0]?.content || '...'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString('ar-EG') : ''}
                  </p>
                </button>
              ))
            )
          ) : (
            threads.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">لا توجد تعليقات</div>
            ) : (
              threads.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/inbox/comments/${t.id}`)}
                  className={`w-full text-right p-3 border-b border-slate-100 hover:bg-slate-50 transition ${
                    selectedId === t.id ? 'bg-violet-50 border-r-2 border-r-violet-500' : ''
                  }`}
                >
                  <p className="text-sm font-medium truncate">{t.postCaption || 'بوست'}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">{t._count?.comments || 0} تعليق</span>
                    <span className="text-[10px] text-slate-400">
                      {t.lastCommentAt ? new Date(t.lastCommentAt).toLocaleString('ar-EG') : ''}
                    </span>
                  </div>
                </button>
              ))
            )
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {activeTab === 'conversations' && selectedId && conversation ? (
            <>
              {/* Conversation header */}
              <div className="bg-white border-b border-slate-200 p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{conversation.participantName || 'مجهول'}</span>
                  <span className={`text-xs mr-2 ${PLATFORM_ICON[conversation.platform]?.color}`}>
                    {PLATFORM_ICON[conversation.platform]?.label}
                  </span>
                  {conversation.lead && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded mr-2">
                      ليد: {conversation.lead.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {/* TODO: open drawer */}}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                  title="معلومات العميل"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: any) => {
                  const isCommentReply = msg.content?.includes('بصدد الرد على تعليق') || msg.content?.includes('comment_id=');
                  const commentUrl = isCommentReply ? msg.content?.match(/https?:\/\/[^\s)]+/)?.[0] : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.direction === 'inbound'
                            ? 'bg-white border border-slate-200 text-slate-800'
                            : 'bg-violet-600 text-white'
                        }`}
                      >
                        {msg.contentType === 'image' && msg.attachments?.[0]?.url && (
                          <img src={msg.attachments[0].url} alt="" className="rounded-lg max-w-full mb-1" />
                        )}
                        {msg.content && (
                          isCommentReply ? (
                            <div className={`text-sm ${msg.direction === 'inbound' ? 'text-slate-600' : 'text-violet-100'}`}>
                              <p className="text-xs opacity-70 mb-1">↩️ رد على تعليق</p>
                              <p>{msg.content.replace(/\(https?:\/\/[^\s)]+\)/g, '').replace(/https?:\/\/[^\s]+/g, '').replace(/[\u200f\u200e]/g, '').trim()}</p>
                              {commentUrl && (
                                <a
                                  href={commentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs underline mt-1 inline-block ${msg.direction === 'inbound' ? 'text-blue-500' : 'text-violet-200'}`}
                                >
                                  عرض التعليق الأصلي
                                </a>
                              )}
                            </div>
                          ) : (
                            <MessageText content={msg.content} direction={msg.direction} />
                          )
                        )}
                        <div className={`text-[10px] mt-1 ${msg.direction === 'inbound' ? 'text-slate-400' : 'text-violet-200'}`}>
                          {msg.sentByUser?.name && <span className="ml-2">{msg.sentByUser.name}</span>}
                          {new Date(msg.platformTimestamp || msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="bg-white border-t border-slate-200 p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); if (messageText.trim()) sendMutation.mutate(); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="اكتب رسالة..."
                    className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    disabled={sendMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
                  >
                    {sendMutation.isPending ? '...' : 'إرسال'}
                  </button>
                </form>
              </div>
            </>
          ) : activeTab === 'comments' && selectedId && thread ? (
            <>
              {/* Thread header */}
              <div className="bg-white border-b border-slate-200 p-3">
                <p className="text-sm text-slate-600 truncate">{thread.postCaption || 'بوست'}</p>
                {thread.postUrl && (
                  <a href={thread.postUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                    فتح البوست
                  </a>
                )}
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(thread.comments || []).map((comment: any) => (
                  <div key={comment.id} className={`${comment.parentCommentId ? 'mr-8' : ''}`}>
                    <div className={`rounded-xl p-3 ${
                      comment.direction === 'outbound' ? 'bg-violet-50 border border-violet-200' : 'bg-white border border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{comment.authorName || comment.sentByUser?.name || 'مجهول'}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(comment.platformTimestamp || comment.createdAt).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{comment.content}</p>
                      {comment.direction === 'inbound' && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => { setReplyingTo(comment.id); setReplyText(''); }}
                            className="text-xs text-violet-600 hover:underline"
                          >
                            رد
                          </button>
                          <button
                            onClick={() => inboxApi.privateReplyToComment(comment.id, '').catch(() => {})}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            DM
                          </button>
                          <button
                            onClick={() => inboxApi.hideComment(comment.id).then(() => queryClient.invalidateQueries({ queryKey: ['inbox', 'thread', selectedId] }))}
                            className="text-xs text-red-500 hover:underline"
                          >
                            {comment.isHidden ? 'إظهار' : 'إخفاء'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Reply input */}
                    {replyingTo === comment.id && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); if (replyText.trim()) replyMutation.mutate(); }}
                        className="flex gap-2 mt-2 mr-4"
                      >
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="اكتب رد..."
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                        >
                          رد
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="text-slate-400 text-sm"
                        >
                          إلغاء
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>اختر محادثة أو تعليق من القائمة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
