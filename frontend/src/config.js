// Enterprise API & Realtime Socket Configuration for YNR Fishes

// 1. Dynamic Public App URL (Ensures Production URL when deployed, localhost only in dev)
export const getPublicAppUrl = () => {
  if (import.meta.env.VITE_PUBLIC_URL) {
    return import.meta.env.VITE_PUBLIC_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://ynrfishes.com';
};

// 2. Production Driver Shareable Tracking Link (Used in WhatsApp & Copy Link)
export const getDriverTrackingUrl = (plate) => {
  const origin = getPublicAppUrl();
  return `${origin}/driver-gps?v=${encodeURIComponent(plate || '')}`;
};

// 3. API Base URL
export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return import.meta.env.PROD 
    ? 'https://ynr-fishes-backend.onrender.com/api' 
    : 'http://localhost:5000/api';
};

// 4. Superadmin API URL
export const getSuperadminApiUrl = () => {
  if (import.meta.env.VITE_SUPERADMIN_API_URL) return import.meta.env.VITE_SUPERADMIN_API_URL;
  return import.meta.env.PROD 
    ? 'https://ynr-fishes-backend.onrender.com/api/superadmin' 
    : 'http://localhost:5000/api/superadmin';
};

// 5. Realtime Socket.IO URL
export const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.PROD) return 'https://ynr-fishes-backend.onrender.com';
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:5000`;
};

export const API_BASE_URL = getApiUrl();

export default {
  getPublicAppUrl,
  getDriverTrackingUrl,
  getApiUrl,
  getSuperadminApiUrl,
  getSocketUrl,
  API_BASE_URL
};
