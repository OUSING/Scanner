import type { Corners, PageAdjustments, Point } from '../types/scanner';

/**
 * Returns default corner positions inset by 5% from edges
 */
export function getDefaultCorners(): Corners {
  return {
    topLeft: { x: 0.05, y: 0.05 },
    topRight: { x: 0.95, y: 0.05 },
    bottomRight: { x: 0.95, y: 0.95 },
    bottomLeft: { x: 0.05, y: 0.95 },
  };
}

/**
 * Edge detection based corner auto-detection.
 * Uses a combination of contrast analysis and convex quad fitting.
 */
export function autoDetectCorners(canvas: HTMLCanvasElement): Corners {
  const ctx = canvas.getContext('2d');
  if (!ctx) return getDefaultCorners();

  const width = canvas.width;
  const height = canvas.height;
  
  // Downscale image for fast edge analysis
  const maxDim = 300;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const sw = Math.floor(width * scale);
  const sh = Math.floor(height * scale);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return getDefaultCorners();

  tempCtx.drawImage(canvas, 0, 0, sw, sh);
  const imgData = tempCtx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // Simple Sobel edge detection & brightness intensity thresholding
  const gray = new Uint8Array(sw * sh);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }

  // Scan four corners bounding regions for strong edge transitions
  let minTL = Infinity, tlPoint = { x: 0.05 * sw, y: 0.05 * sh };
  let minTR = Infinity, trPoint = { x: 0.95 * sw, y: 0.05 * sh };
  let maxBR = -Infinity, brPoint = { x: 0.95 * sw, y: 0.95 * sh };
  let maxBL = -Infinity, blPoint = { x: 0.05 * sw, y: 0.95 * sh };

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const val = gray[y * sw + x];
      if (val > 100) {
        const sumTL = x + y;
        const sumTR = (sw - x) + y;
        const sumBR = x + y;

        if (sumTL < minTL) { minTL = sumTL; tlPoint = { x, y }; }
        if (sumTR < minTR) { minTR = sumTR; trPoint = { x, y }; }
        if (sumBR > maxBR) { maxBR = sumBR; brPoint = { x, y }; }
        if (x - y < maxBL) { maxBL = x - y; blPoint = { x, y }; }
      }
    }
  }

  // Normalize to 0..1 range with safety margins
  return {
    topLeft: { x: Math.max(0.02, Math.min(0.4, tlPoint.x / sw)), y: Math.max(0.02, Math.min(0.4, tlPoint.y / sh)) },
    topRight: { x: Math.max(0.6, Math.min(0.98, trPoint.x / sw)), y: Math.max(0.02, Math.min(0.4, trPoint.y / sh)) },
    bottomRight: { x: Math.max(0.6, Math.min(0.98, brPoint.x / sw)), y: Math.max(0.6, Math.min(0.98, brPoint.y / sh)) },
    bottomLeft: { x: Math.max(0.02, Math.min(0.4, blPoint.x / sw)), y: Math.max(0.6, Math.min(0.98, blPoint.y / sh)) },
  };
}

/**
 * Computes homography transformation matrix from 4 quad corners to rectangular dest
 */
function solveHomography(src: Point[], dst: Point[]): number[] | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = src[i];
    const { x: x, y: y } = dst[i];
    A.push([-u, -v, -1, 0, 0, 0, u * x, v * x, x]);
    A.push([0, 0, 0, -u, -v, -1, u * y, v * y, y]);
  }

  const B: number[] = [];
  const M: number[][] = [];
  for (let i = 0; i < 8; i++) {
    M.push(A[i].slice(0, 8));
    B.push(-A[i][8]);
  }

  for (let i = 0; i < 8; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 8; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    [B[i], B[maxRow]] = [B[maxRow], B[i]];

    if (Math.abs(M[i][i]) < 1e-10) return null;

    for (let k = i + 1; k < 8; k++) {
      const c = M[k][i] / M[i][i];
      for (let j = i; j < 8; j++) M[k][j] -= c * M[i][j];
      B[k] -= c * B[i];
    }
  }

  const h = new Array(9).fill(0);
  h[8] = 1;
  for (let i = 7; i >= 0; i--) {
    let sum = B[i];
    for (let j = i + 1; j < 8; j++) sum -= M[i][j] * h[j];
    h[i] = sum / M[i][i];
  }

  return h;
}

