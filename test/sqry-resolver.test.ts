import { describe, test, expect } from 'bun:test';
import { generateSqryContext } from '../scripts/resolvers/sqry';
import type { TemplateContext, HostPaths } from '../scripts/resolvers/types';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

// Known sqry MCP tool names (from sqry MCP server tool registrations)
const KNOWN_SQRY_TOOLS = [
  'call_hierarchy', 'complexity_metrics', 'cross_language_edges',
  'dependency_impact', 'direct_callees', 'direct_callers',
  'explain_code', 'export_graph', 'find_cycles', 'find_duplicates',
  'find_unused', 'get_definition', 'get_document_symbols',
  'get_graph_stats', 'get_hover_info', 'get_index_status',
  'get_insights', 'get_references', 'get_workspace_symbols',
  'hierarchical_search', 'is_node_in_cycle', 'list_files',
  'list_symbols', 'pattern_search', 'rebuild_index',
  'relation_query', 'search_similar', 'semantic_diff',
  'semantic_search', 'show_dependencies', 'sqry_ask',
  'subgraph', 'trace_path',
];

const claudePaths: HostPaths = {
  skillRoot: '~/.claude/skills/gstack',
  localSkillRoot: '.claude/skills/gstack',
  binDir: '~/.claude/skills/gstack/bin',
  browseDir: '~/.claude/skills/gstack/browse/dist',
  designDir: '~/.claude/skills/gstack/design/dist',
};

function makeCtx(skillName: string, host: string = 'claude'): TemplateContext {
  return {
    skillName,
    tmplPath: path.join(ROOT, skillName, 'SKILL.md.tmpl'),
    host: host as any,
    paths: claudePaths,
    preambleTier: 4,
  };
}

// Load tools.json for schema validation
const toolsJsonPath = path.join(ROOT, 'contrib/add-tool/sqry/tools.json');
const toolsConfig = JSON.parse(fs.readFileSync(toolsJsonPath, 'utf-8'));

describe('sqry tools.json schema validation', () => {
  test('has valid top-level structure', () => {
    expect(toolsConfig.tool).toBe('sqry');
    expect(toolsConfig.mcp_server_name).toBe('sqry');
    expect(toolsConfig.detection).toBeDefined();
    expect(toolsConfig.detection.binary).toBe('sqry');
    expect(toolsConfig.detection.min_version).toBe('7.0.0');
    expect(toolsConfig.detection.rebuild_hint).toBeTruthy();
    expect(toolsConfig.integrations).toBeDefined();
  });

  test('has no mcp_resources section (resource reads are prohibited — see contrib/add-tool/README.md Security)', () => {
    expect(toolsConfig.mcp_resources).toBeUndefined();
  });

  test('has static parameter_guidance string', () => {
    expect(toolsConfig.parameter_guidance).toBeDefined();
    expect(typeof toolsConfig.parameter_guidance).toBe('string');
    expect(toolsConfig.parameter_guidance.length).toBeGreaterThan(20);
  });

  const integrationNames = Object.keys(toolsConfig.integrations);

  test('has 6 skill integrations', () => {
    expect(integrationNames).toEqual([
      'investigate', 'cso', 'review', 'retro', 'plan-eng-review', 'ship',
    ]);
  });

  test('no tool in any integration has a constraint field', () => {
    for (const [, integration] of Object.entries(toolsConfig.integrations) as [string, any][]) {
      for (const tool of integration.tools) {
        expect(tool.constraint).toBeUndefined();
      }
    }
  });

  for (const [skillName, integration] of Object.entries(toolsConfig.integrations) as [string, any][]) {
    describe(`integration: ${skillName}`, () => {
      test('has required fields', () => {
        expect(integration.phase).toBeTruthy();
        expect(integration.context).toBeTruthy();
        expect(Array.isArray(integration.tools)).toBe(true);
        expect(integration.tools.length).toBeGreaterThan(0);
      });

      for (const tool of integration.tools) {
        test(`tool "${tool.tool}" is a known sqry MCP tool`, () => {
          expect(KNOWN_SQRY_TOOLS).toContain(tool.tool);
        });

        test(`tool "${tool.tool}" has a when description`, () => {
          expect(tool.when).toBeTruthy();
          expect(tool.when.length).toBeGreaterThan(10);
        });
      }
    });
  }
});

