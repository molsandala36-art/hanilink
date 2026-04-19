import axios from 'axios';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');

const api = axios.create({
  baseURL: normalizedBaseUrl || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
