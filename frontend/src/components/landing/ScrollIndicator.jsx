import React from 'react';

export default function ScrollIndicator({ style, onClick }) {
  return (
    <button
      className="hero-scroll-indicator"
      style={style}
      onClick={onClick}
      aria-label="Scroll to dive deeper into the underwater world"
    >
      <span className="scroll-text-caps">EXPLORE</span>
      
      <div className="scroll-mouse-icon" aria-hidden="true">
        <div className="scroll-wheel-dot" />
      </div>

      <span className="scroll-subtext">Scroll to dive deeper</span>

      <svg className="scroll-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}
