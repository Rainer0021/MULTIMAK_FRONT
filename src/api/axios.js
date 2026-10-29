import axios from 'axios';

const api = axios.create({
  baseURL: 'https://multimakspa.duckdns.org/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;