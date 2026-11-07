import React, { useState, useMemo } from 'react';
import {
  Truck, Phone, Navigation, MapPin, CheckCircle2, Plus,
  Search, RefreshCw
} from 'lucide-react';

export default function DriverTripsTab({
  trips,
  loading,
  assignedVehicle,
  onOpenLogTrip,
  onOpenCompleteTrip
}) {
  const [tripFilter, setTripFilter] = useState('All'); // 'All' | 'On-Road' | 'Scheduled' | 'Delivered'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      if (tripFilter === 'On-Road' && trip.status !== 'On-Road') return false;
      if (tripFilter === 'Scheduled' && trip.status !== 'Scheduled') return false;
      if (tripFilter === 'Delivered' && trip.status !== 'Delivered' && trip.status !== 'Completed') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dest = (trip.customerName || trip.routeTo || '').toLowerCase();
        const addr = (trip.customerAddress || '').toLowerCase();
        const phone = (trip.customerPhone || '').toLowerCase();
        const plate = (trip.vehicleNumber || '').toLowerCase();
        return dest.includes(q) || addr.includes(q) || phone.includes(q) || plate.includes(q);
      }
      return true;
    });
  }, [trips, tripFilter, searchQuery]);

  return (
    <div className="space-y-2.5 w-full">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap w-full">
        <div className="flex items-center gap-1">
          {['All', 'On-Road', 'Scheduled', 'Delivered'].map((filter) => (
            <button
              key={filter}
              onClick={() => setTripFilter(filter)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tripFilter === filter
                  ? 'bg-[#ea580c] text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              {filter === 'All' ? 'All Deliveries' : filter}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[180px] flex-1 sm:flex-initial">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, route, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Trips Feed */}
      {loading && trips.length === 0 ? (
        <div className="py-12 text-center text-slate-400 w-full">
          <RefreshCw size={22} className="animate-spin mx-auto text-[#ea580c] mb-2" />
          <p className="text-xs font-bold">Loading assigned deliveries...</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="py-8 px-4 text-center bg-white rounded-xl border border-[#E8DCCB] shadow-2xs w-full">
          <Truck size={28} className="mx-auto text-slate-300 mb-1.5" />
          <h3 className="text-xs sm:text-sm font-black text-slate-800">No Dispatches Found</h3>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
            {searchQuery || tripFilter !== 'All'
              ? 'No trips matched your active filter or search criteria.'
              : 'You currently have no active deliveries assigned. When an export order is scheduled, it will appear here.'}
          </p>
          <button
            onClick={onOpenLogTrip}
            className="mt-2.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus size={13} />
            <span>Log Delivery Manually</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
          {filteredTrips.map((trip) => {
            const isDelivered = trip.status === 'Delivered' || trip.status === 'Completed';
            const exportBadgeColor = trip.exportType === 'DAM'
              ? 'bg-sky-100 text-sky-800 border-sky-300'
              : 'bg-purple-100 text-purple-800 border-purple-300';

            return (
              <div
                key={trip._id}
                className={`bg-white rounded-xl border p-3 shadow-2xs space-y-2.5 transition-all flex flex-col justify-between ${
                  isDelivered ? 'border-emerald-200 bg-emerald-50/15' : 'border-[#E8DCCB] hover:shadow-md'
                }`}
              >
                {/* Header: Plate, Mode, Status */}
                <div>
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black bg-amber-400 text-slate-900 px-2 py-0.5 rounded-md border border-slate-900 text-[10px] shadow-2xs">
                        {trip.vehicleNumber}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${exportBadgeColor}`}>
                        {trip.exportType === 'DAM' ? 'DAM Export' : 'Local Catch'}
                      </span>
                    </div>

                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                      isDelivered
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    }`}>
                      {trip.status || 'On-Road'}
                    </span>
                  </div>

                  {/* Customer & Route Box */}
                  <div className="bg-[#FAF0E4] p-2.5 rounded-lg border border-[#E8DCCB] space-y-1.5 mt-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Customer / Destination
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900 leading-snug truncate">
                          {trip.customerName || trip.routeTo || 'Kadapa Depot Delivery'}
                        </div>
                      </div>

                      {trip.boxesCount > 0 && (
                        <div className="px-1.5 py-0.5 bg-white border border-[#E8DCCB] rounded-md text-center shadow-2xs shrink-0">
                          <div className="text-[8px] font-bold text-slate-400 uppercase">Cargo</div>
                          <div className="text-[11px] font-black text-[#ea580c]">{trip.boxesCount} Boxes</div>
                        </div>
                      )}
                    </div>

                    {/* Address preview */}
                    {(trip.customerAddress || trip.routeTo) && (
                      <div className="flex items-start gap-1 text-[11px] text-slate-700 pt-1 border-t border-[#E8DCCB]/60">
                        <MapPin size={11} className="text-[#ea580c] shrink-0 mt-0.5" />
                        <span className="font-medium truncate">{trip.customerAddress || trip.routeTo}</span>
                      </div>
                    )}

                    {/* Odometer info */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-[#E8DCCB]/60">
                      <span>Start: {trip.startKm} KM</span>
                      {trip.endKm > trip.startKm && <span>End: {trip.endKm} KM</span>}
                      {trip.distanceKm > 0 && <span className="font-bold text-slate-800">+{trip.distanceKm} KM</span>}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {trip.customerPhone ? (
                      <a
                        href={`tel:${trip.customerPhone}`}
                        className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all text-center"
                      >
                        <Phone size={12} />
                        <span>Call Dealer</span>
                      </a>
                    ) : (
                      <div className="py-1.5 px-2 bg-slate-100 text-slate-400 font-medium text-xs rounded-lg text-center">
                        No Phone
                      </div>
                    )}

                    {(trip.customerAddress || trip.routeTo) ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.customerAddress || trip.routeTo)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all text-center"
                      >
                        <Navigation size={12} />
                        <span>Maps Nav</span>
                      </a>
                    ) : (
                      <div className="py-1.5 px-2 bg-slate-100 text-slate-400 font-medium text-xs rounded-lg text-center">
                        No Address
                      </div>
                    )}
                  </div>

                  {!isDelivered ? (
                    <button
                      type="button"
                      onClick={() => onOpenCompleteTrip(trip)}
                      className="w-full py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                    >
                      <CheckCircle2 size={13} />
                      <span>Mark Delivered & Complete</span>
                    </button>
                  ) : (
                    <div className="py-1 text-center text-[10px] font-black text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                      ✓ Delivery Completed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

