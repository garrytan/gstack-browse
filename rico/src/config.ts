import { join } from "node:path";
import type { RicoConfig, ResolveConfigInput } from "./types";

function parseMaxActiveProjects(value: string | undefined): number {
  if (value === undefined) return 2;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid RICO_MAX_ACTIVE_PROJECTS: ${JSON.stringify(value)}. Expected a positive finite integer.`,
    );
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid RICO_MAX_ACTIVE_PROJECTS: ${JSON.stringify(value)}. Expected a positive finite integer.`,
    );
  }

  return parsed;
}

export function resolveConfig(input: ResolveConfigInput = {}): RicoConfig {
  const cwd = input.cwd ?? process.cwd();
  const env = input.env ?? process.env;
  const stateDir = join(cwd, ".gstack", "rico");

  return {
    stateDir,
    dbPath: join(stateDir, "rico.sqlite"),
    artifactDir: join(stateDir, "artifacts"),
    maxActiveProjects: parseMaxActiveProjects(env.RICO_MAX_ACTIVE_PROJECTS),
    slackSigningSecret: env.SLACK_SIGNING_SECRET ?? "",
    slackBotToken: env.SLACK_BOT_TOKEN ?? "",
  };
}
