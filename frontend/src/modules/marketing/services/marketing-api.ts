import api from '../../../shared/services/api';

// === Projects ===
export const getProjects = () => api.get('/marketing/projects');
export const createProject = (data: { name: string; slug: string; language: string }) =>
  api.post('/marketing/projects', data);
export const getProjectProducts = (projectId: string) =>
  api.get(`/marketing/projects/${projectId}/products`);
export const createProjectProduct = (projectId: string, data: { name: string }) =>
  api.post(`/marketing/projects/${projectId}/products`, data);

// === Creatives ===
export const getCreatives = (params?: Record<string, string>) =>
  api.get('/marketing/creatives', { params });
export const getCreative = (id: string) =>
  api.get(`/marketing/creatives/${id}`);
export const createCreative = (data: any) =>
  api.post('/marketing/creatives', data);
export const updateCreative = (id: string, data: any) =>
  api.put(`/marketing/creatives/${id}`, data);
export const updateCreativeTags = (id: string, tagIds: string[]) =>
  api.put(`/marketing/creatives/${id}/tags`, { tagIds });
export const deleteCreative = (id: string) =>
  api.delete(`/marketing/creatives/${id}`);

// === Creative Requests ===
export const getRequests = (params?: Record<string, string>) =>
  api.get('/marketing/requests', { params });
export const getRequest = (id: string) =>
  api.get(`/marketing/requests/${id}`);
export const createRequest = (data: any) =>
  api.post('/marketing/requests', data);
export const updateRequestStatus = (id: string, status: string) =>
  api.put(`/marketing/requests/${id}/status`, { status });
export const assignRequest = (id: string, assignedTo: string) =>
  api.put(`/marketing/requests/${id}/assign`, { assignedTo });

// === Tags ===
export const getTags = () => api.get('/marketing/tags');
export const createTag = (data: { name: string; categoryId?: string }) =>
  api.post('/marketing/tags', data);
export const deleteTag = (id: string) => api.delete(`/marketing/tags/${id}`);
export const getTagCategories = () => api.get('/marketing/tags/categories');
export const createTagCategory = (name: string) =>
  api.post('/marketing/tags/categories', { name });

// === Ideas ===
export const getIdeas = (params?: Record<string, string>) =>
  api.get('/marketing/ideas', { params });
export const getIdea = (id: string) => api.get(`/marketing/ideas/${id}`);
export const createIdea = (data: any) => api.post('/marketing/ideas', data);
export const updateIdeaStatus = (id: string, status: string) =>
  api.put(`/marketing/ideas/${id}/status`, { status });
export const addIdeaComment = (id: string, text: string) =>
  api.post(`/marketing/ideas/${id}/comments`, { text });

// === Competitors ===
export const getCompetitors = (params?: Record<string, string>) =>
  api.get('/marketing/competitors', { params });
export const createCompetitor = (data: any) =>
  api.post('/marketing/competitors', data);
export const deleteCompetitor = (id: string) =>
  api.delete(`/marketing/competitors/${id}`);

// === Settings ===
export const getCreativeCodeConfig = () =>
  api.get('/marketing/settings/creative-code');
export const updateCreativeCodeConfig = (data: any) =>
  api.put('/marketing/settings/creative-code', data);
export const getSavedFilters = () =>
  api.get('/marketing/settings/saved-filters');
export const createSavedFilter = (data: { name: string; filters: any }) =>
  api.post('/marketing/settings/saved-filters', data);
export const deleteSavedFilter = (id: string) =>
  api.delete(`/marketing/settings/saved-filters/${id}`);
