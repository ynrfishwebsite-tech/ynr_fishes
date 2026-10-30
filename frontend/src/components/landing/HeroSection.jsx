import React from 'react';
import VerticalScrollHero from './VerticalScrollHero';
import BrandContent from './BrandContent';

export default function HeroSection() {
  return (
    <section className="hero-track" id="hero">
      <div className="hero-viewport">
        {/* Infinite Vertical Scrolling Images Background */}
        <VerticalScrollHero />

        {/* Centered Hero Branding */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: 25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <BrandContent />
        </div>
      </div>
    </section>
  );
}
