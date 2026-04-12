export type ImpactLevel = "info" | "approval_needed" | "blocking";

export interface SpecialistImpact {
  role: string;
  level: ImpactLevel;
  message: string;
}

export function preserveSpecialistImpacts(
  impacts: SpecialistImpact[],
): SpecialistImpact[] {
  return impacts.map((impact) => ({ ...impact }));
}
