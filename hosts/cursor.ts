import type { HostConfig } from '../scripts/host-config';

const cursor: HostConfig = {
  name: 'cursor',
  displayName: 'Cursor',
  cliCommand: 'cursor',
  cliAliases: [],

  globalRoot: '.cursor/skills/cavestack',
  localSkillRoot: '.cursor/skills/cavestack',
  hostSubdir: '.cursor',
  usesEnvVars: true,

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: null,
  },

  generation: {
    generateMetadata: false,
    skipSkills: ['codex'],
  },

  pathRewrites: [
    { from: '~/.claude/skills/cavestack', to: '~/.cursor/skills/cavestack' },
    { from: '.claude/skills/cavestack', to: '.cursor/skills/cavestack' },
    { from: '.claude/skills', to: '.cursor/skills' },
  ],

  runtimeRoot: {
    globalSymlinks: ['bin', 'browse/dist', 'browse/bin', 'cavestack-upgrade', 'ETHOS.md'],
    globalFiles: {
      'review': ['checklist.md', 'TODOS-format.md'],
    },
  },

  install: {
    prefixable: false,
    linkingStrategy: 'symlink-generated',
  },

  learningsMode: 'basic',
};

export default cursor;
