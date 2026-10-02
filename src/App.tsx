import { useState, useEffect } from 'react';
import type { DocumentProject, ScannedPage, ViewState, Corners, PageAdjustments, DocumentKind, IdSide } from './types/scanner';
import { ID_CARD_ASPECT } from './types/scanner';
import { createNewDocument, deleteDocument, getAllDocuments, getDocumentById, saveDocument } from './db/scannerDb';
import { autoDetectCorners, applyFiltersAndAdjustments, loadImage, imageToCanvas, warpPerspective } from './utils/imageProcessing';
import { DocumentList } from './components/DocumentList';
import { DocumentDetail } from './components/DocumentDetail';
import { CameraModal } from './components/CameraModal';
import { CropEditor } from './components/CropEditor';
import { FilterEditor } from './components/FilterEditor';
import { PdfExportModal } from './components/PdfExportModal';
import { SplashScreen } from './components/SplashScreen';

// Real ID-1 card proportions for ID documents, free-form for everything else
const aspectFor = (doc: DocumentProject | null | undefined): number | undefined =>
  doc?.kind === 'id_card' ? ID_CARD_ASPECT : undefined;

// Front is scanned first, then back (alternating if more pages are added)
const nextIdSide = (doc: DocumentProject | null | undefined): IdSide =>
  (doc?.pages.length ?? 0) % 2 === 0 ? 'front' : 'back';

