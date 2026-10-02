export interface Point {
  x: number; // Normalized 0..1 or pixel coordinate
  y: number;
}

export interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export type FilterMode = 'magic' | 'grayscale' | 'bw' | 'original' | 'sharpen';

export interface PageAdjustments {
  corners: Corners;
  rotation: number; // 0, 90, 180, 270
  filter: FilterMode;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  sharpen: number; // 0 to 100
}

export type DocumentKind = 'document' | 'id_card';
export type IdSide = 'front' | 'back';

/** ISO/IEC 7810 ID-1 card (national ID, driver licence, bank card): 85.60 x 53.98 mm */
export const ID_CARD_ASPECT = 85.6 / 53.98;

export interface ScannedPage {
  id: string;
  side?: IdSide;
  originalImageBase64: string;
  processedImageBase64?: string;
  adjustments: PageAdjustments;
  aspectRatio?: number;
  createdAt: number;
}

export interface DocumentProject {
  id: string;
  title: string;
  pages: ScannedPage[];
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  kind?: DocumentKind; // undefined = regular document
}

export type ViewState = 
  | { mode: 'library' }
  | { mode: 'document_detail'; docId: string }
  | { mode: 'camera'; docId?: string }
  | { mode: 'crop'; docId: string; pageId: string }
  | { mode: 'filter'; docId: string; pageId: string }
  | { mode: 'reorder'; docId: string };
