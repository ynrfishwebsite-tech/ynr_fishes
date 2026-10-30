import React from 'react';

export default function BranchesTab({
  branches,
  searchTerm,
  setSearchTerm,
  onOpenCreateModal,
  onOpenEditModal,
  onDeleteBranch
}) {
  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dash-section-card">
      <div className="dash-section-header">
        <h2 className="dash-section-title">
          <span>🏢</span>
          <span className="section-title-full">Enterprise Branch Registry</span>
          <span className="section-title-short">Branch Registry</span>
        </h2>
        <button onClick={onOpenCreateModal} className="sa-primary-btn">
          <span>➕</span>
          <span className="sa-btn-full">Provision New Branch Node</span>
          <span className="sa-btn-short">Branch</span>
        </button>
      </div>

      {/* Control Filter Bar */}
      <div className="sa-control-bar">
        <input
          type="text"
          className="sa-search-input"
          placeholder="Filter branches by name, code or city..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div style={{ color: 'rgba(230,247,255,0.6)', fontSize: '0.85rem' }}>
          Showing {filtered.length} of {branches.length} branches
        </div>
      </div>

      <div className="enterprise-table-wrapper">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Branch Name</th>
              <th>Branch Code</th>
              <th>City</th>
              <th>Address</th>
              <th>Capacity</th>
              <th>Contact Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'rgba(230,247,255,0.4)' }}>
                  No matching branches found.
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr key={b._id || b.code}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{b.name}</td>
                  <td>
                    <code style={{ background: 'rgba(61,192,204,0.15)', color: '#3dc0cc', padding: '3px 8px', borderRadius: '6px' }}>
                      {b.code}
                    </code>
                  </td>
                  <td>{b.city}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.address || 'N/A'}
                  </td>
                  <td>{b.capacityKg ? `${b.capacityKg.toLocaleString()} kg/day` : 'N/A'}</td>
                  <td>{b.phone || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${b.status === 'active' ? 'active' : 'inactive'}`}>
                      {b.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => onOpenEditModal(b)}
                      className="table-action-btn"
                      title="Edit branch details"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => onDeleteBranch(b._id, b.name)}
                      className="table-action-btn danger"
                      title="Delete branch"
                    >
                      🗑️
                    </button>
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
