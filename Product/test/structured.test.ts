/**
 * Unit tests for vlm/structured.ts JSON extraction.
 */

import { describe, it, expect } from "bun:test";
import { extractJson, requireJson } from "../src/vlm/structured";

describe("extractJson", () => {
  it("parses raw JSON string", () => {
    const result = extractJson('{"key": "value", "num": 42}');
    expect(result).toEqual({ key: "value", num: 42 });
  });

  it("extracts JSON from markdown code block", () => {
    const text = 'Here is the result:\n```json\n{"found": true, "value": "test"}\n```\nDone.';
    const result = extractJson(text);
    expect(result).toEqual({ found: true, value: "test" });
  });

  it("extracts JSON from code block without json tag", () => {
    const text = '```\n{"found": true}\n```';
    const result = extractJson(text);
    expect(result).toEqual({ found: true });
  });

  it("extracts first JSON object from mixed text", () => {
    const text = 'Based on my analysis, the result is {"fieldFound": true, "confidence": 0.9}. Let me explain...';
    const result = extractJson(text);
    expect(result).toEqual({ fieldFound: true, confidence: 0.9 });
  });

  it("extracts JSON array", () => {
    const text = 'Results: [{"a": 1}, {"b": 2}]';
    const result = extractJson(text);
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("returns null for non-JSON text", () => {
    const result = extractJson("This is just plain text without any JSON.");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractJson("")).toBeNull();
  });

  it("handles nested JSON objects", () => {
    const text = '{"bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}, "found": true}';
    const result = extractJson<any>(text);
    expect(result?.bbox?.x).toBe(0.1);
    expect(result?.found).toBe(true);
  });

  it("handles JSON with special characters in strings", () => {
    const text = '{"text": "This has \\"quotes\\" and \\n newlines"}';
    const result = extractJson<any>(text);
    expect(result?.text).toContain("quotes");
  });
});

describe("requireJson", () => {
  it("returns parsed JSON for valid input", () => {
    const result = requireJson('{"ok": true}');
    expect(result).toEqual({ ok: true });
  });

  it("throws for non-JSON input", () => {
    expect(() => requireJson("not json")).toThrow("Failed to extract JSON");
  });

  it("includes context in error message", () => {
    expect(() => requireJson("not json", "layout")).toThrow("layout");
  });

  it("includes preview of failed text in error", () => {
    expect(() => requireJson("some random text")).toThrow("some random text");
  });
});