export function App() {
  const [documents, setDocuments] = useState<DocumentProject[]>([]);
  const [viewState, setViewState] = useState<ViewState>({ mode: 'library' });
  const [activeDoc, setActiveDoc] = useState<DocumentProject | null>(null);

  // Active page editing transient state
  const [editingImageSrc, setEditingImageSrc] = useState<string | null>(null);
  const [editingCanvas, setEditingCanvas] = useState<HTMLCanvasElement | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingCorners, setEditingCorners] = useState<Corners | undefined>(undefined);
  const [editingAdjustments, setEditingAdjustments] = useState<PageAdjustments | undefined>(undefined);

  // PDF Export Modal State
  const [exportDocModal, setExportDocModal] = useState<DocumentProject | null>(null);

  // Lottie splash shown on launch
  const [showSplash, setShowSplash] = useState<boolean>(true);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  };

  const handleSelectDoc = async (docId: string) => {
    const doc = await getDocumentById(docId);
    if (doc) {
      setActiveDoc(doc);
      setViewState({ mode: 'document_detail', docId });
    }
  };

  const handleStartNewScan = async (kind: DocumentKind = 'document') => {
    const newDoc = await createNewDocument(undefined, [], kind);
    setActiveDoc(newDoc);
    await loadDocs();
    setViewState({ mode: 'camera', docId: newDoc.id });
  };

  const handleAddPageToDoc = (docId: string) => {
    setViewState({ mode: 'camera', docId });
  };

  // Called when a page image is captured from Camera / Gallery
  const handleCapturePage = async (imageBase64: string, isBatch: boolean) => {
    if (!activeDoc) return;

    const loadedImg = await loadImage(imageBase64);
    const canvas = imageToCanvas(loadedImg);
    const autoCorners = autoDetectCorners(canvas);
    const isId = activeDoc.kind === 'id_card';
    const side = isId ? nextIdSide(activeDoc) : undefined;

    // Documents get the magic filter; ID cards keep their original colours (photo, hologram, stamps)
    const defaultAdjustments: PageAdjustments = {
      corners: autoCorners,
      rotation: 0,
      filter: isId ? 'original' : 'magic',
      brightness: 0,
      contrast: 0,
      sharpen: 0,
    };

    const warpedCanvas = warpPerspective(canvas, autoCorners, aspectFor(activeDoc));
    const processedCanvas = applyFiltersAndAdjustments(warpedCanvas, defaultAdjustments);

    const newPage: ScannedPage = {
      id: 'page_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      side,
      originalImageBase64: imageBase64,
      processedImageBase64: processedCanvas.toDataURL('image/jpeg', 0.9),
      adjustments: defaultAdjustments,
      createdAt: Date.now(),
    };

    const updatedDoc: DocumentProject = {
      ...activeDoc,
      pages: [...activeDoc.pages, newPage],
    };

    await saveDocument(updatedDoc);
    setActiveDoc(updatedDoc);
    await loadDocs();

    // ID card: after the back side is captured, jump to the result so both sides can be checked
    if (isId && side === 'back') {
      setViewState({ mode: 'document_detail', docId: updatedDoc.id });
      return;
    }

    if (!isBatch) {
      // Go to Crop Editor for single scan precision
      setEditingImageSrc(imageBase64);
      setEditingPageId(newPage.id);
      setEditingCorners(autoCorners);
      setViewState({ mode: 'crop', docId: updatedDoc.id, pageId: newPage.id });
    }
  };

  const handleStartCropPage = (docId: string, pageId: string) => {
    if (!activeDoc) return;
    const page = activeDoc.pages.find((p) => p.id === pageId);
    if (!page) return;

    setEditingImageSrc(page.originalImageBase64);
    setEditingPageId(page.id);
    setEditingCorners(page.adjustments.corners);
    setViewState({ mode: 'crop', docId, pageId });
  };

  const handleSaveCrop = (warpedCanvas: HTMLCanvasElement, corners: Corners) => {
    setEditingCanvas(warpedCanvas);
    setEditingCorners(corners);
    if (activeDoc && editingPageId) {
      setViewState({ mode: 'filter', docId: activeDoc.id, pageId: editingPageId });
    }
  };

  const handleStartFilterPage = async (docId: string, pageId: string) => {
    if (!activeDoc) return;
    const page = activeDoc.pages.find((p) => p.id === pageId);
    if (!page) return;

    const loadedImg = await loadImage(page.originalImageBase64);
    const canvas = imageToCanvas(loadedImg);
    const warped = warpPerspective(canvas, page.adjustments.corners, aspectFor(activeDoc));

    setEditingCanvas(warped);
    setEditingPageId(page.id);
    setEditingAdjustments(page.adjustments);
    setViewState({ mode: 'filter', docId, pageId });
  };

  const handleSaveFilter = async (
    processedCanvas: HTMLCanvasElement,
    adjustments: PageAdjustments,
    applyToAll?: boolean
  ) => {
    if (!activeDoc || !editingPageId) return;

    const finalCorners = editingCorners || adjustments.corners;
    const updatedAdjustments = { ...adjustments, corners: finalCorners };

    let updatedPages: ScannedPage[];

    if (applyToAll && activeDoc.pages.length > 1) {
      updatedPages = await Promise.all(
        activeDoc.pages.map(async (p) => {
          if (p.id === editingPageId) {
            return {
              ...p,
              processedImageBase64: processedCanvas.toDataURL('image/jpeg', 0.9),
              adjustments: updatedAdjustments,
            };
          }
          const loadedImg = await loadImage(p.originalImageBase64);
          const canvas = imageToCanvas(loadedImg);
          const warped = warpPerspective(canvas, p.adjustments.corners, aspectFor(activeDoc));
          const pageAdj: PageAdjustments = {
            ...adjustments,
            corners: p.adjustments.corners,
            rotation: p.adjustments.rotation,
          };
          const processed = applyFiltersAndAdjustments(warped, pageAdj);
          return {
            ...p,
            processedImageBase64: processed.toDataURL('image/jpeg', 0.9),
            adjustments: pageAdj,
          };
        })
      );
    } else {
      updatedPages = activeDoc.pages.map((p) => {
        if (p.id === editingPageId) {
          return {
            ...p,
            processedImageBase64: processedCanvas.toDataURL('image/jpeg', 0.9),
            adjustments: updatedAdjustments,
          };
        }
        return p;
      });
    }

    const updatedDoc: DocumentProject = {
      ...activeDoc,
      pages: updatedPages,
    };

    await saveDocument(updatedDoc);
    setActiveDoc(updatedDoc);
    await loadDocs();
    setViewState({ mode: 'document_detail', docId: updatedDoc.id });
  };

  const handleUpdateDocument = async (updated: DocumentProject) => {
    await saveDocument(updated);
    setActiveDoc(updated);
    await loadDocs();
  };

  const handleDeleteDocument = async (docId: string) => {
    await deleteDocument(docId);
    if (activeDoc?.id === docId) setActiveDoc(null);
    await loadDocs();
    setViewState({ mode: 'library' });
  };

  return (
    <div className="h-screen w-screen bg-black font-sans overflow-hidden text-zinc-100">
      {/* 1. Library View */}
      {viewState.mode === 'library' && (
        <DocumentList
          documents={documents}
          onSelectDocument={handleSelectDoc}
          onNewScan={() => handleStartNewScan('document')}
          onNewIdScan={() => handleStartNewScan('id_card')}
          onDeleteDocument={handleDeleteDocument}
          onExportDocument={(doc) => setExportDocModal(doc)}
        />
      )}

      {/* 2. Document Detail Workspace */}
      {viewState.mode === 'document_detail' && activeDoc && (
        <DocumentDetail
          document={activeDoc}
          onBack={() => setViewState({ mode: 'library' })}
          onUpdateDocument={handleUpdateDocument}
          onDeleteDocument={handleDeleteDocument}
          onAddPage={handleAddPageToDoc}
          onCropPage={handleStartCropPage}
          onFilterPage={handleStartFilterPage}
        />
      )}

      {/* 3. Camera Capture Modal */}
      {viewState.mode === 'camera' && (
        <CameraModal
          isOpen={true}
          onClose={() => {
            if (activeDoc && activeDoc.pages.length > 0) {
              setViewState({ mode: 'document_detail', docId: activeDoc.id });
            } else {
              setViewState({ mode: 'library' });
            }
          }}
          onCapture={handleCapturePage}
          idMode={activeDoc?.kind === 'id_card'}
          idSide={nextIdSide(activeDoc)}
        />
      )}

      {/* 4. 4-Corner Crop Perspective View */}
      {viewState.mode === 'crop' && editingImageSrc && (
        <CropEditor
          imageSrc={editingImageSrc}
          initialCorners={editingCorners}
          lockAspect={aspectFor(activeDoc)}
          onSaveCrop={handleSaveCrop}
          onCancel={() => {
            if (activeDoc) setViewState({ mode: 'document_detail', docId: activeDoc.id });
            else setViewState({ mode: 'library' });
          }}
        />
      )}

      {/* 5. Filter & Enhancement View */}
      {viewState.mode === 'filter' && editingCanvas && (
        <FilterEditor
          imageCanvas={editingCanvas}
          initialAdjustments={editingAdjustments}
          totalPages={activeDoc?.pages.length || 1}
          onSaveFilter={handleSaveFilter}
          onBackToCrop={() => {
            if (activeDoc && editingPageId) {
              setViewState({ mode: 'crop', docId: activeDoc.id, pageId: editingPageId });
            }
          }}
        />
      )}

      {/* Launch splash (Lottie) */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* Export Modal triggered from Library */}
      {exportDocModal && (
        <PdfExportModal
          isOpen={true}
          docProject={exportDocModal}
          onClose={() => setExportDocModal(null)}
        />
      )}
    </div>
  );
}
