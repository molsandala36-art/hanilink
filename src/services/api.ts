import axios from 'axios';
import { getApiBaseUrl, getApiErrorMessage, isSupabaseConfigured } from '../lib/backend';
import { handleSupabaseApiRequest } from './directApi';
import {
  cacheOnlineMutation,
  cacheOnlineResponse,
  flushPendingOperations,
  getOfflineCapableResponse,
  initializeOfflineSync,
  queueOfflineMutation,
} from './offlineSync';

const getAxiosApi = () =>
  axios.create({
    baseURL: getApiBaseUrl(),
  });

const decorateAxios = (axiosApi: ReturnType<typeof getAxiosApi>) => {
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

  return axiosApi;
};

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

const isOfflineCapableMutation = (method: 'POST' | 'PUT' | 'DELETE', path: string) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return (
    cleanPath === '/products' ||
    cleanPath === '/products/bulk' ||
    (method !== 'POST' && /^\/products\/[^/]+$/.test(cleanPath)) ||
    cleanPath === '/suppliers' ||
    (method !== 'POST' && /^\/suppliers\/[^/]+$/.test(cleanPath)) ||
    cleanPath === '/sales' ||
    cleanPath === '/returns' ||
    cleanPath === '/expenses' ||
    (method !== 'POST' && /^\/expenses\/[^/]+$/.test(cleanPath)) ||
    cleanPath === '/purchase-orders' ||
    cleanPath === '/documents' ||
    (method !== 'POST' && /^\/documents\/[^/]+$/.test(cleanPath)) ||
    cleanPath === '/customers' ||
    (method !== 'POST' && /^\/customers\/[^/]+$/.test(cleanPath)) ||
    cleanPath === '/credits'
  );
};

const isOfflineCapableRead = (path: string) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return (
    cleanPath === '/products' ||
    cleanPath === '/suppliers' ||
    cleanPath === '/sales' ||
    cleanPath === '/returns' ||
    cleanPath === '/expenses' ||
    cleanPath === '/purchase-orders' ||
    cleanPath === '/documents' ||
    cleanPath === '/customers' ||
    cleanPath === '/credits' ||
    cleanPath === '/users' ||
    cleanPath === '/analytics' ||
    cleanPath === '/sync/status'
  );
};

const isNetworkError = (error: any) =>
  !error?.response ||
  String(error?.message || '').toLowerCase().includes('network') ||
  String(error?.message || '').toLowerCase().includes('fetch');

const request = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, payload?: any, config?: any) => {
  try {
    if (isSupabaseConfigured()) {
      initializeOfflineSync(handleSupabaseApiRequest);

      if (method === 'GET') {
        if (typeof navigator !== 'undefined' && !navigator.onLine && isOfflineCapableRead(path)) {
          return getOfflineCapableResponse(path, config);
        }

        const response = await handleSupabaseApiRequest(method, path, payload, config);
        if (isOfflineCapableRead(path)) {
          cacheOnlineResponse(path, response.data, config);
          void flushPendingOperations();
        }
        return response;
      }

      if (
        (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
        isOfflineCapableMutation(method, path) &&
        typeof navigator !== 'undefined' &&
        !navigator.onLine
      ) {
        return queueOfflineMutation(method, path, payload, config);
      }

      try {
        const response = await handleSupabaseApiRequest(method, path, payload, config);
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          if (isOfflineCapableMutation(method, path)) {
            cacheOnlineMutation(method, path, response.data, payload);
          }
          void flushPendingOperations();
        }
        return response;
      } catch (error: any) {
        if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && isOfflineCapableMutation(method, path) && isNetworkError(error)) {
          return queueOfflineMutation(method, path, payload, config);
        }
        throw error;
      }
    }
    const axiosApi = decorateAxios(getAxiosApi());
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
