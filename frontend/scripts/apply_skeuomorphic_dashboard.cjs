const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/components/admin/analytics/Dashboard.jsx');
let code = fs.readFileSync(targetPath, 'utf8');

// Match from main component return (<div style={{ minHeight: '100%' ... down to {/* Modals */}
const regex = /\n  return \(\s*<div style=\{\{\s*minHeight:\s*'100%'[\s\S]*?\{\/\* Modals \*\//;

if (!regex.test(code)) {
  console.error('Could not match return minHeight down to Modals in Dashboard.jsx');
  process.exit(1);
}

const replacement = `
  return (
    <div className="skeuo-deck-canvas">
      
      {/* Deck Header: Breadcrumb & Vintage Metallic Filter Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        marginBottom: '20px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(163, 153, 139, 0.4)'
      }}>
        {/* Left: Embossed Icon + Title & Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(180deg, #ea580c 0%, #c2410c 100%)',
            border: '1px solid #9a3412',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6), 0 3px 6px rgba(0,0,0,0.2)'
          }}>
            <LayoutDashboard size={20} strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.45rem',
              fontWeight: 900,
              color: '#1e293b',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textShadow: '0 1px 0 rgba(255,255,255,0.8)'
            }}>
              <span>{t("Dashboard")}</span>
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>/</span>
            </h1>
            <p style={{
              margin: '2px 0 0 0',
              fontSize: '0.82rem',
              color: '#64748b',
              fontWeight: 600
            }}>
              Monitor your fish business operations at a glance
            </p>
          </div>
        </div>

        {/* Right: Date Filter Pill & Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="skeuo-btn-metal"
            >
              <Calendar size={14} style={{ color: '#64748b' }} />
              <span>{t(dateFilter)}</span>
              <ChevronDown size={14} style={{ color: '#94a3b8' }} />
            </button>

            {isFilterDropdownOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                marginTop: '6px',
                width: '150px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                zIndex: 50,
                padding: '4px 0',
                overflow: 'hidden'
              }}>
                {['Today', 'Last 7 Days', '1 Month', '3 Months', '6 Months', '1 Year', 'Custom'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => {
                      if (filter === 'Custom') {
                        setShowCustomDateModal(true);
                        setIsFilterDropdownOpen(false);
                      } else {
                        setDateFilter(filter);
                        setIsFilterDropdownOpen(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 14px',
                      fontSize: '0.8rem',
                      fontWeight: dateFilter === filter ? 700 : 500,
                      background: dateFilter === filter ? '#fff7ed' : 'transparent',
                      color: dateFilter === filter ? '#ea580c' : '#334155',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {t(filter)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="skeuo-btn-metal" style={{ cursor: 'default' }}>
            <Clock size={14} />
            <span>{currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards Row: Tactile Skeuomorphic Hardware Enclosures */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px',
        marginBottom: '22px'
      }}>
        {/* CARD 1: Total Fish Sales (Brushed Aluminum + Mechanical Analog Odometer) */}
        <div className="skeuo-panel-aluminum">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#ea580c',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}>
                Fish
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1e293b' }}>
                {t("Total Fish Sales")}
              </span>
            </div>
            <span style={{
              background: '#334155',
              color: '#f8fafc',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              {t(dateFilter)}
            </span>
          </div>

          {/* Mechanical Odometer Cylinder Wheel Readout */}
          <div style={{ marginTop: '12px', position: 'relative', zIndex: 2 }}>
            <div className="skeuo-odometer-box" title="Analog Mechanical Tally Counter">
              <span style={{ color: '#94a3b8', fontWeight: 900, fontSize: '16px', marginRight: '2px' }}>₹</span>
              {String(Math.round(stats.sales || 0)).padStart(4, '0').split('').map((digit, i) => (
                <span key={i} className="skeuo-odometer-wheel">{digit}</span>
              ))}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '6px', fontWeight: 700 }}>
              {stats.orders || 0} Total Invoices
            </div>
          </div>

          {/* 3D Fish Graphic */}
          <img
            src="/assets/cards/isolated_card1_fish.png"
            alt="Fish"
            style={{
              position: 'absolute',
              right: '6px',
              bottom: '8px',
              width: '92px',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
              pointerEvents: 'none'
            }}
          />
        </div>

        {/* CARD 2: Retail Orders (Kg) (Industrial Green Enamel + Balance Scale) */}
        <div className="skeuo-panel-green-enamel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#064e3b',
                color: '#86efac',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid #10b981'
              }}>
                ⚖️
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                {t("Retail Orders (Kg)")}
              </span>
            </div>
            <span style={{
              background: '#064e3b',
              color: '#86efac',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              Retail
            </span>
          </div>

          <div style={{ marginTop: '12px', position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.4)', lineHeight: 1 }}>
              {stats.recentBills?.filter(b => !b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round((stats.orders || 0) * 0.7)}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#dcfce7', marginTop: '6px', fontWeight: 600, maxWidth: '140px', lineHeight: 1.25 }}>
              Individual fish cuts & weighed orders
            </div>
          </div>

          {/* Mechanical Scale Graphic */}
          <img
            src="/assets/cards/isolated_card2_scale.png"
            alt="Scale"
            style={{
              position: 'absolute',
              right: '6px',
              bottom: '8px',
              width: '86px',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
              pointerEvents: 'none'
            }}
          />
        </div>

        {/* CARD 3: Bulk Orders (Boxes) (Warm Bronze/Leather + Wooden Crates) */}
        <div className="skeuo-panel-bronze">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#382317',
                color: '#fde68a',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px'
              }}>
                Bulk
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                {t("Bulk Orders (Boxes)")}
              </span>
            </div>
            <span style={{
              background: '#382317',
              color: '#fde68a',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              Wholesale
            </span>
          </div>

          <div style={{ marginTop: '12px', position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.4)', lineHeight: 1 }}>
              {stats.recentBills?.filter(b => b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round((stats.orders || 0) * 0.3)}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#fef3c7', marginTop: '6px', fontWeight: 600, maxWidth: '140px', lineHeight: 1.25 }}>
              Wholesale box batches sold
            </div>
          </div>

          {/* Wooden Crates Graphic */}
          <img
            src="/assets/cards/isolated_card3_boxes.png"
            alt="Boxes"
            style={{
              position: 'absolute',
              right: '6px',
              bottom: '8px',
              width: '88px',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
              pointerEvents: 'none'
            }}
          />
        </div>

        {/* CARD 4: Estimated Gross Profit (Royal Purple + Recessed LED + Gold Coins) */}
        <div className="skeuo-panel-purple">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#3b0764',
                color: '#f3e8ff',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px'
              }}>
                📊
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                {t("Estimated Gross Profit")}
              </span>
            </div>
            <span style={{
              background: '#3b0764',
              color: '#f3e8ff',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              Margin
            </span>
          </div>

          <div style={{ marginTop: '12px', position: 'relative', zIndex: 2 }}>
            <div className="skeuo-purple-led" title="Digital Electronic Margin Readout">
              {formatCurrency(Math.round((stats.sales || 0) * 0.28))}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#f3e8ff', marginTop: '6px', fontWeight: 600 }}>
              Avg ~28% Fish Margin
            </div>
          </div>

          {/* Gold Coins Stack Graphic */}
          <img
            src="/assets/cards/isolated_card4_coins.png"
            alt="Coins"
            style={{
              position: 'absolute',
              right: '8px',
              bottom: '8px',
              width: '72px',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>

      {/* Middle Row: Two Heavy Machined Metal Chassis Consoles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* CONSOLE 1: Top Selling Items (Brushed Steel Chassis with Hex Screws & Weathered Note) */}
        <div className="skeuo-chassis-console" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
          <span className="skeuo-screw" style={{ position: 'absolute', top: '10px', left: '10px' }} />
          <span className="skeuo-screw" style={{ position: 'absolute', top: '10px', right: '10px' }} />
          <span className="skeuo-screw flat" style={{ position: 'absolute', bottom: '10px', left: '10px' }} />
          <span className="skeuo-screw vertical" style={{ position: 'absolute', bottom: '10px', right: '10px' }} />

          {/* Weathered Parchment Header Ribbon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', padding: '0 8px' }}>
            <div className="skeuo-parchment-banner">
              <Crown size={16} style={{ color: '#b45309' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 900, color: '#451a03' }}>
                  {t("Top Selling Items")}
                </h3>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#78350f', fontWeight: 600 }}>
                  Most sold fish items based on today's orders
                </p>
              </div>
            </div>
            <span style={{
              background: '#334155',
              color: '#f8fafc',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              {t(dateFilter)}
            </span>
          </div>

          {/* Sunken Cavity Body */}
          <div className="skeuo-sunken-cavity" style={{ flex: 1 }}>
            {stats.topItems && stats.topItems.length > 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                overflowX: 'auto',
                width: '100%',
                paddingBottom: '8px'
              }}>
                {stats.topItems.slice(0, 5).map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '100px',
                    padding: '10px',
                    borderRadius: '10px',
                    background: '#fcfaf6',
                    border: '1px solid #c7bca9'
                  }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      border: '2px solid #fdba74',
                      padding: '2px',
                      marginBottom: '6px',
                      background: '#fff7ed',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item._id} 
                          onError={(e) => { e.target.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        />
                      ) : (
                        <span style={{ fontSize: '18px' }}>🐟</span>
                      )}
                    </div>
                    <p style={{ fontWeight: 800, fontSize: '0.78rem', color: '#1e293b', margin: '0 0 2px 0', textAlign: 'center' }}>
                      {t(item._id)}
                    </p>
                    <p style={{ color: '#ea580c', fontWeight: 900, fontSize: '0.8rem', margin: '0 0 2px 0' }}>
                      {formatCurrency(item.revenue)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                      {item.quantity} {t("Sold")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              /* Clean 3D Box empty state with weathered paper tape */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src="/assets/cards/clean_empty_box.png"
                  alt="Empty Fish Shipping Box"
                  style={{
                    width: '92px',
                    height: 'auto',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.22))'
                  }}
                />
                <div className="skeuo-weathered-note">
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '0.88rem', fontWeight: 800, color: '#451a03' }}>
                    {t("No items sold today")}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#78350f', fontWeight: 600 }}>
                    Top selling fish items will appear here once there are sales.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CONSOLE 2: Sales Overview (CRT Radar / Oscilloscope Screen) */}
        <div className="skeuo-chassis-console" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
          <span className="skeuo-screw" style={{ position: 'absolute', top: '10px', left: '10px' }} />
          <span className="skeuo-screw" style={{ position: 'absolute', top: '10px', right: '10px' }} />
          <span className="skeuo-screw flat" style={{ position: 'absolute', bottom: '10px', left: '10px' }} />
          <span className="skeuo-screw vertical" style={{ position: 'absolute', bottom: '10px', right: '10px' }} />

          {/* Console Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                <BarChart2 size={16} strokeWidth={2.4} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 900, color: '#0f172a' }}>
                  {t("Sales Overview")}
                </h3>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                  Orders and sales throughout the day
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                <span>Orders</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#ea580c' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fb923c', boxShadow: '0 0 6px #fb923c' }} />
                <span>Sales (₹)</span>
              </div>
              <span style={{
                background: '#334155',
                color: '#f8fafc',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px'
              }}>
                {t(dateFilter)}
              </span>
            </div>
          </div>

          {/* CRT Oscilloscope Screen */}
          <div className="skeuo-crt-screen" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Glowing HUD Tooltip */}
            <div style={{ position: 'absolute', top: '16px', right: '40%', zIndex: 10 }}>
              <div className="skeuo-crt-hud">
                <div style={{ color: '#94a3b8', fontSize: '9.5px', marginBottom: '2px' }}>09:00 am</div>
                <div style={{ color: '#fb923c', fontWeight: 800, fontSize: '11px' }}>Sales (₹): 0</div>
                <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '11px' }}>Orders: 0</div>
              </div>
            </div>

            {/* Glowing Trace Radar Plots */}
            <div style={{ flex: 1, width: '100%', minHeight: '190px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesOverviewData} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(14, 165, 233, 0.16)" vertical={true} />
                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#fb923c"
                    strokeWidth={2.5}
                    dot={{ fill: '#fb923c', r: 4, stroke: '#ea580c', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ fill: '#38bdf8', r: 4, stroke: '#0284c7', strokeWidth: 1 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */`;

code = code.replace(regex, replacement);
fs.writeFileSync(targetPath, code, 'utf8');
console.log('Dashboard.jsx safely replaced with Skeuomorphic Industrial Terminal!');
