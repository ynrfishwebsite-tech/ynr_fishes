import React from 'react';
import '../../styles/gallery.css';

export default function GallerySection() {
  const galleryItems = [
    { title: 'Fresh Fish', type: 'large', img: '/images/freshwater_fish_1790409128786.jpg' },
    { title: 'Prawns', type: 'small', img: '/images/prawns_1790409158351.jpg' },
    { title: 'Crabs', type: 'small', img: '/images/crabs_1790409170925.jpg' },
    { title: 'Seafood', type: 'medium', img: '/images/sea_fish_1790409145549.jpg' },
    { title: 'Our Market', type: 'medium', img: '/images/fish_market_1790409183949.jpg' },
    { title: 'Cleaning & Cutting', type: 'large', img: '/images/fish_cutting_1790409198223.jpg' },
  ];

  return (
    <section className="gallery-section" id="gallery">
      <div className="gallery-container">
        <h2 className="section-heading">Our Fresh Catch</h2>
        <p className="gallery-subtitle">A glimpse into our daily supply directly from the market</p>
        
        <div className="gallery-masonry">
          {galleryItems.map((item, index) => (
            <div key={index} className={`gallery-item ${item.type}`}>
              <img 
                src={item.img} 
                alt={item.title} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div className="gallery-caption">
                <h4>{item.title}</h4>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Gentle caustics overlay at the bottom */}
      <div className="gallery-caustics" aria-hidden="true"></div>
    </section>
  );
}
