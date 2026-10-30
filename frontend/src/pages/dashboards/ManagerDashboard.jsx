import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const branchName = user?.branch?.name || 'Vijayawada Central';
  const branchCode = user?.branch?.code || 'VJA';
  const branchCity = user?.branch?.city || 'Vijayawada';

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <div className="dashboard-header-bar">
        <div className="dash-user-welcome">
          <div className="dash-avatar-badge" style={{ borderColor: '#4EE1A0', color: '#4EE1A0' }}>
            💼
          </div>
          <div className="dash-title-group">
            <h1>{user?.name || 'Branch Manager'}</h1>
            <p>
              Branch: <strong style={{ color: '#4EE1A0' }}>{branchName} ({branchCode})</strong> • City: <strong>{branchCity}</strong> • Role: <strong>MANAGER</strong>
            </p>
          </div>
        </div>

        <div className="dash-quick-actions">
          <Link to="/" className="dash-pill-btn">
            🌐 View Public Website
          </Link>
          <button onClick={logout} className="dash-pill-btn danger">
            Logout
          </button>
        </div>
      </div>

      {/* Simple Status Cards */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-title">Branch Station</div>
          <div className="dash-stat-value">{branchCity}</div>
          <div className="dash-stat-sub">Code: {branchCode}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-title">Billing Desk</div>
          <div className="dash-stat-value" style={{ color: '#4EE1A0' }}>Ready</div>
          <div className="dash-stat-sub">Counter System Online</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-title">Assigned Role</div>
          <div className="dash-stat-value">Manager</div>
          <div className="dash-stat-sub">Billing & Stock Approvals</div>
        </div>
      </div>

      {/* Invoice Overview */}
      <div className="dash-section-card">
        <div className="dash-section-header">
          <h2 className="dash-section-title">
            <span>📑 Billing & Invoice Overview</span>
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#4EE1A0' }}>Desk Ready</span>
        </div>

        <div style={{ padding: '24px', background: 'rgba(1, 10, 20, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <p style={{ margin: 0, color: 'rgba(230, 247, 255, 0.85)', lineHeight: 1.6 }}>
            Logged in as <strong>{user?.name}</strong> ({user?.email}) at <strong>{branchName}</strong>. Ready to register invoices, review credit limits, and approve outgoing fish lots once billing workflow is started.
          </p>
        </div>
      </div>
    </div>
  );
}
