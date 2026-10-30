import React, { useState } from 'react';
import { 
  Bell, 
  Trash2, 
  CheckCheck, 
  ArrowLeft, 
  ShoppingCart, 
  Receipt, 
  Package, 
  AlertTriangle, 
  Info, 
  Clock, 
  Filter,
  CheckCircle2,
  X
} from 'lucide-react';
import useNotifications from '../../../hooks/useNotifications';

export default function NotificationsPage({ userRole = 'Admin', onNavigate, onGoBack }) {
  const { notifications, unreadCount, markAllAsRead, clearNotification } = useNotifications(userRole);
  const [filterType, setFilterType] = useState('all');
  const [showClearModal, setShowClearModal] = useState(false);

  const formatFullDate = (timestamp) => {
    if (!timestamp) return 'Recent';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Recent';
    }
  };

  const getNotifDetails = (n) => {
    const title = (n?.title || '').toLowerCase();
    const type = (n?.data?.type || n?.type || '').toLowerCase();

    if (title.includes('order') || type.includes('order')) {
      return { icon: ShoppingCart, bg: '#e0f2fe', color: '#0284c7', category: 'Orders' };
    }
    if (title.includes('bill') || title.includes('settle') || type.includes('bill')) {
      return { icon: Receipt, bg: '#dcfce7', color: '#15803d', category: 'Bills & Sales' };
    }
    if (title.includes('stock') || title.includes('fish') || type.includes('stock')) {
      return { icon: Package, bg: '#fef9c3', color: '#a16207', category: 'Fish Stock' };
    }
    if (n?.type === 'warning' || title.includes('alert')) {
      return { icon: AlertTriangle, bg: '#fee2e2', color: '#dc2626', category: 'Alerts' };
    }
    return { icon: Info, bg: '#f1f5f9', color: '#475569', category: 'System' };
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'all') return true;
    const { category } = getNotifDetails(n);
    if (filterType === 'orders') return category === 'Orders';
    if (filterType === 'bills') return category === 'Bills & Sales';
    if (filterType === 'stock') return category === 'Fish Stock';
    if (filterType === 'system') return category === 'System' || category === 'Alerts';
    return true;
  });

  const handleActionClick = (n) => {
    const { category } = getNotifDetails(n);
    if (category === 'Orders' && onNavigate) onNavigate('active-orders');
    else if (category === 'Bills & Sales' && onNavigate) onNavigate('bill-history');
    else if (category === 'Fish Stock' && onNavigate) onNavigate('menu');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F7EFE2', color: '#1e293b', padding: '24px', boxSizing: 'border-box', minHeight: '100%' }}>
      {/* Top Header Bar */}
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '16px', 
          marginBottom: '20px',
          borderBottom: '1px solid #E8DCCB',
          paddingBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onGoBack && (
            <button
              onClick={onGoBack}
              style={{
                background: '#FDFBF7',
                border: '1.5px solid #E8DCCB',
                color: '#475569',
                borderRadius: '10px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          )}

          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
              <span style={{ color: '#ea580c', display: 'flex' }}><Bell size={24} /></span>
              Fish Billing Notification Center
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              Real-time alerts for customer fish orders, billing invoices, stock warnings, and daybook updates
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                background: '#ecfdf5',
                border: '1.5px solid #a7f3d0',
                color: '#047857',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <CheckCheck size={16} />
              <span>Mark All As Read</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={() => setShowClearModal(true)}
              style={{
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                color: '#dc2626',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <Trash2 size={16} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '20px', 
          overflowX: 'auto', 
          paddingBottom: '4px' 
        }}
      >
        {[
          { id: 'all', label: `All (${notifications.length})` },
          { id: 'orders', label: 'Fish Orders' },
          { id: 'bills', label: 'Bills & Invoices' },
          { id: 'stock', label: 'Stock Alerts' },
          { id: 'system', label: 'System Updates' }
        ].map((tab) => {
          const active = filterType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              style={{
                padding: '7px 16px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: active ? 800 : 600,
                background: active ? '#ea580c' : '#FDFBF7',
                color: active ? '#ffffff' : '#475569',
                border: active ? '1.5px solid #ea580c' : '1.5px solid #E8DCCB',
                cursor: 'pointer',
                boxShadow: active ? '0 2px 6px rgba(234, 88, 12, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notifications List Body */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredNotifications.length === 0 ? (
          <div 
            style={{ 
              padding: '80px 20px', 
              textAlign: 'center', 
              color: '#64748b', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '12px',
              background: '#FDFBF7',
              borderRadius: '16px',
              border: '1.5px dashed #E8DCCB'
            }}
          >
            <div 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: '#FAF0E4', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#c2410c' 
              }}
            >
              <Bell size={30} />
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>No Notifications In This Category</div>
            <div style={{ fontSize: '0.8rem', maxWidth: '340px', color: '#64748b', lineHeight: 1.5 }}>
              Whenever retail fish orders are weighed, wholesale bills are printed, or daybook entries are logged, they will appear here in real-time.
            </div>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const { icon: NotifIcon, bg, color, category } = getNotifDetails(n);
            return (
              <div
                key={n.id || n._id || Math.random()}
                style={{
                  background: '#FDFBF7',
                  border: '1.5px solid #E8DCCB',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: bg,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}
                >
                  <NotifIcon size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#1e293b' }}>
                        {n.title || 'Notification'}
                      </h3>
                      <span 
                        style={{ 
                          fontSize: '0.68rem', 
                          fontWeight: 700, 
                          padding: '1px 7px', 
                          borderRadius: '8px', 
                          background: '#FAF0E4',
                          color: '#7c3f1d',
                          border: '1px solid #E8DCCB'
                        }}
                      >
                        {category}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <Clock size={12} />
                      {formatFullDate(n.time || n.timestamp || n.createdAt)}
                    </span>
                  </div>

                  <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#334155', lineHeight: 1.5, fontWeight: 500 }}>
                    {n.message}
                  </p>

                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleActionClick(n)}
                      style={{
                        background: '#FAF0E4',
                        border: '1px solid #fed7aa',
                        color: '#c2410c',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => clearNotification(n.id || n._id)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #E8DCCB',
                        color: '#64748b',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal to Clear All */}
      {showClearModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #fecaca',
              borderRadius: '16px',
              maxWidth: '380px',
              width: '100%',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                border: '1px solid #fecaca'
              }}
            >
              <Trash2 size={24} />
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 900, color: '#1e293b' }}>
              Clear All Notifications?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, fontWeight: 500 }}>
              Are you sure you want to permanently delete all fish order and billing notifications?
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowClearModal(false)}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  background: '#FDFBF7',
                  border: '1.5px solid #E8DCCB',
                  color: '#475569',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearNotification('ALL');
                  setShowClearModal(false);
                }}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
