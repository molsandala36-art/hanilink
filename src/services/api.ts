import axios from 'axios';
import { getApiBaseUrl, getApiErrorMessage } from '../lib/backend';

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
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

export default api;
