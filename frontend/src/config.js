// Enterprise API & Realtime Socket Configuration for YNR Fishes
export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return import.meta.env.PROD 
    ? 'https://ynr-fishes-backend.onrender.com/api' 
    : 'http://localhost:5000/api';
};

export const getSuperadminApiUrl = () => {
  if (import.meta.env.VITE_SUPERADMIN_API_URL) return import.meta.env.VITE_SUPERADMIN_API_URL;
  return import.meta.env.PROD 
    ? 'https://ynr-fishes-backend.onrender.com/api/superadmin' 
    : 'http://localhost:5000/api/superadmin';
};

export const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  return import.meta.env.PROD 
    ? 'https://ynr-fishes-backend.onrender.com' 
    : 'http://localhost:5000';
};

export const API_BASE_URL = getApiUrl();

export default {
  getApiUrl,
  getSuperadminApiUrl,
  getSocketUrl,
  API_BASE_URL
};
