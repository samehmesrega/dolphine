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

    return Promise.reject(err);
  }
);

export default api;
