import React from 'react';

export default function StorageServicesTab({ data }) {
  const mongo = data?.mongoStats || {
    storageUsedMB: '53.85',
    storageLimitMB: '512.00',
    remainingMB: '458.15',
    collectionsCount: 12,
    maxCollections: 500,
    totalDocuments: 88636,
    status: 'Healthy'
  };

  const cloud = data?.cloudStorage || {
    provider: 'ImageKit.io',
    plan: 'Free Forever Tier (20 GB)',
    storageUsedMB: '141.71',
    storageTotalGB: '20',
    remainingGB: '19.86',
    liveAssets: 19,
    bandwidthUsedGB: '0.14',
    status: 'Connected & Healthy',
    isConfigured: true
  };

  const transfer = data?.dataTransfer || {
    totalMB: '94.41',
    inbound: '56.29 KB',
    outbound: '94.36 MB'
  };

  const revenue = data?.revenueVelocity || {
    amount: 300,
    transactionsCount: 6,
    lastTransactionTime: '4:10 pm IST'
  };

  // Percent calculations
  const mongoPct = Math.min(((Number(mongo.storageUsedMB) / Number(mongo.storageLimitMB)) * 100), 100).toFixed(1);
  const cloudUsedGB = Number(cloud.storageUsedMB) / 1024;
  const cloudPct = Math.min(((cloudUsedGB / Number(cloud.storageTotalGB)) * 100), 100).toFixed(1);

  return (
    <div className="telemetry-view-container">
      {/* 4 Infrastructure Health Cards Grid */}
      <div className="services-grid-2x2">
        {/* Card 1: MongoDB Single Cluster */}
        <div className="service-health-card">
          <div className="service-card-top">
            <div className="service-brand">
              <div className="service-brand-icon mongo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
              </div>
              <div>
                <h4 className="service-title">MongoDB Single Cluster</h4>
                <p className="service-subtitle">Atlas Free Tier (M0 Quota)</p>
              </div>
            </div>
            <span className="service-status-pill green">
              {mongo.status}
            </span>
          </div>

          <div className="service-progress-section">
            <div className="progress-labels">
              <span className="progress-label-main">Occupied Storage:</span>
              <span className="progress-val-bold">{mongo.storageUsedMB} MB / {mongo.storageLimitMB} MB</span>
            </div>
            <div className="service-meter-track">
              <div className="service-meter-fill green" style={{ width: `${Math.max(mongoPct, 6)}%` }} />
            </div>
            <div className="progress-remaining-text">
              Remaining: {mongo.remainingMB} MB
            </div>
          </div>

          <div className="service-card-footer">
            <div className="service-stat-col">
              <span className="stat-label">COLLECTIONS</span>
              <span className="stat-val">{mongo.collectionsCount} <span className="stat-sub">/ {mongo.maxCollections}</span></span>
            </div>
            <div className="service-stat-col">
              <span className="stat-label">TOTAL DOCUMENTS</span>
              <span className="stat-val">{Number(mongo.totalDocuments).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 2: ImageKit Media CDN Storage */}
        <div className="service-health-card">
          <div className="service-card-top">
            <div className="service-brand">
              <div className="service-brand-icon cloud">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2">
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
                  <path d="M12 12v9"></path>
                  <path d="m16 16-4-4-4 4"></path>
                </svg>
              </div>
              <div>
                <h4 className="service-title">ImageKit Media Storage &amp; CDN</h4>
                <p className="service-subtitle">{cloud.plan || 'Free Forever Tier (20 GB)'}</p>
              </div>
            </div>
            <span className={`service-status-pill ${cloud.status === 'Connected & Healthy' ? 'blue' : 'muted'}`}>
              {cloud.status}
            </span>
          </div>

          <div className="service-progress-section">
            <div className="progress-labels">
              <span className="progress-label-main">Storage Used:</span>
              <span className="progress-val-bold">{cloud.storageUsedMB} MB / {cloud.storageTotalGB} GB</span>
            </div>
            <div className="service-meter-track">
              <div className="service-meter-fill blue" style={{ width: `${Math.max(cloudPct, 4)}%` }} />
            </div>
            <div className="progress-remaining-text">
              Remaining: {cloud.remainingGB} GB (20 GB Total Quota)
            </div>
          </div>

          <div className="service-card-footer">
            <div className="service-stat-col">
              <span className="stat-label">LIVE ASSETS</span>
              <span className="stat-val">{cloud.liveAssets} <span className="stat-sub">items</span></span>
            </div>
            <div className="service-stat-col">
              <span className="stat-label">BANDWIDTH (EST.)</span>
              <span className="stat-val">{cloud.bandwidthUsedGB} GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary Cards */}
      <div className="services-bottom-summary-grid">
        {/* Daily Data Transfer */}
        <div className="telemetry-panel-card">
          <div className="panel-header-between">
            <div>
              <span className="summary-card-tag">DAILY DATA TRANSFER (TODAY)</span>
              <div className="summary-big-value">{transfer.totalMB} MB</div>
              <div className="summary-sub-transfers">
                <span>↓ Inbound: <strong>{transfer.inbound}</strong></span>
                <span className="divider-dot">•</span>
                <span>↑ Outbound: <strong>{transfer.outbound}</strong></span>
              </div>
            </div>
            <div className="summary-icon-box blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </div>
          </div>
        </div>

        {/* Live Revenue Velocity */}
        <div className="telemetry-panel-card">
          <div className="panel-header-between">
            <div>
              <span className="summary-card-tag">LIVE REVENUE VELOCITY (TODAY)</span>
              <div className="summary-big-value text-green">₹{Number(revenue.amount).toLocaleString()}</div>
              <div className="summary-sub-transfers">
                <span>{revenue.transactionsCount} paid transactions completed as of {revenue.lastTransactionTime}</span>
              </div>
            </div>
            <div className="summary-icon-box green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
