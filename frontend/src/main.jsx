import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import './styles/hero.css';
import './styles/telemetry.css';
import App from './App.jsx';
import { CartProvider } from './context/CartContext.jsx';

// Globally disable mouse wheel changing number input values across the entire application
if (typeof window !== 'undefined') {
  window.addEventListener('wheel', () => {
    if (document.activeElement && document.activeElement.type === 'number') {
      document.activeElement.blur();
    }
  }, { passive: true });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </StrictMode>
);
