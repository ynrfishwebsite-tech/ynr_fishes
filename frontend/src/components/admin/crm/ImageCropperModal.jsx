import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, Move, Maximize2, Minimize2, Circle, Square } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

export default function ImageCropperModal({ imageSrc, onCropComplete, onClose, title, initialShape = 'circle' }) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [cropShape, setCropShape] = useState(initialShape); // 'circle' | 'square'
  const [baseDimensions, setBaseDimensions] = useState({ width: 260, height: 260 });
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });

  const dragStartRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const CROP_SIZE = 260; // preview crop circle/square size in px

  // Calculate base dimensions when image loads to fit within CROP_SIZE at 100%
  const handleImageLoaded = (e) => {
    const nw = e.target.naturalWidth || 260;
    const nh = e.target.naturalHeight || 260;
    setNaturalDimensions({ width: nw, height: nh });

    // Fit entire image inside CROP_SIZE
    const scale = Math.min(CROP_SIZE / nw, CROP_SIZE / nh);
    const bw = nw * scale;
    const bh = nh * scale;
    setBaseDimensions({ width: bw, height: bh });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  // Reset transform when new imageSrc changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    if (initialShape) setCropShape(initialShape);
  }, [imageSrc, initialShape]);

  // Fit Whole Image action
  const handleFitWholeImage = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  // Fill Frame action (zooms in so no white space is visible)
  const handleFillFrame = () => {
    if (!naturalDimensions.width || !naturalDimensions.height) return;
    const nw = naturalDimensions.width;
    const nh = naturalDimensions.height;
    const fitScale = Math.min(CROP_SIZE / nw, CROP_SIZE / nh);
    const fillScale = Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
    const ratio = fitScale > 0 ? fillScale / fitScale : 1.2;
    setZoom(Math.max(1, parseFloat(ratio.toFixed(2))));
    setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(3.5, Math.max(0.2, parseFloat((prev + delta).toFixed(2)))));
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y
      };
    }
  };

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStartRef.current.x,
      y: e.touches[0].clientY - dragStartRef.current.y
    });
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  // Crop execution using HTML5 Canvas
  const handleCrop = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    const outputCanvas = document.createElement('canvas');
    const OUTPUT_SIZE = 400; // Clean 400x400 output
    outputCanvas.width = OUTPUT_SIZE;
    outputCanvas.height = OUTPUT_SIZE;
    const ctx = outputCanvas.getContext('2d');

    // Fill clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const renderedWidth = baseDimensions.width * zoom;
    const renderedHeight = baseDimensions.height * zoom;

    ctx.save();
    // Center canvas context
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Apply offset proportionally
    const scaleFactor = OUTPUT_SIZE / CROP_SIZE;
    const drawX = offset.x * scaleFactor;
    const drawY = offset.y * scaleFactor;
    const drawW = renderedWidth * scaleFactor;
    const drawH = renderedHeight * scaleFactor;

    ctx.drawImage(img, drawX - drawW / 2, drawY - drawH / 2, drawW, drawH);
    ctx.restore();

    // Export compressed JPEG
    const croppedDataUrl = outputCanvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(croppedDataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999999] flex items-center justify-center p-2.5 sm:p-4 animate-fade-in" style={{ zIndex: 999999 }}>
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[96vh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#FDFBF7] border-b border-[#E8DCCB] shrink-0">
          <div className="pr-2 min-w-0">
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">{title || t('Crop Photo')}</h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">{t('Drag to position & zoom to fit whole image')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport / Drag Box */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onWheel={handleWheel}
          className="relative w-full h-[270px] sm:h-[310px] bg-slate-900 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shrink-0"
        >
          {/* Crop Guide Mask (Circle or Rounded Square) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div
              style={{ width: `${CROP_SIZE}px`, height: `${CROP_SIZE}px` }}
              className={`${
                cropShape === 'circle' ? 'rounded-full' : 'rounded-2xl'
              } border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] relative transition-all duration-200`}
            >
              {/* Center crosshair */}
              <div className="absolute inset-0 flex items-center justify-center opacity-25">
                <Move size={22} className="text-white" />
              </div>
            </div>
          </div>

          {/* Movable & Zoomable Image */}
          <img
            ref={imageRef}
            src={imageSrc}
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
              onClick={() => setCropShape((prev) => (prev === 'circle' ? 'square' : 'circle'))}
              title={t('Toggle Crop Shape')}
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 py-1.5 px-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              {cropShape === 'circle' ? (
                <Circle size={13} className="text-blue-600 shrink-0" />
              ) : (
                <Square size={13} className="text-blue-600 shrink-0" />
              )}
              <span className="text-[10px] sm:text-[11px] font-bold leading-tight capitalize truncate">
                {cropShape === 'circle' ? t('Circle') : t('Square')}
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

