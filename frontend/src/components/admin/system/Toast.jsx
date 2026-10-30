import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose, duration = 1000 }) => {
  const [touchStartX, setTouchStartX] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (duration && !isDismissing) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timerRef.current);
    }
  }, [duration, isDismissing]);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onClose?.();
    }, 150);
  };

  // Mobile swipe left/right to dismiss
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (touchStartX === null) return;
    const diff = e.touches[0].clientX - touchStartX;
    setSwipeOffset(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeOffset) > 60) {
      // Swiped enough (left or right) to wipe away
      setIsDismissing(true);
      setTimeout(() => {
        onClose?.();
      }, 120);
    } else {
      // Reset position if swipe was tiny
      setSwipeOffset(0);
    }
    setTouchStartX(null);
  };

  const icons = {
    success: <CheckCircle size={20} className="text-white shrink-0" />,
    error: <AlertCircle size={20} className="text-white shrink-0" />,
    warning: <AlertTriangle size={20} className="text-white shrink-0" />,
    info: <Info size={20} className="text-white shrink-0" />
  };

  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    warning: 'bg-amber-600',
    info: 'bg-blue-600'
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000002] w-[calc(100%-2rem)] max-w-md pointer-events-none print:hidden select-none">
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${swipeOffset}px) scale(${isDismissing ? 0.9 : 1})`,
          opacity: isDismissing ? 0 : Math.max(0.2, 1 - Math.abs(swipeOffset) / 200),
          transition: touchStartX === null ? 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
        }}
        className={`${bgColors[type] || 'bg-amber-600'} text-white px-5 py-3.5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/20 flex items-center gap-3 pointer-events-auto cursor-grab active:cursor-grabbing animate-in slide-in-from-bottom-4 fade-in duration-150 touch-pan-x`}
      >
        {icons[type] || icons.warning}
        <p className="font-bold text-sm flex-1 leading-snug">{message}</p>
        <button onClick={handleDismiss} className="hover:bg-white/20 rounded-full p-1 transition-colors shrink-0 cursor-pointer">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
