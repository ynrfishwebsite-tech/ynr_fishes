import React from 'react';
import { Radio, RefreshCw, LogOut, Truck } from 'lucide-react';
import ynrLogo from '../../../../assets/ynr_logo_hd.jpg';

export default function DriverHeader({
  user,
  assignedVehicle,
  isTracking,
  onToggleGpsTab,
  onRefresh,
  refreshing,
  onLogout
}) {
  const driverName = user?.name || user?.username || 'Fleet Driver';
  const driverPhotoUrl = user?.profileImage || assignedVehicle?.driverPhoto || '';
  const initials = driverName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-[#FDFBF7] border-b border-[#E8DCCB] shadow-xs px-2.5 py-2 sm:px-4 sm:py-2.5 w-full">
      <div className="w-full flex items-center justify-between gap-2">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src={ynrLogo}
            alt="YNR Fishes"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain border border-[#E8DCCB] bg-white shadow-2xs shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-tight">
                YNR FISHES
              </span>
              <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 text-[#ea580c] border border-orange-200">
                DRIVER PORTAL
              </span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                KDP DEPOT
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium truncate hidden sm:block">
              Vehicle Dispatches & Real-Time Logistics
            </p>
          </div>
        </div>

        {/* Right: Driver Identity, GPS Status, Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Live GPS Beacon */}
          <button
            type="button"
            onClick={onToggleGpsTab}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
              isTracking
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
            title={isTracking ? 'GPS Broadcast Active' : 'GPS Broadcast Paused'}
          >
            <Radio size={11} className={isTracking ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="hidden xs:inline">{isTracking ? 'GPS LIVE' : 'GPS IDLE'}</span>
          </button>

          {/* Driver Cardlet */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-[#E8DCCB]">
            {driverPhotoUrl ? (
              <img
                src={driverPhotoUrl}
                alt={driverName}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-orange-400 shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white font-black text-[11px] flex items-center justify-center border-2 border-white shadow-2xs shrink-0">
                {initials}
              </div>
            )}
            <div className="hidden md:block text-left">
              <div className="text-xs font-black text-slate-900 leading-tight truncate max-w-[130px]">
                {driverName}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {assignedVehicle?.vehicleNumber || 'Unassigned'}
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] text-slate-700 hover:bg-[#FAF0E4] active:scale-95 transition-all shadow-2xs cursor-pointer"
            title="Refresh Fleet Data"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#ea580c]' : ''} />
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
            title="Log Out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}

