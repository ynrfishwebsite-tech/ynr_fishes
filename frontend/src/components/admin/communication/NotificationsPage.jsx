import React, { useState } from 'react';
import { 
  Bell, 
  Trash2, 
  CheckCheck, 
  ArrowLeft, 
  ShoppingCart, 
  ReceiptIndianRupee, 
  Package, 
  AlertTriangle, 
  Info, 
  Clock
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
      return { icon: ReceiptIndianRupee, bg: '#dcfce7', color: '#15803d', category: 'Bills & Sales' };
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
    <div className="flex-1 flex flex-col bg-[#F7EFE2] text-slate-800 p-2.5 sm:p-6 box-border min-h-full overflow-y-auto">
      {/* Top Header Bar - Compact & Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-2.5 sm:mb-4 border-b border-[#E8DCCB] pb-2.5 sm:pb-3.5 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="px-2.5 py-1 sm:py-1.5 sm:px-3 text-xs sm:text-sm font-bold bg-[#FDFBF7] border border-[#E8DCCB] text-slate-700 rounded-lg sm:rounded-xl flex items-center gap-1 cursor-pointer shadow-xs shrink-0 hover:bg-slate-50 transition-all"
            >
              <ArrowLeft size={14} className="sm:w-4 sm:h-4 text-slate-600" />
              <span>Back</span>
            </button>
          )}

          <div className="min-w-0">
            <h1 className="text-xs sm:text-base md:text-lg font-black text-slate-900 flex items-center gap-1.5 leading-tight">
              <span className="text-[#ea580c] shrink-0"><Bell size={18} className="sm:w-5 sm:h-5" /></span>
              <span className="truncate">Fish Billing Notification Center</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[280px] sm:max-w-none mt-0.5">
              Real-time fish orders, billing invoices, stock alerts, and daybook updates
            </p>
          </div>
        </div>

        {/* Action Controls (Mark read & clear all) */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-2 py-1 sm:py-1.5 sm:px-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs hover:bg-emerald-100 transition-all"
            >
              <CheckCheck size={13} className="sm:w-3.5 sm:h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={() => setShowClearModal(true)}
              className="px-2 py-1 sm:py-1.5 sm:px-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs hover:bg-rose-100 transition-all"
            >
              <Trash2 size={13} className="sm:w-3.5 sm:h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs - Compact Horizontal Strip */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-2.5 sm:mb-4 overflow-x-auto pb-1 shrink-0 no-scrollbar">
        {[
          { id: 'all', label: `All (${notifications.length})` },
          { id: 'orders', label: 'Fish Orders' },
          { id: 'bills', label: 'Bills & Invoices' },
          { id: 'stock', label: 'Stock Alerts' },
          { id: 'system', label: 'System' }
        ].map((tab) => {
          const active = filterType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`py-1 px-2.5 sm:py-1.5 sm:px-3.5 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer shadow-xs shrink-0 ${
                active 
                  ? 'bg-[#ea580c] text-white border border-[#ea580c] shadow-orange-500/20' 
                  : 'bg-[#FDFBF7] text-slate-700 border border-[#E8DCCB] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notifications List Body */}
      <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="py-10 px-4 sm:py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2 bg-[#FDFBF7] rounded-xl sm:rounded-2xl border border-dashed border-[#E8DCCB]">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#FAF0E4] flex items-center justify-center text-[#c2410c]">
              <Bell size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="text-xs sm:text-sm font-black text-slate-800">No Notifications In This Category</div>
            <div className="text-[11px] sm:text-xs max-w-xs text-slate-500 leading-snug">
              Whenever retail fish orders are weighed, wholesale bills are printed, or daybook entries are logged, they will appear here.
            </div>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const { icon: NotifIcon, bg, color, category } = getNotifDetails(n);
            return (
              <div
                key={n.id || n._id || Math.random()}
                className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex gap-2.5 sm:gap-3 items-start shadow-xs transition-all hover:shadow-sm"
              >
                <div
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 mt-0.5 border border-black/5"
                  style={{ background: bg, color: color }}
                >
                  <NotifIcon size={15} className="sm:w-4 sm:h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {n.title || 'Notification'}
                      </h3>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[#FAF0E4] text-[#7c3f1d] border border-[#E8DCCB] shrink-0">
                        {category}
                      </span>
                    </div>

                    <span className="text-[9px] sm:text-[10px] text-slate-500 flex items-center gap-1 font-semibold shrink-0">
                      <Clock size={10} />
                      {formatFullDate(n.time || n.timestamp || n.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] sm:text-xs text-slate-700 leading-snug font-medium">
                    {n.message}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => handleActionClick(n)}
                      className="bg-[#FAF0E4] hover:bg-[#F5E5D0] border border-[#fed7aa] text-[#c2410c] rounded-md sm:rounded-lg py-0.5 px-2 text-[10px] sm:text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => clearNotification(n.id || n._id)}
                      className="bg-white hover:bg-slate-100 border border-[#E8DCCB] text-slate-600 rounded-md sm:rounded-lg py-0.5 px-2 text-[10px] sm:text-[11px] font-semibold cursor-pointer transition-colors"
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

      {/* Confirmation Modal to Clear All - Compact */}
      {showClearModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3">
          <div className="bg-white border border-rose-200 rounded-2xl max-w-[340px] w-full p-4 sm:p-5 text-center shadow-xl">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2.5 border border-rose-200">
              <Trash2 size={20} />
            </div>

            <h3 className="text-sm sm:text-base font-black text-slate-900 mb-1">
              Clear All Notifications?
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-600 mb-3.5 leading-snug">
              Are you sure you want to permanently delete all fish order and billing notifications?
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-1.5 px-3 bg-[#FDFBF7] border border-[#E8DCCB] text-slate-700 rounded-lg font-bold text-xs cursor-pointer hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearNotification('ALL');
                  setShowClearModal(false);
                }}
                className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors"
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
