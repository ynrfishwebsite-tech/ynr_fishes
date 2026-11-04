import React, { useState, useEffect } from 'react';
import { 
  Truck, Navigation, Phone, MapPin, CheckCircle2, Clock, 
  Package, Calendar, RefreshCw, AlertCircle, ExternalLink, ShieldCheck, User 
} from 'lucide-react';
import BackButton from '../common/BackButton';
import { useLanguage } from '../../../context/LanguageContext';
import { getTrips } from '../../../api/operations/vehicle';
import axios from 'axios';
import { getApiUrl } from '../../../config.js';

export default function DriverPortal({ user, onGoBack }) {
  const { t } = useLanguage();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchDriverTrips = async () => {
    try {
      setLoading(true);
      const res = await getTrips();
      if (res && Array.isArray(res.data)) {
        setTrips(res.data);
      }
    } catch (err) {
      console.error('Failed to load driver trips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverTrips();
  }, []);

  const handleMarkDelivered = async (tripId) => {
    try {
      setUpdatingId(tripId);
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      await axios.patch(
        `${getApiUrl()}/vehicles/trips/${tripId}/status`,
        { status: 'Delivered' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTrips(prev => prev.map(t => t._id === tripId ? { ...t, status: 'Delivered' } : t));
    } catch (err) {
      setTrips(prev => prev.map(t => t._id === tripId ? { ...t, status: 'Delivered' } : t));
    } finally {
      setUpdatingId(null);
    }
  };

  const driverDisplayName = user?.name || user?.username || 'Fleet Driver';

  return (
    <div className="h-full flex flex-col bg-[#F7EFE2] text-slate-800 overflow-y-auto">
      {/* Compact Responsive Driver Header */}
      <div className="py-2.5 px-3 sm:py-3.5 sm:px-5 border-b border-[#E8DCCB] bg-[#FDFBF7] sticky top-0 z-10 shadow-xs flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onGoBack && <BackButton onClick={onGoBack} className="px-2.5 py-1 text-xs shrink-0 rounded-lg sm:rounded-xl" />}
          
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-orange-100 border border-orange-200 text-[#ea580c] flex items-center justify-center shadow-xs shrink-0">
            <Truck size={17} className="sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap leading-tight">
              <span>{t("Driver Delivery Portal")}</span>
              <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full border border-blue-200">
                {t("View-Only")}
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-none mt-0.5">
              {t("Welcome,")} <strong className="text-slate-800">{driverDisplayName}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={fetchDriverTrips}
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#FAF0E4] border border-[#E8DCCB] text-[#7c3f1d] hover:bg-[#FDFBF7] transition-all cursor-pointer shadow-xs shrink-0"
          title={t("Refresh Trips")}
        >
          <RefreshCw size={14} className={`sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Trips Feed (Full Screen Width, Compact Responsive) */}
      <div className="p-2.5 sm:p-6 w-full space-y-2.5 sm:space-y-4">
        {/* Compact Read-Only Notice */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex items-start gap-2 text-sky-900 shadow-2xs text-[11px] sm:text-xs">
          <ShieldCheck size={16} className="text-sky-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong className="font-bold">{t("Driver Read-Only Access")}</strong>
            <p className="text-[10px] sm:text-[11px] text-sky-700 mt-0.5">
              {t("You can view assigned destinations, customer contacts, and loaded box counts. Financial billing details are restricted.")}
            </p>
          </div>
        </div>

        {loading && trips.length === 0 ? (
          <div className="py-10 sm:py-16 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#ea580c] mb-2 sm:w-7 sm:h-7" />
            <p className="text-xs font-bold">{t("Loading assigned deliveries...")}</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="py-8 px-4 sm:py-14 sm:px-6 text-center bg-white rounded-2xl sm:rounded-3xl border border-[#E8DCCB] shadow-xs w-full">
            <Truck size={28} className="mx-auto text-slate-300 mb-1.5 sm:w-9 sm:h-9" />
            <h3 className="text-xs sm:text-sm font-black text-slate-800">{t("No Deliveries Assigned")}</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 max-w-xs mx-auto">
              {t("You currently have no active trips assigned. When an export order is assigned to your vehicle, it will appear here.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-4">
            {trips.map((trip) => {
              const isDelivered = trip.status === 'Delivered';
              const exportBadgeColor = trip.exportType === 'DAM' 
                ? 'bg-sky-100 text-sky-800 border-sky-300' 
                : 'bg-purple-100 text-purple-800 border-purple-300';

              return (
                <div 
                  key={trip._id} 
                  className={`bg-white rounded-2xl sm:rounded-3xl border p-2.5 sm:p-4 shadow-xs space-y-2 sm:space-y-3 transition-all ${
                    isDelivered ? 'border-emerald-200 bg-emerald-50/20' : 'border-[#E8DCCB] hover:shadow-md'
                  }`}
                >
                  {/* Plate + Date + Consignment Type */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black bg-amber-400 text-slate-900 px-2 py-0.5 rounded-md sm:rounded-lg border border-slate-900 text-[10px] sm:text-xs shadow-xs">
                        {trip.vehicleNumber}
                      </span>
                      <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 py-0.2 rounded-full border ${exportBadgeColor}`}>
                        {trip.exportType === 'DAM' ? t("Export - DAM") : t("Export - Local")}
                      </span>
                    </div>

                    <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      isDelivered 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    }`}>
                      {trip.status || t("On-Road")}
                    </span>
                  </div>

                  {/* Destination & Customer Block */}
                  <div className="bg-[#FAF0E4] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#E8DCCB] space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div>
                        <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">{t("Destination / Customer")}</div>
                        <div className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                          {trip.customerName || trip.routeTo || t("Kadapa Depot Delivery")}
                        </div>
                      </div>

                      {trip.boxesCount > 0 && (
                        <div className="px-2 py-0.5 bg-white border border-[#E8DCCB] rounded-lg sm:rounded-xl text-center shadow-2xs shrink-0">
                          <div className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase">{t("Cargo")}</div>
                          <div className="text-[11px] sm:text-xs font-black text-[#ea580c]">{trip.boxesCount} {t("Boxes")}</div>
                        </div>
                      )}
                    </div>

                    {/* Address preview */}
                    {(trip.customerAddress || trip.routeTo) && (
                      <div className="flex items-start gap-1 text-[11px] sm:text-xs text-slate-700 pt-1 border-t border-[#E8DCCB]/60">
                        <MapPin size={12} className="text-[#ea580c] shrink-0 mt-0.5" />
                        <span className="font-medium truncate">{trip.customerAddress || trip.routeTo}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Action Buttons: Call Customer & Navigate */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    {trip.customerPhone ? (
                      <a
                        href={`tel:${trip.customerPhone}`}
                        className="py-1.5 px-2.5 sm:py-2.5 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all text-center"
                      >
                        <Phone size={12} />
                        <span>{t("Call Dealer")}</span>
                      </a>
                    ) : (
                      <div className="py-1.5 px-2.5 sm:py-2.5 sm:px-3 bg-slate-100 text-slate-400 font-medium text-[11px] sm:text-xs rounded-lg sm:rounded-xl text-center">
                        {t("No Phone")}
                      </div>
                    )}

                    {(trip.customerAddress || trip.routeTo) ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.customerAddress || trip.routeTo)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 sm:py-2.5 sm:px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all text-center"
                      >
                        <Navigation size={12} />
                        <span>{t("Maps")}</span>
                      </a>
                    ) : (
                      <div className="py-1.5 px-2.5 sm:py-2.5 sm:px-3 bg-slate-100 text-slate-400 font-medium text-[11px] sm:text-xs rounded-lg sm:rounded-xl text-center">
                        {t("No Address")}
                      </div>
                    )}
                  </div>

                  {/* Status Toggle Button */}
                  {!isDelivered && (
                    <button
                      type="button"
                      onClick={() => handleMarkDelivered(trip._id)}
                      disabled={updatingId === trip._id}
                      className="w-full py-1.5 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                    >
                      <CheckCircle2 size={13} />
                      <span>{updatingId === trip._id ? t("Updating...") : t("Mark Delivered")}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
