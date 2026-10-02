import React, { useState } from 'react';
import type { DocumentProject, ScannedPage } from '../types/scanner';
import { Header } from './Header';
import { PdfExportModal } from './PdfExportModal';
import { PageReorderModal } from './PageReorderModal';
import {
  Share2,
  Camera,
  Layers,
  Trash2,
  Edit2,
  Maximize2,
  Plus,
  FileText,
  Crop,
  Sliders,
  Check,
} from 'lucide-react';

interface DocumentDetailProps {
  document: DocumentProject;
  onBack: () => void;
  onUpdateDocument: (updated: DocumentProject) => void;
  onDeleteDocument: (docId: string) => void;
  onAddPage: (docId: string) => void;
  onCropPage: (docId: string, pageId: string) => void;
  onFilterPage: (docId: string, pageId: string) => void;
}

export const DocumentDetail: React.FC<DocumentDetailProps> = ({
  document,
  onBack,
  onUpdateDocument,
  onDeleteDocument,
  onAddPage,
  onCropPage,
  onFilterPage,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>(document.title);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isReorderOpen, setIsReorderOpen] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<ScannedPage | null>(null);

  const handleSaveTitle = () => {
    if (titleInput.trim()) {
      onUpdateDocument({ ...document, title: titleInput.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleReorderPagesSave = (newPages: ScannedPage[]) => {
    onUpdateDocument({ ...document, pages: newPages });
  };

  return (
    <div className="flex flex-col h-full bg-black text-white select-none">
      <Header
        title={document.title}
        showBack
        onBack={onBack}
        rightAction={
          <button
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold shadow-md shadow-white/10 active:scale-95 transition-all"
          >
            <Share2 className="h-4 w-4" /> Export PDF
          </button>
        }
      />

      {/* Document Workspace Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="bg-zinc-900 border border-zinc-600 rounded-lg px-2.5 py-1 text-sm font-semibold text-white focus:outline-none focus:border-white"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                className="p-1 rounded-lg bg-white text-black hover:bg-zinc-200"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100">{document.title}</h2>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-zinc-400 hover:text-white p-1"
                aria-label="Edit Title"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <span className="text-xs text-zinc-300 font-semibold bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-800">
            {document.pages.length} {document.pages.length === 1 ? 'Page' : 'Pages'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReorderOpen(true)}
            disabled={document.pages.length <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 active:scale-95 disabled:opacity-40"
          >
            <Layers className="h-3.5 w-3.5 text-zinc-400" /> Reorder
          </button>
          <button
            onClick={() => onDeleteDocument(document.id)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-zinc-800 active:scale-95"
            aria-label="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pages Grid Workspace */}
      <div className="flex-1 overflow-y-auto p-4">
        {document.pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-16 w-16 text-zinc-700 mb-3" />
            <p className="text-zinc-400 font-medium">No pages scanned yet.</p>
            <button
              onClick={() => onAddPage(document.id)}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200"
            >
              <Camera className="h-4 w-4" /> Scan First Page
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {document.pages.map((page, index) => (
              <div
                key={page.id}
                className="group relative flex flex-col bg-zinc-950 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-zinc-600"
              >
                {/* Page Thumbnail Image */}
                <div
                  onClick={() => setPreviewPage(page)}
                  className={`relative bg-black cursor-pointer overflow-hidden ${document.kind === 'id_card' ? 'aspect-[1.586]' : 'aspect-[3/4]'}`}
                >
                  <img
                    src={page.processedImageBase64 || page.originalImageBase64}
                    alt={`Page ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs font-bold text-zinc-200 backdrop-blur-md border border-zinc-700">
                    {index + 1}
                  </span>
                  {page.side && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-bold uppercase tracking-wider text-zinc-200 backdrop-blur-md border border-zinc-700">
                      {page.side}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="h-8 w-8 text-white drop-shadow-md" />
                  </div>
                </div>

                {/* Page Action Controls */}
                <div className="flex items-center justify-around p-2 bg-zinc-950 border-t border-zinc-800">
                  <button
                    onClick={() => onCropPage(document.id, page.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white p-1"
                  >
                    <Crop className="h-3.5 w-3.5" /> Crop
                  </button>
                  <div className="h-3 w-px bg-zinc-800" />
                  <button
                    onClick={() => onFilterPage(document.id, page.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white p-1"
                  >
                    <Sliders className="h-3.5 w-3.5" /> Filter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Page Button Bar */}
      <div className="bottom-bar-safe shrink-0 px-4 pt-4 bg-zinc-950 border-t border-zinc-800">
        <button
          onClick={() => onAddPage(document.id)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-sm shadow-xl active:scale-95 transition-all"
        >
          <Plus className="h-5 w-5" /> Add More Pages to Scan
        </button>
      </div>

      {/* Fullscreen Zoom Preview Modal */}
      {previewPage && (
        <div
          onClick={() => setPreviewPage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 cursor-zoom-out"
        >
          <img
            src={previewPage.processedImageBase64 || previewPage.originalImageBase64}
            alt="Page Zoom"
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl border border-zinc-800"
          />
        </div>
      )}

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isExportOpen}
        docProject={document}
        onClose={() => setIsExportOpen(false)}
      />

      {/* Page Reorder Modal */}
      <PageReorderModal
        isOpen={isReorderOpen}
        pages={document.pages}
        onSavePages={handleReorderPagesSave}
        onClose={() => setIsReorderOpen(false)}
      />
    </div>
  );
};
