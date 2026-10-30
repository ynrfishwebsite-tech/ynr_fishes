import React from 'react';
import '../../styles/about.css';

export default function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-container">
        <h2 className="section-heading">About YNR Fishes</h2>
        
        <div className="about-content">
          <p className="about-text highlight">
            <strong>YNR Fishes</strong> is a fish and seafood market located in Chemmumiahpet, Ravindra Nagar, Utukuru, Andhra Pradesh. With <strong>30+ years of experience</strong>, YNR Fishes serves customers with a variety of freshwater fish, sea fish, prawns and crabs.
          </p>
          
          <p className="about-text">
            The market also provides fish cleaning and cutting services, with retail and bulk/wholesale requirements accommodated based on availability.
          </p>
        </div>

        {/* Leadership Section */}
        <div className="leadership-section">
          <div className="leader-card">
            <img src="https://ui-avatars.com/api/?name=Yalavarthi+Nageshwar+Rao&background=0E5672&color=fff&size=200" alt="Yalavarthi Nageshwar Rao" className="leader-img" />
            <div className="leader-info">
              <h4 className="leader-name">Yalavarthi Nageshwar Rao</h4>
              <p className="leader-role">Proprietor</p>
            </div>
          </div>
          
          <div className="leader-card">
            <img src="https://ui-avatars.com/api/?name=Dr+Parimala+Sharou&background=3DC0CC&color=fff&size=200" alt="Dr. Parimala Sharou" className="leader-img" />
            <div className="leader-info">
              <h4 className="leader-name">Dr. Parimala Sharou</h4>
              <p className="leader-role">M.D (Pharmacy, DMO)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
