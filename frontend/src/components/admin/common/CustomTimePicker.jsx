import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';

const CustomTimePicker = ({ value, onChange, label, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [clockMode, setClockMode] = useState('hour'); // 'hour' | 'minute'

  // Parse 24h "HH:MM" → { hour, minute, ampm }
  const parse24h = (str) => {
    if (!str) return { hour: '10', minute: '00', ampm: 'AM' };
    const [hRaw, mRaw] = str.split(':');
    let h = parseInt(hRaw, 10) || 0;
    const m = mRaw ? mRaw.padStart(2, '0') : '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return { hour: String(h).padStart(2, '0'), minute: m, ampm };
  };

  const [time, setTime] = useState(() => parse24h(value));

  useEffect(() => {
    setTime(parse24h(value));
  }, [value]);

  const emit = (t) => {
    let h = parseInt(t.hour, 10);
    if (t.ampm === 'PM' && h !== 12) h += 12;
    if (t.ampm === 'AM' && h === 12) h = 0;
    const formatted = `${String(h).padStart(2, '0')}:${t.minute}`;
    if (onChange) onChange(formatted);
  };

  const update = (newT) => {
    setTime(newT);
    emit(newT);
  };

  // ── Dial geometry ──
  const CENTER = 100;
  const HAND_R = 68;
  const NUM_R = 78;
  const isHour = clockMode === 'hour';
  const hourNum = parseInt(time.hour, 10);
  const minNum = parseInt(time.minute, 10);
  const hourAngle = ((hourNum % 12) / 12) * 360 - 90;
  const minAngle = (minNum / 60) * 360 - 90;
  const ang = isHour ? hourAngle : minAngle;
  const hx = CENTER + HAND_R * Math.cos((ang * Math.PI) / 180);
  const hy = CENTER + HAND_R * Math.sin((ang * Math.PI) / 180);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Pill */}
      <button
        type="button"
        onClick={() => {
          setClockMode('hour');
          setIsOpen(true);
        }}
        className="flex items-center gap-2 px-3.5 py-2 border border-[#25D366]/50 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-900 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
        title="Click to set reminder time"
      >
        <Clock size={14} className="text-[#25D366]" />
        <span className="font-mono font-black text-sm tracking-wide">
          {time.hour}:{time.minute} {time.ampm}
        </span>
      </button>

      {/* ── LIGHT CENTERED DIALOG VIA PORTAL (Zero-Scroll, Perfectly Centered on Any Screen) ── */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in select-none">
            {/* Backdrop click to close */}
            <div
              className="absolute inset-0"
              onClick={() => {
                setIsOpen(false);
                setClockMode('hour');
              }}
            />

            {/* Exact Light Theme Clock Card */}
            <div className="relative bg-white dark:bg-gray-900 border border-border dark:border-gray-700 rounded-3xl shadow-2xl p-4 sm:p-5 w-full max-w-[285px] sm:max-w-[305px] flex flex-col items-center animate-scale-up z-10">
              {/* Header */}
              <div className="w-full flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-gray-800 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl">
                    <Clock size={15} className="text-[#25D366]" />
                  </div>
                  <div>
                    <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider block leading-tight">
                      {label || 'REMINDER TIME'}
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {isHour ? 'Select Hour (1 - 12)' : 'Select Minutes (00 - 55)'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setClockMode('hour');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Time Display + AM / PM Toggle */}
              <div className="flex items-center justify-center gap-3 mb-3 w-full">
                {/* Monospace Hour & Minute Switch */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-1.5 border border-border dark:border-gray-700 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setClockMode('hour')}
                    className={`text-2xl font-black tabular-nums px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                      clockMode === 'hour'
                        ? 'bg-white dark:bg-gray-700 text-[#25D366] shadow-xs scale-105'
                        : 'text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {time.hour}
                  </button>
                  <span className="text-xl font-black text-gray-400 select-none animate-pulse">
                    :
                  </span>
                  <button
                    type="button"
                    onClick={() => setClockMode('minute')}
                    className={`text-2xl font-black tabular-nums px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                      clockMode === 'minute'
                        ? 'bg-white dark:bg-gray-700 text-[#25D366] shadow-xs scale-105'
                        : 'text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {time.minute}
                  </button>
                </div>

                {/* AM / PM Segmented Buttons */}
                <div className="flex flex-col gap-1">
                  {['AM', 'PM'].map((p) => {
                    const isActive = time.ampm === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => update({ ...time, ampm: p })}
                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#25D366] text-white shadow-xs scale-105'
                            : 'bg-gray-100 dark:bg-gray-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-gray-700'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exact Responsive SVG Clock Dial (Fits 360° on mobile & desktop without scrolling) */}
              <div className="relative w-[190px] h-[190px] sm:w-[210px] sm:h-[210px] flex items-center justify-center my-1">
                <svg viewBox="0 0 200 200" className="w-full h-full select-none">
                  {/* Outer ring */}
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r="96"
                    fill="#f9fafb"
                    stroke="#e5e7eb"
                    strokeWidth="1.5"
                  />

                  {/* 60 Minute Ticks */}
                  {Array.from({ length: 60 }, (_, i) => {
                    const a = (i / 60) * 360 - 90;
                    const r = (a * Math.PI) / 180;
                    const major = i % 5 === 0;
                    const r1 = major ? 84 : 88;
                    return (
                      <line
                        key={i}
                        x1={CENTER + r1 * Math.cos(r)}
                        y1={CENTER + r1 * Math.sin(r)}
                        x2={CENTER + 92 * Math.cos(r)}
                        y2={CENTER + 92 * Math.sin(r)}
                        stroke={major ? '#9ca3af' : '#e5e7eb'}
                        strokeWidth={major ? 1.5 : 0.8}
                      />
                    );
                  })}

                  {/* Hand */}
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={hx}
                    y2={hy}
                    stroke="#25D366"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx={hx} cy={hy} r="5" fill="#25D366" />
                  <circle cx={CENTER} cy={CENTER} r="4" fill="#25D366" />

                  {/* Hour Numbers (1 - 12) */}
                  {isHour &&
                    Array.from({ length: 12 }, (_, i) => {
                      const h = i + 1;
                      const a = (h / 12) * 360 - 90;
                      const r = (a * Math.PI) / 180;
                      const x = CENTER + NUM_R * Math.cos(r);
                      const y = CENTER + NUM_R * Math.sin(r);
                      const active = h === hourNum;
                      return (
                        <g
                          key={h}
                          onClick={() => {
                            update({ ...time, hour: String(h).padStart(2, '0') });
                            setClockMode('minute');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {active && <circle cx={x} cy={y} r="13" fill="#25D366" />}
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="13"
                            fontWeight="700"
                            fill={active ? '#fff' : '#374151'}
                            fontFamily="inherit"
                          >
                            {h}
                          </text>
                        </g>
                      );
                    })}

                  {/* Minute Markers (00 - 55) */}
                  {!isHour &&
                    Array.from({ length: 12 }, (_, i) => {
                      const m = i * 5;
                      const a = (m / 60) * 360 - 90;
                      const r = (a * Math.PI) / 180;
                      const x = CENTER + NUM_R * Math.cos(r);
                      const y = CENTER + NUM_R * Math.sin(r);
                      const active = minNum === m;
                      return (
                        <g
                          key={m}
                          onClick={() => update({ ...time, minute: String(m).padStart(2, '0') })}
                          style={{ cursor: 'pointer' }}
                        >
                          {active && <circle cx={x} cy={y} r="13" fill="#25D366" />}
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="11"
                            fontWeight="700"
                            fill={active ? '#fff' : '#374151'}
                            fontFamily="inherit"
                          >
                            {String(m).padStart(2, '0')}
                          </text>
                        </g>
                      );
                    })}

                  {/* Dial Center Mode Indicator */}
                  <text
                    x={CENTER}
                    y={CENTER + 16}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9"
                    fontWeight="800"
                    fill="#9ca3af"
                    fontFamily="inherit"
                  >
                    {isHour ? 'HOUR' : 'MIN'}
                  </text>
                </svg>
              </div>

              {/* Done Action Button */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setClockMode('hour');
                }}
                className="mt-3 w-full py-2.5 rounded-2xl text-xs font-black bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomTimePicker;
