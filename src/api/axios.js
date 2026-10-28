import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://multimakspa.duckdns.org',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
