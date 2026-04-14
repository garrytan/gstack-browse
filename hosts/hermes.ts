import type { HostConfig } from '../scripts/host-config';

const hermes: HostConfig = {
  name: 'hermes',
  displayName: 'Hermes',
  cliCommand: 'hermes',
  cliAliases: [],

  globalRoot: '.hermes/skills/gstack',
  localSkillRoot: '.hermes/skills/gstack',
  hostSubdir: '.hermes',
  usesEnvVars: true,

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: 1024,
    descriptionLimitBehavior: 'error',
    extraFields: {
      version: '0.15.13.0',
    },
  },

  generation: {
    generateMetadata: false,
    skipSkills: ['codex'],
    includeSkills: [],
  },

  pathRewrites: [
    { from: '~/.claude/skills/gstack', to: '~/.hermes/skills/gstack' },
    { from: '.claude/skills/gstack', to: '.hermes/skills/gstack' },
    { from: '.claude/skills', to: '.hermes/skills' },
    { from: 'CLAUDE.md', to: 'HERMES.md' },
  ],
  toolRewrites: {
    'use the Bash tool': 'use the terminal tool',
    'use the Read tool': 'use the read_file tool',
    'use the Write tool': 'use the write_file tool',
    'use the Edit tool': 'use the patch tool',
    'use the Grep tool': 'use search_files with a regex pattern',
    'use the Glob tool': 'use search_files to find files matching',
    'use the Agent tool': 'use delegate_task',
    'the Bash tool': 'the terminal tool',
    'the Read tool': 'the read_file tool',
    'the Write tool': 'the write_file tool',
    'the Edit tool': 'the patch tool',
    'WebSearch': 'web_search',
  },

  // Suppress Claude-specific preamble sections that don't apply to Hermes
  suppressedResolvers: [
    'DESIGN_OUTSIDE_VOICES',
    'ADVERSARIAL_STEP',
    'CODEX_SECOND_OPINION',
    'CODEX_PLAN_REVIEW',
    'REVIEW_ARMY',
  ],

  runtimeRoot: {
    globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'gstack-upgrade', 'ETHOS.md'],
    globalFiles: {
      'review': ['checklist.md', 'TODOS-format.md'],
    },
  },

  install: {
    prefixable: false,
    linkingStrategy: 'symlink-generated',
  },

  coAuthorTrailer: 'Co-Authored-By: Hermes Agent <agent@nousresearch.com>',
  learningsMode: 'basic',

  adapter: './scripts/host-adapters/hermes-adapter',
};

export default hermes;
