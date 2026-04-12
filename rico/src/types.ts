export interface RicoConfig {
  cwd: string;
  stateDir: string;
  dbPath: string;
  artifactDir: string;
  maxActiveProjects: number;
  slackSigningSecret: string | null;
  slackBotToken: string | null;
}

export interface ResolveConfigInput {
  cwd?: string;
  env?: Record<string, string | undefined>;
}
