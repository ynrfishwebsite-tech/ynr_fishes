import React from 'react';

export default function TelemetryHeader({
  currentTime,
  onSync,
  isSyncing,
  autoRefreshInterval = 5
}) {
  return (
    <div className="telemetry-header-card">
      <div className="telemetry-header-left">
        <div className="telemetry-icon-pulse">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <div className="telemetry-title-block">
          <div className="telemetry-title-row">
            <h2 className="telemetry-heading">Real-Time Telemetry &amp; SaaS Health</h2>
            <span className="live-pill-badge">
              <span className="live-dot-pulse"></span>
              LIVE ({autoRefreshInterval}s)
            </span>
          </div>
          <p className="telemetry-subtext">
            Monitoring Atlas Free Tier, ImageKit Media CDN, live network throughput, and WhatsApp communication matrix.
          </p>
        </div>
      </div>

      <div className="telemetry-header-right">
        <div className="telemetry-clock">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{currentTime || '09:36:30 pm'}</span>
        </div>

        <button 
          className={`telemetry-sync-btn ${isSyncing ? 'syncing' : ''}`}
          onClick={onSync}
          disabled={isSyncing}
          title="Force telemetry synchronization"
        >
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={isSyncing ? 'spin-icon' : ''}
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>
    </div>
  );
}
