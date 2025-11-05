import axios from 'axios';

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
      const apiError = new Error(backendMessage);
      // 保留原始响应信息
      (apiError as any).response = error.response;
      (apiError as any).status = error.response?.status;
      (apiError as any).data = error.response?.data;
      return Promise.reject(apiError);
    }

    return Promise.reject(error);
  }
);

export default api;
