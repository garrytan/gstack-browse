import type { HostConfig } from '../scripts/host-config';

/**
 * AINative Studio host config.
 *
 * AINative runs on Claude Code (same runtime as the 'claude' host) but
 * enforces platform-specific rules:
 *   - Zero-tolerance for AI attribution in commits/PRs
 *   - Mandatory TDD with 80% coverage
 *   - File placement rules (docs in docs/, scripts in scripts/)
 *   - Issue tracking enforcement (every PR links to an issue)
 *   - Schema sync script instead of Alembic migrations
 *
 * Skills exposed through this host are AINative-specific domain knowledge:
 *   - ZeroDB vector database operations
 *   - ZeroMemory cognitive agent memory
 *   - Agent Cloud deployment and A2A networking
 *   - AX (Agentic Experience) testing methodology
 *   - SDK guides (React, Next.js, Svelte, Vue)
 *   - MCP server creation and hosting
 *
 * @see https://ainative.studio
 * @see https://docs.ainative.studio
 */
const ainative: HostConfig = {
  name: 'ainative',
  displayName: 'AINative Studio',
  cliCommand: 'claude',
  cliAliases: ['cody'],

  globalRoot: '.claude/skills/gstack',
  localSkillRoot: '.claude/skills/gstack',
  hostSubdir: '.ainative',
  usesEnvVars: false,

  frontmatter: {
    mode: 'denylist',
    stripFields: ['sensitive', 'voice-triggers'],
    descriptionLimit: null,
    extraFields: {
      'platform': 'ainative',
    },
  },

  generation: {
    generateMetadata: false,
    skipSkills: ['codex'],  // OpenAI Codex second-opinion not relevant
    includeSkills: [
      // Include all gstack workflow skills plus AINative domain skills
      'autoplan', 'design-consultation', 'design-html', 'design-review',
      'design-shotgun', 'devex-review', 'investigate', 'learn', 'office-hours',
      'plan-ceo-review', 'plan-design-review', 'plan-devex-review',
      'plan-eng-review', 'qa', 'qa-only', 'retro', 'review', 'ship',
      'browse', 'canary', 'cso', 'document-release', 'land-and-deploy',
    ],
  },

  pathRewrites: [],
  toolRewrites: {},
  suppressedResolvers: [],

  runtimeRoot: {
    globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md'],
    globalFiles: {
      'review': ['checklist.md', 'TODOS-format.md'],
    },
  },

  install: {
    prefixable: true,
    linkingStrategy: 'real-dir-symlink',
  },

  // AINative zero-tolerance: no AI attribution in commits
  coAuthorTrailer: '',
  learningsMode: 'full',
};

export default ainative;
