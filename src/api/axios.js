import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL 
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000/api'
    : 'https://multimakspa.duckdns.org/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// 1. Interceptor de PETICIONES: Inyecta el token en cada consulta HTTP
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token_multimak');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// 2. Interceptor de RESPUESTAS: Redirige al Login si la API devuelve 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Un 401 en el propio login (contraseña mala) NO debe recargar la página:
    // el formulario tiene que poder mostrar el mensaje de error.
    const esPeticionLogin = String(error.config?.url || '').includes('login');

    if (error.response && error.response.status === 401 && !esPeticionLogin) {
      localStorage.removeItem('token_multimak');
      localStorage.removeItem('usuario_multimak');

      // Forzar la recarga o redirección al Login
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;