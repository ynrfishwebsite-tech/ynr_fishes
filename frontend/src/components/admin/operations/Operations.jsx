import React, { useState } from 'react';
import {
  FileText, Laptop, Receipt, Users, Banknote, Wallet, CreditCard, Coins, Package, Bell,
  LayoutGrid, RefreshCw, HelpCircle, MonitorPlay, IndianRupee, Languages, UserCog,
  MessageSquarePlus, Truck, Monitor, Smartphone,
  UtensilsCrossed, Printer, Percent, Tags, MonitorSmartphone, Settings as SettingsIcon,
  Globe, ToggleLeft, Clock, ListChecks, Shield, Lock, Award, LineChart, Search, X, Gift
} from 'lucide-react';
import BackButton from '../common/BackButton';

const Operations = ({ onNavigate, onGoBack, userRole = 'admin', onOpenWhatsApp }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const operationsFeatures = [
    { id: 'dashboard', name: 'Dashboard', icon: Shield },
    { id: 'billing', name: 'New Orders / POS', icon: FileText },
    { id: 'active-orders', name: 'Active Orders', icon: Clock },
    { id: 'bill-history', name: 'Bill History', icon: Receipt },
    { id: 'edited-bills', name: 'Edited Bills', icon: FileText, highlight: true },
    { id: 'day-book', name: 'Cash Flow / Day Book', icon: Banknote },
    { id: 'expenses', name: 'Expenses', icon: Wallet },
    { id: 'vehicles', name: 'Vehicles & Fleet Tracking', icon: Truck, highlight: true },
    { id: 'khata', name: 'Khata Book', icon: CreditCard },
    { id: 'crm', name: 'Customers & CRM', icon: Users, highlight: true },
    { id: 'analytics', name: 'Analytics & Reports', icon: LineChart },
  ];

  const configFeatures = [
    { id: 'staff', name: 'Admin Control Panel', icon: Shield, highlight: true },
    { id: 'discount', name: 'Discounts & Offers', icon: Tags, highlight: true },
    { id: 'security', name: 'Security & PINs', icon: Lock, highlight: true },
    { id: 'printer', name: 'Printer Config', icon: Printer, highlight: true },
    { id: 'menu', name: 'Fish Registry / Menu', icon: UtensilsCrossed },
    { id: 'settings', name: 'System Settings', icon: SettingsIcon },
    { id: 'whatsapp-bot', name: 'WhatsApp Bot Login', icon: Smartphone, isWhatsApp: true },
  ];

  const handleFeatureClick = (id) => {
    if (id === 'whatsapp-bot') {
      if (onOpenWhatsApp) onOpenWhatsApp();
      return;
    }
    if (onNavigate) {
      onNavigate(id);
    }
  };

  const filteredOperations = operationsFeatures.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const filteredConfig = configFeatures.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const renderGrid = (features) => (
    <div className="operations-compact-grid">
      {features.map((feature) => {
        const Icon = feature.icon;
        const isWA = feature.isWhatsApp;
        const isHl = feature.highlight;

        return (
          <button
            key={feature.id}
            onClick={() => handleFeatureClick(feature.id)}
            className={`operations-compact-tile ${isHl ? 'highlight' : ''} ${isWA ? 'whatsapp' : ''}`}
          >
            <div className="operations-tile-icon" style={{ color: isHl ? '#d97706' : isWA ? '#16a34a' : '#0284c7' }}>
              <Icon size={20} />
            </div>
            <span
              className="operations-tile-label"
              style={{
                color: isHl ? '#92400e' : '#1e293b',
              }}
            >
              {feature.name}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="operations-page-container" style={{ background: "#FAF7F2", minHeight: "100%", padding: "20px 24px", boxSizing: "border-box" }}>
      <style>{`
        .operations-title {
          color: #1e293b !important;
        }
        .operations-subtitle {
          color: #64748b !important;
        }
        .operations-search-input {
          background: #ffffff !important;
          border: 1px solid #eedecb !important;
          color: #1e293b !important;
        }
        .operations-search-input::placeholder {
          color: #94a3b8 !important;
        }
        .operations-section-card {
          background: #ffffff !important;
          border: 1px solid #eedecb !important;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03) !important;
        }
        .operations-compact-tile {
          background: #FAF7F2 !important;
          border: 1px solid #eedecb !important;
        }
        .operations-compact-tile:hover {
          background: #FFF3E5 !important;
          border-color: #ea580c !important;
        }
        .operations-compact-tile.highlight {
          background: linear-gradient(145deg, #fffbf2, #ffffff) !important;
          border-color: #fbd38d !important;
        }
        .operations-compact-tile.highlight:hover {
          background: #FFF3E5 !important;
          border-color: #f59e0b !important;
        }
        .operations-compact-tile.whatsapp {
          background: #f0fdf4 !important;
          border-color: #86efac !important;
        }
        .operations-compact-tile.whatsapp:hover {
          background: #dcfce7 !important;
          border-color: #22c55e !important;
        }
        .operations-tile-label {
          color: #1e293b !important;
        }
      `}</style>
      {/* Header bar */}
      <div className="operations-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onGoBack && <BackButton onClick={onGoBack} label="Back" />}
          <div>
            <h2 className="operations-title">
              Extra Operations & Configurations
            </h2>
            <p className="operations-subtitle">
              Instant hub for Discounts, Security PINs, Hardware, and System Controls
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="operations-search-wrapper">
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search operations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="operations-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Configurations & Security Section */}
      <div className="operations-section-card">
        <h3 className="operations-section-heading" style={{ color: '#ea580c' }}>
          ⭐ Configurations & Security Controls
        </h3>
        {renderGrid(filteredConfig)}
      </div>

      {/* Core POS & Ledger Operations */}
      <div className="operations-section-card">
        <h3 className="operations-section-heading" style={{ color: '#0284c7' }}>
          💼 All Operations & Desk Tools
        </h3>
        {renderGrid(filteredOperations)}
      </div>
    </div>
  );
};

export default Operations;
