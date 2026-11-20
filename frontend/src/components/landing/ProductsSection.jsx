import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { getApiUrl } from '../../config.js';
import { useCart } from '../../context/CartContext';
import '../../styles/products.css';

export default function ProductsSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedWeight, setSelectedWeight] = useState(1); // multiplier in Kg
  const [selectedCut, setSelectedCut] = useState('Whole'); // DEFAULT TO WHOLE

  const { addToCart } = useCart();

  // Helper to parse English and Telugu/Regional names cleanly
  const parseFishTitle = (rawTitle = '') => {
    if (!rawTitle) return { mainName: 'Fresh Catch', localName: '' };
    const cleaned = rawTitle.replace(/\/+$/, '').trim();
    if (cleaned.includes('/')) {
      const parts = cleaned.split('/');
      return {
        mainName: parts[0].trim(),
        localName: parts.slice(1).join('/').trim()
      };
    }
    return { mainName: cleaned, localName: '' };
  };

  // Fetch live seafood catalog from Kadapa Depot (kdp) database
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${getApiUrl()}/menu`, {
          headers: {
            'X-Tenant-DB': 'kdp',
            'X-Branch-Code': 'KDP'
          }
        });

        if (Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((item, idx) => {
            const catName = typeof item.category === 'object' ? item.category?.name : (item.category || 'Fresh Catch');

            return {
              _id: item._id || `kdp_${idx}`,
              title: item.name,
              scientificName: item.scientificName || '',
              price: item.price || 0,
              sellingUnit: item.sellingUnit || 'Kg',
              category: catName,
              type: catName,
              description: item.description || `${item.name} freshly sourced at YNR Fishes Kadapa Depot.`,
              imgUrl: item.image && item.image.startsWith('/') ? item.image : (item.image || '/valuga.png'),
              stock: item.stock !== undefined ? item.stock : 50,
              isAvailable: item.isAvailable !== false,
              badge: item.price >= 700 ? 'Premium' : (idx < 3 ? 'Bestseller' : null),
              delay: `${(idx % 6) * 0.1}s`
            };
          });
          setProducts(mapped);
        } else {
          setProducts(getFallbackProducts());
        }
      } catch (err) {
        console.warn('Error fetching live fish catalog:', err.message);
        setProducts(getFallbackProducts());
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const getFallbackProducts = () => [
    { _id: '1', title: 'Wallago / వాలగ (ఆల)', scientificName: 'Wallago attu', price: 200, category: 'Fresh Water', description: 'Fresh water river shark Wallago / Valuga fish', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/wallago_valuga.png', badge: 'Bestseller' },
    { _id: '2', title: 'Rani / గులివిందలు', scientificName: 'Nemipterus japonicus', price: 300, category: 'Sea Water', description: 'Pink perch / Rani fish fresh coastal catch', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/rani_gulivindalu.png' },
    { _id: '3', title: 'Pothi Gini / చిన్న చేపలు', scientificName: 'Puntius sophore', price: 250, category: 'Fresh Water', description: 'Fresh small pool barb fish, great for fry', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/pothi_gini.png' },
    { _id: '4', title: 'Koli / కోలి చేప', scientificName: 'Otolithes ruber', price: 100, category: 'Sea Water', description: 'Tiger toothed croaker fish', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/koli_croaker.png' },
    { _id: '5', title: 'Bangaru Theega / Golden Fish', scientificName: 'Carassius auratus', price: 150, category: 'Fresh Water', description: 'Golden carp fresh water catch', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/bangaru_theega.png', badge: 'Value Pack' },
    { _id: '6', title: 'Black Pomfret (నల్ల చందువా)', scientificName: 'Parastromateus niger', price: 800, category: 'Sea Water', description: 'Premium fresh black pomfret', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/black_pomfret.png', badge: 'Premium' },
    { _id: '7', title: 'Sea Crabs / పీతలు', scientificName: 'Portunus pelagicus', price: 350, category: 'Crabs & Shellfish', description: 'Fresh succulent sea crabs', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/sea_crabs.jpg' },
    { _id: '8', title: 'Sheelavathi / శీలావతి ఫిష్', scientificName: 'Labeo rohita hybrid', price: 300, category: 'Fresh Water', description: 'Fresh freshwater carp delicacy', imgUrl: 'https://ik.imagekit.io/uy5estwss/menus/rohu.png' }
  ];

  const cutYieldMap = {
    'Whole': 1.0,
    'Whole Cleaned': 0.85,
    'Curry Cut': 0.75,
    'Boneless Fillet': 0.50
  };

  const dynamicCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const tabs = ['All', ...dynamicCategories];

  const filteredProducts = activeTab === 'All'
    ? products
    : products.filter(p => p.category === activeTab);

  // Default cuts list (Whole is always first and default!)
  const cutOptions = ['Whole', 'Whole Cleaned', 'Curry Cut', 'Boneless Fillet'];
  const weightOptions = [
    { label: '500g', value: 0.5 },
    { label: '1kg', value: 1 },
    { label: '2kg', value: 2 },
    { label: '3kg', value: 3 },
    { label: '5kg', value: 5 }
  ];

  const handleOpenModal = (product) => {
    setSelectedProduct(product);
    setSelectedWeight(1);
    setSelectedCut('Whole'); // Always default to Whole!
  };

  const handleAddToCart = (product, cut = 'Whole', weight = 1, isFromModal = false) => {
    const yieldF = cutYieldMap[cut] || 1.0;
    const grossKg = parseFloat((weight / yieldF).toFixed(2));

    const finalProduct = {
      ...product,
      title: `${product.title} (${cut})`,
      price: product.price,
      imgUrl: product.imgUrl,
      isBox: false,
      cutType: cut,
      yieldFactor: yieldF,
      grossWeightKg: grossKg,
      netWeightKg: weight
    };

    addToCart(finalProduct, weight);
    if (isFromModal) setSelectedProduct(null);
  };

  return (
    <section className="products-section" id="products">
      <div className="products-container">

        {/* Enterprise Depot Delivery Banner - Responsive */}
        <div className="depot-delivery-banner">
          <div className="depot-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3DC0CC" strokeWidth="2.2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <div>
            <div className="depot-banner-sub">
              Direct From Kadapa City Depot (KDP)
            </div>
            <div className="depot-banner-main">
              Delivering to Chemmumiahpet, Ravindra Nagar & Nearby (516004)
            </div>
          </div>
        </div>

        <h2 className="section-heading-main">Fresh Daily Catch</h2>
        <p className="section-subheading-text">
          Live stock synchronized directly from YNR Fishes wholesale and retail counters.
        </p>

        {/* Modern Category Filter Tabs - Horizontal Swipeable on Mobile */}
        <div className="category-tabs-scroll-area">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`category-tab-btn ${activeTab === tab ? 'active' : 'inactive'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '4rem 0', color: '#8AA4B8', fontSize: '1.1rem' }}>
            Loading live fish inventory from Kadapa Depot...
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product, index) => {
              const { mainName, localName } = parseFishTitle(product.title);

              return (
                <div
                  key={`${product._id}-${index}`}
                  className="product-card"
                >
                  <div className="product-card-inner">
                    {/* Visual Image Showcase */}
                    <div
                      className="product-img-wrapper"
                      onClick={() => handleOpenModal(product)}
                      title="Click to view details & choose cuts"
                    >
                      {/* Status Badges */}
                      {product.badge && (
                        <div className={`badge-status ${product.badge === 'Premium' ? 'badge-premium' : 'badge-bestseller'}`}>
                          <span>{product.badge === 'Premium' ? '⭐' : '🔥'}</span>
                          <span>{product.badge}</span>
                        </div>
                      )}

                      {/* Category Environment Badge */}
                      {product.category && (
                        <div className="badge-environment">
                          {product.category}
                        </div>
                      )}

                      <img
                        src={product.imgUrl}
                        alt={product.title}
                        className="product-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/valuga.png';
                        }}
                      />

                      {/* Bottom Image Overlay Bar */}
                      <div className="img-overlay-bar">
                        <span className="fresh-indicator">
                          <span className="pulsing-dot"></span>
                          <span>Daily Fresh</span>
                        </span>
                        {product.stock > 0 && (
                          <span className="stock-indicator">
                            In Stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Product Information */}
                    <div className="product-info-block">
                      <div className="product-title-row">
                        <h3
                          className="product-title"
                          onClick={() => handleOpenModal(product)}
                        >
                          {mainName}
                        </h3>
                        {localName && (
                          <span className="product-native-badge">
                            {localName}
                          </span>
                        )}
                      </div>

                      {product.scientificName && (
                        <div className="product-scientific">
                          {product.scientificName}
                        </div>
                      )}

                      {/* Quality Assurance Chips */}
                      <div className="product-features-row">
                        <span className="product-feature-tag">🔪 Custom Cuts</span>
                        <span className="product-feature-tag">❄️ Chilled 0-4°C</span>
                        <span className="product-feature-tag">✨ 100% Chemical-Free</span>
                      </div>

                      <p className="product-description">{product.description}</p>
                    </div>

                    {/* Price & Action Area - Zero Cropping Structure */}
                    <div className="product-card-footer">
                      <div className="footer-top-row">
                        <div className="price-column">
                          <span className="price-label-tiny">PRICE PER KG</span>
                          <div className="price-amount-box">
                            <span className="product-price-val">₹{product.price}</span>
                            <span className="product-price-unit">/{product.sellingUnit || 'kg'}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenModal(product)}
                          className="btn-custom-cuts"
                          title="Choose butchering cuts & weight"
                        >
                          <span>⚙️ Cuts</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleAddToCart(product, 'Whole', 1, false)}
                        className="btn-add-whole"
                        title="Quick add 1kg whole fish"
                      >
                        <span>+</span> Add Whole
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Details & Cut / Weight Customization Modal */}
      {selectedProduct && createPortal(
        <div
          className="product-modal-overlay"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="product-modal"
            onClick={e => e.stopPropagation()}
          >
            {/* Dedicated High-Contrast Close Button */}
            <button
              onClick={() => setSelectedProduct(null)}
              aria-label="Close modal"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(2, 18, 34, 0.95)',
                border: '1.5px solid #3DC0CC',
                color: '#ffffff',
                fontSize: '1.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 1000,
                boxShadow: '0 4px 14px rgba(0,0,0,0.7)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#3DC0CC';
                e.currentTarget.style.color = '#010A14';
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(2, 18, 34, 0.95)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              &times;
            </button>

            {/* Modal Image Header */}
            <div style={{ height: '145px', minHeight: '145px', position: 'relative', background: '#010A14', overflow: 'hidden' }}>
              <img
                src={selectedProduct.imgUrl}
                alt={selectedProduct.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/valuga.png';
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '70px',
                background: 'linear-gradient(to top, #03182C, transparent)'
              }} />
            </div>

            {/* Scrollable Modal Body */}
            <div
              className="modal-body"
              style={{
                padding: '1.25rem 1.5rem',
                overflowY: 'auto',
                flex: 1,
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.15rem 0' }}>
                    {selectedProduct.title}
                  </h3>
                  {selectedProduct.scientificName && (
                    <div style={{ color: '#3DC0CC', fontStyle: 'italic', fontSize: '0.82rem' }}>
                      {selectedProduct.scientificName}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#F5C144', fontSize: '1.45rem', fontWeight: 900, textShadow: '0 0 12px rgba(245, 193, 68, 0.35)' }}>
                    ₹{selectedProduct.price * selectedWeight}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#8AA4B8', fontWeight: 600 }}>
                    for {selectedWeight >= 1 ? `${selectedWeight} kg` : `${selectedWeight * 1000} g`}
                  </div>
                </div>
              </div>

              {/* Weight & Yield Transparency Card */}
              {(() => {
                const yieldF = cutYieldMap[selectedCut] || 1.0;
                const netGrams = selectedWeight * 1000;
                const grossGrams = Math.round(netGrams / yieldF);
                return (
                  <div style={{
                    background: 'rgba(1, 15, 30, 0.85)',
                    border: '1px solid rgba(61, 192, 204, 0.3)',
                    borderRadius: '12px',
                    padding: '0.65rem 1rem',
                    margin: '0.85rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '0.82rem' }}>
                      <span>Gross Uncut Catch:</span>
                      <span style={{ color: '#ffffff', fontWeight: 700 }}>
                        ~{grossGrams >= 1000 ? `${(grossGrams / 1000).toFixed(2)} kg` : `${grossGrams} g`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#3DC0CC', fontSize: '0.88rem', fontWeight: 800 }}>
                      <span>Net Delivered ({selectedCut}):</span>
                      <span>~{netGrams >= 1000 ? `${selectedWeight} kg` : `${netGrams} g`}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#8AA4B8', fontStyle: 'italic', marginTop: '0.1rem' }}>
                      {selectedCut === 'Whole' 
                        ? '*Full uncut whole fish fresh from the depot water.' 
                        : '*Freshly descaled, gutted & butchered at Kadapa counter.'}
                    </div>
                  </div>
                );
              })()}

              <p style={{ color: '#D1E4ED', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                {selectedProduct.description}
              </p>

              {/* Select Butchering Cut */}
              <div style={{ marginBottom: '1.1rem' }}>
                <h4 style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Select Butchering Cut:
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {cutOptions.map(cut => (
                    <button
                      key={cut}
                      onClick={() => setSelectedCut(cut)}
                      style={{
                        background: selectedCut === cut ? 'rgba(61, 192, 204, 0.3)' : 'rgba(3, 24, 44, 0.8)',
                        color: selectedCut === cut ? '#3DC0CC' : '#8AA4B8',
                        border: `1.5px solid ${selectedCut === cut ? '#3DC0CC' : 'rgba(255, 255, 255, 0.12)'}`,
                        padding: '0.45rem 0.95rem',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {cut}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Weight */}
              <div style={{ marginBottom: '0.5rem' }}>
                <h4 style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Select Net Quantity:
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {weightOptions.map(wt => (
                    <button
                      key={wt.label}
                      onClick={() => setSelectedWeight(wt.value)}
                      style={{
                        background: selectedWeight === wt.value ? 'rgba(245, 193, 68, 0.22)' : 'rgba(3, 24, 44, 0.8)',
                        color: selectedWeight === wt.value ? '#F5C144' : '#8AA4B8',
                        border: `1.5px solid ${selectedWeight === wt.value ? '#F5C144' : 'rgba(255, 255, 255, 0.12)'}`,
                        padding: '0.45rem 1rem',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div style={{
              padding: '0.85rem 1.5rem',
              background: 'rgba(2, 18, 34, 0.98)',
              borderTop: '1px solid rgba(61, 192, 204, 0.25)',
              display: 'flex',
              alignItems: 'center'
            }}>
              <button
                onClick={() => handleAddToCart(selectedProduct, selectedCut, selectedWeight, true)}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, #3DC0CC, #0E5672)',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 800,
                  border: '1px solid rgba(114, 222, 229, 0.5)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(19, 119, 143, 0.5)',
                  transition: 'filter 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
              >
                Add to Cart — ₹{selectedProduct.price * selectedWeight} ({selectedCut})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
