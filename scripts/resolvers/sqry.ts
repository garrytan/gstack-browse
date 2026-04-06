import type { TemplateContext, ResolverFn } from './types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface ToolMapping {
  tool: string;
  when: string;
}

interface SkillIntegration {
  phase: string;
  context: string;
  tools: ToolMapping[];
}

interface ToolsConfig {
  tool: string;
  mcp_server_name: string;
  detection: { binary: string; min_version: string; rebuild_hint: string };
  parameter_guidance: string;
  integrations: Record<string, SkillIntegration>;
}

let cachedConfig: ToolsConfig | null = null;

function loadToolsConfig(): ToolsConfig {
  if (cachedConfig) return cachedConfig;
  const configPath = resolve(
    import.meta.dir,
    '../../contrib/add-tool/sqry/tools.json',
  );
  cachedConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  return cachedConfig!;
}

export const generateSqryContext: ResolverFn = (
  ctx: TemplateContext,
): string => {
  let config: ToolsConfig;
  try {
    config = loadToolsConfig();
  } catch {
    return '';
  }

  const integration = config.integrations[ctx.skillName];
  if (!integration) return '';

  const prefix = `mcp__${config.mcp_server_name}__`;

  const toolList = integration.tools
    .map((t) => `- \`${prefix}${t.tool}\` — ${t.when}`)
    .join('\n');

  return `## Structural Code Analysis (sqry)

If \`SQRY: unavailable\`: skip this section.
If \`SQRY: available\` but no \`${prefix}\` tools visible: tell user to run \`sqry mcp setup\` and restart session.

**Index freshness:** if \`SQRY_INDEXED: no\` → tell user to run \`sqry index .\` (typically 10-60s), then \`${prefix}rebuild_index\`.
${config.detection.rebuild_hint}

**${integration.context}** — use these \`${prefix}\` tools:

${toolList}

**Tool parameters:** ${config.parameter_guidance}`;
};
