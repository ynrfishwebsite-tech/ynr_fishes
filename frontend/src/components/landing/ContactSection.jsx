import React from 'react';
import '../../styles/contact.css';

export default function ContactSection() {
  return (
    <section className="contact-section" id="contact">
      <div className="contact-container">
        <h2 className="section-heading">Visit YNR Fish Market</h2>
        
        <div className="contact-grid">
          {/* Address Block */}
          <div className="contact-card">
            <div className="contact-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <h3>YNR Fish Market</h3>
            <p>
              Chemmumiahpet, Ravindra Nagar<br />
              Utukuru, Andhra Pradesh – 516004
            </p>
          </div>

          {/* Phone Block */}
          <div className="contact-card">
            <div className="contact-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </div>
            <h3>Call Us</h3>
            <p className="phone-number">+91 98493 13889</p>
          </div>
        </div>

        {/* Live Google Map */}
        <div className="map-embed-container" style={{ marginTop: '3rem', borderRadius: '16px', overflow: 'hidden', height: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <iframe 
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15501.996027473855!2d78.8143282!3d14.4746395!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bb3720023a1a599%3A0x7d6a52cd1d6ebef9!2sUtukuru%2C%20Kadapa%2C%20Andhra%20Pradesh%20516003!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin" 
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            allowFullScreen="" 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade">
          </iframe>
        </div>

        {/* Action Buttons */}
        <div className="contact-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a 
            href="https://wa.me/919849313889" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="contact-button wa-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            WhatsApp Order / Enquiry
          </a>
          
          <a 
            href="https://maps.app.goo.gl/8TYhrcsoawkcYgBUA" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="contact-button map-btn"
            style={{ 
              backgroundColor: '#4285F4', 
              color: '#fff', 
              padding: '0.8rem 1.5rem', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              textDecoration: 'none',
              fontWeight: '600',
              boxShadow: '0 4px 10px rgba(66, 133, 244, 0.3)'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            View on Google Maps
          </a>
        </div>
      </div>
    </section>
  );
}
