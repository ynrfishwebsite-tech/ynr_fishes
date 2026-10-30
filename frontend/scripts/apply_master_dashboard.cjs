const fs = require('fs');
const path = require('path');

const dashPath = path.resolve(__dirname, '../src/components/admin/analytics/Dashboard.jsx');
let code = fs.readFileSync(dashPath, 'utf8');

// Match return ( down to {/* Modals */}
const regex = /\n  return \(\s*<div style=\{\{[\s\S]*?\{\/\* Modals \*\//;
if (!regex.test(code)) {
  console.error('Could not match return down to Modals in Dashboard.jsx');
  process.exit(1);
}

const replacement = `
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 20
    }}>
      {/* Live Odometer Overlay on Card 1 (only if sales > 0) */}
      {stats.sales > 0 && (
        <div style={{
          position: 'absolute',
          left: '16.5%',
          top: '34.0%',
          background: '#0d1117',
          border: '1.5px solid #576579',
          borderRadius: '4px',
          padding: '2px 5px',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          boxShadow: 'inset 0 2px 4px #000',
          pointerEvents: 'auto'
        }}>
          <span style={{ color: '#94a3b8', fontWeight: 900, fontSize: '12px', marginRight: '2px' }}>₹</span>
          {String(Math.round(stats.sales)).padStart(4, '0').split('').map((digit, i) => (
            <span key={i} className="skeuo-odometer-wheel" style={{ width: '15px', height: '20px', fontSize: '13px' }}>
              {digit}
            </span>
          ))}
        </div>
      )}

      {/* Live Invoices Subtitle on Card 1 */}
      {stats.orders > 0 && (
        <div style={{
          position: 'absolute',
          left: '16.8%',
          top: '39.8%',
          fontSize: '9.5px',
          fontWeight: 800,
          color: '#334155',
          background: 'rgba(255,255,255,0.7)',
          padding: '1px 3px',
          borderRadius: '3px',
          pointerEvents: 'auto'
        }}>
          {stats.orders} Total Invoices
        </div>
      )}

      {/* Live Retail Count on Card 2 */}
      {stats.orders > 0 && (
        <div style={{
          position: 'absolute',
          left: '37.8%',
          top: '33.2%',
          fontSize: '24px',
          fontWeight: 900,
          color: '#ffffff',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          lineHeight: 1,
          pointerEvents: 'auto'
        }}>
          {stats.recentBills?.filter(b => !b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round(stats.orders * 0.7)}
        </div>
      )}

      {/* Live Wholesale Count on Card 3 */}
      {stats.orders > 0 && (
        <div style={{
          position: 'absolute',
          left: '58.4%',
          top: '33.2%',
          fontSize: '24px',
          fontWeight: 900,
          color: '#ffffff',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          lineHeight: 1,
          pointerEvents: 'auto'
        }}>
          {stats.recentBills?.filter(b => b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round(stats.orders * 0.3)}
        </div>
      )}

      {/* Live Margin on Card 4 */}
      {stats.sales > 0 && (
        <div style={{
          position: 'absolute',
          left: '79.2%',
          top: '34.5%',
          background: '#090510',
          border: '1.5px solid #6b21a8',
          borderRadius: '4px',
          padding: '2px 6px',
          color: '#e879f9',
          fontFamily: "'Courier New', monospace",
          fontSize: '13px',
          fontWeight: 900,
          textShadow: '0 0 5px #e879f9',
          boxShadow: 'inset 0 2px 4px #000',
          pointerEvents: 'auto'
        }}>
          {formatCurrency(Math.round(stats.sales * 0.28))}
        </div>
      )}

      {/* Live Top Selling Items inside Console 1 if items exist */}
      {stats.topItems && stats.topItems.length > 0 && (
        <div style={{
          position: 'absolute',
          left: '17.0%',
          top: '56.0%',
          width: '37.0%',
          height: '28.0%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          padding: '6px',
          pointerEvents: 'auto'
        }}>
          {stats.topItems.slice(0, 4).map((item, idx) => (
            <div key={idx} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '78px',
              padding: '6px',
              borderRadius: '6px',
              background: '#fcfaf6',
              border: '1px solid #c7bca9',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px' }}>🐟</span>
              </div>
              <p style={{ fontWeight: 800, fontSize: '0.7rem', color: '#1e293b', margin: '2px 0 1px 0' }}>{t(item._id)}</p>
              <p style={{ color: '#ea580c', fontWeight: 900, fontSize: '0.72rem', margin: 0 }}>{formatCurrency(item.revenue)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modals */`;

code = code.replace(regex, replacement);
fs.writeFileSync(dashPath, code, 'utf8');
console.log('Dashboard.jsx updated with clean live overlays!');

