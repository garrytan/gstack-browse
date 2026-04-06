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
  mcp_resources: Record<string, string>;
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

  const manifest = config.mcp_resources.manifest;
  const capMap = config.mcp_resources.capability_map;
  const toolGuide = config.mcp_resources.tool_guide;

  return `## Structural Code Analysis (sqry)

If \`SQRY: unavailable\`: skip this section.
If \`SQRY: available\` but no \`${prefix}\` tools visible: tell user to run \`sqry mcp setup\` and restart session.

**Before first query:** read \`${manifest}\` via ReadMcpResourceTool to confirm MCP server connection.

**Index freshness:** if \`SQRY_INDEXED: no\` or \`SQRY_STALE: yes\` → run \`${prefix}rebuild_index\` first.
${config.detection.rebuild_hint}

**${integration.context}** — use these \`${prefix}\` tools:

${toolList}

**Limits/tiering:** read \`${capMap}\` via ReadMcpResourceTool. Full params: \`${toolGuide}\`. Live from sqry — do not hardcode.`;
};
