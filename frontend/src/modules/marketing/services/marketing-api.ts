import api from '../../../shared/services/api';

// === Dashboard ===
export const getDashboardStats = (params?: Record<string, string>) =>
  api.get('/marketing/dashboard/stats', { params });
export const getLeadsBySource = (params?: Record<string, string>) =>
  api.get('/marketing/dashboard/leads-by-source', { params });
export const getCreativeROI = (code: string, params?: Record<string, string>) =>
  api.get(`/marketing/dashboard/creative-roi/${code}`, { params });

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

// === Scripts ===
export const getScripts = (params?: Record<string, string>) =>
  api.get('/marketing/scripts', { params });
export const getScript = (id: string) => api.get(`/marketing/scripts/${id}`);
export const createScript = (data: any) => api.post('/marketing/scripts', data);
export const generateScript = (data: any) =>
  api.post('/marketing/scripts/generate', data);
export const updateScript = (id: string, data: any) =>
  api.put(`/marketing/scripts/${id}`, data);
export const updateScriptStatus = (id: string, status: string) =>
  api.put(`/marketing/scripts/${id}/status`, { status });
export const assignScript = (id: string, assignedTo: string) =>
  api.put(`/marketing/scripts/${id}/assign`, { assignedTo });
export const updateScriptScene = (scriptId: string, sceneId: string, data: any) =>
  api.put(`/marketing/scripts/${scriptId}/scenes/${sceneId}`, data);
export const getScriptVersions = (id: string) =>
  api.get(`/marketing/scripts/${id}/versions`);
export const saveScriptVersion = (id: string) =>
  api.post(`/marketing/scripts/${id}/versions`);

// === Publishing ===
export const getCalendarPosts = (from: string, to: string) =>
  api.get('/marketing/calendar', { params: { from, to } });
export const getScheduledPosts = (params?: Record<string, string>) =>
  api.get('/marketing/posts', { params });
export const getScheduledPost = (id: string) => api.get(`/marketing/posts/${id}`);
export const createScheduledPost = (data: any) =>
  api.post('/marketing/posts', data);
export const updateScheduledPost = (id: string, data: any) =>
  api.put(`/marketing/posts/${id}`, data);
export const updatePostStatus = (id: string, status: string) =>
  api.put(`/marketing/posts/${id}/status`, { status });
export const deleteScheduledPost = (id: string) =>
  api.delete(`/marketing/posts/${id}`);

// === Social Pages & Brands ===
export const getSocialPages = () => api.get('/marketing/social-pages');
export const connectSocialPage = (data: any) =>
  api.post('/marketing/social-pages/connect', data);
export const disconnectSocialPage = (id: string) =>
  api.delete(`/marketing/social-pages/${id}`);
export const getBrands = () => api.get('/marketing/brands');
export const createBrand = (data: { name: string; slug: string; language?: string }) =>
  api.post('/marketing/brands', data);

// === Media Buying ===
export const getAdAccounts = () => api.get('/marketing/media-buying/ad-accounts');
export const getMetaAvailableAccounts = () => api.get('/marketing/media-buying/meta-available-accounts');
export const connectMetaExisting = (data: { accountId: string; accountName: string; brandId: string }) =>
  api.post('/marketing/media-buying/meta-connect-existing', data);
export const connectAdAccount = (data: any) =>
  api.post('/marketing/media-buying/ad-accounts/connect', data);
export const disconnectAdAccount = (id: string) =>
  api.delete(`/marketing/media-buying/ad-accounts/${id}`);
export const getAdAccountSyncLogs = (id: string) =>
  api.get(`/marketing/media-buying/ad-accounts/${id}/sync-logs`);
export const getMediaBuyingOverview = (params?: Record<string, string>) =>
  api.get('/marketing/media-buying/overview', { params });
export const getMediaBuyingByPlatform = (params?: Record<string, string>) =>
  api.get('/marketing/media-buying/by-platform', { params });
export const getMediaBuyingByBrand = (params?: Record<string, string>) =>
  api.get('/marketing/media-buying/by-brand', { params });
export const getMediaBuyingCampaigns = (params?: Record<string, string>) =>
  api.get('/marketing/media-buying/campaigns', { params });
export const getMediaBuyingCampaign = (id: string) =>
  api.get(`/marketing/media-buying/campaigns/${id}`);
export const syncAccounts = (adAccountId?: string) =>
  api.post('/marketing/media-buying/sync', adAccountId ? { adAccountId } : {});
export const getSyncSchedule = () => api.get('/marketing/media-buying/sync-schedule');
export const setSyncSchedule = (data: { enabled: boolean; unit: string; value: number }) =>
  api.put('/marketing/media-buying/sync-schedule', data);

// === Meta OAuth ===
export const getMetaOAuthUrl = () => api.get('/marketing/oauth/meta');
export const metaOAuthCallback = (code: string) =>
  api.post('/marketing/oauth/meta/callback', { code });
export const connectMetaAdAccount = (data: {
  accountId: string;
  accountName: string;
  accessToken: string;
  brandId: string;
}) => api.post('/marketing/oauth/meta/connect', data);
export const syncAdAccount = (adAccountId: string) =>
  api.post(`/marketing/oauth/meta/sync/${adAccountId}`);

// === Landing Pages ===
export const getLandingPages = (params?: Record<string, string>) =>
  api.get('/marketing/landing-pages', { params });
export const getLandingPage = (id: string) =>
  api.get(`/marketing/landing-pages/${id}`);
export const createLandingPage = (data: any) =>
  api.post('/marketing/landing-pages', data);
export const generateLandingPage = (data: any) =>
  api.post('/marketing/landing-pages/generate', data);
export const updateLandingPage = (id: string, data: any) =>
  api.put(`/marketing/landing-pages/${id}`, data);
export const deleteLandingPage = (id: string) =>
  api.delete(`/marketing/landing-pages/${id}`);
export const aiEditLandingPage = (id: string, editRequest: string) =>
  api.post(`/marketing/landing-pages/${id}/edit`, { editRequest });
export const publishLandingPage = (id: string) =>
  api.post(`/marketing/landing-pages/${id}/publish`);
export const unpublishLandingPage = (id: string) =>
  api.post(`/marketing/landing-pages/${id}/unpublish`);
export const getLandingPageVersions = (id: string) =>
  api.get(`/marketing/landing-pages/${id}/versions`);
export const rollbackLandingPage = (id: string, versionId: string) =>
  api.post(`/marketing/landing-pages/${id}/rollback/${versionId}`);
export const getLandingPageFieldMappings = (id: string) =>
  api.get(`/marketing/landing-pages/${id}/field-mappings`);
export const updateLandingPageFieldMappings = (id: string, mappings: any[]) =>
  api.put(`/marketing/landing-pages/${id}/field-mappings`, { mappings });
export const createABTest = (landingPageAId: string, data: any) =>
  api.post(`/marketing/landing-pages/${landingPageAId}/ab-test`, data);
export const getABTests = () =>
  api.get('/marketing/landing-pages/ab-tests/list');
export const endABTest = (testId: string, winnerId?: string) =>
  api.put(`/marketing/landing-pages/ab-tests/${testId}/end`, { winnerId });

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