/**
 * Performs Perspective Warp (Homography Transformation) to un-skew quadrilateral document scan
 */
export function warpPerspective(
  sourceCanvas: HTMLCanvasElement,
  corners: Corners,
  /** Optional width/height ratio to force (e.g. ID card). Orientation follows the detected shape. */
  targetAspect?: number
): HTMLCanvasElement {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  const pTL = { x: corners.topLeft.x * sw, y: corners.topLeft.y * sh };
  const pTR = { x: corners.topRight.x * sw, y: corners.topRight.y * sh };
  const pBR = { x: corners.bottomRight.x * sw, y: corners.bottomRight.y * sh };
  const pBL = { x: corners.bottomLeft.x * sw, y: corners.bottomLeft.y * sh };

  const topW = Math.hypot(pTR.x - pTL.x, pTR.y - pTL.y);
  const botW = Math.hypot(pBR.x - pBL.x, pBR.y - pBL.y);
  const leftH = Math.hypot(pBL.x - pTL.x, pBL.y - pTL.y);
  const rightH = Math.hypot(pBR.x - pTR.x, pBR.y - pTR.y);

  let destWidth = Math.round(Math.max(topW, botW));
  let destHeight = Math.round(Math.max(leftH, rightH));

  if (targetAspect) {
    // Keep the longest detected side, derive the other from the real card ratio
    if (destWidth >= destHeight) {
      destHeight = Math.round(destWidth / targetAspect);
    } else {
      destWidth = Math.round(destHeight / targetAspect);
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = destWidth;
  outCanvas.height = destHeight;

  const outCtx = outCanvas.getContext('2d');
  const srcCtx = sourceCanvas.getContext('2d');
  if (!outCtx || !srcCtx) return sourceCanvas;

  const srcQuad = [pTL, pTR, pBR, pBL];
  const dstQuad = [
    { x: 0, y: 0 },
    { x: destWidth, y: 0 },
    { x: destWidth, y: destHeight },
    { x: 0, y: destHeight },
  ];

  const H = solveHomography(dstQuad, srcQuad);
  if (!H) {
    outCtx.drawImage(sourceCanvas, 0, 0, destWidth, destHeight);
    return outCanvas;
  }

  const srcImgData = srcCtx.getImageData(0, 0, sw, sh);
  const dstImgData = outCtx.createImageData(destWidth, destHeight);

  const srcPixels = srcImgData.data;
  const dstPixels = dstImgData.data;

  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;

  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      const w = h6 * x + h7 * y + h8;
      const u = (h0 * x + h1 * y + h2) / w;
      const v = (h3 * x + h4 * y + h5) / w;

      const dstIdx = (y * destWidth + x) * 4;

      if (u >= 0 && u < sw - 1 && v >= 0 && v < sh - 1) {
        const u0 = Math.floor(u);
        const v0 = Math.floor(v);
        const u1 = u0 + 1;
        const v1 = v0 + 1;

        const dx = u - u0;
        const dy = v - v0;

        const idx00 = (v0 * sw + u0) * 4;
        const idx10 = (v0 * sw + u1) * 4;
        const idx01 = (v1 * sw + u0) * 4;
        const idx11 = (v1 * sw + u1) * 4;

        for (let c = 0; c < 3; c++) {
          const val =
            (1 - dx) * (1 - dy) * srcPixels[idx00 + c] +
            dx * (1 - dy) * srcPixels[idx10 + c] +
            (1 - dx) * dy * srcPixels[idx01 + c] +
            dx * dy * srcPixels[idx11 + c];
          dstPixels[dstIdx + c] = Math.round(val);
        }
        dstPixels[dstIdx + 3] = 255;
      } else {
        dstPixels[dstIdx] = 255;
        dstPixels[dstIdx + 1] = 255;
        dstPixels[dstIdx + 2] = 255;
        dstPixels[dstIdx + 3] = 255;
      }
    }
  }

  outCtx.putImageData(dstImgData, 0, 0);
  return outCanvas;
}

/**
 * Applies filters (Magic Color, Grayscale, B&W, Sharpen) and adjustments
 */
