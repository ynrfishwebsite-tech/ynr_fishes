import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ style }) {
  const { cartCount, setIsCartOpen } = useCart();
  const { user, isAuthenticated, logout, getDashboardPath } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNavigation = (e, path, sectionId) => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      e.preventDefault();
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate(path);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super-admin':
        return { bg: 'rgba(245, 193, 68, 0.15)', border: '#F5C144', text: '#F5C144' };
      case 'admin':
        return { bg: 'rgba(61, 192, 204, 0.15)', border: '#3DC0CC', text: '#3DC0CC' };
      case 'manager':
        return { bg: 'rgba(78, 225, 160, 0.15)', border: '#4EE1A0', text: '#4EE1A0' };
      case 'worker':
        return { bg: 'rgba(255, 138, 72, 0.15)', border: '#FF8A48', text: '#FF8A48' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.1)', border: '#fff', text: '#fff' };
    }
  };

  const roleStyle = user ? getRoleBadgeColor(user.role) : null;

  return (
    <header className="hero-nav" style={style}>
      <Link to="/" className="nav-brand" aria-label="YNR Fishes Home">
        <div className="brand-icon-wrapper">
          <img 
            src="/assets/ynr_logo_hd.jpg" 
            alt="YNR Fishes Logo" 
            className="brand-logo-img"
          />
        </div>
      </Link>

      <div className="nav-meta-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link to="/about" className="nav-info-chip" onClick={(e) => handleNavigation(e, '/about', 'about')}>
          <span>About Us</span>
        </Link>
        <Link to="/services" className="nav-info-chip" onClick={(e) => handleNavigation(e, '/services', 'services')}>
          <span>Our Services</span>
        </Link>
        <Link to="/products" className="nav-info-chip" onClick={(e) => handleNavigation(e, '/products', 'products')}>
          <span>Products</span>
        </Link>
        <Link to="/gallery" className="nav-info-chip" onClick={(e) => handleNavigation(e, '/gallery', 'gallery')}>
          <span>Gallery</span>
        </Link>
        <Link to="/contact" className="nav-info-chip" onClick={(e) => handleNavigation(e, '/contact', 'contact')}>
          <span>Contact</span>
        </Link>
        
        {/* Cart Icon */}
        <button 
          onClick={() => setIsCartOpen(true)}
          aria-label="Open Cart"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', margin: '0 8px', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          {cartCount > 0 && (
            <span style={{
              position: 'absolute', top: '-8px', right: '-8px', background: '#F5C144', color: '#010A14',
              borderRadius: '50%', padding: '2px 6px', fontSize: '0.72rem', fontWeight: 'bold'
            }}>
              {cartCount}
            </span>
          )}
        </button>

        {/* Staff Authentication / Dashboard Section */}
        {isAuthenticated && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to={getDashboardPath(user.role)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: roleStyle.bg,
                border: `1px solid ${roleStyle.border}`,
                color: roleStyle.text,
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: `0 0 12px ${roleStyle.border}33`,
              }}
              title="Open Billing / Management Dashboard"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span>{user.role.toUpperCase()}</span>
              {user.branch?.code && (
                <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({user.branch.code})</span>
              )}
            </Link>

            <button
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              style={{
                background: 'rgba(255, 77, 77, 0.12)',
                border: '1px solid rgba(255, 77, 77, 0.4)',
                color: '#ff6b6b',
                padding: '6px 10px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 77, 77, 0.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 77, 77, 0.12)')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            id="nav-login-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, rgba(61, 192, 204, 0.2) 0%, rgba(245, 193, 68, 0.2) 100%)',
              border: '1px solid rgba(61, 192, 204, 0.5)',
              color: '#3DC0CC',
              fontSize: '0.82rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textDecoration: 'none',
              boxShadow: '0 0 15px rgba(61, 192, 204, 0.25)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 0 22px rgba(61, 192, 204, 0.5)';
              e.currentTarget.style.borderColor = '#4EE1A0';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(61, 192, 204, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(61, 192, 204, 0.5)';
              e.currentTarget.style.color = '#3DC0CC';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>STAFF LOGIN</span>
          </Link>
        )}
      </div>
    </header>
  );
}
