import React from 'react';
import '../../styles/vertical-scroll-hero.css';

const images = {
  col1: ['2.jpg', '3.jpg', '4.jpg'],
  col2: ['5.jpg', '6.jpg', '7.webp'],
  col3: ['8.webp', '9.webp', '2.jpg'],
};

export default function VerticalScrollHero() {
  return (
    <div className="v-scroll-hero">
      <div className="v-scroll-grid">
        {/* Column 1 - Scrolling Up */}
        <div className="v-scroll-column scroll-up">
          {[...images.col1, ...images.col1, ...images.col1, ...images.col1].map((img, idx) => (
            <img key={`c1-${idx}`} src={`/hero-assets/${img}`} alt="Fish Gallery" className="v-scroll-img" />
          ))}
        </div>
        {/* Column 2 - Scrolling Down */}
        <div className="v-scroll-column scroll-down">
          {[...images.col2, ...images.col2, ...images.col2, ...images.col2].map((img, idx) => (
            <img key={`c2-${idx}`} src={`/hero-assets/${img}`} alt="Fish Gallery" className="v-scroll-img" />
          ))}
        </div>
        {/* Column 3 - Scrolling Up at different speed */}
        <div className="v-scroll-column scroll-up" style={{ animationDuration: '35s' }}>
          {[...images.col3, ...images.col3, ...images.col3, ...images.col3].map((img, idx) => (
            <img key={`c3-${idx}`} src={`/hero-assets/${img}`} alt="Fish Gallery" className="v-scroll-img" />
          ))}
        </div>
      </div>
      
      {/* Heavy vignette to ensure center text is readable */}
      <div className="v-hero-overlay" />
    </div>
  );
}
