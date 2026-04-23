import axios from 'axios';

export interface ApiRequestError extends Error {
  response?: any;
  status?: number;
  data?: any;
  code?: string;
  conflictFields?: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证 token
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 统一错误处理 - 提取后端返回的错误消息
    console.error('API Error:', error);

    // 从后端响应中提取错误消息
    const backendMessage = error.response?.data?.error
                        || error.response?.data?.message
                        || error.response?.data?.msg;

    // 如果后端有返回错误消息，创建新的错误对象包含这个消息
    if (backendMessage) {
      const apiError = new Error(backendMessage) as ApiRequestError;
      apiError.response = error.response;
      apiError.status = error.response?.status;
      apiError.data = error.response?.data;
      apiError.code = error.response?.data?.code;
      apiError.conflictFields = error.response?.data?.conflictFields;
      return Promise.reject(apiError);
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function getApiConflictFields(error: unknown): string[] {
  return Array.isArray((error as ApiRequestError | undefined)?.conflictFields)
    ? (error as ApiRequestError).conflictFields!
    : [];
}

export default api;
