/**
 * Drawing importer: PDF/PNG/JPEG → normalized page images.
 *
 * For PoC, handles PNG and JPEG via sharp. PDF support is Phase 5.
 * All output pages are PNG at consistent DPI, max 4096px longest side.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import type { DrawingInput, NormalizedPage } from "../types";

const TARGET_DPI = 300;
const MAX_DIMENSION = 4096;

function detectFormat(filePath: string): "pdf" | "png" | "jpeg" {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "pdf";
    case ".png":
      return "png";
    case ".jpg":
    case ".jpeg":
      return "jpeg";
    default:
      throw new Error(`Unsupported file format: ${ext}. Supported: .pdf, .png, .jpg, .jpeg`);
  }
}

async function normalizeImage(buffer: Buffer): Promise<NormalizedPage> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const origWidth = metadata.width || 0;
  const origHeight = metadata.height || 0;

  if (origWidth === 0 || origHeight === 0) {
    throw new Error("Invalid image: width or height is 0");
  }

  // Scale down if exceeding max dimension, preserving aspect ratio
  let targetWidth = origWidth;
  let targetHeight = origHeight;
  const longestSide = Math.max(origWidth, origHeight);

  if (longestSide > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longestSide;
    targetWidth = Math.round(origWidth * scale);
    targetHeight = Math.round(origHeight * scale);
  }

  const outputBuffer = await image
    .resize(targetWidth, targetHeight, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  // Re-read metadata from the output
  const outputMeta = await sharp(outputBuffer).metadata();

  return {
    pageIndex: 0,
    imageBuffer: outputBuffer,
    width: outputMeta.width || targetWidth,
    height: outputMeta.height || targetHeight,
    dpi: TARGET_DPI,
  };
}

export async function importDrawing(
  filePath: string,
): Promise<{ input: DrawingInput; pages: NormalizedPage[] }> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const format = detectFormat(filePath);
  const fileName = path.basename(filePath);

  if (format === "pdf") {
    // PDF support is Phase 5 — for now, throw a clear error
    throw new Error(
      "PDF import is not yet supported in this PoC. Please convert to PNG or JPEG first.",
    );
  }

  const buffer = fs.readFileSync(filePath);
  const page = await normalizeImage(buffer);

  const input: DrawingInput = {
    filePath,
    fileName,
    format,
    pages: 1,
  };

  return { input, pages: [page] };
}
