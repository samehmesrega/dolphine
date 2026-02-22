import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dolphin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isLoginRequest = err.config?.url === '/auth/login';
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('dolphin_token');
      localStorage.removeItem('dolphin_user');
      window.location.href = '/login';
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1424ae04-f79a-48c9-a6b0-4702d1f6cf84', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        runId: 'initial',
        hypothesisId: 'H1',
        location: 'frontend/src/services/api.ts:responseInterceptor',
        message: 'API error',
        data: {
          url: err.config?.url,
          method: err.config?.method,
          status: err.response?.status,
          statusText: err.response?.statusText,
          responseData: err.response?.data,
        },
      }),
    }).catch(() => {});
    // #endregion

    return Promise.reject(err);
  }
);

export default api;
