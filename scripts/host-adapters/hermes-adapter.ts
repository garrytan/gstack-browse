/**
 * Hermes host adapter — post-processing content transformer.
 *
 * Runs AFTER generic frontmatter/path/tool rewrites from the config system.
 * Handles semantic transformations that string-replace can't cover:
 *
 * 1. AskUserQuestion → clarify (Hermes built-in tool)
 * 2. Agent spawning → delegate_task patterns
 * 3. Browse binary patterns ($B → terminal tool)
 * 4. Learnings binary calls → memory tool
 * 5. skill_manage hint footer
 * 6. SOUL.md awareness
 *
 * Interface: transform(content, config) → transformed content
 */

import type { HostConfig } from '../host-config';

/**
 * Transform generated SKILL.md content for Hermes compatibility.
 * Called after all generic rewrites (paths, tools, frontmatter) have been applied.
 */
export function transform(content: string, _config: HostConfig): string {
  let result = content;

  // 1. AskUserQuestion references → clarify
  result = result.replaceAll('AskUserQuestion', 'clarify');
  result = result.replaceAll('Use AskUserQuestion', 'Use clarify');
  result = result.replaceAll('use AskUserQuestion', 'use clarify');

  // 2. Agent tool references → delegate_task (catch remaining patterns)
  result = result.replaceAll('the Agent tool', 'delegate_task');
  result = result.replaceAll('Agent tool', 'delegate_task');
  result = result.replaceAll('subagent_type', 'task description');

  // 3. Browse binary patterns → terminal tool invocation
  result = result.replaceAll('`$B ', '`terminal $B ');

  // 4. Learnings binary calls → memory tool
  result = result.replace(
    /~\/\.hermes\/skills\/gstack\/bin\/gstack-learnings-log\s+'([^']+)'/g,
    'Use the memory tool to save: $1',
  );
  result = result.replace(
    /~\/\.hermes\/skills\/gstack\/bin\/gstack-learnings-search/g,
    'Use the memory tool to search for relevant learnings',
  );

  // 5. SOUL.md awareness — inject note when persona/voice config is referenced
  if (result.includes('persona') || result.includes('voice configuration')) {
    result = result.replace(
      /^(# .+)$/m,
      '$1\n\n> Voice and persona are configured via SOUL.md (~/.hermes/SOUL.md).',
    );
  }

  // 6. skill_manage hint — add footer to generated skills
  if (!result.includes('skill_manage')) {
    result = result.trimEnd() + '\n\n---\n\n> If you find outdated steps in this skill, use skill_manage(action=\'patch\') to fix them.\n';
  }

  return result;
}
