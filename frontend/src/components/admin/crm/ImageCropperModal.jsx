import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Move } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

export default function ImageCropperModal({ imageSrc, onCropComplete, onClose, title }) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const CROP_SIZE = 260; // preview crop circle/square size in px

  // Reset transform when new image loads
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, [imageSrc]);

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
    const OUTPUT_SIZE = 360; // Clean 360x360 square
    outputCanvas.width = OUTPUT_SIZE;
    outputCanvas.height = OUTPUT_SIZE;
    const ctx = outputCanvas.getContext('2d');

    // Ratio between rendered container scale and natural image dimensions
    const renderedWidth = img.width * zoom;
    const renderedHeight = img.height * zoom;

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
    const croppedDataUrl = outputCanvas.toDataURL('image/jpeg', 0.85);
    onCropComplete(croppedDataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[999999] flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#FDFBF7] border-b border-[#E8DCCB]">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800">{title || t('Crop Photo')}</h3>
            <p className="text-[11px] text-slate-500">{t('Drag to position & zoom to fit')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport / Drag Box */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="relative w-full h-[300px] bg-slate-900 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
        >
          {/* Circular Crop Guide Mask */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div
              style={{ width: `${CROP_SIZE}px`, height: `${CROP_SIZE}px` }}
              className="rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] relative"
            >
              {/* Center crosshair */}
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <Move size={20} className="text-white" />
              </div>
            </div>
          </div>

          {/* Movable & Zoomable Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop source"
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              maxWidth: 'none',
              maxHeight: 'none'
            }}
            className="pointer-events-none select-none max-w-[280px]"
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-3 bg-[#FDFBF7]">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <ZoomOut size={16} className="text-slate-500 shrink-0" />
            <input
              type="range"
              min="0.6"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#ea580c]"
            />
            <ZoomIn size={16} className="text-slate-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-600 font-mono w-9 text-right shrink-0">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <RotateCw size={13} />
              <span>{t('Rotate')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
                setRotation(0);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              {t('Reset')}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              onClick={handleCrop}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
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

