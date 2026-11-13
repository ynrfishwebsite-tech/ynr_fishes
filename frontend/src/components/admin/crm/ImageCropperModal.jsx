import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, Move, Maximize2, Minimize2, Circle, Square, Loader2 } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { getApiUrl } from '../../../config.js';

export default function ImageCropperModal({ imageSrc, onCropComplete, onClose, title, initialShape = 'circle' }) {
  const { t } = useLanguage();
  const [cleanImageSrc, setCleanImageSrc] = useState(() =>
    imageSrc && (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')) ? imageSrc : ''
  );
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [cropShape, setCropShape] = useState(initialShape === 'square' ? 'free' : initialShape); // 'free' | 'square' | 'circle'
  const [baseDimensions, setBaseDimensions] = useState({ width: 260, height: 260 });
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });

  // Dynamic Crop Box: { x, y, width, height } where x and y are relative to viewport center
  const [box, setBox] = useState({ x: 0, y: 0, width: 260, height: 260 });

  const boxRef = useRef(box);
  boxRef.current = box;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const MIN_BOX_SIZE = 50;

  // Calculate base dimensions when image loads
  const handleImageLoaded = (e) => {
    const nw = e.target.naturalWidth || 260;
    const nh = e.target.naturalHeight || 260;
    setNaturalDimensions({ width: nw, height: nh });

    const containerW = containerRef.current?.clientWidth || 320;
    const containerH = containerRef.current?.clientHeight || 270;
    const maxViewW = containerW - 24;
    const maxViewH = containerH - 24;

    const scale = Math.min(maxViewW / nw, maxViewH / nh);
    const bw = Math.max(40, Math.round(nw * scale));
    const bh = Math.max(40, Math.round(nh * scale));
    setBaseDimensions({ width: bw, height: bh });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);

    // Initialize crop box to frame the image nicely
    if (initialShape === 'circle') {
      const s = Math.min(220, bw, bh);
      setBox({ x: 0, y: 0, width: s, height: s });
      setCropShape('circle');
    } else {
      // Free / square mode: size box to hug the image nicely!
      const initW = Math.min(maxViewW - 10, Math.max(80, bw));
      const initH = Math.min(maxViewH - 10, Math.max(80, bh));
      setBox({ x: 0, y: 0, width: initW, height: initH });
      setCropShape('free');
    }
  };

  // Reset transform when imageSrc changes and load an untainted safe local blob
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    if (initialShape) setCropShape(initialShape === 'square' ? 'free' : initialShape);

    if (!imageSrc) return;

    // 1. Data URLs and Blob URLs are already local and never taint the canvas
    if (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')) {
      setIsLoadingSource(false);
      setCleanImageSrc(imageSrc);
      return;
    }

    // 2. Remote URLs: convert to local Blob URL via CORS or backend proxy to prevent canvas tainting
    let isCancelled = false;
    let localCreatedUrl = null;
    setCleanImageSrc('');
    setIsLoadingSource(true);

    const convertToUntaintedBlob = async () => {
      // Try 1: Direct CORS fetch
      try {
        const res = await fetch(imageSrc, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          localCreatedUrl = URL.createObjectURL(blob);
          if (!isCancelled) {
            setCleanImageSrc(localCreatedUrl);
            setIsLoadingSource(false);
          }
          return;
        }
      } catch (err) {
        // Direct fetch failed (no CORS header on remote host)
      }

      // Try 2: Backend proxy which serves with Access-Control-Allow-Origin: *
      try {
        const proxyUrl = `${getApiUrl()}/proxy-image?url=${encodeURIComponent(imageSrc)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          localCreatedUrl = URL.createObjectURL(blob);
          if (!isCancelled) {
            setCleanImageSrc(localCreatedUrl);
            setIsLoadingSource(false);
          }
          return;
        }
      } catch (err) {
        console.warn('Backend proxy fetch failed:', err);
      }

      // Fallback: pass original image
      if (!isCancelled) {
        setCleanImageSrc(imageSrc);
        setIsLoadingSource(false);
      }
    };

    convertToUntaintedBlob();

    return () => {
      isCancelled = true;
      if (localCreatedUrl) {
        URL.revokeObjectURL(localCreatedUrl);
      }
    };
  }, [imageSrc, initialShape]);

  // Fit Whole Image action
  const handleFitWholeImage = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
    if (baseDimensions.width && baseDimensions.height) {
      if (cropShape === 'circle') {
        const s = Math.min(220, baseDimensions.width, baseDimensions.height);
        setBox({ x: 0, y: 0, width: s, height: s });
      } else if (cropShape === 'square') {
        const s = Math.min(baseDimensions.width, baseDimensions.height);
        setBox({ x: 0, y: 0, width: s, height: s });
      } else {
        setBox({ x: 0, y: 0, width: baseDimensions.width, height: baseDimensions.height });
      }
    }
  };

  // Fill Frame action
  const handleFillFrame = () => {
    if (!naturalDimensions.width || !naturalDimensions.height) return;
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    const containerW = containerRef.current?.clientWidth || 320;
    const containerH = containerRef.current?.clientHeight || 270;
    const fillScale = Math.max(containerW / nw, containerH / nh);
    const fitScale = Math.min(containerW / nw, containerH / nh);
    const ratio = fitScale > 0 ? fillScale / fitScale : 1.25;
    setZoom(Math.max(1, parseFloat(ratio.toFixed(2))));
    setOffset({ x: 0, y: 0 });
  };

  // Zoom with mouse wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(3.5, Math.max(0.2, parseFloat((prev + delta).toFixed(2)))));
  };

  // Dragging system (handles borders, corners, center, and photo pan)
  const startDrag = (e, type) => {
    e.stopPropagation();
    const isTouch = !!e.touches;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      type,
      startX: clientX,
      startY: clientY,
      initialBox: { ...boxRef.current },
      initialOffset: { ...offsetRef.current }
    };
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { type, startX, startY, initialBox, initialOffset } = dragRef.current;
    const isTouch = !!e.touches;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    const containerW = containerRef.current?.clientWidth || 320;
    const containerH = containerRef.current?.clientHeight || 270;
    const maxHalfW = containerW / 2 - 8;
    const maxHalfH = containerH / 2 - 8;

    if (type === 'image') {
      setOffset({
        x: initialOffset.x + dx,
        y: initialOffset.y + dy
      });
      return;
    }

    if (type === 'moveBox') {
      const newX = Math.max(-maxHalfW + initialBox.width / 2, Math.min(maxHalfW - initialBox.width / 2, initialBox.x + dx));
      const newY = Math.max(-maxHalfH + initialBox.height / 2, Math.min(maxHalfH - initialBox.height / 2, initialBox.y + dy));
      setBox({ ...initialBox, x: newX, y: newY });
      return;
    }

    // Border and Corner Resizing
    const initialTop = initialBox.y - initialBox.height / 2;
    const initialBottom = initialBox.y + initialBox.height / 2;
    const initialLeft = initialBox.x - initialBox.width / 2;
    const initialRight = initialBox.x + initialBox.width / 2;

    let newTop = initialTop;
    let newBottom = initialBottom;
    let newLeft = initialLeft;
    let newRight = initialRight;

    if (type.includes('top')) {
      newTop = Math.min(initialBottom - MIN_BOX_SIZE, Math.max(-maxHalfH, initialTop + dy));
    }
    if (type.includes('bottom')) {
      newBottom = Math.max(initialTop + MIN_BOX_SIZE, Math.min(maxHalfH, initialBottom + dy));
    }
    if (type.includes('left')) {
      newLeft = Math.min(initialRight - MIN_BOX_SIZE, Math.max(-maxHalfW, initialLeft + dx));
    }
    if (type.includes('right')) {
      newRight = Math.max(initialLeft + MIN_BOX_SIZE, Math.min(maxHalfW, initialRight + dx));
    }

    let newWidth = Math.max(MIN_BOX_SIZE, newRight - newLeft);
    let newHeight = Math.max(MIN_BOX_SIZE, newBottom - newTop);

    // If locked to circle or square 1:1 ratio
    if (cropShape === 'circle' || cropShape === 'square') {
      const s = Math.max(MIN_BOX_SIZE, Math.min(newWidth, newHeight));
      newWidth = s;
      newHeight = s;
      if (type.includes('top')) newTop = initialBottom - s;
      if (type.includes('bottom')) newBottom = initialTop + s;
      if (type.includes('left')) newLeft = initialRight - s;
      if (type.includes('right')) newRight = initialLeft + s;
    }

    const newX = (newLeft + newRight) / 2;
    const newY = (newTop + newBottom) / 2;

    setBox({
      x: newX,
      y: newY,
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    });
  }, [cropShape]);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const onTouchMove = (e) => {
        if (e.cancelable) e.preventDefault();
        handleDragMove(e);
      };
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('touchcancel', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', handleDragEnd);
        window.removeEventListener('touchcancel', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Crop execution using HTML5 Canvas
  const handleCrop = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    // Output canvas dimensions maintaining the crop box's exact aspect ratio
    const MAX_OUTPUT = 480;
    let outW = 400;
    let outH = 400;

    if (box.width >= box.height) {
      outW = MAX_OUTPUT;
      outH = Math.max(60, Math.round(MAX_OUTPUT * (box.height / box.width)));
    } else {
      outH = MAX_OUTPUT;
      outW = Math.max(60, Math.round(MAX_OUTPUT * (box.width / box.height)));
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outW;
    outputCanvas.height = outH;
    const ctx = outputCanvas.getContext('2d');

    // Clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    // If circle crop, clip to circular path
    if (cropShape === 'circle') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    // Scale factor from crop box in viewport to output canvas
    const scaleFactor = outW / box.width;

    // Distance between image center and crop box center in viewport
    const deltaX = offset.x - box.x;
    const deltaY = offset.y - box.y;

    const renderedWidth = baseDimensions.width * zoom;
    const renderedHeight = baseDimensions.height * zoom;

    const drawW = renderedWidth * scaleFactor;
    const drawH = renderedHeight * scaleFactor;
    const drawCenterX = outW / 2 + deltaX * scaleFactor;
    const drawCenterY = outH / 2 + deltaY * scaleFactor;

    ctx.save();
    ctx.translate(drawCenterX, drawCenterY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    if (cropShape === 'circle') {
      ctx.restore();
    }

    // Export compressed JPEG safely
    try {
      const croppedDataUrl = outputCanvas.toDataURL('image/jpeg', 0.88);
      onCropComplete(croppedDataUrl);
    } catch (err) {
      console.warn('Canvas export failed (tainted), falling back to original image:', err);
      onCropComplete(imageSrc);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999999] flex items-center justify-center p-2.5 sm:p-4 animate-fade-in" style={{ zIndex: 999999 }}>
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[96vh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#FDFBF7] border-b border-[#E8DCCB] shrink-0">
          <div className="pr-2 min-w-0">
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">{title || t('Crop Photo')}</h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">{t('Drag borders or corners to crop • Drag photo to position')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport / Interactive Crop Box */}
        <div
          ref={containerRef}
          onMouseDown={(e) => startDrag(e, 'image')}
          onTouchStart={(e) => startDrag(e, 'image')}
          onWheel={handleWheel}
          className="relative w-full h-[270px] sm:h-[310px] bg-slate-900 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shrink-0"
        >
          {isLoadingSource && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/80 z-40 bg-slate-900/60 pointer-events-none">
              <Loader2 size={24} className="animate-spin text-[#ea580c]" />
              <span className="text-[11px] font-semibold">{t('Preparing image...')}</span>
            </div>
          )}

          {/* Movable & Zoomable Image underneath */}
          {cleanImageSrc && (
            <img
              ref={imageRef}
              src={cleanImageSrc}
              crossOrigin="anonymous"
              alt="Crop source"
              onLoad={handleImageLoaded}
              draggable={false}
              style={{
                width: `${baseDimensions.width}px`,
                height: `${baseDimensions.height}px`,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              className="pointer-events-none select-none max-w-none max-h-none object-contain"
            />
          )}

          {/* Draggable & Resizable Crop Box */}
          <div
            style={{
              width: `${box.width}px`,
              height: `${box.height}px`,
              transform: `translate(${box.x}px, ${box.y}px)`
            }}
            className={`absolute ${
              cropShape === 'circle' ? 'rounded-full' : 'rounded-lg'
            } border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.68)] transition-all duration-75`}
          >
            {/* Rule of thirds grid lines */}
            <div className="absolute inset-0 pointer-events-none opacity-30">
              <div className="absolute top-1/3 left-0 right-0 border-t border-white/40" />
              <div className="absolute top-2/3 left-0 right-0 border-t border-white/40" />
              <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/40" />
              <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/40" />
            </div>

            {/* Center move handle to reposition box */}
            <div
              onMouseDown={(e) => startDrag(e, 'moveBox')}
              onTouchStart={(e) => startDrag(e, 'moveBox')}
              title={t('Drag to move crop box')}
              className="absolute inset-0 flex items-center justify-center cursor-move touch-none z-20"
            >
              <div className="w-7 h-7 rounded-full bg-black/45 backdrop-blur-xs border border-white/70 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                <Move size={14} className="text-white" />
              </div>
            </div>

            {/* 4 Border Handles (Top, Bottom, Left, Right) */}
            {/* Top Border Handle */}
            <div
              onMouseDown={(e) => startDrag(e, 'top')}
              onTouchStart={(e) => startDrag(e, 'top')}
              title={t('Drag top border')}
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-16 h-7 flex items-center justify-center cursor-ns-resize touch-none z-30"
            >
              <div className="w-8 h-1.5 bg-white rounded-full shadow-md border border-slate-300" />
            </div>

            {/* Bottom Border Handle */}
            <div
              onMouseDown={(e) => startDrag(e, 'bottom')}
              onTouchStart={(e) => startDrag(e, 'bottom')}
              title={t('Drag bottom border')}
              className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-16 h-7 flex items-center justify-center cursor-ns-resize touch-none z-30"
            >
              <div className="w-8 h-1.5 bg-white rounded-full shadow-md border border-slate-300" />
            </div>

            {/* Left Border Handle */}
            <div
              onMouseDown={(e) => startDrag(e, 'left')}
              onTouchStart={(e) => startDrag(e, 'left')}
              title={t('Drag left border')}
              className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-16 flex items-center justify-center cursor-ew-resize touch-none z-30"
            >
              <div className="w-1.5 h-8 bg-white rounded-full shadow-md border border-slate-300" />
            </div>

            {/* Right Border Handle */}
            <div
              onMouseDown={(e) => startDrag(e, 'right')}
              onTouchStart={(e) => startDrag(e, 'right')}
              title={t('Drag right border')}
              className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-16 flex items-center justify-center cursor-ew-resize touch-none z-30"
            >
              <div className="w-1.5 h-8 bg-white rounded-full shadow-md border border-slate-300" />
            </div>

            {/* 4 Corner Handles (Top-Left, Top-Right, Bottom-Left, Bottom-Right) */}
            <div
              onMouseDown={(e) => startDrag(e, 'top-left')}
              onTouchStart={(e) => startDrag(e, 'top-left')}
              title={t('Drag corner')}
              className="absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize touch-none z-30"
            >
              <div className="w-3.5 h-3.5 border-t-[3px] border-l-[3px] border-white rounded-tl-sm shadow-md" />
            </div>

            <div
              onMouseDown={(e) => startDrag(e, 'top-right')}
              onTouchStart={(e) => startDrag(e, 'top-right')}
              title={t('Drag corner')}
              className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize touch-none z-30"
            >
              <div className="w-3.5 h-3.5 border-t-[3px] border-r-[3px] border-white rounded-tr-sm shadow-md" />
            </div>

            <div
              onMouseDown={(e) => startDrag(e, 'bottom-left')}
              onTouchStart={(e) => startDrag(e, 'bottom-left')}
              title={t('Drag corner')}
              className="absolute -bottom-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize touch-none z-30"
            >
              <div className="w-3.5 h-3.5 border-b-[3px] border-l-[3px] border-white rounded-bl-sm shadow-md" />
            </div>

            <div
              onMouseDown={(e) => startDrag(e, 'bottom-right')}
              onTouchStart={(e) => startDrag(e, 'bottom-right')}
              title={t('Drag corner')}
              className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize touch-none z-30"
            >
              <div className="w-3.5 h-3.5 border-b-[3px] border-r-[3px] border-white rounded-br-sm shadow-md" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-[#FDFBF7]">
          {/* Zoom Slider (0.2x to 3.5x for full flexibility) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(0.2, parseFloat((prev - 0.1).toFixed(2))))}
              className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
              title={t('Zoom out')}
            >
              <ZoomOut size={15} />
            </button>
            <input
              type="range"
              min="0.2"
              max="3.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#ea580c]"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3.5, parseFloat((prev + 0.1).toFixed(2))))}
              className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
              title={t('Zoom in')}
            >
              <ZoomIn size={15} />
            </button>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 font-mono w-9 sm:w-10 text-right shrink-0">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Responsive 5-Tool Toolbar: Fit, Fill, Shape, Rotate, Reset */}
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleFitWholeImage}
              title={t('Fit entire image in frame')}
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 px-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <Minimize2 size={13} className="text-[#ea580c] shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate">{t('Fit')}</span>
            </button>

            <button
              type="button"
              onClick={handleFillFrame}
              title={t('Fill frame')}
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 px-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <Maximize2 size={13} className="text-emerald-600 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate">{t('Fill')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCropShape((prev) => {
                  if (prev === 'free') {
                    const s = Math.min(box.width, box.height);
                    setBox((b) => ({ ...b, width: s, height: s }));
                    return 'square';
                  } else if (prev === 'square') {
                    return 'circle';
                  } else {
                    return 'free';
                  }
                });
              }}
              title={t('Toggle Crop Mode: Free / Square / Circle')}
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 px-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              {cropShape === 'circle' ? (
                <Circle size={13} className="text-blue-600 shrink-0" />
              ) : cropShape === 'square' ? (
                <Square size={13} className="text-indigo-600 shrink-0" />
              ) : (
                <Maximize2 size={13} className="text-emerald-600 shrink-0" />
              )}
              <span className="text-[10px] sm:text-[11px] font-bold leading-tight capitalize truncate">
                {cropShape === 'circle' ? t('Circle') : cropShape === 'square' ? t('Square') : t('Free')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              title={t('Rotate 90° clockwise')}
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 px-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <RotateCw size={13} className="text-purple-600 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate">{t('Rotate')}</span>
            </button>

            <button
              type="button"
              onClick={handleFitWholeImage}
              title={t('Reset transform')}
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 px-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <RotateCcw size={13} className="text-rose-500 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate">{t('Reset')}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              onClick={handleCrop}
              className="flex-1 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Check size={15} strokeWidth={2.5} />
              <span>{t('Apply Photo')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
