/**
 * Unit tests for import/importer.ts.
 */

import { describe, it, expect } from "bun:test";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { importDrawing } from "../src/import/importer";

// Create a small test PNG in the fixtures directory
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_PNG = path.join(FIXTURES_DIR, "test-small.png");

// Generate a tiny test image if it doesn't exist
async function ensureTestImage(): Promise<void> {
  if (fs.existsSync(TEST_PNG)) return;
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const buf = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(TEST_PNG, buf);
}

describe("importDrawing", () => {
  it("imports a PNG file", async () => {
    await ensureTestImage();
    const { input, pages } = await importDrawing(TEST_PNG);
    expect(input.format).toBe("png");
    expect(input.fileName).toBe("test-small.png");
    expect(pages.length).toBe(1);
    expect(pages[0].width).toBe(800);
    expect(pages[0].height).toBe(600);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].imageBuffer).toBeInstanceOf(Buffer);
    expect(pages[0].imageBuffer.length).toBeGreaterThan(0);
  });

  it("throws on missing file", async () => {
    await expect(importDrawing("/nonexistent/file.png")).rejects.toThrow("File not found");
  });

  it("throws on unsupported format", async () => {
    const tmpFile = path.join(FIXTURES_DIR, "test.bmp");
    fs.writeFileSync(tmpFile, "fake");
    try {
      await expect(importDrawing(tmpFile)).rejects.toThrow("Unsupported file format");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("throws on PDF (not yet supported)", async () => {
    const tmpFile = path.join(FIXTURES_DIR, "test.pdf");
    fs.writeFileSync(tmpFile, "fake pdf");
    try {
      await expect(importDrawing(tmpFile)).rejects.toThrow("PDF import is not yet supported");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("normalizes large images to max 4096px", async () => {
    const largePng = path.join(FIXTURES_DIR, "test-large.png");
    const buf = await sharp({
      create: { width: 6000, height: 4000, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .png()
      .toBuffer();
    fs.writeFileSync(largePng, buf);

    try {
      const { pages } = await importDrawing(largePng);
      expect(Math.max(pages[0].width, pages[0].height)).toBeLessThanOrEqual(4096);
    } finally {
      fs.unlinkSync(largePng);
    }
  });
});
