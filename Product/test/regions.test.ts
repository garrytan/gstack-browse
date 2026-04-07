/**
 * Unit tests for layout/regions.ts bbox utilities.
 * No API calls — pure geometry math.
 */

import { describe, it, expect } from "bun:test";
import {
  clampBBox,
  isValidBBox,
  bboxOverlap,
  bboxIoU,
  bboxContains,
  bboxCenterDistance,
  bboxUnion,
  bboxToPixels,
  defaultTitleBlockBBox,
} from "../src/layout/regions";

describe("clampBBox", () => {
  it("passes through valid bbox unchanged", () => {
    const bbox = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(clampBBox(bbox)).toEqual(bbox);
  });

  it("clamps negative values to 0", () => {
    const result = clampBBox({ x: -0.1, y: -0.2, w: 0.3, h: 0.4 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("clamps width that would exceed 1.0", () => {
    const result = clampBBox({ x: 0.8, y: 0.0, w: 0.5, h: 0.3 });
    expect(result.x + result.w).toBeLessThanOrEqual(1);
  });

  it("clamps values exceeding 1.0", () => {
    const result = clampBBox({ x: 1.5, y: 1.5, w: 0.5, h: 0.5 });
    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
    expect(result.w).toBe(0);
    expect(result.h).toBe(0);
  });
});

describe("isValidBBox", () => {
  it("accepts valid bbox", () => {
    expect(isValidBBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toBe(true);
  });

  it("rejects zero-width bbox", () => {
    expect(isValidBBox({ x: 0.1, y: 0.2, w: 0, h: 0.4 })).toBe(false);
  });

  it("rejects zero-height bbox", () => {
    expect(isValidBBox({ x: 0.1, y: 0.2, w: 0.3, h: 0 })).toBe(false);
  });

  it("rejects negative x", () => {
    expect(isValidBBox({ x: -0.1, y: 0.2, w: 0.3, h: 0.4 })).toBe(false);
  });

  it("accepts bbox at edge (x+w = 1.0)", () => {
    expect(isValidBBox({ x: 0.7, y: 0.0, w: 0.3, h: 1.0 })).toBe(true);
  });
});

describe("bboxOverlap", () => {
  it("returns 0 for non-overlapping bboxes", () => {
    const a = { x: 0, y: 0, w: 0.3, h: 0.3 };
    const b = { x: 0.5, y: 0.5, w: 0.3, h: 0.3 };
    expect(bboxOverlap(a, b)).toBe(0);
  });

  it("returns 1 for identical bboxes", () => {
    const a = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
    expect(bboxOverlap(a, a)).toBeCloseTo(1, 5);
  });

  it("returns correct overlap ratio", () => {
    const a = { x: 0, y: 0, w: 0.4, h: 0.4 };
    const b = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
    // Intersection: 0.2 * 0.2 = 0.04
    // Area of a: 0.4 * 0.4 = 0.16
    // Overlap: 0.04 / 0.16 = 0.25
    expect(bboxOverlap(a, b)).toBeCloseTo(0.25, 5);
  });

  it("handles contained bbox (b inside a)", () => {
    const a = { x: 0, y: 0, w: 1, h: 1 };
    const b = { x: 0.2, y: 0.2, w: 0.1, h: 0.1 };
    // Intersection area = b area = 0.01
    // Overlap from a's perspective: 0.01 / 1 = 0.01
    expect(bboxOverlap(a, b)).toBeCloseTo(0.01, 5);
  });
});

describe("bboxIoU", () => {
  it("returns 1 for identical bboxes", () => {
    const a = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
    expect(bboxIoU(a, a)).toBeCloseTo(1, 5);
  });

  it("returns 0 for non-overlapping bboxes", () => {
    const a = { x: 0, y: 0, w: 0.2, h: 0.2 };
    const b = { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    expect(bboxIoU(a, b)).toBe(0);
  });

  it("returns correct IoU for partial overlap", () => {
    const a = { x: 0, y: 0, w: 0.4, h: 0.4 };
    const b = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
    // Intersection: 0.2 * 0.2 = 0.04
    // Union: 0.16 + 0.16 - 0.04 = 0.28
    // IoU: 0.04 / 0.28 ≈ 0.1429
    expect(bboxIoU(a, b)).toBeCloseTo(0.04 / 0.28, 4);
  });
});

describe("bboxContains", () => {
  it("returns true when a contains b", () => {
    const a = { x: 0, y: 0, w: 1, h: 1 };
    const b = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    expect(bboxContains(a, b)).toBe(true);
  });

  it("returns false when b extends beyond a", () => {
    const a = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
    const b = { x: 0, y: 0, w: 0.5, h: 0.5 };
    expect(bboxContains(a, b)).toBe(false);
  });

  it("returns true for identical bboxes", () => {
    const a = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(bboxContains(a, a)).toBe(true);
  });
});

describe("bboxCenterDistance", () => {
  it("returns 0 for identical bboxes", () => {
    const a = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
    expect(bboxCenterDistance(a, a)).toBe(0);
  });

  it("calculates correct distance", () => {
    const a = { x: 0, y: 0, w: 0.2, h: 0.2 }; // center: (0.1, 0.1)
    const b = { x: 0.4, y: 0.3, w: 0.2, h: 0.2 }; // center: (0.5, 0.4)
    // distance = sqrt((0.4)^2 + (0.3)^2) = sqrt(0.16 + 0.09) = sqrt(0.25) = 0.5
    expect(bboxCenterDistance(a, b)).toBeCloseTo(0.5, 5);
  });
});

describe("bboxUnion", () => {
  it("returns enclosing bbox", () => {
    const a = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    const b = { x: 0.4, y: 0.3, w: 0.3, h: 0.3 };
    const union = bboxUnion(a, b);
    expect(union.x).toBe(0.1);
    expect(union.y).toBe(0.1);
    expect(union.w).toBeCloseTo(0.6, 5);
    expect(union.h).toBeCloseTo(0.5, 5);
  });

  it("returns same bbox for identical inputs", () => {
    const a = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    const union = bboxUnion(a, a);
    expect(union.x).toBeCloseTo(a.x, 10);
    expect(union.y).toBeCloseTo(a.y, 10);
    expect(union.w).toBeCloseTo(a.w, 10);
    expect(union.h).toBeCloseTo(a.h, 10);
  });
});

describe("bboxToPixels", () => {
  it("converts normalized bbox to pixel coordinates", () => {
    const bbox = { x: 0.5, y: 0.5, w: 0.25, h: 0.25 };
    const result = bboxToPixels(bbox, 1000, 800);
    expect(result.left).toBe(500);
    expect(result.top).toBe(400);
    expect(result.width).toBe(250);
    expect(result.height).toBe(200);
  });

  it("ensures minimum 1px dimensions", () => {
    const bbox = { x: 0.5, y: 0.5, w: 0.0001, h: 0.0001 };
    const result = bboxToPixels(bbox, 100, 100);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

describe("defaultTitleBlockBBox", () => {
  it("returns bottom-right region", () => {
    const bbox = defaultTitleBlockBBox();
    expect(bbox.x).toBeGreaterThan(0.5);
    expect(bbox.y).toBeGreaterThan(0.7);
    expect(bbox.x + bbox.w).toBeCloseTo(1.0, 1);
    expect(bbox.y + bbox.h).toBeCloseTo(1.0, 1);
  });
});
