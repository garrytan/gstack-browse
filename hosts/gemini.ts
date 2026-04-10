import type { HostConfig } from '../scripts/host-config';

const gemini: HostConfig = {
  name: 'gemini',
  displayName: 'Gemini CLI',
  cliCommand: 'gemini',
  cliAliases: [],

  // Gemini extensions live in ~/.gemini/extensions/<name>/
  // When linked via `gemini extensions link`, the repo root IS the extension.
  // gen-skill-docs outputs to .gemini/skills/; setup creates a `skills` symlink
  // at the repo root pointing there so Gemini discovers them.
  globalRoot: '.gemini/extensions/gstack',
  localSkillRoot: '.gemini/extensions/gstack',
  hostSubdir: '.gemini',
  usesEnvVars: true,

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: null,
  },

  generation: {
    generateMetadata: false,
    skipSkills: ['codex'],  // Codex skill is Claude-specific
  },

  pathRewrites: [
    // $HOME prefix variant (must come before ~ variant to avoid partial matches)
    { from: '$HOME/.claude/skills/gstack', to: '$HOME/.gemini/extensions/gstack' },
    { from: '~/.claude/skills/gstack', to: '$GSTACK_ROOT' },
    { from: '.claude/skills/gstack/', to: '.gemini/extensions/gstack/' },
    { from: '.claude/skills/gstack', to: '.gemini/extensions/gstack' },
    { from: '.claude/skills/review', to: '.gemini/extensions/gstack/review' },
    { from: '.claude/skills', to: '.gemini/extensions' },
    { from: '$HOME/.claude/plans', to: '$HOME/.gemini/plans' },
    { from: '$HOME/.claude/', to: '$HOME/.gemini/' },
    { from: '~/.claude/', to: '~/.gemini/' },
    { from: 'git add .claude/', to: 'git add .gemini/' },
    { from: 'git rm -r .claude/skills/gstack/', to: 'git rm -r .gemini/extensions/gstack/' },
    { from: 'CLAUDE.md', to: 'GEMINI.md' },
    { from: 'cd ~/.claude/skills/gstack', to: 'cd ~/.gemini/extensions/gstack' },
  ],

  toolRewrites: {
    // Plan mode tools (exact names first)
    'call ExitPlanMode': 'call exit_plan_mode',
    'ExitPlanMode': 'exit_plan_mode',

    // User interaction
    'Use AskUserQuestion': 'Use the ask_user tool',
    'use AskUserQuestion': 'use the ask_user tool',
    'via AskUserQuestion': 'via the ask_user tool',
    'AskUserQuestion call': 'ask_user call',
    'AskUserQuestion calls': 'ask_user calls',
    'AskUserQuestion Format': 'ask_user Format',
    'AskUserQuestion': 'ask_user',

    // Agent/subagent (Gemini has no parallel subagents)
    'use the Agent tool': 'perform the following steps sequentially (Gemini CLI does not support parallel subagents)',
    'dispatch a subagent': 'perform the following steps sequentially',
    'Agent tool': 'sequential execution',
    'subagent': 'sequential sub-task',

    // Skill invocation
    'use the Skill tool to invoke': 'use the activate_skill tool to invoke',
    'invoke the Skill tool': 'use the activate_skill tool',
    'Skill tool': 'activate_skill tool',

    // Web tools
    'WebSearch': 'google_web_search',
    'WebFetch': 'web_fetch',

    // File tools — longer patterns first to avoid partial matches
    'use the Bash tool': 'use the run_shell_command tool',
    'use the Write tool': 'use the write_file tool',
    'use the Read tool': 'use the read_file tool',
    'use the Edit tool': 'use the replace tool',
    'use the Grep tool': 'use the grep_search tool',
    'use the Glob tool': 'use the glob tool',

    // Bare tool references
    'the Bash tool': 'the run_shell_command tool',
    'the Write tool': 'the write_file tool',
    'the Read tool': 'the read_file tool',
    'the Edit tool': 'the replace tool',
    'the Grep tool': 'the grep_search tool',
    'the Glob tool': 'the glob tool',

    // Task tracking
    'TodoWrite': 'write_todos',

    // Chrome MCP (not available in vanilla Gemini)
    'mcp__claude-in-chrome__': '(NOT AVAILABLE in Gemini CLI) mcp__claude-in-chrome__',
  },

  suppressedResolvers: [
    'CODEX_SECOND_OPINION',
    'CODEX_PLAN_REVIEW',
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

  coAuthorTrailer: 'Co-Authored-By: Gemini CLI <noreply@google.com>',
  learningsMode: 'basic',
};

export default gemini;