describe('SQRY_CONTEXT resolver', () => {
  const integratedSkills = Object.keys(toolsConfig.integrations);

  for (const skillName of integratedSkills) {
    test(`${skillName}: returns non-empty output`, () => {
      const result = generateSqryContext(makeCtx(skillName));
      expect(result.length).toBeGreaterThan(0);
    });

    test(`${skillName}: contains mcp__sqry__ prefix`, () => {
      const result = generateSqryContext(makeCtx(skillName));
      expect(result).toContain('mcp__sqry__');
    });

    test(`${skillName}: contains SQRY availability gating`, () => {
      const result = generateSqryContext(makeCtx(skillName));
      expect(result).toContain('SQRY: unavailable');
      expect(result).toContain('SQRY: available');
    });

    test(`${skillName}: contains MCP runtime gate`, () => {
      const result = generateSqryContext(makeCtx(skillName));
      expect(result).toContain('sqry mcp setup');
    });

    test(`${skillName}: contains index freshness instructions`, () => {
      const result = generateSqryContext(makeCtx(skillName));
      expect(result).toContain('SQRY_INDEXED: no');
      expect(result).toContain('rebuild_index');
    });

    test(`${skillName}: emits static parameter guidance (no MCP resource reads)`, () => {
      const result = generateSqryContext(makeCtx(skillName));
      expect(result).toContain('Tool parameters:');
      expect(result).not.toContain('ReadMcpResourceTool');
      expect(result).not.toContain('sqry://');
    });

    test(`${skillName}: uses context from tools.json`, () => {
      const result = generateSqryContext(makeCtx(skillName));
      const expectedContext = toolsConfig.integrations[skillName].context;
      expect(result).toContain(expectedContext);
    });
  }

  test('returns empty string for unknown skills', () => {
    expect(generateSqryContext(makeCtx('browse'))).toBe('');
    expect(generateSqryContext(makeCtx('qa'))).toBe('');
    expect(generateSqryContext(makeCtx('design-review'))).toBe('');
    expect(generateSqryContext(makeCtx('nonexistent-skill'))).toBe('');
  });
});

describe('generated SKILL.md files contain sqry content', () => {
  const integratedSkills = ['investigate', 'cso', 'review', 'retro', 'plan-eng-review', 'ship'];

  for (const skill of integratedSkills) {
    test(`${skill}/SKILL.md contains Structural Code Analysis section`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('## Structural Code Analysis (sqry)');
      expect(content).toContain('mcp__sqry__');
    });

    test(`${skill}/SKILL.md has no unresolved {{SQRY_CONTEXT}} placeholder`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('{{SQRY_CONTEXT}}');
    });

    test(`${skill}/SKILL.md has static parameter guidance (no MCP resource reads)`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('ReadMcpResourceTool');
      expect(content).not.toContain('sqry://');
      expect(content).toContain('Tool parameters:');
    });
  }

  test('non-integrated skills have no sqry content', () => {
    const nonIntegrated = ['browse', 'qa', 'design-review', 'office-hours', 'codex'];
    for (const skill of nonIntegrated) {
      const skillPath = path.join(ROOT, skill, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).not.toContain('Structural Code Analysis');
        expect(content).not.toContain('mcp__sqry__');
      }
    }
  });
});

describe('preamble detection block', () => {
  test('preamble.ts contains sqry detection', () => {
    const preamble = fs.readFileSync(path.join(ROOT, 'scripts/resolvers/preamble.ts'), 'utf-8');
    expect(preamble).toContain('sqry');
    expect(preamble).toContain('SQRY:');
    expect(preamble).toContain('SQRY_INDEXED');
  });

  test('generated SKILL.md preamble contains sqry detection output', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review/SKILL.md'), 'utf-8');
    expect(content).toContain('SQRY:');
    expect(content).toContain('SQRY_INDEXED:');
  });
});
