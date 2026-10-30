import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiUrl } from '../config.js';

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

  // Logout handler
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ynr_token');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('ynr_auth_token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('ynr_user');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantDb');
    localStorage.removeItem('resto_db_name');
    localStorage.removeItem('branchCode');
    localStorage.removeItem('branch');
    localStorage.removeItem('branchName');
    localStorage.removeItem('branchId');
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
