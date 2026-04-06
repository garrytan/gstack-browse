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

If preamble shows \`SQRY: unavailable\`: skip this section entirely.

If preamble shows \`SQRY: available\`: check your available tools for the \`${prefix}\` prefix.
- If you see \`${prefix}\` tools: use them as described below.
- If you do NOT see \`${prefix}\` tools despite \`SQRY: available\`: tell the user
  "sqry is installed but not configured as an MCP server. Run \`sqry mcp setup\`
  to enable structural code analysis, then restart this session."

**Server health:** Before your first sqry query, read \`${manifest}\` via
ReadMcpResourceTool to confirm the MCP server is connected and check the installed version.

**Index freshness:**
- If \`SQRY_INDEXED: no\`: run \`${prefix}rebuild_index\` before any queries.
- If \`SQRY_STALE: yes\`: run \`${prefix}rebuild_index\` before any queries.
- ${config.detection.rebuild_hint}

**During ${integration.context}**, use these sqry MCP tools:

${toolList}

**Parameter guidance:** For limits (max_depth, max_results, scoping) and cost tiering,
read \`${capMap}\` via ReadMcpResourceTool. For full tool parameters,
read \`${toolGuide}\`. These resources are served live by sqry and always match
your installed version — do not hardcode parameter values.`;
};
