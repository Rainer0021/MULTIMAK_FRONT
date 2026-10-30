import axios from 'axios';

const api = axios.create({
  baseURL: 'https://multimakspa.duckdns.org/api',
});

// Interceptor para permitir multipart/form-data automático al enviar FormData
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

export default api;