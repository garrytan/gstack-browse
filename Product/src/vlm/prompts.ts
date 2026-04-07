/**
 * Prompt templates for VLM tasks.
 * Each function returns a prompt string for a specific pipeline stage.
 */

export const LAYOUT_ANALYSIS_PROMPT = `You are analyzing an engineering/manufacturing drawing image.

Identify ALL distinct regions in the drawing and return their bounding boxes as normalized coordinates (0.0 to 1.0 relative to image dimensions).

## Region types to identify:
- title_block: The title block, usually bottom-right, contains drawing number, part name, material, revision info
- revision_table: Revision history table, often above the title block or top-right
- notes_area: Area with text notes, specifications, or requirements
- projection_view: Each distinct orthographic projection view (front, side, top, isometric, etc.)
- section_view: Cross-section views (labeled like "Section A-A")
- dimension_area: Dense clusters of dimension annotations
- parts_list: Bill of materials or parts list table

## Rules:
- A drawing may have multiple projection_view regions
- The title_block is almost always in the bottom-right quadrant
- Return ALL regions you can identify, even with lower confidence
- Bounding boxes: x,y is top-left corner, w,h is width/height, all normalized 0-1

Return valid JSON only:
{
  "regions": [
    {
      "type": "title_block",
      "bbox": {"x": 0.65, "y": 0.80, "w": 0.35, "h": 0.20},
      "confidence": 0.95,
      "label": "Title Block"
    }
  ]
}`;

export const PART_CLASSIFICATION_PROMPT = `You are classifying an engineering part based on its title block from a manufacturing drawing.

Analyze the title block image and determine:
1. Business unit / product division (e.g., "Automotive", "Consumer Electronics", "Industrial", "Medical")
2. Part category (e.g., "Housing", "Cover", "Bracket", "Connector", "Gear", "Shaft", "PCB", "Lens")
3. Material if visible (e.g., "ABS", "PC", "POM", "SUS304", "A5052")

Return valid JSON only:
{
  "businessUnit": "string",
  "category": "string",
  "material": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of classification basis"
}`;

export function titleBlockFieldPrompt(fieldName: string, fieldNameJa: string): string {
  return `You are inspecting an engineering drawing's title block.

## Task
Check whether the "${fieldNameJa}" (${fieldName}) field is present, filled in, and legible.

## Input
- Image: cropped title block region of the drawing

## Rules
- The field must contain actual content, not just a label or empty cell
- If the field exists but is blank or illegible, report fieldFound: false
- Report the exact text value if readable

Return valid JSON only:
{
  "fieldFound": true,
  "fieldValue": "extracted text or null",
  "confidence": 0.0-1.0,
  "bbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0},
  "reasoning": "brief explanation"
}`;
}

export function requiredNotationPrompt(notationType: string, notationJa: string, synonyms: string[]): string {
  const synonymList = synonyms.length > 0
    ? `\nAcceptable expressions (synonyms): ${synonyms.map(s => `"${s}"`).join(", ")}`
    : "";

  return `You are inspecting an engineering drawing for a required notation.

## Task
Check whether the drawing contains a notation about "${notationJa}" (${notationType}).
${synonymList}

## Input
- Image: the notes area or full drawing page

## Rules
- The notation does NOT need to match exactly — semantically equivalent expressions count
- Check notes, annotations, and any text areas in the drawing
- Report the location if found

Return valid JSON only:
{
  "found": true,
  "matchedText": "the actual text found or null",
  "isExactMatch": false,
  "confidence": 0.0-1.0,
  "bbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0},
  "reasoning": "brief explanation"
}`;
}

export const NOTE_NUMBERING_PROMPT = `You are checking note numbering continuity in an engineering drawing.

## Task
Identify all numbered notes in the drawing and check:
1. Are note numbers sequential (1, 2, 3, ... with no gaps)?
2. Are there any duplicate note numbers?
3. Are there any skipped numbers?

## Input
- Image: the notes area of the drawing

Return valid JSON only:
{
  "notes": [
    {"number": 1, "text": "brief content", "bbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}}
  ],
  "isSequential": true,
  "gaps": [],
  "duplicates": [],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export const REVISION_CONSISTENCY_PROMPT = `You are checking revision consistency in an engineering drawing.

