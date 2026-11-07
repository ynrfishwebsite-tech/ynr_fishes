import React from 'react';
import { Truck, Navigation, Gauge, Radio } from 'lucide-react';

export default function DriverMetricsGrid({
  assignedVehicle,
  trips,
  currentSpeed,
  tripDistanceKm,
  elapsedTimeFormatted,
  isTracking,
  onToggleGps
}) {
  const activeDispatchesCount = trips.filter(t => t.status === 'On-Road').length;
  const completedTripsCount = trips.filter(t => t.status === 'Delivered' || t.status === 'Completed').length;
  const totalKmsCalculated = trips.reduce((acc, t) => acc + (Number(t.distanceKm) || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
      {/* 1. Assigned Vehicle */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Assigned Vehicle
          </span>
          <Truck size={14} className="text-orange-500" />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-xs sm:text-sm text-slate-900 truncate">
            {assignedVehicle?.vehicleNumber || 'Unassigned'}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            {assignedVehicle?.modelName || 'Fleet Vehicle'} • {assignedVehicle?.fuelType || 'Diesel'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1 border-t border-[#E8DCCB]/60">
          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            {assignedVehicle?.status || 'Available'}
          </span>
          <span className="text-[9px] font-semibold text-slate-400 truncate">
            {assignedVehicle?.operationalMode || 'DAM Consignments'}
          </span>
        </div>
      </div>

      {/* 2. Active Trips */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Active Trips
          </span>
          <Navigation size={14} className="text-sky-500" />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
            {activeDispatchesCount}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            {completedTripsCount} deliveries completed
          </div>
        </div>
        <div className="pt-1 border-t border-[#E8DCCB]/60">
          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
            activeDispatchesCount > 0
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}>
            {activeDispatchesCount > 0 ? 'Delivery In Progress' : 'No Open Trips'}
          </span>
        </div>
      </div>

      {/* 3. Distance & Odometer */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Total Distance
          </span>
          <Gauge size={14} className="text-purple-500" />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
            {totalKmsCalculated} <span className="text-xs font-sans font-bold text-slate-500">KM</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            Across {trips.length} logged dispatches
          </div>
        </div>
        <div className="pt-1 border-t border-[#E8DCCB]/60">
          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
            Odometer: {(assignedVehicle?.currentKm || 0).toLocaleString()} KM
          </span>
        </div>
      </div>

      {/* 4. Live Telemetry */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Live Telemetry
          </span>
          <Radio size={14} className={isTracking ? 'text-emerald-500 animate-spin' : 'text-slate-400'} />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
            {currentSpeed} <span className="text-xs font-sans font-bold text-slate-500">KM/H</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            {isTracking ? `Trip: ${tripDistanceKm} KM (${elapsedTimeFormatted})` : 'GPS Tracking Paused'}
          </div>
        </div>
        <div className="pt-1 border-t border-[#E8DCCB]/60">
          <button
            type="button"
            onClick={onToggleGps}
            className={`w-full py-0.5 text-[9px] font-black rounded-md border cursor-pointer transition-all text-center ${
              isTracking
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {isTracking ? 'Stop Broadcast' : 'Start Broadcast'}
          </button>
        </div>
      </div>
    </div>
  );
}

