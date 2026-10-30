import React from 'react';
import { useCart } from '../../context/CartContext';

export default function CartDrawer() {
  const { cartItems, updateQuantity, removeFromCart, cartTotal, isCartOpen, setIsCartOpen } = useCart();

  if (!isCartOpen) return null;

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    
    let message = "Hello YNR Fishes! I would like to place an order:%0A%0A";
    
    cartItems.forEach((item, index) => {
      if (item.isBox) {
        const totalKg = item.quantity * (item.boxPackingKg || 60);
        message += `${index + 1}. *${item.title}* - ${item.quantity} Box(es) (~${totalKg} kg) @ ₹${item.price}/Box = ₹${(item.quantity * item.price).toFixed(2)}%0A`;
      } else {
        const netWeight = item.quantity >= 1 ? `${item.quantity} kg` : `${item.quantity * 1000} g`;
        const cut = item.cutType || 'Whole';
        message += `${index + 1}. *${item.title}* - Net Weight: ${netWeight} (${cut}) @ ₹${item.price}/kg = ₹${(item.quantity * item.price).toFixed(2)}%0A`;
      }
    });
    
    message += `%0A*Total Estimated Value: ₹${cartTotal.toFixed(2)}*%0A%0APlease confirm availability from Kadapa Depot and share delivery / payment details.`;
    
    window.open(`https://wa.me/919849313889?text=${message}`, '_blank');
  };

  return (
    <>
      <div 
        style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 99998
        }}
        onClick={() => setIsCartOpen(false)}
      />
      
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '420px', height: '100%',
        backgroundColor: '#03182C', borderLeft: '1px solid rgba(61, 192, 204, 0.35)',
        zIndex: 99999, display: 'flex', flexDirection: 'column',
        boxShadow: '-10px 0 35px rgba(0,0,0,0.8)',
        animation: 'slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(61, 192, 204, 0.25)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(1, 15, 30, 0.9)'
        }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', margin: 0, fontWeight: 800 }}>Your Seafood Cart</h2>
            <span style={{ fontSize: '0.78rem', color: '#3DC0CC', fontWeight: 600 }}>Kadapa Depot Direct Counter</span>
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            style={{
              background: 'none', border: 'none', color: '#8AA4B8', fontSize: '1.8rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#8AA4B8'}
          >&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {cartItems.length === 0 ? (
            <div style={{ color: '#8AA4B8', textAlign: 'center', marginTop: '3rem', padding: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐟</div>
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Your cart is empty.</p>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>Add fresh catch in individual Kg or Wholesale Boxes!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {cartItems.map((item) => (
                <div key={item.title} style={{
                  display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  paddingBottom: '1.1rem', alignItems: 'flex-start'
                }}>
                  <img 
                    src={item.imgUrl} 
                    alt={item.title} 
                    style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '10px', background: '#010A14' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/valuga.png'; }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: '#ffffff', margin: '0 0 0.25rem 0', fontSize: '0.98rem', fontWeight: 700 }}>
                      {item.title}
                    </h4>

                    {item.isBox ? (
                      <div style={{ color: '#F5C144', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        📦 ₹{item.price} / Box ({item.boxPackingKg || 60}kg)
                      </div>
                    ) : (
                      <div style={{ color: '#3DC0CC', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        ₹{item.price} / kg &bull; <span style={{ color: '#8AA4B8', fontWeight: 600 }}>{item.cutType || 'Whole'}</span>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => updateQuantity(item.title, item.isBox ? Math.max(0, item.quantity - 1) : Math.max(0, item.quantity - 0.5))}
                        style={{
                          background: 'rgba(3, 24, 44, 0.8)', border: '1px solid rgba(61, 192, 204, 0.4)',
                          color: '#fff', width: '26px', height: '26px', borderRadius: '6px',
                          cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >-</button>
                      <span style={{ color: '#ffffff', minWidth: '55px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 800 }}>
                        {item.isBox 
                          ? `${item.quantity} ${item.quantity === 1 ? 'Box' : 'Boxes'}`
                          : (item.quantity >= 1 ? `${item.quantity} kg` : `${item.quantity * 1000} g`)}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.title, item.isBox ? item.quantity + 1 : item.quantity + 0.5)}
                        style={{
                          background: 'rgba(3, 24, 44, 0.8)', border: '1px solid rgba(61, 192, 204, 0.4)',
                          color: '#fff', width: '26px', height: '26px', borderRadius: '6px',
                          cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >+</button>
                      
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ color: '#F5C144', fontWeight: 800, fontSize: '0.95rem' }}>
                          ₹{(item.quantity * item.price).toFixed(0)}
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.title)}
                          style={{
                            background: 'none', border: 'none', color: '#f87171',
                            cursor: 'pointer', fontSize: '0.75rem', padding: 0, marginTop: '2px'
                          }}
                        >Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(61, 192, 204, 0.25)',
          backgroundColor: 'rgba(1, 15, 30, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.25rem' }}>
            <span>Total Value:</span>
            <span style={{ color: '#F5C144' }}>₹{cartTotal.toFixed(0)}</span>
          </div>
          
          <button 
            onClick={handleCheckout}
            disabled={cartItems.length === 0}
            style={{
              width: '100%', padding: '0.95rem',
              background: cartItems.length === 0 ? '#334155' : 'linear-gradient(135deg, #25D366, #128C7E)',
              color: '#ffffff', fontSize: '1.05rem', fontWeight: 800, border: 'none', borderRadius: '12px',
              cursor: cartItems.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
              boxShadow: cartItems.length === 0 ? 'none' : '0 4px 16px rgba(37, 211, 102, 0.35)',
              transition: 'transform 0.2s'
            }}
          >
            <span>💬</span> Place Order on WhatsApp
          </button>
        </div>
      </div>
    </>
  );
}