## Task
1. Find the revision/version in the title block (e.g., "Rev. C", "版数: 3", "ECN: 005")
2. Find the revision table entries
3. Check: does the latest revision symbol in the revision table match the title block version?
4. Check: are revision symbols sequential (A→B→C or 1→2→3)?

## Input
- Image: full drawing page (or title block + revision table crops)

Return valid JSON only:
{
  "titleBlockRevision": "C",
  "revisionTableEntries": [
    {"symbol": "A", "date": "2024-01-15", "description": "Initial release"},
    {"symbol": "B", "date": "2024-03-20", "description": "Added mounting holes"},
    {"symbol": "C", "date": "2024-06-10", "description": "Material change"}
  ],
  "latestRevisionMatches": true,
  "isSequential": true,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export const DIMENSION_ANALYSIS_PROMPT = `You are analyzing dimensions in an engineering drawing view.

## Task
List every dimension annotation visible in this drawing view. For each dimension, report:
1. The dimension value/text (e.g., "25.0", "R5", "M4x0.7", "45°")
2. The bounding box of the dimension text
3. The approximate bounding box of the dimension line (including extension lines)
4. The type: linear, angular, radius, diameter, chamfer, or other

## Input
- Image: a projection view from an engineering drawing

Return valid JSON only:
{
  "dimensions": [
    {
      "value": "25.0",
      "unit": "mm",
      "textBbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0},
      "lineBbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0},
      "type": "linear"
    }
  ],
  "outlineBbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0},
  "confidence": 0.0-1.0
}`;

export const DIMENSION_OVERLAP_PROMPT = `You are checking for dimension overlap issues in an engineering drawing view.

## Task
Examine whether any dimension text, dimension lines, or leader lines overlap with:
1. Part outline/profile lines
2. Other dimension text or lines
3. Hatching or section patterns

## Input
- Image: a projection view with dimensions

Report each overlap issue found.

Return valid JSON only:
{
  "overlaps": [
    {
      "description": "Dimension '25.0' text overlaps with part outline",
      "severity": "major",
      "bbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}
    }
  ],
  "hasOverlaps": false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export const OUTERMOST_DIMENSION_PROMPT = `You are checking whether outermost (overall) dimensions are present in an engineering drawing view.

## Task
1. Identify the overall bounding extents of the part in this view
2. Check whether there is an overall width dimension
3. Check whether there is an overall height dimension
4. Report any missing outermost dimensions

## Input
- Image: a projection view with dimensions

Return valid JSON only:
{
  "hasOverallWidth": true,
  "hasOverallHeight": true,
  "overallWidthValue": "120.0",
  "overallHeightValue": "80.0",
  "missingDirections": [],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export const DUPLICATE_DIMENSION_PROMPT = `You are checking for duplicate or redundant dimensions in an engineering drawing view.

## Task
1. List all dimensions in the view
2. Identify any dimensions that specify the same measurement redundantly
3. Check for over-dimensioning (chain dimensions + overall that create redundancy)

## Input
- Image: a projection view with dimensions

Return valid JSON only:
{
  "duplicates": [
    {
      "value": "25.0",
      "count": 2,
      "locations": [
        {"bbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}},
        {"bbox": {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}}
      ],
      "description": "Same 25.0mm dimension appears twice for the same feature"
    }
  ],
  "hasDuplicates": false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export const TOLERANCE_NOTATION_PROMPT = `You are checking tolerance notation consistency in an engineering drawing.

## Task
1. Find the general tolerance specification (often in or near the title block, e.g., "JIS B 0405-m" or "ISO 2768-m")
2. Check if tolerance class is noted with appropriate strikethrough/slash marks
3. Verify that individually toleranced dimensions use consistent notation format

## Input
- Image: full drawing or title block + notes area

Return valid JSON only:
{
  "generalToleranceFound": true,
  "generalToleranceValue": "JIS B 0405-m",
  "toleranceTablePresent": true,
  "slashMarksConsistent": true,
  "issues": [],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
