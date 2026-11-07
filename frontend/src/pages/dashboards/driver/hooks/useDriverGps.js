import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { sendLiveLocation } from '../../../../api/operations/vehicle';
import { getSocketUrl } from '../../../../config';

export function useDriverGps(assignedVehicle) {
  const plate = assignedVehicle?.vehicleNumber || '';
  const storageKey = plate ? `ynr_gps_active_${plate}` : 'ynr_gps_active';
  const startKey = plate ? `ynr_gps_start_${plate}` : 'ynr_gps_start';
  const distKey = plate ? `ynr_gps_dist_${plate}` : 'ynr_gps_dist';
  const trailKey = plate ? `ynr_gps_trail_${plate}` : 'ynr_gps_trail';

  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [lastCoords, setLastCoords] = useState(null);
  const [routeTrail, setRouteTrail] = useState([]);
  const [tripDistanceKm, setTripDistanceKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const prevCoordsRef = useRef(null);
  const lastRestTimeRef = useRef(0);
  const socketRef = useRef(null);
  const isRestoredRef = useRef(false);

  // Calculate distance between two lat/lng coordinates in KM (Haversine formula)
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

  // 1. Restore tracking state on page refresh or component mount
  useEffect(() => {
    if (!plate || isRestoredRef.current) return;

    const savedActive = localStorage.getItem(storageKey) === 'true' ||
      Boolean(assignedVehicle?.lastKnownLocation?.isTrackingActive) ||
      assignedVehicle?.status === 'On Trip';

    if (savedActive) {
      setIsTracking(true);

      const savedStart = Number(localStorage.getItem(startKey));
      if (savedStart && !isNaN(savedStart)) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - savedStart) / 1000)));
      } else {
        localStorage.setItem(startKey, Date.now().toString());
      }

      const savedDist = Number(localStorage.getItem(distKey));
      if (savedDist && !isNaN(savedDist)) {
        setTripDistanceKm(savedDist);
      }

      try {
        const savedTrail = JSON.parse(localStorage.getItem(trailKey) || '[]');
        if (Array.isArray(savedTrail) && savedTrail.length > 0) {
          setRouteTrail(savedTrail);
          prevCoordsRef.current = savedTrail[savedTrail.length - 1];
        }
      } catch (_) {}

      if (assignedVehicle?.lastKnownLocation?.lat && assignedVehicle?.lastKnownLocation?.lng) {
        setLastCoords({
          lat: assignedVehicle.lastKnownLocation.lat,
          lng: assignedVehicle.lastKnownLocation.lng
        });
      }
    }

    isRestoredRef.current = true;
  }, [plate, assignedVehicle]);

  // 2. Realtime Socket Connection
  useEffect(() => {
    try {
      const socketUrl = getSocketUrl();
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsSocketConnected(true);
      });

      socket.on('disconnect', () => {
        setIsSocketConnected(false);
      });

      return () => {
        if (socket) socket.disconnect();
      };
    } catch (e) {
      console.warn('[useDriverGps] Socket initialization warning:', e.message);
    }
  }, []);

  // 3. Geolocation Tracking Loop
  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, speed, accuracy, heading: posHeading } = pos.coords;
            const spdKm = speed ? Math.round(speed * 3.6) : 0;
            const hdg = posHeading !== null && !isNaN(posHeading) ? Math.round(posHeading) : 0;
            const acc = Math.round(accuracy || 0);

            setCurrentSpeed(spdKm);
            setHeading(hdg);
            setGpsAccuracy(acc);
            setLastCoords({ lat: latitude, lng: longitude });

            // Append to route trail & persist to localStorage
            setRouteTrail((prev) => {
              const last = prev[prev.length - 1];
              if (!last) {
                const initTrail = [{ lat: latitude, lng: longitude }];
                localStorage.setItem(trailKey, JSON.stringify(initTrail));
                return initTrail;
              }
              const distMeters = calculateDistance(last.lat, last.lng, latitude, longitude) * 1000;
              if (distMeters >= 5) {
                const nextTrail = [...prev.slice(-300), { lat: latitude, lng: longitude }];
                try {
                  localStorage.setItem(trailKey, JSON.stringify(nextTrail));
                } catch (_) {}
                return nextTrail;
              }
              return prev;
            });

            // Distance calculation
            if (prevCoordsRef.current) {
              const d = calculateDistance(
                prevCoordsRef.current.lat,
                prevCoordsRef.current.lng,
                latitude,
                longitude
              );
              if (d > 0.01) {
                setTripDistanceKm((prev) => {
                  const updated = Number((prev + d).toFixed(2));
                  localStorage.setItem(distKey, updated.toString());
                  return updated;
                });
                prevCoordsRef.current = { lat: latitude, lng: longitude };
              }
            } else {
              prevCoordsRef.current = { lat: latitude, lng: longitude };
            }

            const payload = {
              vehicleNumber: plate,
              lat: latitude,
              lng: longitude,
              latitude,
              longitude,
              speed: spdKm,
              heading: hdg,
              accuracy: acc,
              isTrackingActive: true,
              status: 'On Trip',
              driverName: assignedVehicle?.driverName || 'Driver'
            };

            // 1. Instant WebSocket broadcast (< 50ms) to depot command center
            if (socketRef.current && socketRef.current.connected && plate) {
              socketRef.current.emit('vehicle:send_location', payload);
            }

            // 2. Throttled REST persistence to MongoDB (every 4 seconds)
            const now = Date.now();
            if (now - lastRestTimeRef.current >= 4000 && plate) {
              lastRestTimeRef.current = now;
              sendLiveLocation(payload).catch(() => {});
            }
          },
          (err) => {
            console.warn('[useDriverGps] Geolocation watch warning:', err.message);
          },
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
        );
      }
    } else {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, plate, assignedVehicle, storageKey, startKey, distKey, trailKey]);

  // Toggle GPS Broadcast with full persistence and instant alert notifications
  const toggleGps = () => {
    if (!isTracking) {
      const now = Date.now();
      setTripDistanceKm(0);
      setElapsedSeconds(0);
      setRouteTrail([]);
      prevCoordsRef.current = null;
      lastRestTimeRef.current = 0;

      // Persist broadcast active state in localStorage so page refresh never erases it
      localStorage.setItem(storageKey, 'true');
      localStorage.setItem(startKey, now.toString());
      localStorage.setItem(distKey, '0');
      localStorage.removeItem(trailKey);

      setIsTracking(true);

      // Broadcast start alert notification to Admin
      if (socketRef.current && socketRef.current.connected && plate) {
        const notif = {
          id: `gps_start_${plate}_${now}`,
          title: '🚚 Live GPS Broadcast Started',
          message: `Driver ${assignedVehicle?.driverName || 'Venkatesh Naidu'} started live delivery broadcast for ${plate} (${assignedVehicle?.modelName || 'Reefer Van'})`,
          type: 'info',
          category: 'system',
          timestamp: new Date().toISOString()
        };
        socketRef.current.emit('clientNotification', notif);
      }
    } else {
      setIsTracking(false);
      setCurrentSpeed(0);

      // Wipe persisted broadcast state
      localStorage.removeItem(storageKey);
      localStorage.removeItem(startKey);
      localStorage.removeItem(distKey);
      localStorage.removeItem(trailKey);

      const stopPayload = {
        vehicleNumber: plate,
        lat: lastCoords?.lat || 14.47505,
        lng: lastCoords?.lng || 78.83728,
        speed: 0,
        isTrackingActive: false,
        status: 'Available'
      };

      if (socketRef.current && socketRef.current.connected && plate) {
        socketRef.current.emit('vehicle:send_location', stopPayload);

        // Broadcast stop alert notification to Admin
        const notif = {
          id: `gps_stop_${plate}_${Date.now()}`,
          title: '🏁 Live Delivery Broadcast Ended',
          message: `Driver ${assignedVehicle?.driverName || 'Venkatesh Naidu'} stopped GPS broadcast for ${plate}`,
          type: 'info',
          category: 'system',
          timestamp: new Date().toISOString()
        };
        socketRef.current.emit('clientNotification', notif);
      }

      if (plate) {
        sendLiveLocation(stopPayload).catch(() => {});
      }
    }
  };

  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return {
    isTracking,
    toggleGps,
    currentSpeed,
    heading,
    gpsAccuracy,
    lastCoords,
    routeTrail,
    tripDistanceKm,
    elapsedSeconds,
    formattedTime: formatTimer(elapsedSeconds),
    isSocketConnected
  };
}
