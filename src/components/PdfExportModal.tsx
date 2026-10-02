import React, { useState } from 'react';
import type { DocumentProject } from '../types/scanner';
import { generatePdf, generateZip, type PdfOptions } from '../utils/pdfGenerator';
import { shareFile } from '../utils/nativeBridge';
import { X, FileText, Download, Share2, Archive, CheckCircle, Loader2 } from 'lucide-react';

interface PdfExportModalProps {
  isOpen: boolean;
  docProject: DocumentProject;
  onClose: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  docProject,
  onClose,
}) => {
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [quality, setQuality] = useState<number>(0.9);
  const [margin] = useState<number>(0);
  const isIdCard = docProject.kind === 'id_card';
  const [idSinglePage, setIdSinglePage] = useState<boolean>(true);
  const [docTitle, setDocTitle] = useState<string>(docProject.title);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const getExportDoc = (): DocumentProject => ({
    ...docProject,
    title: docTitle || docProject.title,
  });

  const handleSharePdf = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    try {
      const options: PdfOptions = { pageSize, quality, margin, idLayout: idSinglePage ? 'single_page' : 'separate' };
      const { blob, filename } = await generatePdf(getExportDoc(), options);
      await shareFile(blob, filename, 'application/pdf');
      setExportSuccess('PDF shared successfully!');
    } catch (err) {
      console.error('PDF Share error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    try {
      const options: PdfOptions = { pageSize, quality, margin, idLayout: idSinglePage ? 'single_page' : 'separate' };
      const { blob, filename } = await generatePdf(getExportDoc(), options);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess('PDF saved to device!');
    } catch (err) {
      console.error('PDF Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZip = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    try {
      const { blob, filename } = await generateZip(getExportDoc());
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess('ZIP archive downloaded!');
    } catch (err) {
      console.error('ZIP Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 text-white shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-zinc-300" />
            <h3 className="text-lg font-bold text-zinc-100">Export Document</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Document Title Input */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1">
            Document Title
          </label>
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="w-full bg-black border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-white"
          />
        </div>

        {/* ID card layout */}
        {isIdCard && (
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              ID Card Layout
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { single: true, label: 'Front + back on 1 page' },
                { single: false, label: 'One side per page' },
              ].map((item) => (
                <button
                  key={String(item.single)}
                  onClick={() => setIdSinglePage(item.single)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                    idSinglePage === item.single
                      ? 'bg-white border-white text-black shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Page Size Selector */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
            Page Size
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'a4', label: 'A4 Standard' },
              { id: 'letter', label: 'US Letter' },
              { id: 'fit', label: 'Auto Fit' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPageSize(item.id as any)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                  pageSize === item.id
                    ? 'bg-white border-white text-black shadow-md'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Selector */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
            Image Quality & Size
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { q: 0.95, label: 'High (Best)' },
              { q: 0.75, label: 'Medium' },
              { q: 0.5, label: 'Compact' },
            ].map((item) => (
              <button
                key={item.q}
                onClick={() => setQuality(item.q)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                  quality === item.q
                    ? 'bg-white border-white text-black shadow-md'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {exportSuccess && (
          <div className="flex items-center gap-2 p-3 bg-zinc-900 border border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-semibold">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            {exportSuccess}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleSharePdf}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold shadow-lg active:scale-95 disabled:opacity-50 transition-all"
          >
            {isExporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Share2 className="h-4 w-4" /> Share PDF
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-800 active:scale-95 disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-zinc-300" /> Save PDF
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-800 active:scale-95 disabled:opacity-50"
            >
              <Archive className="h-4 w-4 text-zinc-300" /> Export Images (ZIP)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
