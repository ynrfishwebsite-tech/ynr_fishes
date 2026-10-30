import React from 'react';
import StatCard from '../common/StatCard';

export default function OverviewTab({ stats, branches, onTabChange }) {
  return (
    <div>
      {/* Metric Cards Grid */}
      <div className="dash-stats-grid">
        <StatCard
          title="Total Enterprise Branches"
          value={stats.totalBranches}
          subtext="Single Cluster / Multi-Node"
        />
        <StatCard
          title="Active Regional Nodes"
          value={stats.activeBranches}
          subtext="Operational in AP"
          highlight={true}
        />
        <StatCard
          title="Active System Users"
          value={stats.totalUsers}
          subtext="RBAC Staff Accounts"
        />
        <StatCard
          title="Cluster Infrastructure"
          value="Atlas Single"
          subtext="Central MongoDB Sharded DB"
        />
      </div>

      {/* Network Infrastructure Overview */}
      <div className="dash-section-card">
        <div className="dash-section-header">
          <h2 className="dash-section-title">
            <span>🌐</span>
            <span className="section-title-full">YNR Fishes Regional Network Status</span>
            <span className="section-title-short">Regional Network</span>
          </h2>
          <button
            onClick={() => onTabChange('branches')}
            className="dash-pill-btn sa-header-btn"
          >
            <span className="dash-btn-text-full">Manage All Branches →</span>
            <span className="dash-btn-text-short">Branches →</span>
          </button>
        </div>

        <div className="enterprise-table-wrapper">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Branch Node</th>
                <th>Branch Code</th>
                <th>City Location</th>
                <th>Daily Capacity</th>
                <th>Contact Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'rgba(230,247,255,0.4)' }}>
                    No regional branches registered yet.
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b._id || b.code}>
                    <td style={{ fontWeight: 700, color: '#fff' }}>{b.name}</td>
                    <td>
                      <code style={{ background: 'rgba(61,192,204,0.15)', color: '#3dc0cc', padding: '3px 8px', borderRadius: '6px' }}>
                        {b.code}
                      </code>
                    </td>
                    <td>{b.city}</td>
                    <td>{b.capacityKg ? `${b.capacityKg.toLocaleString()} kg/day` : 'N/A'}</td>
                    <td>{b.phone || 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${b.status === 'active' ? 'active' : 'inactive'}`}>
                        {b.status === 'active' ? '● Active Node' : '○ Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
