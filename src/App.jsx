import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL 
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000/api'
    : 'https://multimakspa.duckdns.org/api';

const api = axios.create({
  baseURL,
  // Ya no dependemos de cookies de sesión ni de CSRF
});

// Interceptor para inyectar la cabecera de autenticación por Token en cada petición
api.interceptors.request.use((config) => {
  try {
    const sesion = JSON.parse(localStorage.getItem('usuario_multimak') || '{}');
    if (sesion.token) {
      config.headers.Authorization = `Token ${sesion.token}`;
    }
  } catch (e) {
    console.error('Error al adjuntar el token de autenticación', e);
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  
  return config;
});

export default api;
