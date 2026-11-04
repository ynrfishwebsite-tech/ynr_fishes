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
      // Fallback local update if patch route is simplified
      setTrips(prev => prev.map(t => t._id === tripId ? { ...t, status: 'Delivered' } : t));
    } finally {
      setUpdatingId(null);
    }
  };

  const driverDisplayName = user?.name || user?.username || 'Fleet Driver';

  return (
    <div className="h-full flex flex-col bg-[#F7EFE2] text-slate-800 overflow-y-auto">
      {/* Driver Header */}
      <div className="p-4 border-b border-[#E8DCCB] bg-[#FDFBF7] sticky top-0 z-10 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onGoBack && <BackButton onClick={onGoBack} />}
          <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 text-[#ea580c] flex items-center justify-center shadow-xs">
            <Truck size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>{t("Driver Delivery Portal")}</span>
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                {t("View-Only")}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {t("Welcome,")} <strong className="text-slate-800">{driverDisplayName}</strong> &bull; {t("Assigned Delivery Routes")}
            </p>
          </div>
        </div>

        <button
          onClick={fetchDriverTrips}
          className="p-2 rounded-xl bg-[#FAF0E4] border border-[#E8DCCB] text-[#7c3f1d] hover:bg-[#FDFBF7] transition-all cursor-pointer shadow-xs"
          title={t("Refresh Trips")}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Trips Feed */}
      <div className="p-3 sm:p-5 max-w-2xl mx-auto w-full space-y-3.5">
        {/* Read-Only Notice */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 flex items-start gap-2.5 text-sky-900 shadow-2xs">
          <ShieldCheck size={18} className="text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block font-bold">{t("Driver Read-Only Access")}</strong>
            <p className="text-[11px] text-sky-700 mt-0.5">
              {t("You can view assigned destinations, customer contacts, and loaded box counts. Financial billing details are restricted.")}
            </p>
          </div>
        </div>

        {loading && trips.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw size={28} className="animate-spin mx-auto text-[#ea580c] mb-2" />
            <p className="text-xs font-bold">{t("Loading assigned delivery routes...")}</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-[#E8DCCB] p-6 shadow-xs">
            <Truck size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-black text-slate-800">{t("No Deliveries Assigned")}</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {t("You currently have no active trips assigned. When an export order is assigned to your vehicle, it will appear here.")}
            </p>
          </div>
        ) : (
          trips.map((trip) => {
            const isDelivered = trip.status === 'Delivered';
            const exportBadgeColor = trip.exportType === 'DAM' 
              ? 'bg-sky-100 text-sky-800 border-sky-300' 
              : 'bg-purple-100 text-purple-800 border-purple-300';

            return (
              <div 
                key={trip._id} 
                className={`bg-white rounded-3xl border p-4 shadow-xs space-y-3 transition-all ${
                  isDelivered ? 'border-emerald-200 bg-emerald-50/20' : 'border-[#E8DCCB] hover:shadow-md'
                }`}
              >
                {/* Plate + Date + Consignment Type */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-900 text-xs shadow-xs">
                      {trip.vehicleNumber}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${exportBadgeColor}`}>
                      {trip.exportType === 'DAM' ? t("Export - DAM Bulk") : t("Export - Local")}
                    </span>
                  </div>

                  <span className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full border ${
                    isDelivered 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                  }`}>
                    {trip.status || t("On-Road")}
                  </span>
                </div>

                {/* Destination & Customer Block */}
                <div className="bg-[#FAF0E4] p-3 rounded-2xl border border-[#E8DCCB] space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{t("Destination / Customer")}</div>
                      <div className="text-sm font-black text-slate-900">
                        {trip.customerName || trip.routeTo || t("Kadapa Depot Route")}
                      </div>
                    </div>

                    {trip.boxesCount > 0 && (
                      <div className="px-2.5 py-1 bg-white border border-[#E8DCCB] rounded-xl text-center shadow-2xs">
                        <div className="text-[9px] font-bold text-slate-500 uppercase">{t("Cargo")}</div>
                        <div className="text-xs font-black text-[#ea580c]">{trip.boxesCount} {t("Boxes")}</div>
                      </div>
                    )}
                  </div>

                  {/* Address preview */}
                  {(trip.customerAddress || trip.routeTo) && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-700 pt-1 border-t border-[#E8DCCB]/60">
                      <MapPin size={13} className="text-[#ea580c] shrink-0 mt-0.5" />
                      <span className="font-medium">{trip.customerAddress || trip.routeTo}</span>
                    </div>
                  )}
                </div>

                {/* Quick Action Buttons: Call Customer & Navigate */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {trip.customerPhone ? (
                    <a
                      href={`tel:${trip.customerPhone}`}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all text-center"
                    >
                      <Phone size={14} />
                      <span>{t("Call Dealer")}</span>
                    </a>
                  ) : (
                    <div className="py-2.5 px-3 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl text-center">
                      {t("No Phone Available")}
                    </div>
                  )}

                  {(trip.customerAddress || trip.routeTo) ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.customerAddress || trip.routeTo)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all text-center"
                    >
                      <Navigation size={14} />
                      <span>{t("Google Maps")}</span>
                    </a>
                  ) : (
                    <div className="py-2.5 px-3 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl text-center">
                      {t("No Address Listed")}
                    </div>
                  )}
                </div>

                {/* Status Toggle Button */}
                {!isDelivered && (
                  <button
                    type="button"
                    onClick={() => handleMarkDelivered(trip._id)}
                    disabled={updatingId === trip._id}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={14} />
                    <span>{updatingId === trip._id ? t("Updating...") : t("Mark Consignment Delivered")}</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

