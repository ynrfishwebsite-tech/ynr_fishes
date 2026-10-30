import React from 'react';
import { Link } from 'react-router-dom';

export default function EnterpriseFooter() {
  return (
    <footer style={{
      backgroundColor: '#020d1a',
      borderTop: '1px solid rgba(61, 192, 204, 0.15)',
      padding: '5rem 2rem 8rem 2rem',
      color: '#b0c4de',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      zIndex: 10
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '4rem',
        marginBottom: '4rem'
      }}>
        {/* Brand Column */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <img 
              src="/assets/ynr_logo_hd.jpg" 
              alt="YNR Fishes" 
              style={{ 
                width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', 
                border: '2px solid rgba(61, 192, 204, 0.5)', padding: '2px', background: '#fff' 
              }} 
            />
            <h3 style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, letterSpacing: '0.12em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>YNR FISHES</h3>
          </div>
          <p style={{ lineHeight: 1.7, marginBottom: '2rem', color: '#7a96ab', fontSize: '0.95rem' }}>
            Nature's Super Food. Bringing you the highest quality, export-grade fresh and sea water fish directly from the market. A legacy of over 30 years in delivering excellence.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {['F', 'I', 'T'].map(social => (
              <a key={social} href="#" style={{
                width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(3, 20, 36, 0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(61, 192, 204, 0.2)',
                color: '#3dc0cc', textDecoration: 'none', transition: 'all 0.3s ease', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(61, 192, 204, 0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(3, 20, 36, 0.6)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{social}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '2rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold' }}>Quick Links</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { name: 'Home', path: '/' },
              { name: 'Shop Products', path: '/products' },
              { name: 'Our Services', path: '/services' },
              { name: 'About Us', path: '/about' },
              { name: 'Contact & Location', path: '/contact' }
            ].map(link => (
              <li key={link.name}>
                <Link to={link.path} style={{ color: '#7a96ab', textDecoration: 'none', transition: 'all 0.2s ease', display: 'inline-block', fontSize: '0.95rem' }}
                  onMouseEnter={(e) => { e.target.style.color = '#3dc0cc'; e.target.style.transform = 'translateX(5px)'; }}
                  onMouseLeave={(e) => { e.target.style.color = '#7a96ab'; e.target.style.transform = 'translateX(0)'; }}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '2rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold' }}>Contact Us</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.2rem', color: '#7a96ab', fontSize: '0.95rem' }}>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3dc0cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span style={{ lineHeight: 1.5 }}>Chemmumiahpet, Ravindra Nagar,<br/>Utukuru, Andhra Pradesh 516004</span>
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3dc0cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              +91 98493 13889
            </li>
            <li style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3dc0cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              info@ynrfishes.com
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '2rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold' }}>Newsletter</h4>
          <p style={{ marginBottom: '1.5rem', color: '#7a96ab', fontSize: '0.95rem', lineHeight: 1.5 }}>Subscribe for exclusive updates on fresh daily catches and premium offers.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <input 
              type="email" 
              placeholder="Enter your email address" 
              style={{
                width: '100%', padding: '0.9rem 1rem', borderRadius: '8px', border: '1px solid rgba(61, 192, 204, 0.2)',
                background: 'rgba(3, 20, 36, 0.5)', color: '#fff', outline: 'none', transition: 'border-color 0.3s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(61, 192, 204, 0.8)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(61, 192, 204, 0.2)'}
            />
            <button style={{
              width: '100%', padding: '0.9rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, rgba(61, 192, 204, 0.9), rgba(14, 86, 114, 0.95))', color: '#fff',
              fontWeight: 'bold', cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(19, 119, 143, 0.2)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(61, 192, 204, 0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(19, 119, 143, 0.2)'; }}
            >
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1280px', margin: '0 auto', paddingTop: '2rem', borderTop: '1px solid rgba(61, 192, 204, 0.15)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem'
      }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#5c7b91' }}>
          &copy; {new Date().getFullYear()} YNR Fishes. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
          {['Privacy Policy', 'Terms of Service', 'Shipping & Returns'].map(link => (
             <a key={link} href="#" style={{ color: '#5c7b91', textDecoration: 'none', transition: 'color 0.2s ease' }}
               onMouseEnter={(e) => e.target.style.color = '#3dc0cc'}
               onMouseLeave={(e) => e.target.style.color = '#5c7b91'}
             >{link}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
