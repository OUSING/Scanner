import React from 'react';
import type { ScannedPage } from '../types/scanner';
import { X, ArrowLeft, ArrowRight, Trash2, Copy, Check } from 'lucide-react';

interface PageReorderModalProps {
  isOpen: boolean;
  pages: ScannedPage[];
  onSavePages: (pages: ScannedPage[]) => void;
  onClose: () => void;
}

export const PageReorderModal: React.FC<PageReorderModalProps> = ({
  isOpen,
  pages: initialPages,
  onSavePages,
  onClose,
}) => {
  const [pages, setPages] = React.useState<ScannedPage[]>(initialPages);

  React.useEffect(() => {
    setPages(initialPages);
  }, [initialPages]);

  if (!isOpen) return null;

  const movePage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const updated = [...pages];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setPages(updated);
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) return;
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);
  };

  const duplicatePage = (index: number) => {
    const pageToDup = pages[index];
    const newPage: ScannedPage = {
      ...pageToDup,
      id: 'page_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    };
    const updated = [...pages];
    updated.splice(index + 1, 0, newPage);
    setPages(updated);
  };

  const handleSave = () => {
    onSavePages(pages);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3 bg-zinc-950 border-b border-zinc-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 28px), 28px)' }}
      >
        <h3 className="text-sm font-bold text-zinc-200">Organize & Reorder Pages</h3>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Pages Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {pages.map((page, idx) => (
            <div
              key={page.id}
              className="relative flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg p-2 space-y-2"
            >
              <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
                <img
                  src={page.processedImageBase64 || page.originalImageBase64}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-black shadow-md">
                  {idx + 1}
                </span>
              </div>

              {/* Action Buttons per page */}
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800/80 rounded-xl p-1">
                <button
                  disabled={idx === 0}
                  onClick={() => movePage(idx, 'left')}
                  className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                  aria-label="Move left"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => duplicatePage(idx)}
                  className="p-1.5 text-zinc-400 hover:text-white"
                  aria-label="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  disabled={pages.length <= 1}
                  onClick={() => deletePage(idx)}
                  className="p-1.5 text-zinc-400 hover:text-rose-400 disabled:opacity-30"
                  aria-label="Delete page"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  disabled={idx === pages.length - 1}
                  onClick={() => movePage(idx, 'right')}
                  className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                  aria-label="Move right"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end px-6 pt-4 bg-zinc-950 border-t border-zinc-800"
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 24px) + 16px), 36px)' }}
      >
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold shadow-lg active:scale-95 transition-all"
        >
          <Check className="h-4 w-4" /> Save Page Order
        </button>
      </div>
    </div>
  );
};
