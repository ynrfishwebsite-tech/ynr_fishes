import React from 'react';

export default function BroadcastsTab({
  broadcasts,
  onOpenCreateModal,
  onDeleteBroadcast
}) {
  return (
    <div className="dash-section-card">
      <div className="dash-section-header">
        <h2 className="dash-section-title">
          <span>📢</span>
          <span className="section-title-full">Enterprise Announcements & System Bulletins</span>
          <span className="section-title-short">Announcements</span>
        </h2>
        <button onClick={onOpenCreateModal} className="sa-primary-btn">
          <span>➕</span>
          <span className="sa-btn-full">Send Network Broadcast</span>
          <span className="sa-btn-short">Broadcast</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
        {broadcasts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(230,247,255,0.4)' }}>
            No active enterprise broadcasts or alerts at this time.
          </div>
        ) : (
          broadcasts.map((b) => (
            <div
              key={b._id}
              style={{
                background: 'rgba(1, 10, 20, 0.65)',
                border: '1px solid rgba(61, 192, 204, 0.25)',
                borderRadius: '14px',
                padding: '18px 22px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span
                    style={{
                      background:
                        b.priority === 'urgent'
                          ? 'rgba(255,77,77,0.2)'
                          : b.priority === 'warning'
                          ? 'rgba(245,193,68,0.2)'
                          : 'rgba(61,192,204,0.2)',
                      color:
                        b.priority === 'urgent'
                          ? '#ff8080'
                          : b.priority === 'warning'
                          ? '#f5c144'
                          : '#3dc0cc',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase'
                    }}
                  >
                    {b.priority || 'INFO'}
                  </span>
                  <h4 style={{ margin: 0, color: '#fff', fontSize: '1.05rem' }}>{b.title}</h4>
                </div>
                <p style={{ margin: '4px 0 8px', color: 'rgba(230,247,255,0.85)', fontSize: '0.9rem' }}>
                  {b.message}
                </p>
                <div style={{ fontSize: '0.75rem', color: 'rgba(230,247,255,0.45)' }}>
                  Target: {b.targetBranches?.length ? `${b.targetBranches.length} specific branches` : 'All Branches'} | Posted: {new Date(b.createdAt).toLocaleDateString()}
                </div>
              </div>

              <button
                onClick={() => onDeleteBroadcast(b._id)}
                className="table-action-btn danger"
                title="Dismiss or delete broadcast"
              >
                🗑️ Dismiss
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
