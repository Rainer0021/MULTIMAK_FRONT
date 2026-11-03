import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL 
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000/api'
    : 'https://multimakspa.duckdns.org/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // Permite enviar cookies de sesión
});

// Interceptor para inyectar token de autorización y gestionar FormData
api.interceptors.request.use((config) => {
  // Intentar rescatar el token de autenticación si se guarda en localStorage
  try {
    const sesion = JSON.parse(localStorage.getItem('usuario_multimak') || '{}');
    const token = sesion.token || sesion.access || localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`; // O `Token ${token}` según tu backend
    }
  } catch (e) {
    console.error('Error leyendo token de sesión', e);
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  
  return config;
});

export default api;