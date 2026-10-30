import React, { useState } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  Receipt, 
  ShoppingCart, 
  AlertTriangle, 
  Info, 
  Clock, 
  X,
  Package
} from 'lucide-react';

export default function NotificationPanel({
  notifications = [],
  unreadCount = 0,
  onMarkAllAsRead,
  onClearNotification,
  onViewAll,
  onNavigate,
  onClose
}) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'orders' | 'bills' | 'system'

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    try {
      const now = new Date();
      const past = new Date(timestamp);
      const diffMs = now - past;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${diffDay}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const getNotificationIcon = (n) => {
    const type = (n?.data?.type || n?.type || '').toLowerCase();
    const title = (n?.title || '').toLowerCase();

    if (title.includes('order') || type.includes('order')) {
      return { icon: ShoppingCart, bg: '#e0f2fe', color: '#0284c7' };
    }
    if (title.includes('bill') || title.includes('settle') || type.includes('bill')) {
      return { icon: Receipt, bg: '#dcfce7', color: '#15803d' };
    }
    if (title.includes('stock') || title.includes('inventory') || type.includes('stock')) {
      return { icon: Package, bg: '#fef9c3', color: '#a16207' };
    }
    if (n?.type === 'warning' || title.includes('alert')) {
      return { icon: AlertTriangle, bg: '#fee2e2', color: '#dc2626' };
    }
    return { icon: Info, bg: '#f1f5f9', color: '#475569' };
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    const title = (n?.title || '').toLowerCase();
    const type = (n?.data?.type || n?.type || '').toLowerCase();
    if (activeFilter === 'orders') return title.includes('order') || type.includes('order');
    if (activeFilter === 'bills') return title.includes('bill') || title.includes('settle') || type.includes('bill');
    if (activeFilter === 'system') return !title.includes('order') && !title.includes('bill');
    return true;
  });

  const handleNotificationClick = (n) => {
    const type = (n?.data?.type || n?.type || '').toLowerCase();
    const title = (n?.title || '').toLowerCase();

    if (title.includes('order') || type.includes('order')) {
      if (onNavigate) onNavigate('active-orders');
    } else if (title.includes('bill') || title.includes('settle') || type.includes('bill')) {
      if (onNavigate) onNavigate('bill-history');
    } else if (title.includes('stock') || title.includes('fish')) {
      if (onNavigate) onNavigate('menu');
    }
    if (onClose) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(1.5px)'
        }}
      />

      {/* Dropdown Container */}
      <div
        className="admin-notification-dropdown"
        style={{
          background: '#FDFBF7',
          border: '1.5px solid #E8DCCB',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          zIndex: 99999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #E8DCCB',
            background: '#FAF0E4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c'
              }}
            >
              <Bell size={17} />
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.01em' }}>
                Notifications
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                title="Mark all as read"
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <CheckCheck size={13} />
                <span>Read All</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#FAF0E4',
                border: '1px solid #E8DCCB',
                color: '#64748b',
                borderRadius: '6px',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #E8DCCB',
            background: '#FDFBF7',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none'
          }}
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'orders', label: 'Orders' },
            { id: 'bills', label: 'Bills & Sales' },
            { id: 'system', label: 'System' }
          ].map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '4px 11px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: active ? 800 : 600,
                  background: active ? '#ea580c' : '#FAF0E4',
                  color: active ? '#ffffff' : '#64748b',
                  border: active ? '1px solid #ea580c' : '1px solid #E8DCCB',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: active ? '0 1px 4px rgba(234, 88, 12, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div
          className="admin-notif-list"
          style={{
            maxHeight: 'min(390px, calc(100vh - 220px))',
            overflowY: 'auto',
            padding: '10px 10px 14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: '#FDFBF7',
            scrollbarWidth: 'thin',
            scrollbarColor: '#E8DCCB transparent'
          }}
        >
          {filteredNotifications.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#FAF0E4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c2410c'
                }}
              >
                <Bell size={20} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>No notifications found</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>New orders, bills, and alerts will appear here</span>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const { icon: NotifIcon, bg, color } = getNotificationIcon(notif);
              return (
                <div
                  key={notif.id || notif._id || Math.random()}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: '#FAF3E8',
                    border: '1px solid #E8DCCB',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F5E8D8';
                    e.currentTarget.style.borderColor = '#fed7aa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#FAF3E8';
                    e.currentTarget.style.borderColor = '#E8DCCB';
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: bg,
                      color: color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shrink: 0,
                      marginTop: '2px',
                      border: '1px solid rgba(0,0,0,0.06)'
                    }}
                  >
                    <NotifIcon size={16} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          color: '#1e293b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {notif.title || 'Notification'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: '#64748b',
                          shrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontWeight: 600
                        }}
                      >
                        <Clock size={10} />
                        {formatTimeAgo(notif.time || notif.timestamp || notif.createdAt)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: '3px 0 0 0',
                        fontSize: '0.74rem',
                        color: '#475569',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {notif.message || 'Activity logged in fish billing system'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onClearNotification) onClearNotification(notif.id || notif._id);
                    }}
                    title="Dismiss"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      padding: '4px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shrink: 0,
                      marginTop: '1px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid #E8DCCB',
            background: '#FAF0E4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (onClearNotification) onClearNotification('ALL');
            }}
            disabled={notifications.length === 0}
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: notifications.length === 0 ? '#94a3b8' : '#dc2626',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: notifications.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Trash2 size={13} />
            <span>Clear All</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onViewAll) onViewAll();
              if (onClose) onClose();
            }}
            style={{
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>View All Center</span>
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </>
  );
}
