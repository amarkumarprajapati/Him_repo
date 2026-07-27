import axios from 'axios';
import { DEFAULT_BASE_URL } from '@/baseurl';
import {
  readAuthCookie,
  clearAuthCookie,
} from '@/utils/auth-cookie';



function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_BASE_URL;
  if (trimmed.endsWith('/api')) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/api';
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    if (trimmed === '') return DEFAULT_BASE_URL;
  }

  return trimmed;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_BASE_URL,
);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = readAuthCookie();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      clearAuthCookie();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?from=' + encodeURIComponent(window.location.pathname));
      }
    }
    return Promise.reject(error);
  }
);
