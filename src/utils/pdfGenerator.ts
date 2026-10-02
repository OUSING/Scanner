import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { DocumentProject } from '../types/scanner';

export interface PdfOptions {
  pageSize: 'a4' | 'letter' | 'fit';
  quality: number; // 0.1 to 1.0
  margin: number; // in mm
  title?: string;
  /** ID card documents: put front + back on one page at real card size (default) or one image per page */
  idLayout?: 'single_page' | 'separate';
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generates a PDF blob from a scanned document project
 */
export async function generatePdf(
  doc: DocumentProject,
  options: PdfOptions = { pageSize: 'a4', quality: 0.9, margin: 0 }
): Promise<{ blob: Blob; filename: string }> {
  if (doc.pages.length === 0) {
    throw new Error('Document has no pages to export.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: options.pageSize === 'fit' ? 'a4' : options.pageSize,
  });

  // ── ID card: both sides on one sheet, printed at real size (85.6 mm wide) ──
  if (doc.kind === 'id_card' && options.idLayout !== 'separate') {
    const CARD_LONG_MM = 85.6;
    const GAP_MM = 10;
    const TOP_MM = 25;
    const pageW = pdf.internal.pageSize.getWidth();

    const sized = [];
    for (const page of doc.pages) {
      const src = page.processedImageBase64 || page.originalImageBase64;
      const img = await loadImg(src);
      const ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
      const w = ar >= 1 ? CARD_LONG_MM : CARD_LONG_MM * ar;
      const h = ar >= 1 ? CARD_LONG_MM / ar : CARD_LONG_MM;
      sized.push({ src, w, h });
    }

    let y = TOP_MM;
    for (const item of sized) {
      const x = (pageW - item.w) / 2;
      pdf.addImage(item.src, 'JPEG', x, y, item.w, item.h, undefined, 'FAST');
      pdf.setDrawColor(190);
      pdf.setLineWidth(0.2);
      pdf.rect(x, y, item.w, item.h);
      y += item.h + GAP_MM;
    }

    const idName = (doc.title || 'ID_Card').replace(/[^a-zA-Z0-9_-]/g, '_');
    return { blob: pdf.output('blob'), filename: `${idName}.pdf` };
  }

  const pageMargin = options.margin;

  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    const imageSrc = page.processedImageBase64 || page.originalImageBase64;

    if (i > 0) {
      pdf.addPage();
    }

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageSrc;
    });

    const imgWidthPx = img.naturalWidth || img.width;
    const imgHeightPx = img.naturalHeight || img.height;
    const imgAspectRatio = imgWidthPx / imgHeightPx;

    if (options.pageSize === 'fit') {
      const pdfW = 210;
      const pdfH = pdfW / imgAspectRatio;
      pdf.setPage(i + 1);
      // @ts-ignore
      pdf.internal.pageSize.width = pdfW;
      // @ts-ignore
      pdf.internal.pageSize.height = pdfH;

      pdf.addImage(imageSrc, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    } else {
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const availW = pdfWidth - 2 * pageMargin;
      const availH = pdfHeight - 2 * pageMargin;

      let renderW = availW;
      let renderH = renderW / imgAspectRatio;

      if (renderH > availH) {
        renderH = availH;
        renderW = renderH * imgAspectRatio;
      }

      const x = (pdfWidth - renderW) / 2;
      const y = (pdfHeight - renderH) / 2;

      pdf.addImage(imageSrc, 'JPEG', x, y, renderW, renderH, undefined, 'FAST');
    }
  }

  const cleanTitle = (doc.title || 'Scanned_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanTitle}.pdf`;
  const pdfOutput = pdf.output('blob');

  return { blob: pdfOutput, filename };
}

/**
 * Packs all document pages into a ZIP archive
 */
export async function generateZip(doc: DocumentProject): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const folderName = (doc.title || 'Scanned_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(folderName) || zip;

  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    const imageSrc = page.processedImageBase64 || page.originalImageBase64;
    const base64Data = imageSrc.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
    folder.file(`Page_${i + 1}.jpg`, base64Data, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `${folderName}_pages.zip`;

  return { blob, filename };
}
