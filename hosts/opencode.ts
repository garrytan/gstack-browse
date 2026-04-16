import type { HostConfig } from '../scripts/host-config';

const opencode: HostConfig = {
  name: 'opencode',
  displayName: 'OpenCode',
  cliCommand: 'opencode',
  cliAliases: [],

  globalRoot: '.config/opencode/skills/cavestack',
  localSkillRoot: '.opencode/skills/cavestack',
  hostSubdir: '.opencode',
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
    { from: '~/.claude/skills/cavestack', to: '~/.config/opencode/skills/cavestack' },
    { from: '.claude/skills/cavestack', to: '.opencode/skills/cavestack' },
    { from: '.claude/skills', to: '.opencode/skills' },
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

export default opencode;
