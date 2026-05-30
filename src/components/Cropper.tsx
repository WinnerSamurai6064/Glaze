/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Check, X, RotateCw } from 'lucide-react';

interface CropperProps {
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onCancel: () => void;
}

export function Cropper({ imageSrc, onCropComplete, onCancel }: CropperProps) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  const SIZE = 240; // Crop box size (circular)

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      imgRef.current = img;
      // Reset variables on load
      setZoom(1.0);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      drawCanvas();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    drawCanvas();
  }, [zoom, rotation, offset, imageSrc]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save state
    ctx.save();

    // Move grid starting point to center
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Draw image applying zoom and dragging offset coordinates
    const drawWidth = img.width * zoom;
    const drawHeight = img.height * zoom;

    // Calculate aspect scale to cover the canvas properly
    const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom;
    const w = img.width * scale;
    const h = img.height * scale;

    ctx.drawImage(
      img,
      -w / 2 + offset.x,
      -h / 2 + offset.y,
      w,
      h
    );

    ctx.restore();

    // Draw circular mask outline to help the user align
    ctx.strokeStyle = '#ff6b00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, SIZE / 2, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Touch Support for Mobile-First experience
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const crop = () => {
    const img = imgRef.current;
    const sourceCanvas = canvasRef.current;
    if (!img || !sourceCanvas) return;

    // Create a square off-screen canvas specifically matching the circular preview dimensions
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = SIZE;
    outputCanvas.height = SIZE;
    const outCtx = outputCanvas.getContext('2d');
    if (!outCtx) return;

    // Grab exactly the central crop rectangle from our interactive viewport
    outCtx.beginPath();
    outCtx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, 2 * Math.PI);
    outCtx.clip();

    outCtx.drawImage(
      sourceCanvas,
      (sourceCanvas.width - SIZE) / 2,
      (sourceCanvas.height - SIZE) / 2,
      SIZE,
      SIZE,
      0,
      0,
      SIZE,
      SIZE
    );

    const croppedBase64 = outputCanvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(croppedBase64);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-panel rounded-2xl w-full max-w-sm mx-auto shadow-2xl space-y-6">
      <div className="w-full flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="font-semibold text-lg text-white">Adjust Avatar</h3>
        <button 
          id="cropper-cancel-icon-btn"
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Viewport Canvas Wrapper */}
      <div className="relative border border-orange-500/20 rounded-full overflow-hidden w-[260px] h-[260px] flex items-center justify-center bg-black/60 shadow-inner">
        <canvas
          id="profile-picture-cropping-canvas"
          ref={canvasRef}
          width={260}
          height={260}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
          className="cursor-move rounded-full"
        />
        <div className="absolute inset-0 border-4 border-black/40 pointer-events-none rounded-full" />
      </div>

      {/* Interactive Controls */}
      <div className="w-full space-y-4">
        <div className="flex items-center space-x-3 text-xs text-gray-400">
          <ZoomOut size={16} />
          <input
            id="cropper-zoom-range-input"
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-brand-orange bg-white/10 h-1 rounded-lg range-sm cursor-pointer"
          />
          <ZoomIn size={16} />
        </div>

        <div className="flex items-center justify-between">
          <button 
            id="cropper-rotate-btn"
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            className="flex items-center space-x-1 text-xs border border-white/10 px-3 py-1.5 rounded-full hover:bg-white/5 text-gray-300 hover:text-white transition-all"
          >
            <RotateCw size={13} className="text-brand-orange" />
            <span>Rotate</span>
          </button>
          
          <div className="text-[10px] font-mono text-gray-500 tracking-wide">
            DRAG IMAGE TO ALIGN
          </div>
        </div>
      </div>

      <div className="w-full flex items-center space-x-3 pt-2">
        <button
          id="cropper-cancel-btn"
          onClick={onCancel}
          className="flex-1 text-center py-2 text-sm font-semibold rounded-full border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white transition-all"
        >
          Cancel
        </button>
        <button
          id="cropper-save-btn"
          onClick={crop}
          className="flex-1 py-2 text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover rounded-full transition-all flex items-center justify-center space-x-1 shadow-md shadow-brand-orange/20"
        >
          <Check size={16} />
          <span>Apply Crop</span>
        </button>
      </div>
    </div>
  );
}
