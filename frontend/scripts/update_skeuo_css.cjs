const fs = require('fs');
const path = require('path');

// 1. Update skeuomorphic-terminal.css with responsive mobile styles & enhanced 3D tactile button animations
const cssPath = path.resolve(__dirname, '../src/styles/skeuomorphic-terminal.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const responsiveCssAdditions = `
/* ==========================================================================
   ENHANCED 3D TACTILE BUTTON INTERACTIONS (PHYSICAL DEPRESSION)
   ========================================================================== */
.skeuo-btn-orange:active {
  transform: translateY(2.5px) scale(0.97) !important;
  box-shadow: 
    inset 0 3px 6px rgba(0, 0, 0, 0.6),
    0 1px 2px rgba(154, 52, 18, 0.2) !important;
  filter: brightness(0.92) !important;
}

.skeuo-btn-green:active {
  transform: translateY(2.5px) scale(0.97) !important;
  box-shadow: 
    inset 0 3px 6px rgba(0, 0, 0, 0.6),
    0 1px 2px rgba(20, 83, 45, 0.2) !important;
  filter: brightness(0.92) !important;
}

.skeuo-btn-metal:active {
  transform: translateY(2px) scale(0.97) !important;
  box-shadow: 
    inset 0 2px 5px rgba(0, 0, 0, 0.4),
    0 1px 2px rgba(0, 0, 0, 0.2) !important;
}

.skeuo-nav-active:active,
.skeuo-nav-inactive:active {
  transform: translateY(1.5px) scale(0.98);
}

/* ==========================================================================
   RESPONSIVE GRIDS & MOBILE DRAWER STYLES
   ========================================================================== */
.skeuo-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.skeuo-consoles-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}

.skeuo-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 999;
  animation: skeuo-fade 0.2s ease;
}

@keyframes skeuo-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Tablet view (769px - 1024px) */
@media (max-width: 1024px) {
  .skeuo-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .skeuo-consoles-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

/* Mobile view (<= 768px) */
@media (max-width: 768px) {
  .skeuo-header-bar {
    padding: 8px 12px !important;
    gap: 8px !important;
  }

  .skeuo-header-title {
    font-size: 1.05rem !important;
  }

  .skeuo-header-subtitle {
    display: none !important;
  }

  .skeuo-nixie-digits {
    font-size: 13px !important;
    letter-spacing: 1.5px !important;
  }

  .skeuo-nixie-clock {
    padding: 3px 8px !important;
  }

  .skeuo-btn-orange,
  .skeuo-btn-green {
    padding: 6px 12px !important;
    font-size: 11px !important;
  }

  .skeuo-btn-metal {
    padding: 6px 10px !important;
    font-size: 11px !important;
  }

  .skeuo-cards-grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
    margin-bottom: 14px !important;
  }

  @media (min-width: 480px) and (max-width: 768px) {
    .skeuo-cards-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }

  .skeuo-consoles-grid {
    grid-template-columns: 1fr !important;
    gap: 14px !important;
  }

  /* Slide-out mobile leather drawer */
  .skeuo-leather-sidebar {
    position: fixed !important;
    top: 0 !important;
    bottom: 0 !important;
    left: 0 !important;
    width: 260px !important;
    max-width: 80vw !important;
    z-index: 1000 !important;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 8px 0 30px rgba(0, 0, 0, 0.85) !important;
  }

  .skeuo-leather-sidebar.mobile-open {
    transform: translateX(0) !important;
  }

  .skeuo-deck-canvas {
    padding: 12px 14px !important;
  }
}
`;

if (!cssContent.includes('ENHANCED 3D TACTILE BUTTON INTERACTIONS')) {
  cssContent += '\n' + responsiveCssAdditions;
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log('Appended mobile responsive styles and tactile animations to skeuomorphic-terminal.css');
} else {
  console.log('skeuomorphic-terminal.css already contains responsive styles');
}

