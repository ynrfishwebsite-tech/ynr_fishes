import React from 'react';
import StatusBadge from '../common/StatusBadge';

export default function StaffTab({
  users,
  branches,
  roleFilter,
  setRoleFilter,
  searchTerm,
  setSearchTerm,
  onOpenCreateModal,
  onOpenEditModal,
  onToggleUserActive,
  onResetPassword,
  onDeleteUser
}) {
  const filtered = users.filter((u) => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch =
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="dash-section-card">
      <div className="dash-section-header">
        <h2 className="dash-section-title">
          <span>👥</span>
          <span className="section-title-full">Enterprise Staff & Access Management</span>
          <span className="section-title-short">Staff & Access</span>
        </h2>
        <button onClick={onOpenCreateModal} className="sa-primary-btn">
          <span>➕</span>
          <span className="sa-btn-full">Create Staff User</span>
          <span className="sa-btn-short">Staff</span>
        </button>
      </div>

      {/* Control Filter Bar */}
      <div className="sa-control-bar">
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="sa-search-input"
            placeholder="Search by name, email, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="sa-select-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="super-admin">Super Admin</option>
            <option value="admin">Branch Admin</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
            <option value="worker">Billing Worker</option>
          </select>
        </div>
        <div style={{ color: 'rgba(230,247,255,0.6)', fontSize: '0.85rem' }}>
          Showing {filtered.length} of {users.length} staff members
        </div>
      </div>

      <div className="enterprise-table-wrapper">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Staff Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Assigned Branch</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'rgba(230,247,255,0.4)' }}>
                  No matching staff members found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{u.name}</td>
                  <td>
                    <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                      @{u.username}
                    </code>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <StatusBadge status={u.role} type="role" />
                  </td>
                  <td>{u.branch?.name || (u.role === 'super-admin' ? '⭐ Global Enterprise' : 'Unassigned')}</td>
                  <td>
                    <StatusBadge status={u.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td>
                    <button
                      onClick={() => onOpenEditModal(u)}
                      className="table-action-btn"
                      title="Edit staff details"
                      style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                    >
                      <span>✏️</span><span className="act-btn-full"> Edit</span>
                    </button>
                    <button
                      onClick={() => onToggleUserActive(u._id, u.isActive)}
                      className={`table-action-btn ${u.isActive ? 'warning' : ''}`}
                      title={u.isActive ? 'Deactivate account' : 'Activate account'}
                    >
                      <span>{u.isActive ? '⏸️' : '▶️'}</span>
                      <span className="act-btn-full">{u.isActive ? ' Disable' : ' Enable'}</span>
                    </button>
                    <button
                      onClick={() => onResetPassword(u._id, u.name)}
                      className="table-action-btn"
                      title="Reset staff password"
                    >
                      <span>🔑</span><span className="act-btn-full"> Reset Key</span>
                    </button>
                    {u.role !== 'super-admin' && (
                      <button
                        onClick={() => onDeleteUser(u._id, u.name)}
                        className="table-action-btn danger"
                        title="Delete staff account"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
