const fs = require('fs');
const path = require('path');

const adminPath = path.resolve(__dirname, '../src/pages/dashboards/AdminDashboard.jsx');
let code = fs.readFileSync(adminPath, 'utf8');

// Find return ( in AdminDashboard.jsx
const returnRegex = /\s*return\s*\(\s*<div style=\{\{[\s\S]*$/;
if (!returnRegex.test(code)) {
  console.error('Could not match return in AdminDashboard.jsx');
  process.exit(1);
}

const newAdminReturn = `
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      background: '#150c06',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* If current view is dashboard, render the authentic hardware console */}
      {currentView === 'dashboard' ? (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px',
          boxSizing: 'border-box'
        }}>
          {/* Main 1024x572 Calibrated Console Master Container */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1240px',
            maxHeight: '96vh',
            aspectRatio: '1024 / 572',
            backgroundImage: "url('/assets/skeuo/master_terminal_bg.jpg')",
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            borderRadius: '16px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 4px 12px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden'
          }}>
            {/* 1. Live Glowing Nixie Clock */}
            <div style={{
              position: 'absolute',
              left: '43.2%',
              top: '8.1%',
              width: '16.2%',
              height: '5.8%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 20
            }}>
              <span style={{
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: 'clamp(12px, 1.6vw, 19px)',
                fontWeight: 900,
                letterSpacing: '2px',
                color: '#fbbf24',
                textShadow: '0 0 5px #fbbf24, 0 0 14px rgba(245, 158, 11, 0.9), 0 0 22px rgba(217, 119, 6, 0.7)'
              }}>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>

            {/* 2. Interactive Hotspot: Brand / Logo Coin */}
            <div
              onClick={() => setCurrentView('dashboard')}
              title="YNR Fishes Terminal Dashboard"
              style={{
                position: 'absolute',
                left: '2.0%',
                top: '2.5%',
                width: '12.0%',
                height: '14.0%',
                cursor: 'pointer',
                zIndex: 25
              }}
            />

            {/* 3. Interactive Hotspot: + New Order Button */}
            <div
              onClick={() => setCurrentView('billing')}
              title="Create New Fish Order (POS)"
              style={{
                position: 'absolute',
                left: '62.4%',
                top: '8.0%',
                width: '10.5%',
                height: '5.8%',
                cursor: 'pointer',
                borderRadius: '16px',
                zIndex: 25,
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            />

            {/* 4. Interactive Hotspot: WhatsApp Button */}
            <div
              onClick={() => setShowWhatsAppModal(true)}
              title="Open WhatsApp Customer Communication"
              style={{
                position: 'absolute',
                left: '74.2%',
                top: '8.0%',
                width: '9.5%',
                height: '5.8%',
                cursor: 'pointer',
                borderRadius: '16px',
                zIndex: 25,
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            />

            {/* 5. Interactive Hotspot: Alerts Toggle Switch */}
            <div
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) markAllAsRead();
              }}
              title={unreadCount > 0 ? \`\${unreadCount} Alerts Available\` : 'System Alerts'}
              style={{
                position: 'absolute',
                left: '85.0%',
                top: '7.5%',
                width: '4.4%',
                height: '7.0%',
                cursor: 'pointer',
                borderRadius: '10px',
                zIndex: 25
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            />

            {/* 6. Interactive Hotspot: Sign Out Button */}
            <div
              onClick={() => setShowLogoutModal(true)}
              title="Sign Out of Terminal"
              style={{
                position: 'absolute',
                left: '91.0%',
                top: '7.5%',
                width: '4.8%',
                height: '7.0%',
                cursor: 'pointer',
                borderRadius: '8px',
                zIndex: 25
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            />

            {/* 7. Sidebar Navigation Hotspots */}
            <div
              onClick={() => setCurrentView('dashboard')}
              title="Dashboard"
              style={{ position: 'absolute', left: '0.8%', top: '30.8%', width: '12.8%', height: '5.2%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('billing')}
              title="New Order"
              style={{ position: 'absolute', left: '0.8%', top: '36.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('active-orders')}
              title="Active Orders"
              style={{ position: 'absolute', left: '0.8%', top: '41.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('bill-history')}
              title="Bill History"
              style={{ position: 'absolute', left: '0.8%', top: '46.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('inventory')}
              title="Stock & Inventory"
              style={{ position: 'absolute', left: '0.8%', top: '51.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('menu')}
              title="Fish Registry & Pricing"
              style={{ position: 'absolute', left: '0.8%', top: '56.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('day-book')}
              title="Cash Flow & Day Book"
              style={{ position: 'absolute', left: '0.8%', top: '61.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('khata')}
              title="Khata Book (Credit Accounts)"
              style={{ position: 'absolute', left: '0.8%', top: '66.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('expenses')}
              title="Store Expenses"
              style={{ position: 'absolute', left: '0.8%', top: '71.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('analytics')}
              title="Analytics & Deep Reports"
              style={{ position: 'absolute', left: '0.8%', top: '76.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('operations')}
              title="Extra Operations & Config"
              style={{ position: 'absolute', left: '0.8%', top: '81.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />
            <div
              onClick={() => setCurrentView('settings')}
              title="System Settings"
              style={{ position: 'absolute', left: '0.8%', top: '86.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
            />

            {/* Dashboard Embedded Functional Component (for modals and notifications) */}
            <Dashboard user={user} onNavigate={setCurrentView} />
          </div>
        </div>
      ) : (
        /* Work Page Views (e.g. Billing, Day Book, Stock) rendered in full workspace */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#faf7f2' }}>
          {/* Header Bar with quick back to dashboard */}
          <div style={{
            height: '48px',
            background: 'linear-gradient(180deg, #f5f7fa 0%, #d8e0ea 50%, #cdd6e2 100%)',
            borderBottom: '1px solid #778598',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <button
              onClick={() => setCurrentView('dashboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 12px',
                fontWeight: 800,
                fontSize: '12px',
                color: '#1e293b',
                cursor: 'pointer'
              }}
            >
              <span>← Back to Hardware Console</span>
            </button>
            <span style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b', textTransform: 'uppercase' }}>
              {currentView.replace('-', ' ')}
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
          </div>
        </div>
      )}

      {/* Notifications Floating Dropdown */}
      {showNotifications && (
        <div style={{ position: 'fixed', top: '70px', right: '120px', zIndex: 1000 }}>
          <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllAsRead={markAllAsRead}
            onClearNotification={clearNotification}
            onViewAll={() => setCurrentView('notifications')}
            onNavigate={(viewId) => setCurrentView(viewId)}
            onClose={() => setShowNotifications(false)}
          />
        </div>
      )}

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

code = code.replace(returnRegex, newAdminReturn);
fs.writeFileSync(adminPath, code, 'utf8');
console.log('AdminDashboard.jsx updated with pristine Master Console architecture!');

