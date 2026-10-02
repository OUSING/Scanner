import React, { useRef, useState, useEffect } from 'react';
import type { Corners, Point } from '../types/scanner';
import { autoDetectCorners, getDefaultCorners, imageToCanvas, loadImage, warpPerspective } from '../utils/imageProcessing';
import { Check, RefreshCw, ScanLine } from 'lucide-react';
import { triggerHaptic } from '../utils/nativeBridge';

interface CropEditorProps {
  imageSrc: string;
  initialCorners?: Corners;
  lockAspect?: number;
  onSaveCrop: (warpedCanvas: HTMLCanvasElement, corners: Corners) => void;
  onCancel: () => void;
}

export const CropEditor: React.FC<CropEditorProps> = ({
  imageSrc,
  initialCorners,
  lockAspect,
  onSaveCrop,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Corners>(initialCorners || getDefaultCorners());
  const [activeCornerKey, setActiveCornerKey] = useState<keyof Corners | null>(null);
  const [magnifierPos, setMagnifierPos] = useState<Point | null>(null);

  useEffect(() => {
    loadImage(imageSrc).then((loadedImg) => {
      setImage(loadedImg);
      const canvas = imageToCanvas(loadedImg);
      if (!initialCorners) {
        const detected = autoDetectCorners(canvas);
        setCorners(detected);
      }
    });
  }, [imageSrc]);

  // Redraw canvas with quadrilateral edge lines & handles whenever corners change
  useEffect(() => {
    if (!image || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;

    // Calculate fitted canvas aspect ratio inside viewport
    const scale = Math.min(cw / imgW, ch / imgH);
    const displayW = Math.floor(imgW * scale);
    const displayH = Math.floor(imgH * scale);

    canvas.width = displayW;
    canvas.height = displayH;

    // Draw background image
    ctx.drawImage(image, 0, 0, displayW, displayH);

    // Convert corners (0..1) to display canvas coordinates
    const tl = { x: corners.topLeft.x * displayW, y: corners.topLeft.y * displayH };
    const tr = { x: corners.topRight.x * displayW, y: corners.topRight.y * displayH };
    const br = { x: corners.bottomRight.x * displayW, y: corners.bottomRight.y * displayH };
    const bl = { x: corners.bottomLeft.x * displayW, y: corners.bottomLeft.y * displayH };

    // Draw dark shaded mask outside quadrilateral
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, displayW, displayH);
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill('evenodd');

    // Draw active quad border lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();

    // Draw Corner Handles
    const handles = [
      { key: 'topLeft', pt: tl },
      { key: 'topRight', pt: tr },
      { key: 'bottomRight', pt: br },
      { key: 'bottomLeft', pt: bl },
    ];

    handles.forEach(({ key, pt }) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14, 0, 2 * Math.PI);
      ctx.fillStyle = activeCornerKey === key ? '#ffffff' : '#27272a';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = activeCornerKey === key ? '#000000' : '#ffffff';
      ctx.fill();
    });
  }, [image, corners, activeCornerKey]);

  // Touch / Pointer Event Handlers for Draggable Corners
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Find nearest corner
    const keys: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    let minDistance = Infinity;
    let closestKey: keyof Corners | null = null;

    keys.forEach((k) => {
      const dist = Math.hypot(corners[k].x - clickX, corners[k].y - clickY);
      if (dist < minDistance && dist < 0.15) {
        minDistance = dist;
        closestKey = k;
      }
    });

    if (closestKey) {
      setActiveCornerKey(closestKey);
      setMagnifierPos({ x: clickX, y: clickY });
      triggerHaptic();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeCornerKey || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setCorners((prev) => ({
      ...prev,
      [activeCornerKey]: { x: newX, y: newY },
    }));
    setMagnifierPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeCornerKey) {
      setActiveCornerKey(null);
      setMagnifierPos(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handleAutoDetect = () => {
    if (image) {
      const canvas = imageToCanvas(image);
      const detected = autoDetectCorners(canvas);
      setCorners(detected);
      triggerHaptic();
    }
  };

  const handleReset = () => {
    setCorners(getDefaultCorners());
    triggerHaptic();
  };

  const handleSave = async () => {
    if (!image) return;
    await triggerHaptic();
    const srcCanvas = imageToCanvas(image);
    const warpedCanvas = warpPerspective(srcCanvas, corners, lockAspect);
    onSaveCrop(warpedCanvas, corners);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white select-none">
      {/* Top Action Bar */}
      <div
        className="flex items-center justify-between px-4 pb-3 bg-zinc-950 border-b border-zinc-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 28px), 28px)' }}
      >
        <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-zinc-400" /> Adjust Document Corners
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoDetect}
            className="flex items-center gap-1 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 active:scale-95"
          >
            <ScanLine className="h-3.5 w-3.5" /> Auto-Detect
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div ref={containerRef} className="relative flex-1 flex items-center justify-center p-4 overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="touch-none cursor-crosshair rounded-lg shadow-2xl"
        />

        {/* Loupe / Magnifier Lens Overlay */}
        {activeCornerKey && magnifierPos && image && canvasRef.current && (
          <div
            className="absolute pointer-events-none rounded-full border-4 border-white bg-black shadow-2xl overflow-hidden w-28 h-28 z-40"
            style={{
              left: `${magnifierPos.x * 100}%`,
              top: `${magnifierPos.y * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={imageSrc}
                alt="magnifier"
                className="absolute max-w-none"
                style={{
                  width: `${canvasRef.current.width * 2.5}px`,
                  left: `-${magnifierPos.x * canvasRef.current.width * 2.5 - 56}px`,
                  top: `-${magnifierPos.y * canvasRef.current.height * 2.5 - 56}px`,
                }}
              />
              <div className="absolute w-2 h-2 rounded-full bg-white ring-2 ring-black" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div
        className="flex items-center justify-between px-6 pt-4 bg-zinc-950 border-t border-zinc-800"
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 24px) + 16px), 36px)' }}
      >
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-800 active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold shadow-lg active:scale-95 transition-all"
        >
          <Check className="h-4 w-4" /> Next: Filters
        </button>
      </div>
    </div>
  );
};
