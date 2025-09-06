import axios from 'axios';

// Guardar el token después del inicio de sesión
export const saveToken = (token) => {
  localStorage.setItem('token', token);
};

// Configurar Axios con la base URL usando variable de entorno
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL, // ✅ Usamos variable de entorno
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');          // tu JWT (si lo tienes)
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const tokenLider = localStorage.getItem('tokenLider'); // ← añade el token del líder
  if (tokenLider) config.headers['x-token-lider'] = tokenLider;

  return config;
});

export default api;
