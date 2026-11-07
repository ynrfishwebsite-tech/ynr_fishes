import React, { useState } from 'react';
import { Package, FileText, Building, Truck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useSupplierData } from './hooks/useSupplierData';
import SupplierHeader from './components/SupplierHeader';
import SupplierMetricsGrid from './components/SupplierMetricsGrid';
import SupplierPassbookTab from './components/SupplierPassbookTab';
import SupplierKhataTab from './components/SupplierKhataTab';
import SupplierProfileTab from './components/SupplierProfileTab';
import FishInwardInvoice from '../../../components/admin/inventory/FishInwardInvoice';

export default function SupplierDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('passbook'); // 'passbook' | 'khata' | 'profile'
  const [activeInvoiceData, setActiveInvoiceData] = useState(null);

  const {
    supplierProfile,
    linkedVehicle,
    stockLogs,
    totalWeightKg,
    totalGrossValue,
    totalBoxesSupplied,
    khataBalance,
    totalSettledAmount,
    loading,
    refreshing,
    refresh
  } = useSupplierData(user);

  const supplierName = user?.name || user?.username || 'Catch Supplier';
  const supplierPhone = user?.phone || '';
  const displayName = supplierProfile?.companyName || supplierProfile?.name || supplierName;

  const handleOpenInvoice = (lot) => {
    const isDam = lot.intakeMode === 'dam';
    const items = Array.isArray(lot.consignmentItems) && lot.consignmentItems.length > 0
      ? lot.consignmentItems
      : [{
          name: lot.itemName || 'Seafood Lot',
          boxes: lot.boxes || lot.totalBoxes || 1,
          grossWeight: Number(lot.grossKgChange || lot.quantityChange || 0),
          netWeight: Number(lot.grossKgChange || lot.quantityChange || 0),
          rate: Number(lot.rate || lot.price || 0),
          amount: Number(lot.netPayable || lot.grossValue || ((lot.rate || lot.price || 0) * (lot.quantityChange || 1)))
        }];

    const invoiceData = {
      mode: isDam ? 'dam' : 'local',
      invoiceNo: lot.invoiceNo || `GIN-${isDam ? 'DAM' : 'LOC'}-${new Date(lot.createdAt).getTime().toString().slice(-6)}`,
      date: new Date(lot.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date(lot.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      supplierName: supplierProfile?.name || lot.supplierName || supplierName,
      supplierPhone: supplierProfile?.phone || lot.supplierPhone || supplierPhone,
      companyName: supplierProfile?.companyName || lot.companyName || '',
      vehicleNumber: lot.vehicleNumber || linkedVehicle?.vehicleNumber || '',
      harbor: supplierProfile?.harbor || lot.harbor || 'Mangalore Harbor',
      items,
      totalBoxes: lot.totalBoxes || lot.boxes || items.reduce((s, i) => s + (Number(i.boxes) || 0), 0),
      totalKg: Number(lot.grossKgChange || lot.quantityChange || 0),
      grossValue: Number(lot.grossValue || lot.netPayable || 0),
      netPayable: Number(lot.netPayable || lot.grossValue || 0),
      settlements: lot.settlements || {},
      notes: lot.notes || ''
    };

    setActiveInvoiceData(invoiceData);
  };

  return (
    <div className="min-h-screen bg-[#F7EFE2] text-slate-800 flex flex-col font-sans select-none antialiased w-full">
      {/* 1. Sleek Compact Header */}
      <SupplierHeader
        user={user}
        supplierProfile={supplierProfile}
        linkedVehicle={linkedVehicle}
        onRefresh={refresh}
        refreshing={refreshing}
        onLogout={logout}
      />

      {/* 2. Full-Width Workspace with Minimum Padding */}
      <main className="w-full px-2 sm:px-4 py-2 space-y-2 flex-1">
        {/* Financial Metrics Grid */}
        <SupplierMetricsGrid
          totalWeightKg={totalWeightKg}
          totalGrossValue={totalGrossValue}
          totalSettledAmount={totalSettledAmount}
          khataBalance={khataBalance}
          totalBoxesSupplied={totalBoxesSupplied}
          verifiedLotsCount={stockLogs.length}
          harborName={supplierProfile?.harbor}
        />

        {/* Tab Controls Bar */}
        <div className="flex items-center justify-between gap-1.5 border-b border-[#E8DCCB] pb-1.5 flex-wrap w-full">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('passbook')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'passbook'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              <Package size={13} />
              <span>Catch Inward Passbook ({stockLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('khata')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'khata'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              <FileText size={13} />
              <span>Khata Statement</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              <Building size={13} />
              <span>Bank & Logistics</span>
            </button>
          </div>

          {/* Quick Info Badge */}
          {linkedVehicle && (
            <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-[#E8DCCB] shadow-2xs">
              <Truck size={12} className="text-orange-500" />
              <span>Transport: {linkedVehicle.vehicleNumber}</span>
            </div>
          )}
        </div>

        {/* Tab Views */}
        {activeTab === 'passbook' && (
          <SupplierPassbookTab
            stockLogs={stockLogs}
            loading={loading}
            onOpenInvoice={handleOpenInvoice}
          />
        )}

        {activeTab === 'khata' && (
          <SupplierKhataTab
            displayName={displayName}
            stockLogs={stockLogs}
            totalGrossValue={totalGrossValue}
            totalSettledAmount={totalSettledAmount}
            khataBalance={khataBalance}
          />
        )}

        {activeTab === 'profile' && (
          <SupplierProfileTab
            supplierProfile={supplierProfile}
            displayName={displayName}
            supplierPhone={supplierPhone}
            linkedVehicle={linkedVehicle}
          />
        )}
      </main>

      {/* Invoice Modal */}
      {activeInvoiceData && (
        <FishInwardInvoice
          data={activeInvoiceData}
          onClose={() => setActiveInvoiceData(null)}
        />
      )}
    </div>
  );
}
