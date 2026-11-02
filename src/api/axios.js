import axios from 'axios';

// Detecta si estás en tu PC (localhost) o en el servidor desplegado (DuckDNS)
const baseURL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL 
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000/api'
    : 'https://multimakspa.duckdns.org/api';

const api = axios.create({
  baseURL,
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