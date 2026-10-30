import React from 'react';

export default function NetworkTrafficTab({ data }) {
  const summary = data?.summary || {
    globalRpm: 20,
    avgLatency: 247,
    apiErrors: 0,
    liveSockets: 2,
  };

  const trafficSeries = data?.trafficSeries || [];
  const topBranches = data?.topBranches || [];

  const branchMatrix = data?.branchMatrix || [];

  // Generate SVG path coordinates for smooth real-time area chart
  const maxRpm = Math.max(...trafficSeries.map(p => p.rpm), 50);
  const chartWidth = 560;
  const chartHeight = 150;
  const paddingBottom = 24;
  const effectiveHeight = chartHeight - paddingBottom;

  const pointsString = trafficSeries.map((p, index) => {
    const x = (index / Math.max(trafficSeries.length - 1, 1)) * chartWidth;
    const y = effectiveHeight - (p.rpm / maxRpm) * (effectiveHeight - 15);
    return `${x},${y}`;
  }).join(' ');

  const areaD = trafficSeries.length > 0 
    ? `M 0,${effectiveHeight} L ${pointsString.split(' ').map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt}`).join(' ')} L ${chartWidth},${effectiveHeight} Z`
    : `M 0,${effectiveHeight} L ${chartWidth},${effectiveHeight} Z`;

  const lineD = trafficSeries.length > 0
    ? pointsString.split(' ').map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt}`).join(' ')
    : '';

  return (
    <div className="telemetry-view-container">
      {/* 4 Top KPI Scorecards */}
      <div className="telemetry-kpi-grid">
        {/* Global RPM */}
        <div className="telemetry-kpi-card">
          <div className="telemetry-kpi-header">
            <span className="telemetry-kpi-title">GLOBAL RPM</span>
            <div className="kpi-icon-pill blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
          </div>
          <div className="telemetry-kpi-value">{summary.globalRpm}</div>
          <div className="telemetry-kpi-sub green">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
            <span>Network requests / min</span>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="telemetry-kpi-card">
          <div className="telemetry-kpi-header">
            <span className="telemetry-kpi-title">AVG LATENCY</span>
            <div className="kpi-icon-pill green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
          </div>
          <div className="telemetry-kpi-value">{summary.avgLatency} <span className="telemetry-kpi-unit">ms</span></div>
          <div className="telemetry-kpi-sub gray">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Server response duration</span>
          </div>
        </div>

        {/* API Errors */}
        <div className="telemetry-kpi-card">
          <div className="telemetry-kpi-header">
            <span className="telemetry-kpi-title">API ERRORS</span>
            <div className="kpi-icon-pill red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
          </div>
          <div className="telemetry-kpi-value">{summary.apiErrors}</div>
          <div className="telemetry-kpi-sub gray">
            <span>HTTP 4xx / 5xx (last 60s)</span>
          </div>
        </div>

        {/* Live Sockets */}
        <div className="telemetry-kpi-card">
          <div className="telemetry-kpi-header">
            <span className="telemetry-kpi-title">LIVE SOCKETS</span>
            <div className="kpi-icon-pill orange">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
              </svg>
            </div>
          </div>
          <div className="telemetry-kpi-value">{summary.liveSockets}</div>
          <div className="telemetry-kpi-sub green">
            <span>Active SSL client sessions</span>
          </div>
        </div>
      </div>

      {/* Middle Charts Grid */}
      <div className="telemetry-charts-grid">
        {/* Network Traffic Flow Area Chart */}
        <div className="telemetry-panel-card">
          <div className="panel-header-between">
            <div>
              <h3 className="panel-card-title">Network Traffic Flow (RPM)</h3>
              <p className="panel-card-subtitle">Sliding real-time traffic pulse</p>
            </div>
            <div className="rpm-pulse-badge">
              {summary.globalRpm} req/min
            </div>
          </div>

          <div className="traffic-chart-wrapper">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="traffic-svg-chart">
              <defs>
                <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="20" x2={chartWidth} y2="20" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="0" y1="55" x2={chartWidth} y2="55" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="0" y1="90" x2={chartWidth} y2="90" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="0" y1={effectiveHeight} x2={chartWidth} y2={effectiveHeight} stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" />

              {/* Chart Curves */}
              <path d={areaD} fill="url(#trafficGradient)" />
              <path d={lineD} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Bottom Time Ticks */}
              {trafficSeries.filter((_, i) => i % 4 === 0).map((pt, idx, arr) => {
                const xPos = (idx / (arr.length - 1 || 1)) * (chartWidth - 50) + 10;
                return (
                  <text key={idx} x={xPos} y={chartHeight - 4} fontSize="9" fill="#94a3b8" textAnchor="middle">
                    {pt.time}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Top Active Branches (by RPM) */}
        <div className="telemetry-panel-card">
          <div className="panel-header-between">
            <div>
              <h3 className="panel-card-title">Top Active Branches (by RPM)</h3>
              <p className="panel-card-subtitle">Throughput comparison</p>
            </div>
            <div className="active-nodes-badge">
              Active Nodes
            </div>
          </div>

          <div className="throughput-bars-container">
            {topBranches.slice(0, 5).map((node, i) => {
              const maxNodeRpm = Math.max(...topBranches.map(n => n.rpm), 1);
              const percentage = Math.min((node.rpm / maxNodeRpm) * 100, 100);
              return (
                <div key={i} className="throughput-bar-row">
                  <div className="throughput-label-col">
                    <span className="throughput-branch-name" title={node.name}>{node.name}</span>
                  </div>
                  <div className="throughput-track-col">
                    <div className="throughput-track">
                      <div 
                        className="throughput-fill" 
                        style={{ width: `${node.rpm > 0 ? Math.max(percentage, 8) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="throughput-val-col">
                    <span>{node.rpm} req/m</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hospital/Branch Live Matrix Table */}
      <div className="telemetry-panel-card no-padding">
        <div className="panel-header-table">
          <div>
            <h3 className="panel-card-title">Branch Live Matrix</h3>
            <p className="panel-card-subtitle">Individual branch throughput, daily transfer and ping telemetry</p>
          </div>
          <div className="nodes-tracked-badge">
            {data?.trackedNodesCount || branchMatrix.length} Nodes Tracked
          </div>
        </div>

        <div className="telemetry-table-responsive">
          <table className="telemetry-data-table">
            <thead>
              <tr>
                <th>BRANCH / NODE</th>
                <th>LIVE STATUS</th>
                <th>LIVE RPM</th>
                <th>DAILY TRANSFER (IN/OUT)</th>
                <th>LAST ACTIVITY PING</th>
              </tr>
            </thead>
            <tbody>
              {branchMatrix.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                    No branches registered yet. Add branches in the <strong>Branches</strong> tab to monitor telemetry.
                  </td>
                </tr>
              ) : (
                branchMatrix.map((branch, idx) => {
                  const isActive = branch.status === 'active';
                  return (
                    <tr key={branch._id || idx}>
                      <td className="node-name-cell">
                        <div className="node-icon">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                          </svg>
                        </div>
                        <span className="node-title">{branch.name}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${isActive ? 'active' : 'idle'}`}>
                          <span className="status-dot"></span>
                          {isActive ? 'Active Now' : 'Idle'}
                        </span>
                      </td>
                      <td className="rpm-num-cell">
                        {branch.liveRpm} req/m
                      </td>
                      <td className="transfer-cell">
                        ↓ {branch.dailyTransferIn} / ↑ {branch.dailyTransferOut}
                      </td>
                      <td className="ping-cell">
                        {branch.lastActivityPing}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
