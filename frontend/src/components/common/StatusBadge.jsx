import React from 'react';

export default function StatusBadge({ status, type = 'status' }) {
  if (type === 'role') {
    const roleColors = {
      'super-admin': { bg: 'rgba(245, 193, 68, 0.2)', color: '#F5C144', border: 'rgba(245, 193, 68, 0.5)' },
      'admin': { bg: 'rgba(61, 192, 204, 0.2)', color: '#3DC0CC', border: 'rgba(61, 192, 204, 0.5)' },
      'manager': { bg: 'rgba(78, 225, 160, 0.2)', color: '#4EE1A0', border: 'rgba(78, 225, 160, 0.5)' },
      'cashier': { bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.5)' },
      'worker': { bg: 'rgba(180, 190, 200, 0.2)', color: '#B0C4DE', border: 'rgba(180, 190, 200, 0.5)' }
    };
    const c = roleColors[status] || { bg: 'rgba(255,255,255,0.1)', color: '#fff', border: 'rgba(255,255,255,0.2)' };
    return (
      <span
        style={{
          background: c.bg,
          color: c.color,
          border: `1px solid ${c.border}`,
          padding: '3px 9px',
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}
      >
        {status}
      </span>
    );
  }

  const isActive = status === 'active' || status === true;
  return (
    <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isActive ? '#4EE1A0' : '#FF6B6B'
        }}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}