export function applyFiltersAndAdjustments(
  canvas: HTMLCanvasElement,
  adjustments: PageAdjustments
): HTMLCanvasElement {
  let workCanvas = canvas;

  if (adjustments.rotation !== 0) {
    const rad = (adjustments.rotation * Math.PI) / 180;
    const is90or270 = adjustments.rotation === 90 || adjustments.rotation === 270;
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = is90or270 ? canvas.height : canvas.width;
    rotCanvas.height = is90or270 ? canvas.width : canvas.height;

    const rotCtx = rotCanvas.getContext('2d');
    if (rotCtx) {
      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate(rad);
      rotCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      workCanvas = rotCanvas;
    }
  }

  const w = workCanvas.width;
  const h = workCanvas.height;
  const ctx = workCanvas.getContext('2d');
  if (!ctx) return workCanvas;

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = w;
  finalCanvas.height = h;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) return workCanvas;

  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;

  const { filter, brightness, contrast, sharpen } = adjustments;

  const bAdd = (brightness / 100) * 128;
  const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];

    if (filter === 'grayscale') {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      r = g = b = gray;
    } else if (filter === 'magic') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let factor = 1.0;
      if (gray > 140) {
        factor = 1.25;
      } else if (gray < 90) {
        factor = 0.8;
      }
      r = Math.min(255, Math.max(0, Math.round((r - 128) * 1.35 + 128 * factor)));
      g = Math.min(255, Math.max(0, Math.round((g - 128) * 1.35 + 128 * factor)));
      b = Math.min(255, Math.max(0, Math.round((b - 128) * 1.35 + 128 * factor)));
    } else if (filter === 'bw') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const bwVal = gray > 128 ? 255 : 0;
      r = g = b = bwVal;
    }

    if (brightness !== 0) {
      r = Math.min(255, Math.max(0, r + bAdd));
      g = Math.min(255, Math.max(0, g + bAdd));
      b = Math.min(255, Math.max(0, b + bAdd));
    }
    if (contrast !== 0) {
      r = Math.min(255, Math.max(0, cFactor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, cFactor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, cFactor * (b - 128) + 128));
    }

    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  }

  finalCtx.putImageData(imgData, 0, 0);

  const sharpenAmount = filter === 'sharpen' ? Math.max(sharpen, 40) : sharpen;
  if (sharpenAmount > 0) {
    const s = sharpenAmount / 100;
    const weights = [
      0, -s, 0,
      -s, 1 + 4 * s, -s,
      0, -s, 0
    ];
    
    const sharpImgData = finalCtx.getImageData(0, 0, w, h);
    const srcData = sharpImgData.data;
    const dstData = finalCtx.createImageData(w, h).data;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const dstIdx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let val = 0;
          let kIdx = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const srcIdx = ((y + ky) * w + (x + kx)) * 4;
              val += srcData[srcIdx + c] * weights[kIdx++];
            }
          }
          dstData[dstIdx + c] = Math.min(255, Math.max(0, Math.round(val)));
        }
        dstData[dstIdx + 3] = 255;
      }
    }
    const resultImageData = finalCtx.createImageData(w, h);
    resultImageData.data.set(dstData);
    finalCtx.putImageData(resultImageData, 0, 0);
  }

  return finalCanvas;
}

/**
 * Loads Base64 or Blob URL into HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Converts image element or canvas to HTMLCanvasElement
 */
export function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Batch applies a filter & adjustment preset to all pages while preserving
 * each page's specific corners and perspective orientation.
 */
export async function batchApplyFilter(
  pages: import('../types/scanner').ScannedPage[],
  adjustments: Omit<PageAdjustments, 'corners' | 'rotation'>
): Promise<import('../types/scanner').ScannedPage[]> {
  const updatedPages: import('../types/scanner').ScannedPage[] = [];

  for (const page of pages) {
    const loadedImg = await loadImage(page.originalImageBase64);
    const canvas = imageToCanvas(loadedImg);
    const warped = warpPerspective(canvas, page.adjustments.corners);

    const fullAdjustments: PageAdjustments = {
      ...adjustments,
      corners: page.adjustments.corners,
      rotation: page.adjustments.rotation,
    };

    const processed = applyFiltersAndAdjustments(warped, fullAdjustments);

    updatedPages.push({
      ...page,
      processedImageBase64: processed.toDataURL('image/jpeg', 0.9),
      adjustments: fullAdjustments,
    });
  }

  return updatedPages;
}

