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

  const parts = displayText.split(/(https?:\/\/[^\s]+)/g);

  return (
    <p className="text-sm whitespace-pre-wrap break-words font-body">
      {parts.map((part, i) =>
        part.match(/^https?:\/\//) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${direction === 'inbound' ? 'text-ds-primary' : 'text-white/70'}`}
          >
            رابط
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`block text-xs mt-1 underline ${direction === 'inbound' ? 'text-ds-primary' : 'text-white/70'}`}
        >
          {expanded ? 'عرض أقل' : 'عرض المزيد'}
        </button>
      )}
    </p>
  );
}

const PLATFORM_ICON: Record<string, { color: string; label: string }> = {
  messenger: { color: 'text-blue-600', label: 'Messenger' },
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

  const { data: brandsRes } = useQuery({ queryKey: ['brands'], queryFn: inboxApi.getBrands });
  const brands = brandsRes?.data?.brands || [];

  const { data: channelsRes } = useQuery({ queryKey: ['inbox', 'channels'], queryFn: inboxApi.getChannels });
  const allChannels = channelsRes?.data || [];
  const filteredChannels = brandFilter
    ? allChannels.filter((c: any) => c.socialPage?.brandId === brandFilter)
    : allChannels;

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

  const { data: threadsRes } = useQuery({
    queryKey: ['inbox', 'comment-threads', convParams],
    queryFn: () => inboxApi.getCommentThreads(convParams),
    refetchInterval: 10000,
    enabled: activeTab === 'comments',
  });
  const threads = threadsRes?.data?.data || [];

  const { data: convDetail } = useQuery({
    queryKey: ['inbox', 'conversation', selectedId],
    queryFn: () => inboxApi.getConversation(selectedId!),
    enabled: !!selectedId && activeTab === 'conversations',
  });
  const conversation = convDetail?.data;

  const { data: msgsRes } = useQuery({
    queryKey: ['inbox', 'messages', selectedId],
    queryFn: () => inboxApi.getMessages(selectedId!),
    enabled: !!selectedId && activeTab === 'conversations',
    refetchInterval: 5000,
  });
  const messages = msgsRes?.data || [];

  const { data: threadDetail } = useQuery({
    queryKey: ['inbox', 'thread', selectedId],
    queryFn: () => inboxApi.getCommentThread(selectedId!),
    enabled: !!selectedId && activeTab === 'comments',
  });
  const thread = threadDetail?.data;

  const sendMutation = useMutation({
    mutationFn: () => inboxApi.sendMessage(selectedId!, messageText),
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
    },
  });

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTabSwitch = (tab: 'conversations' | 'comments') => {
    setActiveTab(tab);
    navigate(tab === 'conversations' ? '/inbox/conversations' : '/inbox/comments');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] font-body">
      {/* Tab bar + filters — tonal surface shift instead of border */}
      <div className="bg-ds-surface-card px-4 py-3">
        <div className="flex items-center gap-3 mb-2.5">
          {/* Tab pills with gradient active state */}
          <div className="flex bg-ds-surface-low rounded-xl p-1">
            <button
              onClick={() => handleTabSwitch('conversations')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'conversations'
                  ? 'bg-gradient-to-l from-ds-primary to-ds-primary-c text-white shadow-sm'
                  : 'text-ds-on-surface-v hover:text-ds-on-surface'
              }`}
            >
              محادثات
            </button>
            <button
              onClick={() => handleTabSwitch('comments')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'comments'
                  ? 'bg-gradient-to-l from-ds-primary to-ds-primary-c text-white shadow-sm'
                  : 'text-ds-on-surface-v hover:text-ds-on-surface'
              }`}
            >
              تعليقات
            </button>
          </div>
        </div>
        {/* Filters — ghost border inputs */}
        <div className="flex items-center gap-2">
          <select
            value={brandFilter}
            onChange={(e) => { setBrandFilter(e.target.value); setChannelFilter(''); }}
            className="text-xs bg-ds-surface-card border border-ds-outline/15 rounded-xl px-3 py-1.5 text-ds-on-surface focus:outline-none focus:border-ds-primary/40 transition"
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
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  !channelFilter ? 'bg-ds-primary/10 text-ds-primary font-medium' : 'bg-ds-surface-low text-ds-on-surface-v'
                }`}
              >
                الكل
              </button>
              {filteredChannels.map((ch: any) => (
                <button
                  key={ch.id}
                  onClick={() => setChannelFilter(ch.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                    channelFilter === ch.id ? 'bg-ds-primary/10 text-ds-primary font-medium' : 'bg-ds-surface-low text-ds-on-surface-v'
                  }`}
                >
                  <span className={ch.platform.includes('instagram') ? 'text-purple-500' : 'text-blue-600'}>
                    {ch.platform.includes('instagram') ? 'IG' : 'FB'}
                  </span>
                  {ch.socialPage?.pageName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Split pane — tonal separation instead of border */}
      <div className="flex-1 flex overflow-hidden">
        {/* List panel — surface-card on surface-low bg */}
        <div className="w-80 bg-ds-surface-card overflow-y-auto flex-shrink-0">
          {activeTab === 'conversations' ? (
            conversations.length === 0 ? (
              <div className="p-6 text-center text-ds-on-surface-v text-sm">لا توجد محادثات</div>
            ) : (
              conversations.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/inbox/conversations/${conv.id}`)}
                  className={`w-full text-right p-3.5 transition-colors ${
                    selectedId === conv.id
                      ? 'bg-ds-primary/5 border-r-[3px] border-r-ds-primary'
                      : 'hover:bg-ds-surface-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-ds-on-surface truncate">{conv.participantName || 'مجهول'}</span>
                    <div className="flex items-center gap-1.5">
                      {conv.unreadCount > 0 && (
                        <span className="bg-gradient-to-l from-ds-primary to-ds-primary-c text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-medium">
                          {conv.unreadCount}
                        </span>
                      )}
                      <span className={`text-xs ${PLATFORM_ICON[conv.platform]?.color || 'text-ds-on-surface-v'}`}>
                        {conv.platform === 'messenger' ? 'FB' : 'IG'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-ds-on-surface-v truncate">{conv.messages?.[0]?.content || '...'}</p>
                  <p className="text-[10px] text-ds-outline mt-1">
                    {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString('ar-EG') : ''}
                  </p>
                </button>
              ))
            )
          ) : (
            threads.length === 0 ? (
              <div className="p-6 text-center text-ds-on-surface-v text-sm">لا توجد تعليقات</div>
            ) : (
              threads.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/inbox/comments/${t.id}`)}
                  className={`w-full text-right p-3.5 transition-colors ${
                    selectedId === t.id
                      ? 'bg-ds-primary/5 border-r-[3px] border-r-ds-primary'
                      : 'hover:bg-ds-surface-low'
                  }`}
                >
                  <p className="text-sm font-medium text-ds-on-surface truncate">{t.postCaption || 'بوست'}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-ds-on-surface-v">{t._count?.comments || 0} تعليق</span>
                    <span className="text-[10px] text-ds-outline">
                      {t.lastCommentAt ? new Date(t.lastCommentAt).toLocaleString('ar-EG') : ''}
                    </span>
                  </div>
                </button>
              ))
            )
          )}
        </div>

        {/* Detail panel — surface background */}
        <div className="flex-1 flex flex-col bg-ds-surface-low">
          {activeTab === 'conversations' && selectedId && conversation ? (
            <>
              {/* Conversation header — card surface, no border */}
              <div className="bg-ds-surface-card p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-ds-on-surface">{conversation.participantName || 'مجهول'}</span>
                  <span className={`text-xs ${PLATFORM_ICON[conversation.platform]?.color}`}>
                    {PLATFORM_ICON[conversation.platform]?.label}
                  </span>
                  {conversation.lead && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-lg">
                      ليد: {conversation.lead.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {/* TODO: open drawer */}}
                  className="p-2 hover:bg-ds-surface-low rounded-xl text-ds-on-surface-v transition-colors"
                  title="معلومات العميل"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>

              {/* Messages area */}
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
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          msg.direction === 'inbound'
                            ? 'bg-ds-surface-card text-ds-on-surface shadow-[0_1px_4px_rgba(25,28,29,0.06)]'
                            : 'bg-gradient-to-l from-ds-primary to-ds-primary-c text-white'
                        }`}
                      >
                        {msg.contentType === 'image' && msg.attachments?.[0]?.url && (
                          <img src={msg.attachments[0].url} alt="" className="rounded-xl max-w-full mb-1" />
                        )}
                        {msg.content && (
                          isCommentReply ? (
                            <div className={`text-sm ${msg.direction === 'inbound' ? 'text-ds-on-surface-v' : 'text-white/80'}`}>
                              <p className="text-xs opacity-70 mb-1">↩️ رد على تعليق</p>
                              <p>{msg.content.replace(/\(https?:\/\/[^\s)]+\)/g, '').replace(/https?:\/\/[^\s]+/g, '').replace(/[\u200f\u200e]/g, '').trim()}</p>
                              {commentUrl && (
                                <a
                                  href={commentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs underline mt-1 inline-block ${msg.direction === 'inbound' ? 'text-ds-primary' : 'text-white/70'}`}
                                >
                                  عرض التعليق الأصلي
                                </a>
                              )}
                            </div>
                          ) : (
                            <MessageText content={msg.content} direction={msg.direction} />
                          )
                        )}
                        <div className={`text-[10px] mt-1 ${msg.direction === 'inbound' ? 'text-ds-outline' : 'text-white/50'}`}>
                          {msg.sentByUser?.name && <span className="ml-2">{msg.sentByUser.name}</span>}
                          {new Date(msg.platformTimestamp || msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input — card surface, ghost border input */}
              <div className="bg-ds-surface-card p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); if (messageText.trim()) sendMutation.mutate(); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="اكتب رسالة..."
                    className="flex-1 bg-ds-surface-low border-0 rounded-xl px-4 py-2.5 text-sm text-ds-on-surface placeholder:text-ds-outline focus:outline-none focus:ring-2 focus:ring-ds-primary/30 transition"
                    disabled={sendMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="bg-gradient-to-l from-ds-primary to-ds-primary-c text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
                  >
                    {sendMutation.isPending ? '...' : 'إرسال'}
                  </button>
                </form>
              </div>
            </>
          ) : activeTab === 'comments' && selectedId && thread ? (
            <>
              {/* Thread header */}
              <div className="bg-ds-surface-card p-3.5">
                <p className="text-sm text-ds-on-surface truncate font-medium">{thread.postCaption || 'بوست'}</p>
                {thread.postUrl && (
                  <a href={thread.postUrl} target="_blank" rel="noreferrer" className="text-xs text-ds-primary hover:underline">
                    فتح البوست
                  </a>
                )}
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(thread.comments || []).map((comment: any) => (
                  <div key={comment.id} className={`${comment.parentCommentId ? 'mr-8' : ''}`}>
                    <div className={`rounded-2xl p-3.5 ${
                      comment.direction === 'outbound'
                        ? 'bg-ds-primary/5'
                        : 'bg-ds-surface-card shadow-[0_1px_4px_rgba(25,28,29,0.06)]'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-ds-on-surface">{comment.authorName || comment.sentByUser?.name || 'مجهول'}</span>
                        <span className="text-[10px] text-ds-outline">
                          {new Date(comment.platformTimestamp || comment.createdAt).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <p className="text-sm text-ds-on-surface-v">{comment.content}</p>
                      {comment.direction === 'inbound' && (
                        <div className="flex gap-3 mt-2.5">
                          <button
                            onClick={() => { setReplyingTo(comment.id); setReplyText(''); }}
                            className="text-xs text-ds-primary hover:underline font-medium"
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
                          className="flex-1 bg-ds-surface-low border-0 rounded-xl px-3 py-2 text-sm text-ds-on-surface placeholder:text-ds-outline focus:outline-none focus:ring-2 focus:ring-ds-primary/30"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          className="bg-gradient-to-l from-ds-primary to-ds-primary-c text-white px-3.5 py-2 rounded-xl text-sm disabled:opacity-40"
                        >
                          رد
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="text-ds-on-surface-v text-sm hover:text-ds-on-surface"
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
            <div className="flex-1 flex items-center justify-center text-ds-on-surface-v">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-ds-outline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="font-display">اختر محادثة أو تعليق من القائمة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
