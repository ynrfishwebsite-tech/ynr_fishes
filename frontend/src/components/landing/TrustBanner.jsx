import React from 'react';

export default function TrustBanner() {
  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      ),
      title: "100% Quality Guarantee",
      subtitle: "Export-grade freshness"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
      title: "Daily Fresh Catch",
      subtitle: "Direct from the sea"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
      ),
      title: "Fast Delivery",
      subtitle: "Wholesale & Retail"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      ),
      title: "30+ Years Trust",
      subtitle: "Legacy of excellence"
    }
  ];

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#031424', // Deep premium slate
      borderTop: '1px solid rgba(61, 192, 204, 0.2)',
      borderBottom: '1px solid rgba(61, 192, 204, 0.2)',
      padding: '2rem 0',
      display: 'flex',
      justifyContent: 'center',
      zIndex: 20,
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '1200px',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '2rem',
        padding: '0 2rem'
      }}>
        {features.map((feature, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              color: '#F5C144',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {feature.icon}
            </div>
            <div>
              <h4 style={{
                color: '#fff',
                fontFamily: 'var(--font-sans)',
                fontSize: '1.05rem',
                fontWeight: 600,
                margin: '0 0 0.25rem 0',
                letterSpacing: '0.05em'
              }}>
                {feature.title}
              </h4>
              <p style={{
                color: '#8aa4b8',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                margin: 0
              }}>
                {feature.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
