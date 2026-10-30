const fs = require('fs');
const path = require('path');

// 1. Update AdminDashboard.jsx
const adminPath = path.resolve(__dirname, '../src/pages/dashboards/AdminDashboard.jsx');
let adminCode = fs.readFileSync(adminPath, 'utf8');

const adminReturnRegex = /\s*return\s*\(\s*<div className="skeuo-terminal-shell"[\s\S]*$/;
if (!adminReturnRegex.test(adminCode)) {
  console.error('Could not find return statement in AdminDashboard.jsx');
  process.exit(1);
}

const newAdminReturn = `
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      background: '#1a0e07',
      padding: '8px 12px 10px 12px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Industrial Hardware Enclosure Frame */}
      <div style={{
        flex: 1,
        borderRadius: '16px',
        border: '3px solid #7c8899',
        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -3px 6px rgba(0,0,0,0.5), 0 12px 30px rgba(0,0,0,0.7)',
        background: '#ded9cf',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>

        {/* Top Header Bar: Brushed Stainless Steel Console */}
        <header style={{
          height: '62px',
          minHeight: '62px',
          background: 'linear-gradient(180deg, #f3f5f8 0%, #d5dde6 42%, #b0bece 48%, #93a5b9 52%, #c9d3df 75%, #f1f4f8 100%)',
          borderBottom: '2px solid #6b7a8d',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 3px rgba(0,0,0,0.25), 0 3px 10px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px 0 0',
          position: 'relative',
          zIndex: 30
        }}>
          {/* Top Edge Screws */}
          <span className="skeuo-screw flat" style={{ position: 'absolute', top: '6px', left: '160px' }} />
          <span className="skeuo-screw" style={{ position: 'absolute', top: '6px', left: '330px' }} />
          <span className="skeuo-screw flat" style={{ position: 'absolute', top: '6px', right: '380px' }} />
          <span className="skeuo-screw" style={{ position: 'absolute', top: '6px', right: '110px' }} />

          {/* Left: Stamped Medallion & Cargo Tag + Brand */}
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', position: 'relative' }}>
            {/* Medallion & Hanging Tag (Overlaps header & sidebar) */}
            <div 
              onClick={() => setCurrentView('dashboard')}
              title="YNR Fishes Marine Terminal"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                height: '62px',
                paddingLeft: '12px'
              }}
            >
              <img
                src="/assets/skeuo/brand_section.png"
                alt="YNR Fishes KDP"
                style={{ height: '58px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Center: Glowing Green Siren + Nixie/VFD Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Green Dome Siren */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src="/assets/skeuo/header_siren.png"
                alt="Online Node"
                style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
              />
            </div>

            {/* Recessed Amber Nixie Clock */}
            <div style={{
              background: '#0a0d13',
              border: '2px solid #576477',
              borderRadius: '7px',
              padding: '3px 14px',
              boxShadow: 'inset 0 3px 6px #000, inset 0 -1px 2px rgba(255,255,255,0.25), 0 2px 4px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}>
              <span style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: '18px',
                fontWeight: 900,
                letterSpacing: '2px',
                color: '#fbbf24',
                textShadow: '0 0 5px #fbbf24, 0 0 12px rgba(245, 158, 11, 0.8), 0 0 20px rgba(217, 119, 6, 0.6)'
              }}>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>
          </div>

          {/* Right: Tactile 3D Buttons & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* New Order: Glossy 3D Orange Button */}
            <div
              onClick={() => setCurrentView('billing')}
              style={{ cursor: 'pointer', transition: 'transform 0.1s ease', display: 'flex', alignItems: 'center' }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1.5px)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
              title="New Order"
            >
              <img
                src="/assets/skeuo/btn_new_order.png"
                alt="New Order"
                style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
              />
            </div>

            {/* WhatsApp: Glossy 3D Green Button */}
            <div
              onClick={() => setShowWhatsAppModal(true)}
              style={{ cursor: 'pointer', transition: 'transform 0.1s ease', display: 'flex', alignItems: 'center' }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1.5px)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
              title="WhatsApp"
            >
              <img
                src="/assets/skeuo/btn_whatsapp.png"
                alt="WhatsApp"
                style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
              />
            </div>

            {/* Alerts: Recessed Metallic Toggle Slider */}
            <div
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) markAllAsRead();
              }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }}
              title="Alerts"
            >
              <img
                src="/assets/skeuo/toggle_alerts.png"
                alt="Alerts"
                style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
              />

              {showNotifications && (
                <NotificationPanel
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAllAsRead={markAllAsRead}
                  onClearNotification={clearNotification}
                  onViewAll={() => setCurrentView('notifications')}
                  onNavigate={(viewId) => setCurrentView(viewId)}
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </div>

            {/* Sign Out: Brushed Metal Button */}
            <div
              onClick={() => setShowLogoutModal(true)}
              style={{ cursor: 'pointer', transition: 'transform 0.1s ease', display: 'flex', alignItems: 'center' }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
              title="Sign Out"
            >
              <img
                src="/assets/skeuo/btn_signout.png"
                alt="Sign Out"
                style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
          </div>
        </header>

        {/* Main Body Layout: Stitched Leather Sidebar + Instrument Deck */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          
          {/* Left Vertical Sidebar: Saddle-Stitched Dark Cognac Leather */}
          <aside style={{
            width: '144px',
            minWidth: '144px',
            background: '#2b170e',
            backgroundImage: 'radial-gradient(circle at 50% 25%, #3c2014 0%, #1f0e06 100%)',
            borderRight: '2px solid #140904',
            boxShadow: 'inset -2px 0 6px rgba(0,0,0,0.6)',
            padding: '12px 8px 10px 8px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflowY: 'auto'
          }}>
            {/* Saddle-stitch seam line on right edge */}
            <div style={{
              position: 'absolute',
              top: '6px',
              bottom: '6px',
              right: '4px',
              width: '1px',
              borderRight: '2px dashed #b88656',
              opacity: 0.7,
              pointerEvents: 'none'
            }} />

            {/* Nav Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {/* Dashboard: Exact Embossed Tan Leather Tab */}
              <div
                onClick={() => setCurrentView('dashboard')}
                style={{ cursor: 'pointer', marginBottom: '4px' }}
                title="Dashboard"
              >
                <img
                  src="/assets/skeuo/tab_dashboard.png"
                  alt="Dashboard"
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
                />
              </div>

              {/* Inactive Nav Items with Metallic Toggle Sliders */}
              {[
                { id: 'billing', label: 'New Order', icon: ShoppingCart, hasToggle: false },
                { id: 'active-orders', label: 'Active Orders', icon: Clock, hasToggle: true },
                { id: 'bill-history', label: 'Bill History', icon: FileText, hasToggle: false },
                { id: 'inventory', label: 'Stock', icon: Package, hasToggle: true },
                { id: 'menu', label: 'Fish Registry', icon: Fish, hasToggle: false },
                { id: 'day-book', label: 'Day Book', icon: BookOpen, hasToggle: true },
                { id: 'khata', label: 'Khata Book', icon: BookMarked, hasToggle: false },
                { id: 'expenses', label: 'Expenses', icon: IndianRupee, hasToggle: true },
                { id: 'analytics', label: 'Analytics', icon: BarChart3, hasToggle: true },
                { id: 'operations', label: 'Extra Operations', icon: Layers, hasToggle: false },
                { id: 'settings', label: 'Settings', icon: SettingsIcon, hasToggle: false }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '3px 4px',
                    background: currentView === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none',
                    color: '#d6c0a8',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#d6c0a8'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                    <item.icon size={12} style={{ color: '#c49f7e', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  </div>
                  {item.hasToggle && (
                    <img
                      src="/assets/skeuo/sidebar_toggle.png"
                      alt="Toggle"
                      style={{ height: '10px', width: 'auto', flexShrink: 0, opacity: 0.9 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Bottom Polaroid Photo with Masking Tape */}
            <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
              <img
                src="/assets/skeuo/sidebar_polaroid_tape.png"
                alt="Fresh Fish on Ice"
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '2px' }}
              />
            </div>
          </aside>

          {/* Right Main Content Deck Area */}
          <main
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              background: '#ece4d5',
              padding: currentView === 'billing' ? 0 : undefined
            }}
          >
            {currentView === 'dashboard' && <Dashboard user={user} onNavigate={setCurrentView} />}
            {currentView === 'billing' && (
              <BillingPage
                user={user}
                initialTable={selectedOrderTable}
                initialAction={selectedOrderAction}
                onNavigate={setCurrentView}
              />
            )}
            {currentView === 'active-orders' && (
              <ActiveOrders
                user={user}
                onNavigate={setCurrentView}
                onSelectOrder={(tableNo, action) => {
                  setSelectedOrderTable(tableNo);
                  setSelectedOrderAction(action);
                  setCurrentView('billing');
                }}
                onGoBack={() => setCurrentView('billing')}
              />
            )}
            {currentView === 'bill-history' && <BillHistory user={user} onNavigate={setCurrentView} />}
            {currentView === 'edited-bills' && <EditedBills user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('operations')} />}
            {currentView === 'inventory' && <FishInventoryManager user={user} onNavigate={setCurrentView} />}
            {currentView === 'menu' && <MenuManagement user={user} onNavigate={setCurrentView} />}
            {currentView === 'day-book' && <DayBook user={user} onNavigate={setCurrentView} />}
            {currentView === 'khata' && <KhataDashboard user={user} onNavigate={setCurrentView} />}
            {currentView === 'expenses' && <Expenses user={user} onNavigate={setCurrentView} />}
            {currentView === 'analytics' && <Analytics user={user} onNavigate={setCurrentView} />}
            {currentView === 'crm' && <CRM user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('operations')} />}
            {currentView === 'operations' && (
              <Operations
                userRole={user?.role}
                onNavigate={setCurrentView}
                onGoBack={() => setCurrentView('dashboard')}
                onOpenWhatsApp={() => setShowWhatsAppModal(true)}
              />
            )}
            {currentView === 'discount' && (
              <DiscountConfig
                onNavigate={setCurrentView}
                onGoBack={() => setCurrentView('operations')}
              />
            )}
            {currentView === 'security' && (
              <SecuritySettings
                onGoBack={() => setCurrentView('operations')}
              />
            )}
            {currentView === 'staff' && <AdminPanel onGoBack={() => setCurrentView('operations')} />}
            {currentView === 'printer' && <PrinterConfig user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('operations')} />}
            {currentView === 'settings' && <Settings user={user} onNavigate={setCurrentView} />}
            {currentView === 'notifications' && (
              <NotificationsPage
                userRole={user?.role || 'Admin'}
                onNavigate={setCurrentView}
                onGoBack={() => setCurrentView('dashboard')}
              />
            )}
          </main>
        </div>

        {/* Machined Bottom Bumper Bar */}
        <div style={{
          height: '16px',
          background: 'linear-gradient(180deg, #b8c4d2 0%, #7d8b9e 40%, #505c6d 70%, #909ea0 100%)',
          borderTop: '1px solid #445163',
          borderBottom: '2px solid #283340',
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7), 0 3px 8px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="skeuo-screw flat" style={{ width: '9px', height: '9px' }} />
            <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#1f2937', letterSpacing: '0.8px' }}>
              YNR MARINE HARDWARE TERMINAL • SERIAL #8942-KD
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#1f2937' }}>
              STABLE OPERATIONAL FIRMWARE
            </span>
            <span className="skeuo-screw vertical" style={{ width: '9px', height: '9px' }} />
          </div>
        </div>

      </div>

      {/* WhatsApp Modal Trigger */}
      {showWhatsAppModal && (
        <WhatsAppConnectModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {/* Custom Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '380px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#dc2626'
              }}
            >
              <LogOut size={28} />
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
              Confirm Sign Out
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to end your current session for <strong>{user?.name || user?.username}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: '#dc2626',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)'
                }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </div>
  );
}
`;

adminCode = adminCode.replace(adminReturnRegex, newAdminReturn);
fs.writeFileSync(adminPath, adminCode, 'utf8');
console.log('AdminDashboard.jsx successfully updated with exact Image 2 header & sidebar!');


// 2. Update Dashboard.jsx to render exact Image 2 panels
const dashPath = path.resolve(__dirname, '../src/components/admin/analytics/Dashboard.jsx');
let dashCode = fs.readFileSync(dashPath, 'utf8');

const dashReturnRegex = /\s*return\s*\(\s*<div className="skeuo-deck-canvas"[\s\S]*?\{\/\* Modals \*\//;
if (!dashReturnRegex.test(dashCode)) {
  console.error('Could not find return skeuo-deck-canvas in Dashboard.jsx');
  process.exit(1);
}

const newDashReturn = `
  return (
    <div style={{
      padding: '16px 20px',
      background: '#ece4d5',
      minHeight: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Deck Header: Breadcrumb & Vintage Recessed Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Left: Square Orange Icon + Title & Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(180deg, #ea580c 0%, #c2410c 100%)',
            border: '1px solid #9a3412',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.2)'
          }}>
            <LayoutDashboard size={18} strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 900,
              color: '#1e293b',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{t("Dashboard")}</span>
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>/</span>
            </h1>
            <p style={{
              margin: '2px 0 0 0',
              fontSize: '0.74rem',
              color: '#64748b',
              fontWeight: 600
            }}>
              Monitor your fish business operations at a glance
            </p>
          </div>
        </div>

        {/* Right: Date Filter Pill & Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '5px 12px',
                color: '#334155',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'inset 0 1px 0 #fff, 0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <Calendar size={13} style={{ color: '#64748b' }} />
              <span>{t(dateFilter)}</span>
              <ChevronDown size={13} style={{ color: '#94a3b8' }} />
            </button>

            {isFilterDropdownOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                marginTop: '4px',
                width: '140px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
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
                      padding: '6px 12px',
                      fontSize: '0.76rem',
                      fontWeight: dateFilter === filter ? 800 : 600,
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

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
            border: '1.5px solid #cbd5e1',
            borderRadius: '8px',
            padding: '5px 12px',
            color: '#334155',
            fontSize: '0.78rem',
            fontWeight: 700,
            boxShadow: 'inset 0 1px 0 #fff, 0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <Clock size={13} style={{ color: '#64748b' }} />
            <span>{currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>
        </div>
      </div>

      {/* Top 4 Metric Cards: Exact Plates from Image 2 with Live Overlays */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* CARD 1: Total Fish Sales */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '209 / 99',
          background: "url('/assets/skeuo/full_card1.png') center / 100% 100% no-repeat",
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.15))'
        }}>
          {stats.sales > 0 && (
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '38px',
              background: '#0d1117',
              border: '2px solid #576579',
              borderRadius: '4px',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              boxShadow: 'inset 0 2px 4px #000'
            }}>
              <span style={{ color: '#94a3b8', fontWeight: 900, fontSize: '13px', marginRight: '2px' }}>₹</span>
              {String(Math.round(stats.sales)).padStart(4, '0').split('').map((digit, i) => (
                <span key={i} className="skeuo-odometer-wheel" style={{ width: '16px', height: '22px', fontSize: '14px' }}>
                  {digit}
                </span>
              ))}
            </div>
          )}
          {stats.orders > 0 && (
            <div style={{
              position: 'absolute',
              left: '14px',
              bottom: '12px',
              fontSize: '10px',
              fontWeight: 800,
              color: '#334155',
              background: 'rgba(255,255,255,0.7)',
              padding: '1px 4px',
              borderRadius: '3px'
            }}>
              {stats.orders} Total Invoices
            </div>
          )}
        </div>

        {/* CARD 2: Retail Orders (Kg) */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '207 / 99',
          background: "url('/assets/skeuo/full_card2.png') center / 100% 100% no-repeat",
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.15))'
        }}>
          {stats.orders > 0 && (
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '38px',
              fontSize: '28px',
              fontWeight: 900,
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              lineHeight: 1
            }}>
              {stats.recentBills?.filter(b => !b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round(stats.orders * 0.7)}
            </div>
          )}
        </div>

        {/* CARD 3: Bulk Orders (Boxes) */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '207 / 99',
          background: "url('/assets/skeuo/full_card3.png') center / 100% 100% no-repeat",
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.15))'
        }}>
          {stats.orders > 0 && (
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '38px',
              fontSize: '28px',
              fontWeight: 900,
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              lineHeight: 1
            }}>
              {stats.recentBills?.filter(b => b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round(stats.orders * 0.3)}
            </div>
          )}
        </div>

        {/* CARD 4: Estimated Gross Profit */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '209 / 99',
          background: "url('/assets/skeuo/full_card4.png') center / 100% 100% no-repeat",
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.15))'
        }}>
          {stats.sales > 0 && (
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '40px',
              background: '#090510',
              border: '1.5px solid #6b21a8',
              borderRadius: '5px',
              padding: '2px 8px',
              color: '#e879f9',
              fontFamily: "'Courier New', monospace",
              fontSize: '15px',
              fontWeight: 900,
              textShadow: '0 0 6px #e879f9',
              boxShadow: 'inset 0 2px 4px #000'
            }}>
              {formatCurrency(Math.round(stats.sales * 0.28))}
            </div>
          )}
        </div>
      </div>

      {/* Lower Row: Two Heavy Consoles Exact Plates from Image 2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '14px',
        marginBottom: '10px'
      }}>
        {/* CONSOLE 1: Top Selling Items */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '421 / 250',
          background: "url('/assets/skeuo/full_console1.png') center / 100% 100% no-repeat",
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.18))'
        }}>
          {stats.topItems && stats.topItems.length > 0 && (
            <div style={{
              position: 'absolute',
              left: '26px',
              right: '26px',
              top: '75px',
              bottom: '26px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              overflowX: 'auto',
              padding: '10px'
            }}>
              {stats.topItems.slice(0, 4).map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '85px',
                  padding: '8px',
                  borderRadius: '8px',
                  background: '#fcfaf6',
                  border: '1px solid #c7bca9'
                }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '18px' }}>🐟</span>
                  </div>
                  <p style={{ fontWeight: 800, fontSize: '0.74rem', color: '#1e293b', margin: '3px 0 1px 0' }}>{t(item._id)}</p>
                  <p style={{ color: '#ea580c', fontWeight: 900, fontSize: '0.76rem', margin: 0 }}>{formatCurrency(item.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CONSOLE 2: Sales Overview (CRT Oscilloscope) */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '421 / 250',
          background: "url('/assets/skeuo/full_console2.png') center / 100% 100% no-repeat",
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.18))'
        }}>
        </div>
      </div>
    </div>

    {/* Modals */`;

dashCode = dashCode.replace(dashReturnRegex, newDashReturn);
fs.writeFileSync(dashPath, dashCode, 'utf8');
console.log('Dashboard.jsx successfully updated with exact Image 2 plates!');

