import axios from 'axios';
import { getApiBaseUrl, getApiErrorMessage, isSupabaseConfigured } from '../lib/backend';
import { handleSupabaseApiRequest } from './directApi';

const axiosApi = axios.create({
  baseURL: getApiBaseUrl(),
});

axiosApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = getApiErrorMessage(error, 'Une erreur reseau est survenue');
    if (error?.response?.data && typeof error.response.data === 'object') {
      error.response.data.message = message;
    } else {
      error.response = {
        ...error.response,
        data: { ...(error.response?.data || {}), message },
      };
    }
    return Promise.reject(error);
  }
);

const normalizeError = (error: any) => {
  const message = getApiErrorMessage(error, 'Une erreur reseau est survenue');
  if (error?.response?.data && typeof error.response.data === 'object') {
    error.response.data.message = message;
  } else {
    error.response = {
      ...error.response,
      data: { ...(error.response?.data || {}), message },
    };
  }
  return error;
};

const request = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, payload?: any, config?: any) => {
  try {
    if (isSupabaseConfigured) {
      return await handleSupabaseApiRequest(method, path, payload, config);
    }
    if (method === 'GET') return await axiosApi.get(path, config);
    if (method === 'POST') return await axiosApi.post(path, payload, config);
    if (method === 'PUT') return await axiosApi.put(path, payload, config);
    return await axiosApi.delete(path, config);
  } catch (error: any) {
    throw normalizeError(error);
  }
};

const api = {
  get: (path: string, config?: any) => request('GET', path, undefined, config),
  post: (path: string, payload?: any, config?: any) => request('POST', path, payload, config),
  put: (path: string, payload?: any, config?: any) => request('PUT', path, payload, config),
  delete: (path: string, config?: any) => request('DELETE', path, undefined, config),
};

export default api;
