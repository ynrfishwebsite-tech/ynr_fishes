import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Navigation,
  Truck,
  Gauge,
  MapPin,
  Radio,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  Power,
  RotateCcw,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { getVehicles, sendLiveLocation, logTrip } from '../api/operations/vehicle';
import io from 'socket.io-client';

export default function DriverGpsPortal() {
  const [searchParams] = useSearchParams();
  const initialPlate = searchParams.get('v') || searchParams.get('vehicle') || '';

  const [vehicles, setVehicles] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState(initialPlate);
  const [currentVehicle, setCurrentVehicle] = useState(null);

  // Tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [tripDistanceKm, setTripDistanceKm] = useState(0);
  const [lastCoords, setLastCoords] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [trackingStartTime, setTrackingStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to start delivery tracking');
  const [errorMsg, setErrorMsg] = useState('');

  const watchIdRef = useRef(null);
  const socketRef = useRef(null);
  const prevPositionRef = useRef(null);
  const timerRef = useRef(null);

  // Haversine formula to compute distance in KM between 2 lat/lng points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in KM
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fetch available vehicles on load
  useEffect(() => {
    const fetchFleet = async () => {
      try {
        const list = await getVehicles();
        setVehicles(list || []);
        if (initialPlate) {
          const match = list.find(
            (v) => v.vehicleNumber.toUpperCase() === initialPlate.toUpperCase()
          );
          if (match) {
            setSelectedPlate(match.vehicleNumber);
            setCurrentVehicle(match);
          }
        } else if (list.length > 0) {
          setSelectedPlate(list[0].vehicleNumber);
          setCurrentVehicle(list[0]);
        }
      } catch (e) {
        console.warn('Failed to load vehicles:', e);
      }
    };
    fetchFleet();

    // Connect socket for low-latency updates
    const backendHost = window.location.hostname;
    socketRef.current = io(`http://${backendHost}:5000`, { transports: ['websocket', 'polling'] });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [initialPlate]);

  // Handle vehicle selection
  const handleSelectVehicle = (plate) => {
    setSelectedPlate(plate);
    const match = vehicles.find((v) => v.vehicleNumber === plate);
    setCurrentVehicle(match || null);
  };

  // Timer for active trip
  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTracking]);

  // Format elapsed time (HH:MM:SS)
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Start GPS Tracking
  const startTracking = () => {
    if (!selectedPlate) {
      setErrorMsg('Please select your vehicle number first.');
      return;
    }

    if (!('geolocation' in navigator)) {
      setErrorMsg('GPS Geolocation is not supported by this browser.');
      return;
    }

    setErrorMsg('');
    setStatusMessage('Acquiring high-accuracy GPS signal...');
    setIsTracking(true);
    setTrackingStartTime(new Date());
    setElapsedSeconds(0);
    setTripDistanceKm(0);
    prevPositionRef.current = null;

    // Use watchPosition for continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        const currentCoord = { lat: latitude, lng: longitude };
        setLastCoords(currentCoord);
        setGpsAccuracy(Math.round(accuracy));

        // Speed in KM/H (speed from coords is m/s)
        const speedKmh = speed && speed > 0 ? Math.round(speed * 3.6) : 0;
        setCurrentSpeed(speedKmh);

        // Accumulate distance
        if (prevPositionRef.current) {
          const deltaKm = calculateDistance(
            prevPositionRef.current.lat,
            prevPositionRef.current.lng,
            latitude,
            longitude
          );
          // Filter out GPS drift (less than 10 meters)
          if (deltaKm > 0.01) {
            setTripDistanceKm((prev) => Math.round((prev + deltaKm) * 100) / 100);
            prevPositionRef.current = currentCoord;
          }
        } else {
          prevPositionRef.current = currentCoord;
        }

        setStatusMessage('GPS Tracking Active • Broadcasting live location');

        // Broadcast to backend
        const payload = {
          vehicleNumber: selectedPlate,
          lat: latitude,
          lng: longitude,
          speed: speedKmh,
          heading: heading || 0,
          accuracy: Math.round(accuracy),
          isTrackingActive: true
        };

        // HTTP fallback
        sendLiveLocation(payload).catch(() => {});

        // Socket stream
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('vehicle:send_location', payload);
        }
      },
      (err) => {
        console.error('GPS Error:', err);
        setErrorMsg(`GPS Error: ${err.message}. Please enable Location/GPS in phone settings.`);
        setStatusMessage('GPS Signal Lost');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Stop GPS Tracking
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setCurrentSpeed(0);
    setStatusMessage('Delivery trip ended • GPS Stopped');

    // Notify backend tracking is stopped
    if (selectedPlate && lastCoords) {
      sendLiveLocation({
        vehicleNumber: selectedPlate,
        lat: lastCoords.lat,
        lng: lastCoords.lng,
        speed: 0,
        isTrackingActive: false
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Top Mobile Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-600 text-white shadow-md">
            <Truck size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">YNR Fishes</h1>
            <p className="text-[11px] text-slate-400">Driver Live GPS Portal</p>
          </div>
        </div>

        {isTracking ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold animate-pulse">
            <Radio size={14} /> LIVE GPS ON
          </div>
        ) : (
          <div className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-xs font-semibold">
            Standby
          </div>
        )}
      </div>

      <div className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-between">
        {/* Vehicle Selection Card */}
        <div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg mb-4">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Assigned Vehicle
            </label>
            <select
              disabled={isTracking}
              value={selectedPlate}
              onChange={(e) => handleSelectVehicle(e.target.value)}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl font-mono font-bold text-lg text-amber-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-75"
            >
              {vehicles.map((v) => (
                <option key={v._id} value={v.vehicleNumber}>
                  {v.vehicleNumber} — {v.modelName}
                </option>
              ))}
            </select>

            {currentVehicle && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Driver: <strong className="text-white">{currentVehicle.driverName || 'Self'}</strong></span>
                <span>Type: <strong className="text-white">{currentVehicle.vehicleType}</strong></span>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Speed & Distance Display */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Speedometer */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                <Gauge size={14} className="text-orange-500" /> Current Speed
              </div>
              <div className="text-4xl font-black font-mono mt-2 text-white">
                {currentSpeed}
                <span className="text-xs font-normal text-slate-500 ml-1">KM/H</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Real-time GPS Speed</div>
            </div>

            {/* Trip Distance */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                <Navigation size={14} className="text-blue-500" /> Trip Distance
              </div>
              <div className="text-4xl font-black font-mono mt-2 text-blue-400">
                {tripDistanceKm}
                <span className="text-xs font-normal text-slate-500 ml-1">KM</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Time: {formatTime(elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* Live Coordinates Pill */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 text-xs text-slate-400 space-y-1 mb-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-emerald-400" /> GPS Coordinates:
              </span>
              <span className="font-mono text-slate-300">
                {lastCoords ? `${lastCoords.lat.toFixed(5)}°, ${lastCoords.lng.toFixed(5)}°` : 'Searching...'}
              </span>
            </div>
            {gpsAccuracy && (
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>GPS Precision:</span>
                <span className="text-emerald-400">±{gpsAccuracy} meters</span>
              </div>
            )}
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{statusMessage}</span>
            </div>
          </div>
        </div>

        {/* Big Start / Stop Button */}
        <div className="my-6">
          {!isTracking ? (
            <button
              onClick={startTracking}
              className="w-full py-5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-95 text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-green-950/50 flex items-center justify-center gap-3 transition-all tracking-wide"
            >
              <Power size={24} />
              <span>START DELIVERY TRIP</span>
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="w-full py-5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-extrabold text-xl rounded-2xl shadow-xl shadow-red-950/50 flex items-center justify-center gap-3 transition-all tracking-wide"
            >
              <Power size={24} />
              <span>END TRIP / STOP GPS</span>
            </button>
          )}

          <p className="text-[11px] text-center text-slate-500 mt-3">
            Keep this screen open or in background while driving so location syncs to depot dispatch.
          </p>
        </div>

        {/* Footer Support Section */}
        <div className="pt-4 border-t border-slate-800/80 text-center">
          <a
            href="tel:9849313889"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
          >
            <PhoneCall size={14} className="text-orange-500" />
            <span>Kadapa Fish Depot Helpline: 9849313889</span>
          </a>
        </div>
      </div>
    </div>
  );
}

