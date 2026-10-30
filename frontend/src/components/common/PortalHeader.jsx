import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PortalHeader({ title, subtitle, icon = '🌊', onRefresh, isRefreshing }) {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-header-bar">
      <div className="dash-user-welcome">
        <div className="dash-avatar-badge">
          {icon}
        </div>
        <div className="dash-title-group">
          <h1>{title || 'Staff Portal'}</h1>
          <p>
            {subtitle || `Welcome back, ${user?.name || 'Administrator'} | Role: ${user?.role?.toUpperCase()} | YNR Enterprises`}
          </p>
        </div>
      </div>

      <div className="dash-quick-actions">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="dash-pill-btn"
            disabled={isRefreshing}
            title="Refresh live data"
          >
            🔄 {isRefreshing ? 'Syncing...' : 'Refresh'}
          </button>
        )}
        <button
          onClick={logout}
          className="dash-pill-btn danger"
          title="Sign out of your session"
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
