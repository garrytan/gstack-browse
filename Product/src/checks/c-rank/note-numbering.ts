/**
 * C-Rank: Note numbering continuity check (C-008).
 * Verifies note numbers are sequential with no gaps or duplicates.
 */

import type { CheckContext, CheckEvidence, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { NOTE_NUMBERING_PROMPT } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";
import { cropRegion } from "../../layout/regions";

interface NoteNumberingResponse {
  notes: Array<{
    number: number;
    text: string;
    bbox: { x: number; y: number; w: number; h: number };
  }>;
  isSequential: boolean;
  gaps: number[];
  duplicates: number[];
  confidence: number;
  reasoning: string;
}

export const checkNoteNumbering = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, layouts, checkConfig } = ctx;
  const layout = layouts[0];
  const page = pages[0];

  const notesRegion = layout?.regions.find((r) => r.type === "notes_area");
  let image: Buffer;
  if (notesRegion) {
    image = await cropRegion(page, notesRegion.bbox);
  } else {
    image = page.imageBuffer;
  }

  const response = await vlmCall({
    provider: "claude",
    images: [image],
    userPrompt: NOTE_NUMBERING_PROMPT,
    responseFormat: "json",
    maxTokens: 1024,
  });

  const data = requireJson<NoteNumberingResponse>(response.text, "note-numbering");

  // Rule-based post-processing: verify the VLM's claim
  const noteNumbers = (data.notes || []).map((n) => n.number).sort((a, b) => a - b);
  const computedGaps: number[] = [];
  const computedDuplicates: number[] = [];

  if (noteNumbers.length > 0) {
    const seen = new Set<number>();
    for (const num of noteNumbers) {
      if (seen.has(num)) computedDuplicates.push(num);
      seen.add(num);
    }

    const unique = [...new Set(noteNumbers)].sort((a, b) => a - b);
    for (let i = 0; i < unique.length - 1; i++) {
      if (unique[i + 1] - unique[i] > 1) {
        for (let g = unique[i] + 1; g < unique[i + 1]; g++) {
          computedGaps.push(g);
        }
      }
    }
  }

  const hasIssues = computedGaps.length > 0 || computedDuplicates.length > 0;
  const verdict = hasIssues ? "fail" : (noteNumbers.length === 0 ? "skip" : "pass");

  const evidence: CheckEvidence[] = [];

  if (computedGaps.length > 0) {
    evidence.push({
      type: "text",
      description: `Missing note numbers: ${computedGaps.join(", ")}`,
      severity: "major",
    });
  }

  if (computedDuplicates.length > 0) {
    evidence.push({
      type: "text",
      description: `Duplicate note numbers: ${computedDuplicates.join(", ")}`,
      severity: "major",
    });
  }

  if (!hasIssues && noteNumbers.length > 0) {
    evidence.push({
      type: "text",
      description: `Notes 1-${noteNumbers[noteNumbers.length - 1]} are sequential`,
      severity: "minor",
    });
  }

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict,
    confidence: data.confidence ?? 0.7,
    evidence,
    reasoning: data.reasoning || "",
    rawVlmResponse: response.text,
  };
};
