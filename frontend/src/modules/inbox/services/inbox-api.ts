import api from '../../../shared/services/api';

// === Channels ===
export const getChannels = () => api.get('/inbox/channels');
export const getOAuthUrl = () => api.get('/inbox/channels/oauth/meta');
export const oauthCallback = (code: string) => api.post('/inbox/channels/oauth/meta/callback', { code });
export const connectPages = (data: { pages: any[]; token: string; brandId: string }) =>
  api.post('/inbox/channels/oauth/meta/connect', data);
export const syncChannel = (id: string) => api.post(`/inbox/channels/${id}/sync`);
export const deactivateChannel = (id: string) => api.delete(`/inbox/channels/${id}`);

// === Conversations ===
export const getConversations = (params?: Record<string, string>) =>
  api.get('/inbox/conversations', { params });
export const getConversation = (id: string) => api.get(`/inbox/conversations/${id}`);
export const getMessages = (id: string, params?: Record<string, string>) =>
  api.get(`/inbox/conversations/${id}/messages`, { params });
export const sendMessage = (id: string, text: string) =>
  api.post(`/inbox/conversations/${id}/messages`, { text });
export const assignConversation = (id: string, assignedToId: string) =>
  api.put(`/inbox/conversations/${id}/assign`, { assignedToId });
export const updateConversationStatus = (id: string, status: string) =>
  api.put(`/inbox/conversations/${id}/status`, { status });
export const linkConversation = (id: string, data: { leadId?: string; customerId?: string }) =>
  api.put(`/inbox/conversations/${id}/link`, data);
export const markAsRead = (id: string) => api.put(`/inbox/conversations/${id}/read`);

// === Comments ===
export const getCommentThreads = (params?: Record<string, string>) =>
  api.get('/inbox/comments/threads', { params });
export const getCommentThread = (id: string) => api.get(`/inbox/comments/threads/${id}`);
export const updateThreadStatus = (id: string, status: string) =>
  api.put(`/inbox/comments/threads/${id}/status`, { status });
export const replyToComment = (commentId: string, text: string) =>
  api.post(`/inbox/comments/${commentId}/reply`, { text });
export const privateReplyToComment = (commentId: string, text: string) =>
  api.post(`/inbox/comments/${commentId}/private-reply`, { text });
export const hideComment = (commentId: string) =>
  api.post(`/inbox/comments/${commentId}/hide`);

// === Convert ===
export const convertToLead = (data: { conversationId: string; name: string; phone: string; email?: string }) =>
  api.post('/inbox/convert/to-lead', data);
export const convertToOrder = (data: { conversationId: string; leadId: string }) =>
  api.post('/inbox/convert/to-order', data);

// === Stats ===
export const getStatsOverview = (params?: Record<string, string>) =>
  api.get('/inbox/stats/overview', { params });
export const getTeamStats = (params?: Record<string, string>) =>
  api.get('/inbox/stats/team', { params });
export const getAgentStats = (userId: string, params?: Record<string, string>) =>
  api.get(`/inbox/stats/agent/${userId}`, { params });

// === Brands (reuse from marketing) ===
export const getBrands = () => api.get('/marketing/brands');
