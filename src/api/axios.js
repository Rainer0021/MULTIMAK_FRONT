import axios from 'axios';

const clienteAxios = axios.create({
  baseURL: 'http://54.89.70.36',
});

export default clienteAxios;
