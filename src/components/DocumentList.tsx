import React, { useState } from 'react';
import type { DocumentProject } from '../types/scanner';
import { Header } from './Header';
import { Camera, IdCard, Search, FileText, Share2, Trash2, Calendar, ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../utils/nativeBridge';

interface DocumentListProps {
  documents: DocumentProject[];
  onSelectDocument: (docId: string) => void;
  onNewScan: () => void;
  onNewIdScan: () => void;
  onDeleteDocument: (docId: string) => void;
  onExportDocument: (doc: DocumentProject) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onSelectDocument,
  onNewScan,
  onNewIdScan,
  onDeleteDocument,
  onExportDocument,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-black text-white select-none relative">
      <Header title="Paper Scanner" />

      {/* Search Bar */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search saved documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>
      </div>

      {/* Document Library Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-center px-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-900 border border-zinc-800 text-zinc-400 mb-4 shadow-xl">
              <FileText className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-zinc-200">No Documents Found</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              {searchQuery
                ? 'No document titles matched your search query.'
                : 'Tap the scan button below to capture paper documents into crisp PDFs.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pb-36">
            {filteredDocs.map((doc) => {
              const coverPage = doc.pages[0];
              const dateStr = new Date(doc.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    triggerHaptic();
                    onSelectDocument(doc.id);
                  }}
                  className="group relative flex items-center gap-3.5 bg-zinc-950 border border-zinc-800/90 hover:border-zinc-600 rounded-2xl p-3 cursor-pointer transition-all shadow-md active:scale-[0.99]"
                >
                  {/* Page Preview Thumbnail */}
                  <div className="relative h-16 w-14 rounded-xl bg-black overflow-hidden shrink-0 border border-zinc-800">
                    {coverPage ? (
                      <img
                        src={coverPage.processedImageBase64 || coverPage.originalImageBase64}
                        alt={doc.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-600">
                        <FileText className="h-6 w-6" />
                      </div>
                    )}
                    {doc.kind === 'id_card' && (
                      <span className="absolute top-1 left-1 flex h-4 px-1 items-center justify-center rounded bg-white text-[9px] font-extrabold text-black">
                        ID
                      </span>
                    )}
                    <span className="absolute bottom-1 right-1 flex h-4 px-1 items-center justify-center rounded bg-black/90 text-[10px] font-bold text-zinc-300 border border-zinc-800">
                      {doc.pages.length}p
                    </span>
                  </div>

                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-zinc-100 truncate group-hover:text-white transition-colors">
                      {doc.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-zinc-500" /> {dateStr}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic();
                        onExportDocument(doc);
                      }}
                      className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      aria-label="Export PDF"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic();
                        onDeleteDocument(doc.id);
                      }}
                      className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Buttons - Positioned safely above Android navigation bar */}
      <div
        style={{ bottom: 'max(calc(env(safe-area-inset-bottom, 24px) + 32px), 64px)' }}
        className="fixed right-6 z-40 flex flex-col items-end gap-3"
      >
        <button
          onClick={() => {
            triggerHaptic();
            onNewIdScan();
          }}
          className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold shadow-2xl shadow-black/80 border border-zinc-700 transition-all active:scale-95"
        >
          <IdCard className="h-5 w-5 text-white" />
          <span className="text-sm tracking-wide">Scan ID Card</span>
        </button>
        <button
          onClick={() => {
            triggerHaptic();
            onNewScan();
          }}
          className="flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-black font-bold shadow-2xl shadow-black/80 border border-white/40 transition-all active:scale-95"
        >
          <Camera className="h-5 w-5 text-black" />
          <span className="text-sm tracking-wide">Scan Paper</span>
        </button>
      </div>
    </div>
  );
};
