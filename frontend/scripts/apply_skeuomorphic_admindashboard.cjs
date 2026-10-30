const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/pages/dashboards/AdminDashboard.jsx');
let code = fs.readFileSync(targetPath, 'utf8');

const returnRegex = /\s*return\s*\(\s*<div className="admin-cream-ui"[\s\S]*$/;
if (!returnRegex.test(code)) {
  console.error('Could not find return (<div className="admin-cream-ui"');
  process.exit(1);
}

const newReturn = `
  return (
    <div className="skeuo-terminal-shell">
      <div className="skeuo-terminal-enclosure">
        
        {/* Top Header Bar: Brushed Stainless Steel / Aluminum Console */}
        <header className="skeuo-header-bar">
          
          {/* Left: Rivet + Stamped Metal Coin Badge + Brand & Cargo Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 10 }}>
            <span className="skeuo-screw" title="M4 Chassis Bolt" />
            
            {/* Stamped Metallic Emblem */}
            <div 
              className="skeuo-coin-badge" 
              onClick={() => setCurrentView('dashboard')}
              title="YNR Fishes Marine Console"
            >
              <img
                src="/assets/ynr_logo_hd.jpg"
                alt="YNR Fishes"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/ynr_logo.png";
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#1e293b',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  textShadow: '0 1px 0 rgba(255,255,255,0.8)'
                }}>
                  YNR FISHES
                </h2>
                {/* Dangling Cargo Fish Tag */}
                <span className="skeuo-cargo-tag">
                  {branchCode} • {branchCity}
                </span>
              </div>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 600,
                letterSpacing: '0.3px'
              }}>
                {branchName} | Admin Terminal
              </p>
            </div>
          </div>

          {/* Center: Glowing Green Glass Dome Siren + Nixie/VFD Digital Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 10 }}>
            {/* Dome Siren */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="skeuo-dome-siren" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textShadow: '0 1px 0 rgba(255,255,255,0.8)'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                  Online Node
                </span>
                <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600 }}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Recessed Amber Nixie / VFD Digital Clock */}
            <div className="skeuo-nixie-clock" title="Hardware Terminal Clock">
              <span className="skeuo-nixie-digits">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>
          </div>

          {/* Right: Tactile 3D Candy Push-Buttons, Slider Toggle & Screw */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 10 }}>
            {/* New Order: Glossy Orange Candy Button */}
            <button
              onClick={() => setCurrentView('billing')}
              className="skeuo-btn-orange"
              title="Create New Customer Fish Order"
            >
              <Plus size={15} strokeWidth={3} />
              <span>New Order</span>
            </button>

            {/* WhatsApp: Glossy Green Candy Button */}
            <button
              onClick={() => setShowWhatsAppModal(true)}
              className="skeuo-btn-green"
              title="Open WhatsApp Notification Hub"
            >
              <MessageSquare size={15} />
              <span>WhatsApp</span>
            </button>

            {/* Quick Calculator Metal Button */}
            <button
              onClick={() => setShowCalculator(true)}
              className="skeuo-btn-metal"
              title="Quick Calculator"
              style={{ padding: '7px 10px' }}
            >
              <Calculator size={15} strokeWidth={2.2} />
            </button>

            {/* Alerts Hardware Toggle Switch */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadCount > 0) {
                    markAllAsRead();
                  }
                }}
                className="skeuo-toggle-housing"
                title={unreadCount > 0 ? \`\${unreadCount} Unread Alerts\` : 'Alerts Monitor'}
              >
                <div
                  className="skeuo-toggle-knob"
                  style={{
                    transform: unreadCount > 0 ? 'translateX(20px)' : 'translateX(0px)',
                    background: unreadCount > 0 ? 'radial-gradient(circle at 35% 35%, #ffffff 0%, #fca5a5 50%, #dc2626 100%)' : undefined
                  }}
                />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#475569', marginTop: '2px', textTransform: 'uppercase' }}>
                Alerts {unreadCount > 0 && \`(\${unreadCount})\`}
              </span>

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
            <button
              onClick={() => setShowLogoutModal(true)}
              className="skeuo-btn-metal"
              title="Terminate Terminal Session"
            >
              <LogOut size={14} strokeWidth={2.2} />
              <span>Sign Out</span>
            </button>

            <span className="skeuo-screw flat" title="M4 Chassis Bolt" style={{ marginLeft: '4px' }} />
          </div>
        </header>

        {/* Main Body Layout: Saddle-Stitched Leather Sidebar + Instrument Deck */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          
          {/* Left Vertical Sidebar: Saddle-Stitched Dark Cognac Leather */}
          <aside className="skeuo-leather-sidebar">
            {/* Nav Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                
                if (isActive) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className="skeuo-nav-active"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon size={16} strokeWidth={2.5} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={14} strokeWidth={3} />
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className="skeuo-nav-inactive"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={15} strokeWidth={2} style={{ opacity: 0.8 }} />
                      <span>{item.label}</span>
                    </div>
                    <span className="skeuo-nav-toggle" />
                  </button>
                );
              })}
            </div>

            {/* Bottom Polaroid Photo with Masking Tape */}
            <div className="skeuo-polaroid-frame" title="Fresh Harbour Fish Catch">
              <div className="skeuo-masking-tape" />
              <img
                src="/assets/cards/sidebar_fish_crate.png"
                alt="Fresh Fish on Ice"
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '2px', objectFit: 'cover' }}
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
              background: '#ede6d8',
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

        {/* Machined Bottom Bumper Bar with Chassis Rivets */}
        <div className="skeuo-bottom-bumper">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="skeuo-screw flat" />
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#1e293b', letterSpacing: '1px' }}>
              YNR MARINE HARDWARE TERMINAL • NODE #KDP-01
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#334155' }}>
              STABLE OPERATIONAL FIRMWARE
            </span>
            <span className="skeuo-screw vertical" />
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

code = code.replace(returnRegex, newReturn);
fs.writeFileSync(targetPath, code, 'utf8');
console.log('AdminDashboard.jsx safely updated with Skeuomorphic shell!');
