import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const FISH_CATALOG = [
  { id: 1, name: 'Silver Pomfret', rate: 850, telugu: 'చందువా', img: '/assets/silver_pomfret.png' },
  { id: 2, name: 'Tiger Prawns', rate: 720, telugu: 'రొయ్యలు', img: '/assets/tiger_prawn.png' },
  { id: 3, name: 'Katla (Live)', rate: 220, telugu: 'బొచ్చె', img: '/images/katla.jpg' },
  { id: 4, name: 'Rohu', rate: 200, telugu: 'రౌ', img: '/images/rohu.jpg' },
  { id: 5, name: 'Mud Crabs', rate: 680, telugu: 'పీతలు', img: '/images/crabs.jpg' },
  { id: 6, name: 'Korramenu', rate: 550, telugu: 'కొర్రమీను', img: '/images/korramane.jpg' },
];

export default function WorkerDashboard() {
  const { user, logout } = useAuth();
  const branchName = user?.branch?.name || 'Kadapa City Depot';
  const branchCode = user?.branch?.code || 'KDP';

  const [cart, setCart] = useState([]);
  const [selectedFish, setSelectedFish] = useState(FISH_CATALOG[0]);
  const [weightKg, setWeightKg] = useState('2.5');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [recentBills, setRecentBills] = useState([]);
  const [generatedSlip, setGeneratedSlip] = useState(null);

  const addItemToBill = () => {
    const weight = parseFloat(weightKg);
    if (!weight || weight <= 0) return;

    const total = Math.round(selectedFish.rate * weight);
    const item = {
      ...selectedFish,
      weight,
      total,
      uid: Date.now(),
    };
    setCart([...cart, item]);
  };

  const removeItem = (uid) => {
    setCart(cart.filter((c) => c.uid !== uid));
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.total, 0);

  const handlePrintBill = () => {
    if (cart.length === 0) return;

    const newBill = {
      id: `BILL-${branchCode}-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: customerName,
      items: [...cart],
      amount: grandTotal,
      mode: paymentMode,
      date: new Date().toLocaleString(),
    };

    setGeneratedSlip(newBill);
    setRecentBills([newBill, ...recentBills]);
    setCart([]);
  };

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <div className="dashboard-header-bar">
        <div className="dash-user-welcome">
          <div className="dash-avatar-badge" style={{ borderColor: '#FF8A48', color: '#FF8A48' }}>
            📦
          </div>
          <div className="dash-title-group">
            <h1>{user?.name || 'Billing Operator'}</h1>
            <p>
              Branch: <strong style={{ color: '#FF8A48' }}>{branchName} ({branchCode})</strong> • Role: <strong>WORKER</strong> • Rapid Point-Of-Sale (POS)
            </p>
          </div>
        </div>

        <div className="dash-quick-actions">
          <Link to="/" className="dash-pill-btn">
            🌐 Public Website
          </Link>
          <button onClick={logout} className="dash-pill-btn danger">
            Logout
          </button>
        </div>
      </div>

      {/* POS Two-Column Grid */}
      <div className="pos-terminal-grid">
        {/* Left: Quick Touch Fish Selector */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <h2 className="dash-section-title">
              <span>🐟 Quick Fish Selection</span>
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#f5c144' }}>Touch or Click Species</span>
          </div>

          <div className="pos-fish-grid">
            {FISH_CATALOG.map((fish) => (
              <div
                key={fish.id}
                className={`pos-fish-card ${selectedFish.id === fish.id ? 'selected' : ''}`}
                onClick={() => setSelectedFish(fish)}
              >
                <img src={fish.img} alt={fish.name} />
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>{fish.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#3dc0cc' }}>{fish.telugu}</div>
                <div style={{ fontWeight: 800, color: '#f5c144', marginTop: '4px' }}>₹ {fish.rate} / KG</div>
              </div>
            ))}
          </div>

          {/* Weighing Scale Input */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(1, 10, 20, 0.6)',
            borderRadius: '14px',
            border: '1px solid rgba(61, 192, 204, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                Weighing Scale Reading (KG)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                style={{
                  background: '#010A14',
                  border: '2px solid #4EE1A0',
                  borderRadius: '10px',
                  color: '#4EE1A0',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  padding: '8px 14px',
                  width: '130px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(230,247,255,0.6)' }}>Item Total</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                ₹ {Math.round((parseFloat(weightKg) || 0) * selectedFish.rate)}
              </div>
            </div>

            <button
              onClick={addItemToBill}
              style={{
                background: 'linear-gradient(135deg, #4EE1A0, #208E9A)',
                border: 'none',
                borderRadius: '12px',
                color: '#010A14',
                fontWeight: 800,
                padding: '14px 24px',
                cursor: 'pointer',
                fontSize: '0.92rem',
                boxShadow: '0 4px 15px rgba(78, 225, 160, 0.3)',
              }}
            >
              + ADD TO BILL
            </button>
          </div>
        </div>

        {/* Right: Active Bill & Receipt Summary */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <h2 className="dash-section-title">
              <span>🧾 Active Customer Bill</span>
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#FF8A48' }}>Counter Ticket</span>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name or Mobile"
              style={{
                width: '100%',
                background: 'rgba(1, 10, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '0.88rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Cart Items List */}
          <div style={{ minHeight: '160px', maxHeight: '240px', overflowY: 'auto', marginBottom: '16px' }}>
            {cart.length === 0 ? (
              <div style={{ color: 'rgba(230,247,255,0.4)', textAlign: 'center', padding: '40px 0', fontSize: '0.88rem' }}>
                No fish items added yet. Click items on the left to add to bill.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.uid} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '8px 0', color: '#fff' }}>{item.name}</td>
                      <td style={{ padding: '8px 0', color: '#3DC0CC' }}>{item.weight} kg</td>
                      <td style={{ padding: '8px 0', color: '#f5c144', fontWeight: 700 }}>₹ {item.total}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>
                        <button
                          onClick={() => removeItem(item.uid)}
                          style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Payment Mode */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['Cash', 'UPI', 'Credit'].map((mode) => (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: paymentMode === mode ? '1px solid #4EE1A0' : '1px solid rgba(255,255,255,0.1)',
                  background: paymentMode === mode ? 'rgba(78,225,160,0.15)' : 'rgba(1,10,20,0.5)',
                  color: paymentMode === mode ? '#4EE1A0' : 'rgba(230,247,255,0.7)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Grand Total Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            background: 'rgba(245, 193, 68, 0.1)',
            border: '1px solid rgba(245, 193, 68, 0.3)',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f5c144' }}>TOTAL AMOUNT:</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>₹ {grandTotal}</span>
          </div>

          <button
            onClick={handlePrintBill}
            disabled={cart.length === 0}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: cart.length > 0 ? 'linear-gradient(135deg, #F5C144, #E5A812)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#010A14',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
              boxShadow: cart.length > 0 ? '0 4px 18px rgba(245, 193, 68, 0.35)' : 'none',
            }}
          >
            🖨️ ISSUE BILL & PRINT RECEIPT
          </button>

          {/* Generated Slip Popup/Card */}
          {generatedSlip && (
            <div style={{
              marginTop: '16px',
              padding: '14px',
              background: '#ffffff',
              color: '#010a14',
              borderRadius: '10px',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
            }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                YNR FISHES • {branchName.toUpperCase()}
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#555' }}>
                GSTIN: 37AAECY9849Z1Z5 • {generatedSlip.id}
              </div>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px dashed #999' }} />
              <div>Customer: {generatedSlip.customer}</div>
              <div>Payment: {generatedSlip.mode} • Date: {generatedSlip.date}</div>
              <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                Total Paid: ₹ {generatedSlip.amount} (PAID)
              </div>
              <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.68rem', color: '#777' }}>
                Thank you! Fresh Coastal Quality Guaranteed.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
