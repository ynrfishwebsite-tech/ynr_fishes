import React from 'react';

export default function TelemetrySubTabs({ activeSubTab, setActiveSubTab }) {
  const tabs = [
    {
      id: 'network',
      label: 'Network & Live Traffic',
      shortLabel: 'Traffic',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
      )
    },
    {
      id: 'storage',
      label: 'Storage & External Services',
      shortLabel: 'Storage',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
      )
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Communication Matrix',
      shortLabel: 'WhatsApp',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
      )
    }
  ];

  return (
    <div className="telemetry-subtabs-bar">
      {tabs.map((tab) => {
        const isActive = activeSubTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`telemetry-subtab-btn ${isActive ? 'active' : ''}`}
          >
            <span className="telemetry-subtab-icon">{tab.icon}</span>
            <span className="telemetry-subtab-full">{tab.label}</span>
            <span className="telemetry-subtab-short">{tab.shortLabel}</span>
            {isActive && <div className="telemetry-subtab-indicator" />}
          </button>
        );
      })}
    </div>
  );
}
