/**
 * B-Rank: Filename vs title block match (B-004).
 * Verifies that the file name matches the drawing number/part name in the title block.
 */

import type { CheckContext, CheckEvidence, CheckResult, VlmRequest, VlmResponse } from "../../types";
import { titleBlockFieldPrompt } from "../../vlm/prompts";
import { requireJson } from "../../vlm/structured";
import { cropRegion } from "../../layout/regions";
import path from "path";

interface FieldResponse {
  fieldFound: boolean;
  fieldValue: string | null;
  confidence: number;
  reasoning: string;
}

function normalizeForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[^.]+$/, "")     // strip file extension
    .replace(/[-_\s]+/g, "")     // strip separators
    .replace(/[（）()]/g, "")     // strip parentheses
    .trim();
}

export const checkFilenameMatch = async (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
): Promise<CheckResult> => {
  const { pages, layouts, checkConfig } = ctx;
  const layout = layouts[0];
  const page = pages[0];

  // Get filename from the first page's source
  const fileName = path.basename(ctx.pages[0]?.pageIndex === 0
    ? (ctx as any).inputFileName || ""
    : "");

  // Extract drawing number from title block
  const titleBlock = layout?.regions.find((r) => r.type === "title_block");
  const image = titleBlock ? await cropRegion(page, titleBlock.bbox) : page.imageBuffer;

  const drawingNumResponse = await vlmCall({
    provider: "claude",
    images: [image],
    userPrompt: titleBlockFieldPrompt("drawing_number", "図番"),
    responseFormat: "json",
    maxTokens: 1024,
  });

  const drawingNumData = requireJson<FieldResponse>(drawingNumResponse.text, "filename-match:drawing_number");

  const partNameResponse = await vlmCall({
    provider: "claude",
    images: [image],
    userPrompt: titleBlockFieldPrompt("part_name", "品名"),
    responseFormat: "json",
    maxTokens: 1024,
  });

  const partNameData = requireJson<FieldResponse>(partNameResponse.text, "filename-match:part_name");

  const evidence: CheckEvidence[] = [];
  let matches = true;

  const drawingNum = drawingNumData.fieldValue || "";
  const partName = partNameData.fieldValue || "";
  const normalizedFilename = normalizeForComparison(fileName);

  if (drawingNum) {
    const normalizedDrawingNum = normalizeForComparison(drawingNum);
    const drawingNumInFilename = normalizedFilename.includes(normalizedDrawingNum);

    evidence.push({
      type: "text",
      extractedValue: drawingNum,
      description: drawingNumInFilename
        ? `Drawing number "${drawingNum}" found in filename`
        : `Drawing number "${drawingNum}" NOT found in filename "${fileName}"`,
      severity: drawingNumInFilename ? "minor" : "major",
    });

    if (!drawingNumInFilename) matches = false;
  } else {
    evidence.push({
      type: "text",
      description: "Could not extract drawing number from title block",
      severity: "major",
    });
    matches = false;
  }

  if (partName) {
    evidence.push({
      type: "text",
      extractedValue: partName,
      description: `Part name: "${partName}"`,
      severity: "minor",
    });
  }

  // If no filename available, skip the check
  if (!fileName) {
    return {
      checkId: checkConfig.id,
      checkName: checkConfig.name,
      checkNameJa: checkConfig.nameJa,
      rank: checkConfig.rank,
      verdict: "skip",
      confidence: 0,
      evidence: [{ type: "text", description: "No filename available for comparison", severity: "minor" }],
      reasoning: "Filename not available",
    };
  }

  return {
    checkId: checkConfig.id,
    checkName: checkConfig.name,
    checkNameJa: checkConfig.nameJa,
    rank: checkConfig.rank,
    verdict: matches ? "pass" : "fail",
    confidence: (drawingNumData.confidence + partNameData.confidence) / 2,
    evidence,
    reasoning: matches
      ? `Filename "${fileName}" matches title block drawing number "${drawingNum}"`
      : `Filename "${fileName}" does not match title block drawing number "${drawingNum}"`,
  };
};
