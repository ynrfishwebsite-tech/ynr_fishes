import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { getApiUrl } from '../../config.js';
import { useCart } from '../../context/CartContext';
import '../../styles/products.css';

export default function ProductsSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderMode, setOrderMode] = useState('retail'); // 'retail' (Individual Kg/Whole) or 'bulk' (Wholesale Boxes)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalMode, setModalMode] = useState('retail'); // 'retail' or 'bulk' in modal
  const [activeTab, setActiveTab] = useState('All');
  const [selectedWeight, setSelectedWeight] = useState(1); // multiplier for retail
  const [selectedCut, setSelectedCut] = useState('Whole'); // DEFAULT TO WHOLE NOT CUT!
  const [boxCount, setBoxCount] = useState(1); // for wholesale boxes

  const { addToCart } = useCart();

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
            const boxPackingKg = item.boxPackingKg || 60;
            const calculatedBoxPrice = item.boxPrice > 0 
              ? item.boxPrice 
              : (item.wholesalePricePerKg > 0 ? item.wholesalePricePerKg * boxPackingKg : (item.price || 0) * boxPackingKg);

            return {
              _id: item._id || `kdp_${idx}`,
              title: item.name,
              scientificName: item.scientificName || '',
              price: item.price || 0,
              boxPrice: calculatedBoxPrice,
              boxRate: calculatedBoxPrice,
              boxPackingKg: boxPackingKg,
              wholesalePricePerKg: item.wholesalePricePerKg || Math.round(calculatedBoxPrice / boxPackingKg),
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
    { _id: '1', title: 'Wallago / వాలగ (ఆల)', scientificName: 'Wallago attu', price: 200, boxPackingKg: 60, boxRate: 12000, category: 'Fresh Water', description: 'Fresh water river shark Wallago / Valuga fish', imgUrl: '/valuga.png', badge: 'Bestseller' },
    { _id: '2', title: 'Rani / గులివిందలు', scientificName: 'Nemipterus japonicus', price: 300, boxPackingKg: 50, boxRate: 15000, category: 'Sea Water', description: 'Pink perch / Rani fish fresh coastal catch', imgUrl: '/valuga.png' },
    { _id: '3', title: 'Pothi Gini / చిన్న చేపలు', scientificName: 'Puntius sophore', price: 250, boxPackingKg: 40, boxRate: 10000, category: 'Fresh Water', description: 'Fresh small pool barb fish, great for fry', imgUrl: '/valuga.png' },
    { _id: '4', title: 'Koli / కోలి చేప', scientificName: 'Otolithes ruber', price: 100, boxPackingKg: 60, boxRate: 6000, category: 'Sea Water', description: 'Tiger toothed croaker fish', imgUrl: '/valuga.png' },
    { _id: '5', title: 'Bangaru Theega / Golden Fish', scientificName: 'Carassius auratus', price: 150, boxPackingKg: 60, boxRate: 9000, category: 'Fresh Water', description: 'Golden carp fresh water catch', imgUrl: '/valuga.png', badge: 'Value Pack' },
    { _id: '6', title: 'Black Pomfret (నల్ల చందువా)', scientificName: 'Parastromateus niger', price: 800, boxPackingKg: 50, boxRate: 40000, category: 'Sea Water', description: 'Premium fresh black pomfret', imgUrl: '/valuga.png', badge: 'Premium' },
    { _id: '7', title: 'Sea Crabs / పీతలు', scientificName: 'Portunus pelagicus', price: 350, boxPackingKg: 40, boxRate: 14000, category: 'Crabs & Shellfish', description: 'Fresh succulent sea crabs', imgUrl: '/valuga.png' },
    { _id: '8', title: 'Sheelavathi / శీలావతి ఫిష్', scientificName: 'Labeo rohita hybrid', price: 300, boxPackingKg: 60, boxRate: 18000, category: 'Fresh Water', description: 'Fresh freshwater carp delicacy', imgUrl: '/valuga.png' }
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
    { label: '3kg', value: 3 }
  ];
  const boxPresetOptions = [1, 2, 5, 10];

  const handleOpenModal = (product, initialMode = null) => {
    setSelectedProduct(product);
    setModalMode(initialMode || orderMode);
    setSelectedWeight(1);
    setSelectedCut('Whole'); // Always default to Whole!
    setBoxCount(1);
  };

  const handleAddRetailToCart = (product, isFromModal = false) => {
    const cut = isFromModal ? selectedCut : 'Whole'; // DEFAULT TO WHOLE!
    const weight = isFromModal ? selectedWeight : 1;
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

  const handleAddBoxToCart = (product, boxes = 1) => {
    const boxPackingKg = product.boxPackingKg || 60;
    const boxRate = product.boxRate || (product.price * boxPackingKg);
    const totalKg = boxes * boxPackingKg;

    const finalProduct = {
      ...product,
      title: `${product.title} (Wholesale Box — ${boxPackingKg}kg)`,
      price: boxRate,
      imgUrl: product.imgUrl,
      isBox: true,
      cutType: 'Wholesale Box',
      boxPackingKg: boxPackingKg,
      boxCount: boxes,
      totalKg: totalKg,
      netWeightKg: totalKg
    };

    addToCart(finalProduct, boxes);
    if (selectedProduct) setSelectedProduct(null);
  };

  return (
    <section className="products-section" id="products">
      <div className="products-container">

        {/* Enterprise Delivery Banner */}
        <div style={{
          background: 'rgba(3, 24, 44, 0.8)',
          border: '1px solid rgba(61, 192, 204, 0.35)',
          borderRadius: '16px',
          padding: '0.9rem 1.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(61, 192, 204, 0.15)',
            border: '1px solid rgba(61, 192, 204, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3DC0CC" strokeWidth="2.2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '0.75rem', color: '#3DC0CC', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Direct From Kadapa City Depot (KDP)
            </span>
            <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.02rem' }}>
              Delivering to Chemmumiahpet, Ravindra Nagar & Nearby (516004)
            </div>
          </div>
        </div>

        <h2 className="section-heading" style={{ marginBottom: '1rem' }}>Fresh Daily Catch</h2>
        <p style={{ color: '#94A3B8', fontSize: '1.05rem', maxWidth: '650px', margin: '0 auto 2rem' }}>
          Live stock synchronized directly from YNR Fishes wholesale and retail counters.
        </p>

        {/* ORDER MODE TOGGLE: Individual (Kg/Whole) vs Bulk (Wholesale Boxes) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(2, 18, 34, 0.95)',
            padding: '5px',
            borderRadius: '16px',
            border: '1.5px solid rgba(61, 192, 204, 0.35)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)'
          }}>
            <button
              onClick={() => setOrderMode('retail')}
              style={{
                padding: '0.65rem 1.6rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.92rem',
                background: orderMode === 'retail' ? 'linear-gradient(135deg, #3DC0CC, #0E5672)' : 'transparent',
                color: orderMode === 'retail' ? '#ffffff' : '#8AA4B8',
                border: orderMode === 'retail' ? '1px solid rgba(114, 222, 229, 0.5)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.25s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: orderMode === 'retail' ? '0 4px 14px rgba(61, 192, 204, 0.35)' : 'none'
              }}
            >
              <span>🐟</span> Individual (Kg / Whole)
            </button>
            <button
              onClick={() => setOrderMode('bulk')}
              style={{
                padding: '0.65rem 1.6rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.92rem',
                background: orderMode === 'bulk' ? 'linear-gradient(135deg, #F5C144, #F97316)' : 'transparent',
                color: orderMode === 'bulk' ? '#010A14' : '#8AA4B8',
                border: orderMode === 'bulk' ? '1px solid #F5C144' : 'none',
                cursor: 'pointer',
                transition: 'all 0.25s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: orderMode === 'bulk' ? '0 4px 14px rgba(245, 193, 68, 0.4)' : 'none'
              }}
            >
              <span>📦</span> Bulk (Wholesale Boxes)
            </button>
          </div>
        </div>

        {/* Modern Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? 'linear-gradient(135deg, #3DC0CC, #0E5672)' : 'rgba(3, 24, 44, 0.75)',
                color: activeTab === tab ? '#ffffff' : '#8AA4B8',
                border: `1px solid ${activeTab === tab ? '#72DEE5' : 'rgba(61, 192, 204, 0.25)'}`,
                padding: '0.65rem 1.75rem',
                borderRadius: '999px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: activeTab === tab ? '0 4px 16px rgba(61, 192, 204, 0.4)' : 'none'
              }}
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
            {filteredProducts.map((product, index) => (
              <div
                key={`${product._id}-${index}`}
                className="product-card"
              >
                <div className="product-card-inner">
                  <div
                    className="product-img-wrapper"
                    onClick={() => handleOpenModal(product, orderMode)}
                  >
                    {orderMode === 'bulk' ? (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        zIndex: 2,
                        background: 'linear-gradient(135deg, #F5C144, #F97316)',
                        color: '#010A14',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>📦</span> WHOLESALE BOX
                      </div>
                    ) : (
                      product.badge && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          zIndex: 2,
                          background: 'linear-gradient(135deg, #F5C144, #F97316)',
                          color: '#010A14',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          textTransform: 'uppercase',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                        }}>
                          {product.badge}
                        </div>
                      )
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

                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(1, 10, 20, 0.9), transparent)',
                      padding: '1.25rem 0.85rem 0.45rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end'
                    }}>
                      <span style={{ color: '#D1E4ED', fontSize: '0.8rem', fontWeight: 600 }}>
                        {orderMode === 'bulk' 
                          ? `1 Box = ${product.boxPackingKg}kg Crate`
                          : `Rate per ${product.sellingUnit || 'Kg'}`}
                      </span>
                      {product.stock > 0 && (
                        <span style={{ color: '#4ADE80', fontSize: '0.75rem', fontWeight: 700 }}>
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="product-title" style={{ cursor: 'pointer' }} onClick={() => handleOpenModal(product, orderMode)}>{product.title}</h3>
                    {product.scientificName && (
                      <div className="product-scientific">{product.scientificName}</div>
                    )}
                    <p className="product-description">{product.description}</p>
                  </div>

                  {/* PRICE & ACTION AREA */}
                  <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(61, 192, 204, 0.2)' }}>
                    {orderMode === 'bulk' ? (
                      /* BULK WHOLESALE BOX VIEW */
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                          <div className="product-price-box">
                            <span className="product-price-val">₹{product.boxRate}</span>
                            <span className="product-price-unit">/Box ({product.boxPackingKg}kg)</span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#F5C144', fontWeight: 700 }}>
                            ~₹{Math.round(product.boxRate / product.boxPackingKg)}/kg
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => handleAddBoxToCart(product, 1)}
                            style={{
                              background: 'linear-gradient(135deg, #F5C144, #F97316)',
                              color: '#010A14',
                              border: 'none',
                              padding: '0.55rem 1.25rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              boxShadow: '0 4px 12px rgba(245, 193, 68, 0.35)',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
                          >
                            <span>📦</span> + Add 1 Box
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* RETAIL INDIVIDUAL KG / WHOLE VIEW */
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                          <div className="product-price-box">
                            <span className="product-price-val">₹{product.price}</span>
                            <span className="product-price-unit">/{product.sellingUnit || 'kg'} (Whole)</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#8AA4B8', background: 'rgba(3,24,44,0.7)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(61,192,204,0.2)' }}>
                            📦 Box: ₹{product.boxRate} ({product.boxPackingKg}kg)
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => handleAddRetailToCart(product, false)}
                            style={{
                              background: 'linear-gradient(135deg, #3DC0CC, #0E5672)',
                              color: '#ffffff',
                              border: '1px solid rgba(114, 222, 229, 0.4)',
                              padding: '0.55rem 1.25rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              boxShadow: '0 4px 12px rgba(19, 119, 143, 0.35)',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
                          >
                            <span>+</span> Add Whole
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Details & Cut / Box Selection Portal Modal */}
      {selectedProduct && createPortal(
        <div
          className="product-modal-overlay"
          onClick={() => setSelectedProduct(null)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(1, 10, 20, 0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '90px 1.25rem 2rem'
          }}
        >
          <div
            className="product-modal"
            onClick={e => e.stopPropagation()}
            style={{
              background: '#03182C',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: 'calc(100vh - 120px)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(61, 192, 204, 0.25)',
              border: '1.5px solid rgba(61, 192, 204, 0.45)',
              color: '#ffffff'
            }}
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

            {/* Modal Image Header (Compact 140px) */}
            <div style={{ height: '140px', minHeight: '140px', position: 'relative', background: '#010A14', overflow: 'hidden' }}>
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
                padding: '1.1rem 1.5rem',
                overflowY: 'auto',
                flex: 1,
                textAlign: 'left'
              }}
            >
              {/* Modal Mode Selector: Retail vs Wholesale Box */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setModalMode('retail')}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: modalMode === 'retail' ? 'rgba(61, 192, 204, 0.3)' : 'rgba(3, 24, 44, 0.8)',
                    color: modalMode === 'retail' ? '#3DC0CC' : '#8AA4B8',
                    border: `1.5px solid ${modalMode === 'retail' ? '#3DC0CC' : 'rgba(255, 255, 255, 0.1)'}`,
                    cursor: 'pointer'
                  }}
                >
                  🐟 Retail (Kg / Whole)
                </button>
                <button
                  onClick={() => setModalMode('bulk')}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    background: modalMode === 'bulk' ? 'rgba(245, 193, 68, 0.25)' : 'rgba(3, 24, 44, 0.8)',
                    color: modalMode === 'bulk' ? '#F5C144' : '#8AA4B8',
                    border: `1.5px solid ${modalMode === 'bulk' ? '#F5C144' : 'rgba(255, 255, 255, 0.1)'}`,
                    cursor: 'pointer'
                  }}
                >
                  📦 Wholesale Box ({selectedProduct.boxPackingKg}kg)
                </button>
              </div>

              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.2rem 0' }}>
                {selectedProduct.title}
              </h3>
              {selectedProduct.scientificName && (
                <div style={{ color: '#3DC0CC', fontStyle: 'italic', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                  {selectedProduct.scientificName}
                </div>
              )}

              {modalMode === 'bulk' ? (
                /* WHOLESALE BULK BOX SELECTION (From New Order Page!) */
                <div>
                  <div style={{ color: '#F5C144', fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.85rem', textShadow: '0 0 12px rgba(245, 193, 68, 0.35)' }}>
                    ₹{selectedProduct.boxRate * boxCount}{' '}
                    <span style={{ fontSize: '0.88rem', color: '#8AA4B8', fontWeight: 600 }}>
                      for {boxCount} {boxCount === 1 ? 'Box' : 'Boxes'} ({boxCount * selectedProduct.boxPackingKg} kg)
                    </span>
                  </div>

                  {/* Box Rate Details Card */}
                  <div style={{
                    background: 'rgba(1, 15, 30, 0.85)',
                    border: '1px solid rgba(245, 193, 68, 0.35)',
                    borderRadius: '12px',
                    padding: '0.75rem 1.1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '0.85rem' }}>
                      <span>Standard Mandi Crate:</span>
                      <span style={{ color: '#ffffff', fontWeight: 700 }}>1 Box = {selectedProduct.boxPackingKg} Kg</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F5C144', fontSize: '0.9rem', fontWeight: 800 }}>
                      <span>Wholesale Box Rate:</span>
                      <span>₹{selectedProduct.boxRate} / Box</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#3DC0CC', fontSize: '0.82rem', fontWeight: 600 }}>
                      <span>Effective Per Kg Rate:</span>
                      <span>~₹{Math.round(selectedProduct.boxRate / selectedProduct.boxPackingKg)} / Kg</span>
                    </div>
                  </div>

                  {/* Box Quantity Stepper */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Select Box Quantity:
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <button
                        onClick={() => setBoxCount(Math.max(1, boxCount - 1))}
                        style={{
                          background: 'rgba(3, 24, 44, 0.9)',
                          border: '1px solid rgba(245, 193, 68, 0.4)',
                          color: '#fff',
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >-</button>
                      <div style={{
                        flex: 1,
                        background: 'rgba(1, 15, 30, 0.9)',
                        border: '1px solid rgba(245, 193, 68, 0.4)',
                        color: '#F5C144',
                        height: '36px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem'
                      }}>
                        {boxCount} {boxCount === 1 ? 'Box' : 'Boxes'}
                      </div>
                      <button
                        onClick={() => setBoxCount(boxCount + 1)}
                        style={{
                          background: 'rgba(3, 24, 44, 0.9)',
                          border: '1px solid rgba(245, 193, 68, 0.4)',
                          color: '#fff',
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >+</button>
                    </div>

                    {/* Quick Box Preset Pills */}
                    <div style={{ display: 'flex', gap: '0.45rem' }}>
                      {boxPresetOptions.map(b => (
                        <button
                          key={b}
                          onClick={() => setBoxCount(b)}
                          style={{
                            flex: 1,
                            background: boxCount === b ? 'rgba(245, 193, 68, 0.3)' : 'rgba(3, 24, 44, 0.8)',
                            color: boxCount === b ? '#F5C144' : '#8AA4B8',
                            border: `1px solid ${boxCount === b ? '#F5C144' : 'rgba(255, 255, 255, 0.12)'}`,
                            padding: '0.45rem 0',
                            borderRadius: '9px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          {b} {b === 1 ? 'Box' : 'Boxes'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* RETAIL SELECTION (DEFAULT TO WHOLE!) */
                <div>
                  <div style={{ color: '#F5C144', fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.85rem', textShadow: '0 0 12px rgba(245, 193, 68, 0.35)' }}>
                    ₹{selectedProduct.price * selectedWeight}{' '}
                    <span style={{ fontSize: '0.88rem', color: '#8AA4B8', fontWeight: 600 }}>
                      for {selectedWeight >= 1 ? `${selectedWeight} kg` : `${selectedWeight * 1000} g`}
                    </span>
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
                        marginBottom: '1rem',
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

                  <p style={{ color: '#D1E4ED', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1rem' }}>
                    {selectedProduct.description}
                  </p>

                  {/* Select Cut Type (DEFAULT TO WHOLE!) */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Select Butchering Cut (Default: Whole):
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
                            padding: '0.42rem 0.95rem',
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

                  {/* Select Quantity */}
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
                            background: selectedWeight === wt.value ? 'rgba(245, 193, 68, 0.2)' : 'rgba(3, 24, 44, 0.8)',
                            color: selectedWeight === wt.value ? '#F5C144' : '#8AA4B8',
                            border: `1.5px solid ${selectedWeight === wt.value ? '#F5C144' : 'rgba(255, 255, 255, 0.12)'}`,
                            padding: '0.42rem 0.95rem',
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
              )}
            </div>

            {/* Sticky Modal Footer for Add to Cart */}
            <div style={{
              padding: '0.85rem 1.5rem',
              background: 'rgba(2, 18, 34, 0.98)',
              borderTop: '1px solid rgba(61, 192, 204, 0.25)',
              display: 'flex',
              alignItems: 'center'
            }}>
              {modalMode === 'bulk' ? (
                <button
                  onClick={() => handleAddBoxToCart(selectedProduct, boxCount)}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    background: 'linear-gradient(135deg, #F5C144, #F97316)',
                    color: '#010A14',
                    fontSize: '1rem',
                    fontWeight: 800,
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(245, 193, 68, 0.45)',
                    transition: 'filter 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  <span>📦</span> Add {boxCount} {boxCount === 1 ? 'Wholesale Box' : 'Boxes'} — ₹{selectedProduct.boxRate * boxCount}
                </button>
              ) : (
                <button
                  onClick={() => handleAddRetailToCart(selectedProduct, true)}
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
                    transition: 'filter 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                  Add to Cart — ₹{selectedProduct.price * selectedWeight} ({selectedCut})
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
