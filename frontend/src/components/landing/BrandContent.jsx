import React, { useState, useEffect } from 'react';

const dynamicPhrases = [
  "30+ YEARS OF EXPERIENCE",
  "PREMIUM EXPORT QUALITY",
  "FRESH CATCH DAILY",
  "WHOLESALE SEA PORT EXPORTS"
];

export default function BrandContent({ style }) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer;
    const currentPhrase = dynamicPhrases[currentPhraseIndex];

    if (isDeleting) {
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.substring(0, displayText.length - 1));
        if (displayText.length === 0) {
          setIsDeleting(false);
          setCurrentPhraseIndex((prev) => (prev + 1) % dynamicPhrases.length);
        }
      }, 40); // Deleting speed
    } else {
      timer = setTimeout(() => {
        setDisplayText(currentPhrase.substring(0, displayText.length + 1));
        if (displayText.length === currentPhrase.length) {
          timer = setTimeout(() => setIsDeleting(true), 2500); // Pause when word is complete
        }
      }, 70); // Typing speed
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentPhraseIndex]);

  return (
    <div className="brand-content-wrapper" style={{ ...style, pointerEvents: 'auto' }}>
      <div className="brand-ambient-glow" aria-hidden="true" style={{ pointerEvents: 'none' }} />

      <div className="brand-badge" style={{ marginBottom: '1.5rem' }}>
        <span className="badge-dot" style={{ flexShrink: 0, marginRight: '8px' }} />
        <span className="brand-badge-text">GOD BLESSES : Have Dominion Over The Fish Of Sea Gen: 1:28</span>
      </div>      
      
      {/* Main Brand Title */}
      <h1 className="brand-title">
        <span className="brand-title-accent">YNR</span> FISHES
      </h1>

      {/* Tagline */}
      <div className="brand-tagline-container">
        <div className="tagline-line" aria-hidden="true" />
        <h2 className="brand-tagline">NATURE'S SUPER FOOD</h2>
        <div className="tagline-line line-right" aria-hidden="true" />
      </div>

      {/* Dynamic Typing Text */}
      <div className="dynamic-text-wrapper">
        <p className="dynamic-text">
          {displayText}
          <span className="typing-cursor"></span>
        </p>
      </div>

    </div>
  );
}
