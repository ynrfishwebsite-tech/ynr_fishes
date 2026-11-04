import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Scissors } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * ClothUnrollReceipt (Option B)
 * 
 * 1. 3D UNROLLING ENTRANCE:
 *    - Continuous, butter-smooth falling banner with decreasing frontside cylinder roll.
 *    - Ceremonial ribbon snip and festive confetti sparkles.
 * 
 * 2. SUBTLE, SOFT WATER-TOUCH LIGHT RIPPLE (OPTION B):
 *    - Clicking or tapping anywhere creates an elegant, delicate water light sheen at that spot.
 *    - ZERO physical movement of any text, row, or container (100% rock-solid, zero shaking).
 *    - The light ripple expands softly and naturally dissolves in ~500ms.
 * 
 * 3. 100% PRINT & EXPORT SAFE:
 *    - Clean bypass for thermal ESC/POS printing, WhatsApp sharing, and PDF downloads.
 */
const ClothUnrollReceipt = ({ children, isDirectPrint = false }) => {
  const [phase, setPhase] = useState(isDirectPrint ? 'settled' : 'unrolling');
  const [threadCut, setThreadCut] = useState(false);
  const [scissorActive, setScissorActive] = useState(!isDirectPrint);

  // Subtle Light Ripple State (Pure light overlay, zero text motion)
  const [ripples, setRipples] = useState([]);
  const [hoverLight, setHoverLight] = useState({ x: 50, y: 50, visible: false });

  const receiptWrapperRef = useRef(null);

  useEffect(() => {
    if (isDirectPrint) return;

    // 1. Scissors snip ribbon at 280ms
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
          disableForReducedMotion: true
        });
      } catch (e) { }
    }, 280);

    const tScissors = setTimeout(() => {
      setScissorActive(false);
    }, 420);

    // 2. Continuous 3.4s unroll completes smoothly
    const tSettle = setTimeout(() => {
      setPhase('settled');
    }, 3600);

    return () => {
      clearTimeout(tCut);
      clearTimeout(tScissors);
      clearTimeout(tSettle);
    };
  }, [isDirectPrint]);

  const isUnrolling = phase === 'unrolling';

  /**
   * Option B: Soft Water Light Sheen Handler
   * Captures (x, y) and emits a delicate, soft liquid light wave.
   * Absolutely NO DOM element movement: The entire receipt remains 100% stationary.
   */
  const handleClothTouch = useCallback((e) => {
    if (isUnrolling) {
      setPhase('settled');
    }

    const rect = receiptWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const x = Math.round(clientX - rect.left);
    const y = Math.round(clientY - rect.top);

    // Spawn purely visual soft water light sheen
    const newRipple = {
      id: Date.now() + Math.random(),
      x,
      y
    };

    setRipples(prev => [...prev.slice(-2), newRipple]); // keep at most 3 ripples

    // Fade and clean up naturally in 520ms
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 520);
  }, [isUnrolling]);

  const handleMouseMove = useCallback((e) => {
    const rect = receiptWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setHoverLight({ x, y, visible: true });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverLight(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <div
      className="cloth-unroll-root relative w-full flex flex-col items-center mt-0 pt-0"
      style={{ perspective: '1500px', transformStyle: 'preserve-3d' }}
    >
      <style>{`
        /* ==========================================================================
           Continuous 3D Roller & Cloth Curtain Entrance Keyframes
           ========================================================================== */

        /* Scissor cut motion */
        @keyframes scissorCutAction {
          0% {
            opacity: 0;
            transform: translate(32px, -18px) rotate(-35deg) scale(0.8);
          }
          35% {
            opacity: 1;
            transform: translate(2px, -2px) rotate(-20deg) scale(1.05);
          }
          60% {
            transform: translate(-3px, 1px) rotate(6deg) scale(1.02);
          }
          80% {
            transform: translate(-8px, 2px) rotate(0deg) scale(0.95);
          }
          100% {
            opacity: 0;
            transform: translate(-30px, 10px) rotate(-18deg) scale(0.8);
          }
        }

        /* Ribbon fluttering apart */
        @keyframes ribbonPartLeft {
          0% { transform: scaleX(1) translateY(0); opacity: 1; }
          40% { transform: scaleX(0.7) translateY(6px) rotate(-8deg); opacity: 0.9; }
          100% { transform: scaleX(0.05) translateY(18px) rotate(-24deg); opacity: 0; }
        }

        @keyframes ribbonPartRight {
          0% { transform: scaleX(1) translateY(0); opacity: 1; }
          40% { transform: scaleX(0.7) translateY(6px) rotate(8deg); opacity: 0.9; }
          100% { transform: scaleX(0.05) translateY(18px) rotate(24deg); opacity: 0; }
        }

        /* Continuous paper reveal during unrolling */
        @keyframes continuousPaperReveal {
          0% {
            clip-path: inset(0 0 100% 0);
            transform: perspective(1500px) rotateX(6deg);
            opacity: 0.85;
          }
          8% {
            opacity: 1;
          }
          100% {
            clip-path: inset(0 0 0% 0);
            transform: perspective(1500px) rotateX(0deg);
            opacity: 1;
          }
        }

        /* Continuous 3D roller travel */
        @keyframes continuousRollerTravel {
          0% {
            top: 0%;
            height: 32px;
            transform: translateY(-50%) scaleY(1);
            opacity: 1;
          }
          40% {
            height: 22px;
            transform: translateY(-50%) scaleY(0.82);
          }
          70% {
            height: 14px;
            transform: translateY(-50%) scaleY(0.58);
          }
          88% {
            height: 7px;
            transform: translateY(-50%) scaleY(0.32);
            opacity: 0.95;
          }
          97% {
            height: 2px;
            transform: translateY(-50%) scaleY(0.12);
            opacity: 0.6;
          }
          100% {
            top: 100%;
            height: 0px;
            transform: translateY(-50%) scaleY(0);
            opacity: 0;
            display: none;
          }
        }

        /* Flowing silk light reflection moving softly down the cloth during unroll */
        @keyframes continuousSilkSheen {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          15% {
            opacity: 0.65;
          }
          60% {
            opacity: 0.5;
          }
          90% {
            opacity: 0.15;
          }
          100% {
            transform: translateY(280%);
            opacity: 0;
          }
        }

        /* ==========================================================================
           OPTION B: PURE WATER LIGHT SHEEN RIPPLE (ZERO ELEMENT MOVEMENT)
           Gentle liquid light sheen expanding and dissolving smoothly in ~500ms.
           The receipt remains 100% stationary, rock-solid, and completely motionless.
           ========================================================================== */

        @keyframes softWaterSheenExpand {
          0% {
            transform: translate(-50%, -50%) scale(0.15);
            opacity: 0.95;
          }
          50% {
            opacity: 0.65;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        @keyframes softWaterRingExpand {
          0% {
            transform: translate(-50%, -50%) scale(0.1);
            opacity: 0.9;
          }
          55% {
            opacity: 0.5;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.15);
            opacity: 0;
          }
        }

        /* Clean bypass for thermal printing & WhatsApp export */
        @media print {
          .cloth-unroll-root,
          .continuous-cloth-viewport {
            clip-path: none !important;
            transform: none !important;
            animation: none !important;
            filter: none !important;
          }
          .cloth-ribbon-bar,
          .frontside-3d-roll,
          .cloth-silk-sheen,
          .soft-water-ripple-instance {
            display: none !important;
          }
        }
      `}</style>

      {/* Frame wrapper that naturally hugs the receipt width */}
      <div className="relative inline-flex flex-col items-center w-fit max-w-full mt-0 pt-0">
        
        {/* Ceremonial Red-Gold Satin Ribbon Header across the top */}
        {isUnrolling && (
          <div className="cloth-ribbon-bar print:hidden relative z-40 w-[96%] flex flex-col items-center mb-0.5">
            <div className="relative w-full h-2.5 flex items-center justify-between">
              {/* Ribbon Left Wing */}
              <div
                className="h-2 flex-1 rounded-l-full bg-gradient-to-r from-red-700 via-red-500 to-red-600 border-y border-amber-300 shadow-xs origin-left"
                style={{
                  animation: threadCut ? 'ribbonPartLeft 0.38s ease-out forwards' : 'none'
                }}
              />

              {/* Central Knot with Golden Sparkle */}
              <div className="relative mx-1 z-10 flex items-center justify-center">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                    threadCut
                      ? 'scale-125 bg-amber-400 text-amber-950 opacity-0 rotate-45'
                      : 'bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-100 border border-amber-400'
                  }`}
                >
                  <Sparkles size={8} className="text-amber-900 animate-pulse" />
                </div>

                {/* Animated Scissors Actor */}
                {scissorActive && (
                  <div
                    className="cloth-scissor-actor absolute -top-3.5 -right-6 pointer-events-none z-50 text-slate-800 drop-shadow-md"
                    style={{ animation: 'scissorCutAction 0.42s cubic-bezier(0.2, 1, 0.4, 1) forwards' }}
                  >
                    <Scissors size={26} className="text-amber-950 fill-amber-400 rotate-90" />
                  </div>
                )}
              </div>

              {/* Ribbon Right Wing */}
              <div
                className="h-2 flex-1 rounded-r-full bg-gradient-to-r from-red-600 via-red-500 to-red-700 border-y border-amber-300 shadow-xs origin-right"
                style={{
                  animation: threadCut ? 'ribbonPartRight 0.38s ease-out forwards' : 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* Viewport Stage: Completely stationary, stable, and crisp */}
        <div className="relative w-full flex flex-col items-center">
          
          {/* 
            Receipt Viewport:
            - Unrolls smoothly on entrance.
            - Remains 100% stationary and rock-solid when clicked (ZERO text movement or shaking).
            - Only a gentle, soft liquid light sheen appears at the touch coordinate and fades in 500ms.
          */}
          <div
            ref={receiptWrapperRef}
            onClick={handleClothTouch}
            onTouchStart={handleClothTouch}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="continuous-cloth-viewport relative w-full cursor-pointer select-none"
            style={{
              transformOrigin: 'top center',
              animation: isUnrolling
                ? 'continuousPaperReveal 3.4s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                : 'none',
              clipPath: isUnrolling ? undefined : 'none'
            }}
            title="Click to interact"
          >
            {/* The Actual Receipt Content (100% rock-solid, zero shaking) */}
            <div className="w-full flex justify-center">
              {children}
            </div>

            {/* Traveling Silk Ripple Sheen Overlay during initial unroll */}
            {isUnrolling && (
              <div
                aria-hidden="true"
                className="cloth-silk-sheen pointer-events-none absolute inset-x-0 top-0 h-64 z-20"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 25%, rgba(0,0,0,0.1) 36%, rgba(255,255,255,0.75) 58%, rgba(0,0,0,0.12) 70%, rgba(255,255,255,0) 100%)',
                  animation: 'continuousSilkSheen 3.3s ease-in-out forwards',
                  mixBlendMode: 'overlay'
                }}
              />
            )}

            {/* Subtle localized satin sheen under cursor on hover */}
            {hoverLight.visible && !isUnrolling && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-200"
                style={{
                  background: `radial-gradient(circle 60px at ${hoverLight.x}% ${hoverLight.y}%, rgba(255, 255, 255, 0.18) 0%, transparent 100%)`,
                  mixBlendMode: 'overlay'
                }}
              />
            )}

            {/* 
              OPTION B: PURE WATER LIGHT SHEEN RIPPLES (ZERO ELEMENT SHAKE)
              Gentle liquid light rings that expand and disappear cleanly in 500ms.
            */}
            <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
              {ripples.map((rip) => (
                <div
                  key={rip.id}
                  className="soft-water-ripple-instance pointer-events-none absolute"
                  style={{
                    left: rip.x,
                    top: rip.y
                  }}
                >
                  {/* Soft Radial Water Light Sheen */}
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: '120px',
                      height: '120px',
                      background: 'radial-gradient(circle, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.2) 35%, rgba(15, 23, 42, 0.08) 60%, transparent 80%)',
                      mixBlendMode: 'overlay',
                      animation: 'softWaterSheenExpand 0.5s ease-out forwards'
                    }}
                  />

                  {/* Delicate Water Meniscus Light Ring */}
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: '130px',
                      height: '130px',
                      border: '1.5px solid rgba(255, 255, 255, 0.85)',
                      boxShadow: '0 0 10px rgba(255, 255, 255, 0.6), inset 0 0 6px rgba(255, 255, 255, 0.4)',
                      backdropFilter: 'blur(0.4px)',
                      animation: 'softWaterRingExpand 0.52s ease-out forwards'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 
            ========================================================================
            PROMINENT 3D CYLINDER ROLLER (IN THE FRONTSIDE / FOREGROUND)
            Positioned with z-index: 50 directly in front.
            Travels simultaneously with the clip-path cut line with zero breaks.
            Diameter smoothly and continuously DECREASES from 32px -> 0px and vanishes!
            ========================================================================
          */}
          {isUnrolling && (
            <div
              aria-hidden="true"
              className="frontside-3d-roll pointer-events-none absolute left-0 right-0 z-50 mx-auto w-[99%]"
              style={{
                top: 0,
                transformOrigin: 'center center',
                animation: 'continuousRollerTravel 3.4s cubic-bezier(0.22, 1, 0.36, 1) forwards'
              }}
            >
              <div className="relative w-full h-full flex items-center justify-between">
                {/* 3D Left Circular End-Cap (Shows rolled spiral layers) */}
                <div
                  className="w-4 h-full rounded-l-full shrink-0 border border-slate-300 shadow-md"
                  style={{
                    background: 'radial-gradient(ellipse at center, #ffffff 0%, #cbd5e1 55%, #64748b 100%)',
                    boxShadow: 'inset 0 0 5px rgba(0,0,0,0.4)'
                  }}
                />

                {/* Main 3D Cylinder Roll Body with Curved Shading & Deep Drop Shadow */}
                <div
                  className="flex-1 h-full border-y border-slate-200/90"
                  style={{
                    background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 25%, #f1f5f9 45%, #cbd5e1 75%, #475569 96%, #1e293b 100%)',
                    boxShadow: '0 16px 30px -4px rgba(0, 0, 0, 0.5), 0 6px 12px rgba(0, 0, 0, 0.3), inset 0 3px 6px rgba(255, 255, 255, 0.95), inset 0 -4px 8px rgba(0, 0, 0, 0.4)'
                  }}
                />

                {/* 3D Right Circular End-Cap (Shows rolled spiral layers) */}
                <div
                  className="w-4 h-full rounded-r-full shrink-0 border border-slate-300 shadow-md"
                  style={{
                    background: 'radial-gradient(ellipse at center, #ffffff 0%, #cbd5e1 55%, #64748b 100%)',
                    boxShadow: 'inset 0 0 5px rgba(0,0,0,0.4)'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClothUnrollReceipt;
