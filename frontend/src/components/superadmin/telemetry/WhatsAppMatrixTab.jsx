import React, { useState } from 'react';

export default function WhatsAppMatrixTab({ data }) {
  const summary = data?.summary || {
    activeNodes: '1 / 7',
    activeNodesLabel: 'Connected WhatsApp Instances',
    globalMessagesToday: 6,
    globalMessagesLabel: 'Total messages dispatched',
    disconnectedNodes: 6,
    disconnectedNodesLabel: 'Pending QR scan or unlinked'
  };

  const matrix = data?.matrix || [];

  // Track expanded rows for department routing sub-table
  const [expandedRows, setExpandedRows] = useState({
    [matrix[0]?._id || 'row_0']: true // Expand first one by default as seen in screenshot 5
  });

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="telemetry-view-container">
      {/* 3 Top KPI Cards */}
      <div className="wa-kpi-grid">
        {/* Active Nodes */}
        <div className="telemetry-kpi-card">
          <div className="telemetry-kpi-header">
            <span className="telemetry-kpi-title">ACTIVE NODES</span>
            <div className="kpi-icon-pill green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
          <div className="telemetry-kpi-value">{summary.activeNodes}</div>
          <div className="telemetry-kpi-sub green">
            <span>{summary.activeNodesLabel}</span>
          </div>
        </div>

        {/* Global Messages Today */}
        <div className="telemetry-kpi-card">
          <div className="telemetry-kpi-header">
            <span className="telemetry-kpi-title">GLOBAL MESSAGES TODAY</span>
            <div className="kpi-icon-pill blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
          </div>
          <div className="telemetry-kpi-value">{summary.globalMessagesToday}</div>
          <div className="telemetry-kpi-sub blue">
            <span>{summary.globalMessagesLabel}</span>
          </div>
        </div>

        {/* Disconnected Nodes */}
        <div className="telemetry-kpi-card">
          <div className="telemetry-kpi-header">
            <span className="telemetry-kpi-title">DISCONNECTED NODES</span>
            <div className="kpi-icon-pill red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>
          <div className="telemetry-kpi-value">{summary.disconnectedNodes}</div>
          <div className="telemetry-kpi-sub red">
            <span>{summary.disconnectedNodesLabel}</span>
          </div>
        </div>
      </div>

      {/* Live WhatsApp Connection Matrix Table */}
      <div className="telemetry-panel-card no-padding">
        <div className="panel-header-table">
          <div>
            <h3 className="panel-card-title">Live WhatsApp Connection Matrix</h3>
            <p className="panel-card-subtitle">Device binding, phone number, messages sent, and department routing</p>
          </div>
        </div>

        <div className="telemetry-table-responsive">
          <table className="telemetry-data-table wa-matrix-table">
            <thead>
              <tr>
                <th>BRANCH / NODE NAME</th>
                <th>STATUS</th>
                <th>PHONE NUMBER LINKED</th>
                <th>DEVICE NAME</th>
                <th>MSGS TODAY</th>
                <th>LINKED TIMESTAMP</th>
                <th style={{ textAlign: 'right' }}>DEPARTMENT ROUTING</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, idx) => {
                const rowKey = row._id || `wa_${idx}`;
                const isConnected = row.status === 'CONNECTED';
                const isExpanded = !!expandedRows[rowKey];

                return (
                  <React.Fragment key={rowKey}>
                    <tr className={isExpanded ? 'tr-parent-expanded' : ''}>
                      <td className="node-name-cell">
                        <div className="node-icon green">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                          </svg>
                        </div>
                        <span className="node-title">{row.name}</span>
                      </td>

                      <td>
                        <span className={`wa-status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
                          <span className="wa-status-dot"></span>
                          {row.status}
                        </span>
                      </td>

                      <td className="phone-cell">
                        {row.phoneNumberLinked}
                      </td>

                      <td className="device-name-cell">
                        {row.deviceName}
                      </td>

                      <td className="msgs-count-cell">
                        <span className="blue-msg-count">{row.msgsToday}</span>
                      </td>

                      <td className="timestamp-cell">
                        {row.linkedTimestamp}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => toggleRow(rowKey)}
                          className="dept-routing-btn"
                          title="View department notification routes"
                        >
                          <span>Departments</span>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Department Routing Sub-Row (Screenshot 5) */}
                    {isExpanded && (
                      <tr className="tr-expanded-drawer">
                        <td colSpan="7">
                          <div className="dept-drawer-card">
                            <div className="dept-drawer-header">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                <line x1="8" y1="21" x2="16" y2="21"></line>
                                <line x1="12" y1="17" x2="12" y2="21"></line>
                              </svg>
                              <span>Department Notification Routing Matrix: <strong>{row.name}</strong></span>
                            </div>

                            <div className="dept-boxes-grid">
                              {/* Pharmacy / Wholesale Billing */}
                              <div className={`dept-pill-box ${row.departments?.billing?.active ? 'active' : 'disabled'}`}>
                                <div className="dept-pill-top">
                                  <span className="dept-pill-title">{row.departments?.billing?.name || 'Billing & Invoicing Portal'}</span>
                                  <span className={`dept-state-badge ${row.departments?.billing?.active ? 'active' : 'disabled'}`}>
                                    {row.departments?.billing?.active ? 'Active' : 'Disabled'}
                                  </span>
                                </div>
                                <div className="dept-pill-phone">
                                  {row.departments?.billing?.active ? (
                                    <>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                      </svg>
                                      <span>{row.departments?.billing?.assignedPhone}</span>
                                    </>
                                  ) : (
                                    <span className="no-assigned">No number assigned</span>
                                  )}
                                </div>
                              </div>

                              {/* Laboratory / Cold Storage */}
                              <div className="dept-pill-box disabled">
                                <div className="dept-pill-top">
                                  <span className="dept-pill-title">Cold Storage &amp; Stock</span>
                                  <span className="dept-state-badge disabled">Disabled</span>
                                </div>
                                <div className="dept-pill-phone">
                                  <span className="no-assigned">No number assigned</span>
                                </div>
                              </div>

                              {/* Front Desk / Wholesale Dispatch */}
                              <div className="dept-pill-box disabled">
                                <div className="dept-pill-top">
                                  <span className="dept-pill-title">Front Desk / Wholesale Helpdesk</span>
                                  <span className="dept-state-badge disabled">Disabled</span>
                                </div>
                                <div className="dept-pill-phone">
                                  <span className="no-assigned">No number assigned</span>
                                </div>
                              </div>

                              {/* Doctor / Manager Terminal */}
                              <div className="dept-pill-box disabled">
                                <div className="dept-pill-top">
                                  <span className="dept-pill-title">Branch Manager Terminal</span>
                                  <span className="dept-state-badge disabled">Disabled</span>
                                </div>
                                <div className="dept-pill-phone">
                                  <span className="no-assigned">No number assigned</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
