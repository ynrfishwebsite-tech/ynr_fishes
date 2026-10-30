import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiUrl } from '../config.js';
import { clearAllOfflineData } from '../db/offlineDb.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('ynr_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('ynr_token') || null);
  const [loading, setLoading] = useState(false);

  // Synchronize state with localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('ynr_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('accessToken', token);
      localStorage.setItem('ynr_auth_token', token);
    } else {
      localStorage.removeItem('ynr_token');
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('ynr_auth_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('ynr_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      const branchCode = (user.role === 'super-admin')
        ? 'fishes'
        : (user.tenantDb || user.branch?.code || user.branchCode || user.db || '').toLowerCase();
      if (branchCode) {
        localStorage.setItem('tenantDb', branchCode);
        localStorage.setItem('resto_db_name', branchCode);
        localStorage.setItem('branchCode', branchCode.toUpperCase());
      }
      if (user.branch) {
        localStorage.setItem('branch', JSON.stringify(user.branch));
        if (user.branch.name) localStorage.setItem('branchName', user.branch.name);
        if (user.branch._id || user.branch.id) localStorage.setItem('branchId', user.branch._id || user.branch.id);
      }
    } else {
      localStorage.removeItem('ynr_user');
      localStorage.removeItem('user');
      localStorage.removeItem('tenantDb');
      localStorage.removeItem('resto_db_name');
      localStorage.removeItem('branchCode');
      localStorage.removeItem('branch');
      localStorage.removeItem('branchName');
      localStorage.removeItem('branchId');
    }
  }, [user]);

  // Login handler
  const login = async (identifier, password) => {
    setLoading(true);
    try {
      // Point to backend API
      const apiBase = getApiUrl().replace(/\/+$/, '');
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed');
      }

      const activeToken = data.token || data.accessToken;
      setToken(activeToken);
      setUser(data.user);

      if (activeToken) {
        localStorage.setItem('ynr_token', activeToken);
        localStorage.setItem('token', activeToken);
        localStorage.setItem('accessToken', activeToken);
        localStorage.setItem('ynr_auth_token', activeToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      if (data.user) {
        localStorage.setItem('ynr_user', JSON.stringify(data.user));
        localStorage.setItem('user', JSON.stringify(data.user));

        const branchCode = (data.user.role === 'super-admin')
          ? 'fishes'
          : (data.tenantDb || data.user.tenantDb || data.user.branch?.code || data.user.branchCode || data.user.db || '').toLowerCase();

        if (branchCode) {
          localStorage.setItem('tenantDb', branchCode);
          localStorage.setItem('resto_db_name', branchCode);
          localStorage.setItem('branchCode', branchCode.toUpperCase());
        }

        if (data.user.branch) {
          localStorage.setItem('branch', JSON.stringify(data.user.branch));
          if (data.user.branch.name) localStorage.setItem('branchName', data.user.branch.name);
          if (data.user.branch._id || data.user.branch.id) localStorage.setItem('branchId', data.user.branch._id || data.user.branch.id);
        }
      }

      return { success: true, user: data.user, message: data.message };
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout handler - clears state, localStorage, and offline data
  const logout = () => {
    setToken(null);
    setUser(null);

    const keysToRemove = [
      'ynr_token', 'token', 'accessToken', 'ynr_auth_token', 'refreshToken',
      'resto_token', 'admin_token',
      'ynr_user', 'user', 'owner_pin',
      'tenantDb', 'tenant_db', 'resto_db_name', 'branchCode', 'branch', 'branchName', 'branchId',
      'admin_current_view', 'ynr_sa_active_tab',
      'cached_vehicles', 'cached_trips', 'cached_fuel_logs', 'cached_maint_logs', 'cached_depot_config',
      'ms_daily_stats_cache', 'resto_crm_cache', 'resto_discounts_cache',
      'ynr_cart'
    ];

    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    }

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('realtime_') ||
          key.startsWith('notified_') ||
          key.startsWith('ms_perm_') ||
          key.startsWith('cached_')
        )) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}

    try {
      clearAllOfflineData().catch(() => {});
    } catch (_) {}
  };

  const getDashboardPath = (role) => {
    const normalized = (role || '').toLowerCase();
    switch (normalized) {
      case 'super-admin':
        return '/dashboard/super-admin';
      case 'admin':
      case 'manager':
      case 'cashier':
      case 'worker':
        return '/dashboard/admin';
      default:
        return '/';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user && !!token,
        getDashboardPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
