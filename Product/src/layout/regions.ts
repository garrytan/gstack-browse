/**
 * BBox and region utilities for layout analysis.
 * All coordinates are normalized 0-1 relative to image dimensions.
 */

import sharp from "sharp";
import type { BBox, NormalizedPage } from "../types";

/** Clamp a bbox to valid 0-1 range */
export function clampBBox(bbox: BBox): BBox {
  const x = Math.max(0, Math.min(1, bbox.x));
  const y = Math.max(0, Math.min(1, bbox.y));
  const w = Math.max(0, Math.min(1 - x, bbox.w));
  const h = Math.max(0, Math.min(1 - y, bbox.h));
  return { x, y, w, h };
}

/** Check if a bbox is valid (non-zero area, within bounds) */
export function isValidBBox(bbox: BBox): boolean {
  return bbox.x >= 0 && bbox.y >= 0 && bbox.w > 0 && bbox.h > 0 && bbox.x + bbox.w <= 1.001 && bbox.y + bbox.h <= 1.001;
}

/** Calculate overlap ratio between two bboxes (intersection / area of a) */
export function bboxOverlap(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.w * a.h;
  return areaA > 0 ? intersection / areaA : 0;
}

/** Calculate intersection-over-union (IoU) between two bboxes */
export function bboxIoU(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Check if bbox a contains bbox b */
export function bboxContains(a: BBox, b: BBox): boolean {
  return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
}

/** Calculate distance between centers of two bboxes */
export function bboxCenterDistance(a: BBox, b: BBox): number {
  const aCx = a.x + a.w / 2;
  const aCy = a.y + a.h / 2;
  const bCx = b.x + b.w / 2;
  const bCy = b.y + b.h / 2;
  return Math.sqrt(Math.pow(aCx - bCx, 2) + Math.pow(aCy - bCy, 2));
}

/** Merge two bboxes into the smallest bbox containing both */
export function bboxUnion(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Convert normalized bbox to pixel coordinates */
export function bboxToPixels(bbox: BBox, width: number, height: number): { left: number; top: number; width: number; height: number } {
  return {
    left: Math.round(bbox.x * width),
    top: Math.round(bbox.y * height),
    width: Math.max(1, Math.round(bbox.w * width)),
    height: Math.max(1, Math.round(bbox.h * height)),
  };
}

/** Crop a region from a page image using a normalized bbox */
export async function cropRegion(page: NormalizedPage, bbox: BBox): Promise<Buffer> {
  const clamped = clampBBox(bbox);
  const pixels = bboxToPixels(clamped, page.width, page.height);

  return sharp(page.imageBuffer)
    .extract(pixels)
    .png()
    .toBuffer();
}

/** Default title block region: bottom-right 35% x 20% of the drawing */
export function defaultTitleBlockBBox(): BBox {
  return { x: 0.65, y: 0.80, w: 0.35, h: 0.20 };
}
