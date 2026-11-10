import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Scissors } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * ClothUnrollReceipt
 *
 * ANIMATION ENGINE — requestAnimationFrame driven (NOT CSS keyframe driven).
 *
 * Root cause of old bug: CSS `clip-path` on element A and `top` on element B
 * are interpolated independently — they can NEVER be frame-perfectly synced.
 *
 * Fix: A single rAF loop computes ONE `progress` value every frame and
 * applies it to BOTH the clip-path AND the roller position simultaneously.
 * They are physically impossible to desync.
 *
 * Performance: receipt height is measured ONCE before the loop starts
 * (not every frame) so there is zero layout-thrash during animation.
 */

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const UNROLL_DURATION_MS = 2000;

const ClothUnrollReceipt = ({ children, isDirectPrint = false, animationEnabled = true }) => {
  const shouldAnimate = !isDirectPrint && animationEnabled;

  const [phase, setPhase] = useState(shouldAnimate ? 'unrolling' : 'settled');
  const [threadCut, setThreadCut] = useState(false);
  const [scissorActive, setScissorActive] = useState(shouldAnimate);

  const [ripples, setRipples] = useState([]);
  const [hoverLight, setHoverLight] = useState({ x: 50, y: 50, visible: false });

  const receiptWrapperRef = useRef(null);
  const rollerRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const phaseRef = useRef(phase);
  // Cache height so we never call getBoundingClientRect inside the rAF loop
  const receiptHeightRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ─── MASTER rAF ANIMATION LOOP ───────────────────────────────────────────────
  useEffect(() => {
    if (!shouldAnimate) return;

    // Ribbon snip at 280 ms
    const tCut = setTimeout(() => {
      setThreadCut(true);
      try {
        confetti({
          particleCount: 26,
          spread: 55,
          startVelocity: 15,
          ticks: 40,
          origin: { y: 0.12 },
          colors: ['#ef4444', '#f59e0b', '#fbbf24', '#10b981', '#ffffff'],
          scalar: 0.75,
          zIndex: 10000010,
          disableForReducedMotion: true,
        });
      } catch (_) {}
    }, 280);

    const tScissors = setTimeout(() => setScissorActive(false), 420);

    const tick = (now) => {
      if (!startTimeRef.current) {
        startTimeRef.current = now;
        const roller = rollerRef.current;
        if (roller) roller.style.willChange = 'top, height, opacity';
      }

      const elapsed = now - startTimeRef.current;
      const rawT = Math.min(elapsed / UNROLL_DURATION_MS, 1);
      const progress = easeOutCubic(rawT); // 0 → 1

      const receipt = receiptWrapperRef.current;
      const roller = rollerRef.current;

      // Dynamically measure actual receipt height so dynamic images (QR code, logo)
      // will never cause roller & paper to desync
      const currentHeight = receipt ? Math.max(receipt.offsetHeight, receipt.scrollHeight, 100) : 100;
      const topPx = progress * currentHeight;

      if (receipt) {
        // Pixel-exact clip-path: bottom edge is guaranteed to match topPx
        const bottomClipPx = Math.max(0, currentHeight - topPx);
        receipt.style.clipPath = `inset(0 0 ${bottomClipPx.toFixed(1)}px 0)`;
      }

      if (roller) {
        roller.style.top = `${topPx.toFixed(1)}px`;

        const rollerH = Math.max(0, 32 * (1 - progress));
        roller.style.height = `${rollerH.toFixed(2)}px`;

        // Fade roller out cleanly near the end
        const opacity = progress > 0.90
          ? Math.max(0, 1 - (progress - 0.90) / 0.10)
          : 1;
        roller.style.opacity = opacity.toFixed(3);
      }

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Done — clean up
        if (receipt) {
          receipt.style.clipPath = 'none';
          receipt.style.transform = 'none';
          receipt.style.willChange = 'auto';
        }
        if (roller) {
          roller.style.willChange = 'auto';
          roller.style.display = 'none';
        }
        setPhase('settled');
      }
    };

    // Defer the first frame by one rAF so the DOM has fully laid out
    // the receipt content and offsetHeight is accurate.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      clearTimeout(tCut);
      clearTimeout(tScissors);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldAnimate]);

  const isUnrolling = phase === 'unrolling';

  // ─── CLICK / TOUCH: skip animation + water ripple ────────────────────────────
  const handleClothTouch = useCallback((e) => {
    if (phaseRef.current === 'unrolling') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const receipt = receiptWrapperRef.current;
      const roller = rollerRef.current;
      if (receipt) { receipt.style.clipPath = 'none'; receipt.style.transform = 'none'; receipt.style.willChange = 'auto'; }
      if (roller) { roller.style.display = 'none'; roller.style.willChange = 'auto'; }
      setPhase('settled');
      return;
    }

    const rect = receiptWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.touches?.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches?.length > 0 ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const x = Math.round(clientX - rect.left);
    const y = Math.round(clientY - rect.top);
    const newRipple = { id: Date.now() + Math.random(), x, y };
    setRipples(prev => [...prev.slice(-2), newRipple]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 520);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (phaseRef.current === 'unrolling') return;
    const rect = receiptWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverLight({
      x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
      visible: true,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverLight(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <div className="cloth-unroll-root relative w-full flex flex-col items-center mt-0 pt-0">
      <style>{`
        @keyframes scissorCutAction {
          0%   { opacity: 0; transform: translate(32px, -18px) rotate(-35deg) scale(0.8); }
          35%  { opacity: 1; transform: translate(2px, -2px)   rotate(-20deg) scale(1.05); }
          60%  { transform: translate(-3px, 1px)  rotate(6deg)  scale(1.02); }
          80%  { transform: translate(-8px, 2px)  rotate(0deg)  scale(0.95); }
          100% { opacity: 0; transform: translate(-30px, 10px) rotate(-18deg) scale(0.8); }
        }
        @keyframes ribbonPartLeft {
          0%   { transform: scaleX(1) translateY(0); opacity: 1; }
          40%  { transform: scaleX(0.7) translateY(6px) rotate(-8deg); opacity: 0.9; }
          100% { transform: scaleX(0.05) translateY(18px) rotate(-24deg); opacity: 0; }
        }
        @keyframes ribbonPartRight {
          0%   { transform: scaleX(1) translateY(0); opacity: 1; }
          40%  { transform: scaleX(0.7) translateY(6px) rotate(8deg); opacity: 0.9; }
          100% { transform: scaleX(0.05) translateY(18px) rotate(24deg); opacity: 0; }
        }
        @keyframes continuousSilkSheen {
          0%   { transform: translateY(-100%); opacity: 0; }
          15%  { opacity: 0.65; }
          60%  { opacity: 0.5; }
          90%  { opacity: 0.15; }
          100% { transform: translateY(280%); opacity: 0; }
        }
        @keyframes softWaterSheenExpand {
          0%   { transform: translate(-50%, -50%) scale(0.15); opacity: 0.95; }
          50%  { opacity: 0.65; }
          100% { transform: translate(-50%, -50%) scale(1);    opacity: 0; }
        }
        @keyframes softWaterRingExpand {
          0%   { transform: translate(-50%, -50%) scale(0.1);  opacity: 0.9; }
          55%  { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0; }
        }
        @media print {
          .cloth-unroll-root, .continuous-cloth-viewport {
            clip-path: none !important; transform: none !important; animation: none !important;
          }
          .cloth-ribbon-bar, .frontside-3d-roll, .cloth-silk-sheen, .soft-water-ripple-instance {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative inline-flex flex-col items-center w-fit max-w-full mt-0 pt-0">

        {/* Ribbon (only during animation) */}
        {isUnrolling && (
          <div className="cloth-ribbon-bar print:hidden relative z-40 w-[96%] flex flex-col items-center mb-0.5">
            <div className="relative w-full h-2.5 flex items-center justify-between">
              <div
                className="h-2 flex-1 rounded-l-full bg-gradient-to-r from-red-700 via-red-500 to-red-600 border-y border-amber-300 shadow-xs origin-left"
                style={{ animation: threadCut ? 'ribbonPartLeft 0.38s ease-out forwards' : 'none' }}
              />
              <div className="relative mx-1 z-10 flex items-center justify-center">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                  threadCut
                    ? 'scale-125 bg-amber-400 text-amber-950 opacity-0 rotate-45'
                    : 'bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-100 border border-amber-400'
                }`}>
                  <Sparkles size={8} className="text-amber-900 animate-pulse" />
                </div>
                {scissorActive && (
                  <div
                    className="cloth-scissor-actor absolute -top-3.5 -right-6 pointer-events-none z-50 text-slate-800 drop-shadow-md"
                    style={{ animation: 'scissorCutAction 0.42s cubic-bezier(0.2, 1, 0.4, 1) forwards' }}
                  >
                    <Scissors size={26} className="text-amber-950 fill-amber-400 rotate-90" />
                  </div>
                )}
              </div>
              <div
                className="h-2 flex-1 rounded-r-full bg-gradient-to-r from-red-600 via-red-500 to-red-700 border-y border-amber-300 shadow-xs origin-right"
                style={{ animation: threadCut ? 'ribbonPartRight 0.38s ease-out forwards' : 'none' }}
              />
            </div>
          </div>
        )}

        {/*
          RECEIPT + ROLLER WRAPPER
          "relative" so the roller's absolute `top` pixel value is measured
          from the top of THIS div — same origin as the clipped receipt.
        */}
        <div className="relative w-full">

          {/* Receipt viewport — clip-path driven by rAF */}
          <div
            ref={receiptWrapperRef}
            onClick={handleClothTouch}
            onTouchStart={handleClothTouch}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="continuous-cloth-viewport relative w-full cursor-pointer select-none"
            style={{
              clipPath: shouldAnimate && isUnrolling ? 'inset(0 0 100% 0)' : 'none',
            }}
            title={isUnrolling ? 'Tap to skip' : undefined}
          >
            <div className="w-full flex justify-center">
              {children}
            </div>

            {/* Silk sheen sweeping down */}
            {isUnrolling && (
              <div
                aria-hidden="true"
                className="cloth-silk-sheen pointer-events-none absolute inset-x-0 top-0 h-64 z-20"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 25%, rgba(0,0,0,0.1) 36%, rgba(255,255,255,0.75) 58%, rgba(0,0,0,0.12) 70%, rgba(255,255,255,0) 100%)',
                  animation: `continuousSilkSheen ${UNROLL_DURATION_MS}ms ease-in-out forwards`,
                  mixBlendMode: 'overlay',
                }}
              />
            )}

            {/* Hover satin glow */}
            {hoverLight.visible && !isUnrolling && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-200"
                style={{
                  background: `radial-gradient(circle 60px at ${hoverLight.x}% ${hoverLight.y}%, rgba(255,255,255,0.18) 0%, transparent 100%)`,
                  mixBlendMode: 'overlay',
                }}
              />
            )}

            {/* Water ripples on tap */}
            <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
              {ripples.map((rip) => (
                <div
                  key={rip.id}
                  className="soft-water-ripple-instance pointer-events-none absolute"
                  style={{ left: rip.x, top: rip.y }}
                >
                  <div className="absolute rounded-full pointer-events-none" style={{
                    width: '120px', height: '120px',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.2) 35%, rgba(15,23,42,0.08) 60%, transparent 80%)',
                    mixBlendMode: 'overlay',
                    animation: 'softWaterSheenExpand 0.5s ease-out forwards',
                  }} />
                  <div className="absolute rounded-full pointer-events-none" style={{
                    width: '130px', height: '130px',
                    border: '1.5px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 0 10px rgba(255,255,255,0.6), inset 0 0 6px rgba(255,255,255,0.4)',
                    backdropFilter: 'blur(0.4px)',
                    animation: 'softWaterRingExpand 0.52s ease-out forwards',
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/*
            3D CYLINDER ROLLER
            Absolutely positioned in the SAME relative wrapper as the receipt.
            top is set in PIXELS by rAF from pre-cached offsetHeight — zero layout thrash.
          */}
          {isUnrolling && (
            <div
              ref={rollerRef}
              aria-hidden="true"
              className="frontside-3d-roll pointer-events-none absolute left-0 right-0 z-50 mx-auto w-[99%]"
              style={{
                top: 0,
                height: '32px',
                transform: 'translateY(-50%)',
                transformOrigin: 'center center',
              }}
            >
              <div className="relative w-full h-full flex items-center justify-between">
                <div className="w-4 h-full rounded-l-full shrink-0 border border-slate-300" style={{
                  background: 'radial-gradient(ellipse at center, #ffffff 0%, #cbd5e1 55%, #64748b 100%)',
                  boxShadow: 'inset 0 0 5px rgba(0,0,0,0.4)',
                }} />
                <div className="flex-1 h-full border-y border-slate-200/90" style={{
                  background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 25%, #f1f5f9 45%, #cbd5e1 75%, #475569 96%, #1e293b 100%)',
                  boxShadow: '0 16px 30px -4px rgba(0,0,0,0.5), 0 6px 12px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.95), inset 0 -4px 8px rgba(0,0,0,0.4)',
                }} />
                <div className="w-4 h-full rounded-r-full shrink-0 border border-slate-300" style={{
                  background: 'radial-gradient(ellipse at center, #ffffff 0%, #cbd5e1 55%, #64748b 100%)',
                  boxShadow: 'inset 0 0 5px rgba(0,0,0,0.4)',
                }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClothUnrollReceipt;
