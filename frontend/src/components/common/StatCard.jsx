import React from 'react';

export default function StatCard({ title, value, subtext, highlight = false }) {
  return (
    <div className={`dash-stat-card ${highlight ? 'highlight' : ''}`}>
      <div className="dash-stat-title">{title}</div>
      <div className="dash-stat-value">{value}</div>
      {subtext && <div className="dash-stat-sub">{subtext}</div>}
    </div>
  );
}
