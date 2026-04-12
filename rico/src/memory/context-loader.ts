import { fitArtifactsToBudget } from "./summaries";

export function buildRoleContext(input: {
  role: string;
  goalSummary: string;
  artifacts: Array<{ title: string; body: string }>;
  maxChars: number;
}) {
  const base = [`role=${input.role}`, input.goalSummary].join("\n\n");
  const artifacts = fitArtifactsToBudget(input.artifacts, base, input.maxChars);
  const parts = [base];

  for (const artifact of artifacts) {
    parts.push(`${artifact.title}\n${artifact.body}`);
  }

  return parts.join("\n\n").slice(0, input.maxChars);
}
