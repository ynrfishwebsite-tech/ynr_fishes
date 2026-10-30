import { getApiUrl } from "../../config.js";
import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
let API_BASE_URL = getApiUrl();

// CRITICAL FIX: If running inside the Desktop Electron App, force localhost
if (navigator.userAgent.toLowerCase().indexOf('electron') > -1) {
  API_BASE_URL = 'http://127.0.0.1:5002/api';
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate axios instance for auth refresh to avoid interceptor recursion
const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh state management
let isRefreshing = false;
let failedQueue = [];
let proactiveRefreshPromise = null;

export const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Buffer of 30 seconds before expiration
    return (Date.now() / 1000) >= (payload.exp - 30);
  } catch {
    return false;
  }
};

const ensureValidAccessToken = async () => {
  const token = localStorage.getItem('accessToken') ||
                localStorage.getItem('token') ||
                localStorage.getItem('ynr_token') ||
                localStorage.getItem('ynr_auth_token');
  const refreshToken = localStorage.getItem('refreshToken');

  if (!token && !refreshToken) return null;

  // If token is still valid, return it immediately
  if (token && !isTokenExpired(token)) {
    return token;
  }

  // Token is expired (or missing), but we have a refreshToken -> refresh proactively!
  if (refreshToken) {
    if (!proactiveRefreshPromise) {
      proactiveRefreshPromise = (async () => {
        try {
          const response = await authApi.post('/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data || {};
          if (accessToken) {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('token', accessToken);
            if (newRefreshToken) {
              localStorage.setItem('refreshToken', newRefreshToken);
            }
            return accessToken;
          }
        } catch (err) {
          console.warn('[axios] Proactive token refresh failed:', err.message);
          return token;
        } finally {
          proactiveRefreshPromise = null;
        }
      })();
    }
    const freshToken = await proactiveRefreshPromise;
    return freshToken || token;
  }

  return token;
};

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Force logout helper — clears auth tokens and dispatches a custom event
 * so App.jsx can reset React state WITHOUT a hard page reload.
 * This breaks the infinite reload loop that was the #1 cause of auto-refresh.
 */
let isForceLoggingOut = false; // Debounce guard
const forceLogout = () => {
  if (isForceLoggingOut) return; // Prevent multiple simultaneous force-logouts
  isForceLoggingOut = true;

  console.warn('[axios] Force logout triggered — clearing tokens, dispatching event');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');

  // Dispatch a custom event that App.jsx listens for.
  // This lets React handle the state change instead of doing a destructive window.location.reload().
  window.dispatchEvent(new Event('forceLogout'));

  // Reset the debounce guard after a short delay so the user can log in again
  setTimeout(() => { isForceLoggingOut = false; }, 2000);
};

// Add a request interceptor to include the token, tenant DB header, and dynamic baseURL
api.interceptors.request.use(
  async (config) => {
    config.baseURL = getApiUrl();

    // Check token proactively before making requests (skip for /auth/ endpoints)
    const isAuthEndpoint = config.url?.includes('/auth/');
    let token = localStorage.getItem('accessToken') ||
                  localStorage.getItem('token') ||
                  localStorage.getItem('ynr_token') ||
                  localStorage.getItem('ynr_auth_token');

    if (!isAuthEndpoint) {
      try {
        const validToken = await ensureValidAccessToken();
        if (validToken) {
          token = validToken;
        }
      } catch {
        // Fall back to stored token
      }
    }

    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    let tenantDb = localStorage.getItem('resto_db_name') || localStorage.getItem('tenantDb');
    if (!tenantDb) {
      try {
        const rawUser = localStorage.getItem('user') || localStorage.getItem('ynr_user');
        if (rawUser) {
          const userObj = JSON.parse(rawUser);
          if (userObj.role === 'super-admin') {
            tenantDb = 'fishes';
          } else {
            const code = userObj.branch?.code || userObj.branchCode || (typeof userObj.branch === 'string' ? userObj.branch : null) || userObj.tenantDb || userObj.db;
            if (code && typeof code === 'string' && code.length <= 10) {
              tenantDb = code.toLowerCase();
            }
          }
        }
      } catch (e) {
        tenantDb = 'kdp';
      }
    }
    if (!tenantDb) tenantDb = 'kdp';
    if (tenantDb) {
      config.headers['X-Tenant-DB'] = String(tenantDb).toLowerCase();
      config.headers['X-Branch-Code'] = String(tenantDb).toUpperCase();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

authApi.interceptors.request.use(
  (config) => {
    config.baseURL = getApiUrl();
    let tenantDb = localStorage.getItem('resto_db_name') || localStorage.getItem('tenantDb');
    if (!tenantDb) {
      try {
        const rawUser = localStorage.getItem('user') || localStorage.getItem('ynr_user');
        if (rawUser) {
          const userObj = JSON.parse(rawUser);
          if (userObj.role === 'super-admin') {
            tenantDb = 'fishes';
          } else {
            const code = userObj.branch?.code || userObj.branchCode || (typeof userObj.branch === 'string' ? userObj.branch : null) || userObj.tenantDb || userObj.db;
            if (code && typeof code === 'string' && code.length <= 10) {
              tenantDb = code.toLowerCase();
            }
          }
        }
      } catch (e) {
        tenantDb = null;
      }
    }
    if (tenantDb) {
      config.headers['X-Tenant-DB'] = String(tenantDb).toLowerCase();
      config.headers['X-Branch-Code'] = String(tenantDb).toUpperCase();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // Check if we are on the public customer QR menu page.
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isPublicOrderPage = window.location.pathname === '/order' ||
      window.location.pathname.startsWith('/order/') ||
      (searchParams.has('table') && searchParams.has('tenant'));

    // Handle 401/403 Token expired / unauthorized -> Try Refresh
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    const status = error.response?.status;
    const isTokenError = (status === 401 || status === 403) && !originalRequest._retry && !isAuthEndpoint && !isPublicOrderPage;

    // Check if it is a PIN / password action verification error (e.g. deleting a bill)
    const errorMsg = String(error.response?.data?.message || error.message || '').toLowerCase();
    const isVerificationError = errorMsg.includes('password') ||
      errorMsg.includes('pin') ||
      errorMsg.includes('incorrect');

    if (isTokenError && !isVerificationError) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.set('Authorization', `Bearer ${token}`);
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        console.warn('No refresh token available - AUTO LOGOUT DISABLED BY USER REQUEST');
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        console.log('Attempting to refresh access token...');
        // Use separate axios instance to avoid triggering interceptor
        const response = await authApi.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        console.log('Token refresh successful');
        // Store new tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        // Update the original request with new token
        originalRequest.headers.set('Authorization', `Bearer ${accessToken}`);

        // Process queued requests
        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
        processQueue(refreshError, null);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    // If not a 401/403 or refresh failed, check if we can fallback from local IP to Cloud API or retry
    const isGetRequest = (originalRequest?.method || 'get').toLowerCase() === 'get';
    const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');

    // 1. SMART CLOUD FALLBACK: For LAN mobile devices on Wi-Fi (192.168.x.x) if local IP is unreachable
    const currentBase = originalRequest?.baseURL || '';
    const isLanDeviceIp = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(currentBase);
    const isWhatsAppEndpoint = originalRequest?.url?.includes('/whatsapp/');

    if (isNetworkOrTimeout && isLanDeviceIp && !originalRequest._fallbackToCloud && !isWhatsAppEndpoint) {
      originalRequest._fallbackToCloud = true;
      originalRequest.baseURL = 'https://msbillings-backend-x9qw.onrender.com/api';
      return api(originalRequest);
    }

    // 2. TRANSIENT RETRY for GET requests (cold start / momentary network glitch)
    if (isNetworkOrTimeout && isGetRequest && (!originalRequest._retryCount || originalRequest._retryCount < 2)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delay = originalRequest._retryCount * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    // Quiet warning for final unhandled error without filling console with red exceptions
    if (error.response && error.response.status !== 401 && error.response.status !== 403) {
      console.warn('[API Notice]', error.response.status, originalRequest?.url, error.response.data?.message || error.message);
    }

    return Promise.reject(error);
  }
);

export default api;

