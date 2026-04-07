/**
 * Shared type definitions for the Drawing Inspection Tool.
 * Every module in the pipeline imports from here.
 */

// ── Geometry ──

export interface BBox {
  x: number; // top-left X, normalized 0-1 relative to image
  y: number; // top-left Y
  w: number; // width
  h: number; // height
}

export interface Point {
  x: number;
  y: number;
}

// ── Drawing Input ──

export interface DrawingInput {
  filePath: string;
  fileName: string;
  format: "pdf" | "png" | "jpeg";
  pages: number;
}

export interface NormalizedPage {
  pageIndex: number;
  imageBuffer: Buffer;
  width: number;
  height: number;
  dpi: number;
}

// ── Layout Regions ──

export type RegionType =
  | "title_block"
  | "revision_table"
  | "notes_area"
  | "projection_view"
  | "section_view"
  | "dimension_area"
  | "parts_list"
  | "unknown";

export interface LayoutRegion {
  type: RegionType;
  bbox: BBox;
  confidence: number;
  label?: string; // e.g., "Front View", "Section A-A"
}

export interface LayoutResult {
  pageIndex: number;
  regions: LayoutRegion[];
  rawVlmResponse?: string;
}

// ── Part Classification ──

export interface PartClassification {
  businessUnit: string;
  category: string;
  material?: string;
  confidence: number;
}

// ── Check Items ──

export type CheckRank = "A" | "B" | "C";
export type JudgmentMethod = "rule" | "rule+llm" | "rag+llm";

export interface CheckItemConfig {
  id: string;
  rank: CheckRank;
  name: string;
  nameJa?: string;
  description: string;
  enabled: boolean;
  categories: string[] | "*";
  requiredRegions: RegionType[];
  judgmentMethod: JudgmentMethod;
  promptTemplate: string;
  promptVariables?: Record<string, string>;
  ruleFunction?: string;
  passCriteria: string;
  targetAccuracy: number;
}

// ── Check Results ──

export type CheckVerdict = "pass" | "fail" | "warn" | "skip" | "error";

export interface CheckEvidence {
  type: "bbox" | "text" | "comparison";
  bbox?: BBox;
  extractedValue?: string;
  description: string;
  severity: "critical" | "major" | "minor";
}

export interface CheckResult {
  checkId: string;
  checkName: string;
  checkNameJa?: string;
  rank: CheckRank;
  verdict: CheckVerdict;
  confidence: number;
  evidence: CheckEvidence[];
  reasoning: string;
  rawVlmResponse?: string;
}

// ── Inspection Report ──

export interface InspectionReport {
  id: string;
  inputFile: string;
  fileName: string;
  timestamp: string;
  classification: PartClassification;
  layout: LayoutResult[];
  results: CheckResult[];
  summary: ReportSummary;
}

export interface ReportSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  errors: number;
  cRankScore: number;
  bRankScore: number;
  aRankScore: number;
}

// ── VLM Types ──

export type VlmProvider = "claude" | "openai";

export interface VlmRequest {
  provider: VlmProvider;
  images: Buffer[];
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export interface VlmResponse {
  text: string;
  parsedJson?: Record<string, unknown>;
  model: string;
  tokensUsed: { input: number; output: number };
}

// ── RAG Types ──

export interface RagChunk {
  text: string;
  source: string;
  section: string;
  page?: number;
  score: number;
}

// ── Check Handler Interface ──

export interface CheckContext {
  pages: NormalizedPage[];
  layouts: LayoutResult[];
  classification: PartClassification;
  checkConfig: CheckItemConfig;
  promptContent?: string;
  ragChunks?: RagChunk[];
}

export type CheckHandler = (
  ctx: CheckContext,
  vlmCall: (req: VlmRequest) => Promise<VlmResponse>,
) => Promise<CheckResult>;

// ── Config ──

export interface ChecksConfig {
  version: number;
  checks: CheckItemConfig[];
}
