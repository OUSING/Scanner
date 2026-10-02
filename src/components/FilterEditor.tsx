import React, { useRef, useState, useEffect } from 'react';
import type { FilterMode, PageAdjustments } from '../types/scanner';
import { applyFiltersAndAdjustments } from '../utils/imageProcessing';
import { Sparkles, FileText, Sun, Contrast, RotateCw, Check, ArrowLeft, Zap, Layers, Loader2 } from 'lucide-react';
import { triggerHaptic } from '../utils/nativeBridge';

interface FilterEditorProps {
  imageCanvas: HTMLCanvasElement;
  initialAdjustments?: PageAdjustments;
  totalPages?: number;
  onSaveFilter: (processedCanvas: HTMLCanvasElement, adjustments: PageAdjustments, applyToAll?: boolean) => void;
  onBackToCrop: () => void;
}

export const FilterEditor: React.FC<FilterEditorProps> = ({
  imageCanvas,
  initialAdjustments,
  totalPages = 1,
  onSaveFilter,
  onBackToCrop,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [adjustments, setAdjustments] = useState<PageAdjustments>(
    initialAdjustments || {
      corners: { topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomRight: { x: 1, y: 1 }, bottomLeft: { x: 0, y: 1 } },
      rotation: 0,
      filter: 'magic',
      brightness: 0,
      contrast: 0,
      sharpen: 0,
    }
  );

  const [activeTab, setActiveTab] = useState<'presets' | 'adjust'>('presets');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Re-apply filters onto preview canvas
  useEffect(() => {
    if (!previewCanvasRef.current) return;
    const processedCanvas = applyFiltersAndAdjustments(imageCanvas, adjustments);

    const dest = previewCanvasRef.current;
    dest.width = processedCanvas.width;
    dest.height = processedCanvas.height;

    const ctx = dest.getContext('2d');
    if (ctx) {
      ctx.drawImage(processedCanvas, 0, 0);
    }
  }, [imageCanvas, adjustments]);

  const handleFilterChange = (filter: FilterMode) => {
    setAdjustments((prev) => ({ ...prev, filter }));
    triggerHaptic();
  };

  const handleRotate = () => {
    setAdjustments((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
    triggerHaptic();
  };

  const handleSaveSingle = async () => {
    await triggerHaptic();
    setIsProcessing(true);
    const finalCanvas = applyFiltersAndAdjustments(imageCanvas, adjustments);
    onSaveFilter(finalCanvas, adjustments, false);
  };

  const handleSaveAll = async () => {
    await triggerHaptic();
    setIsProcessing(true);
    const finalCanvas = applyFiltersAndAdjustments(imageCanvas, adjustments);
    onSaveFilter(finalCanvas, adjustments, true);
  };

  const filterOptions: { mode: FilterMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'magic', label: 'Magic Scan', icon: <Sparkles className="h-4 w-4 text-amber-400" /> },
    { mode: 'grayscale', label: 'Grayscale', icon: <FileText className="h-4 w-4 text-zinc-300" /> },
    { mode: 'bw', label: 'B & W', icon: <div className="h-4 w-4 rounded-full border border-white bg-black" /> },
    { mode: 'sharpen', label: 'Sharpen', icon: <Zap className="h-4 w-4 text-zinc-300" /> },
    { mode: 'original', label: 'Original', icon: <Sun className="h-4 w-4 text-zinc-400" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-black text-white select-none">
      {/* Header Bar */}
      <div
        className="flex items-center justify-between px-4 pb-3 bg-zinc-950 border-b border-zinc-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 28px), 28px)' }}
      >
        <button
          onClick={onBackToCrop}
          className="flex items-center gap-1 text-zinc-300 hover:text-white text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Re-Crop
        </button>
        <span className="text-sm font-bold text-zinc-200">Enhance Document Scan</span>
        <button
          onClick={handleRotate}
          className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-800 active:scale-95"
        >
          <RotateCw className="h-3.5 w-3.5" /> Rotate
        </button>
      </div>

      {/* Main Image Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-black">
        <canvas
          ref={previewCanvasRef}
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl border border-zinc-800"
        />
      </div>

      {/* Control Panel Tabs */}
      <div className="bg-zinc-950 border-t border-zinc-800">
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors ${
              activeTab === 'presets'
                ? 'text-white border-b-2 border-white bg-zinc-900/60'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Presets
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors ${
              activeTab === 'adjust'
                ? 'text-white border-b-2 border-white bg-zinc-900/60'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Adjustments
          </button>
        </div>

        {/* Presets Strip */}
        {activeTab === 'presets' && (
          <div className="flex items-center gap-3 overflow-x-auto p-4 scrollbar-none">
            {filterOptions.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => handleFilterChange(opt.mode)}
                className={`flex flex-col items-center gap-2 p-3 min-w-[85px] rounded-xl border transition-all active:scale-95 ${
                  adjustments.filter === opt.mode
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {opt.icon}
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Manual Sliders */}
        {activeTab === 'adjust' && (
          <div className="p-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-1">
                <span className="flex items-center gap-1"><Sun className="h-3.5 w-3.5 text-amber-400" /> Brightness</span>
                <span>{adjustments.brightness}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.brightness}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, brightness: parseInt(e.target.value) }))
                }
                className="w-full accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-1">
                <span className="flex items-center gap-1"><Contrast className="h-3.5 w-3.5 text-zinc-400" /> Contrast</span>
                <span>{adjustments.contrast}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.contrast}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, contrast: parseInt(e.target.value) }))
                }
                className="w-full accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-1">
                <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-zinc-400" /> Sharpen</span>
                <span>{adjustments.sharpen}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={adjustments.sharpen}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, sharpen: parseInt(e.target.value) }))
                }
                className="w-full accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Bottom Save Action Area */}
        <div
          className="flex items-center justify-between gap-3 px-6 pt-3 border-t border-zinc-800"
          style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 24px) + 16px), 36px)' }}
        >
          {totalPages > 1 ? (
            <>
              <button
                onClick={handleSaveAll}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-700 shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : (
                  <Layers className="h-4 w-4 text-zinc-300" />
                )}
                <span>Apply to All ({totalPages})</span>
              </button>

              <button
                onClick={handleSaveSingle}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <Check className="h-4 w-4 text-black" />
                )}
                <span>This Page Only</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleSaveSingle}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin text-black" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>Save Page</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
