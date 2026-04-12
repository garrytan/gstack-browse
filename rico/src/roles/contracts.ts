export type ImpactLevel = "info" | "approval_needed" | "blocking";

export interface SpecialistArtifact {
  kind: string;
  title: string;
}

export interface SpecialistResult {
  role: string;
  summary: string;
  impact: ImpactLevel;
  artifacts: SpecialistArtifact[];
  rawFindings?: string[];
}

export function validateSpecialistResult(input: SpecialistResult) {
  if (!input.role || !input.summary || !input.impact) {
    return { ok: false as const };
  }
  if (
    !Array.isArray(input.artifacts) ||
    input.artifacts.some((artifact) => !artifact.kind || !artifact.title)
  ) {
    return { ok: false as const };
  }

  return { ok: true as const };
}
