// Enterprise API & Realtime Socket Configuration for YNR Fishes
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
};

export const getSuperadminApiUrl = () => {
  return import.meta.env.VITE_SUPERADMIN_API_URL || 'http://localhost:5000/api/superadmin';
};

export const getSocketUrl = () => {
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
};

export const API_BASE_URL = getApiUrl();

export default {
  getApiUrl,
  getSuperadminApiUrl,
  getSocketUrl,
  API_BASE_URL
};
