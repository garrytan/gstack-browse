import { describe, test, expect } from 'bun:test';
import type { TemplateContext } from '../scripts/resolvers/types';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { generateResearchConventions, generateProvenanceSpec, generateExperimentStructure } from '../scripts/resolvers/research';
import { generateLearningsSearch, generateLearningsLog } from '../scripts/resolvers/learnings';
import { generateSlugEval } from '../scripts/resolvers/utility';
import { generatePreamble } from '../scripts/resolvers/preamble';

const mockCtx: TemplateContext = {
  skillName: 'test-skill',
  tmplPath: '/tmp/test/SKILL.md.tmpl',
  host: 'claude',
  paths: HOST_PATHS.claude,
  preambleTier: 2,
};

describe('RESEARCH_CONVENTIONS resolver', () => {
  const output = generateResearchConventions(mockCtx);

  test('references CLAUDE.md for convention lookup', () => {
    expect(output).toContain('CLAUDE.md');
    expect(output).toContain('Research conventions');
  });

  test('includes convention fields', () => {
    expect(output).toContain('language:');
    expect(output).toContain('test_command:');
    expect(output).toContain('compute_backend:');
    expect(output).toContain('preferred_libraries:');
    expect(output).toContain('naming:');
    expect(output).toContain('imports:');
  });

  test('detects multiple languages', () => {
    expect(output).toContain('python');
    expect(output).toContain('julia');
    expect(output).toContain('rust');
    expect(output).toContain('cpp');
  });

  test('requires user confirmation via AskUserQuestion', () => {
    expect(output).toContain('AskUserQuestion');
  });

  test('handles NO_CONVENTIONS case', () => {
    expect(output).toContain('NO_CONVENTIONS');
  });
});

describe('PROVENANCE_SPEC resolver', () => {
  const output = generateProvenanceSpec(mockCtx);

  test('includes all required JSON fields', () => {
    for (const field of ['git_sha', 'git_dirty', 'branch', 'timestamp', 'wall_clock_seconds', 'random_seeds', 'packages', 'platform', 'experiment_spec', 'parameters']) {
      expect(output).toContain(`"${field}"`);
    }
  });

  test('includes baseline_ref optional field', () => {
    expect(output).toContain('baseline_ref');
  });

  test('includes capture_provenance Python function', () => {
    expect(output).toContain('def capture_provenance');
    expect(output).toContain('import json, subprocess');
  });

  test('uses git commands for SHA and dirty state', () => {
    expect(output).toContain('rev-parse');
    expect(output).toContain('HEAD');
    expect(output).toContain('porcelain');
    expect(output).toContain('show-current');
  });
});

describe('EXPERIMENT_STRUCTURE resolver', () => {
  const output = generateExperimentStructure(mockCtx);

  test('includes all 7 research subdirectories', () => {
    for (const dir of ['hypotheses/', 'experiments/', 'results/', 'baselines/', 'reports/', 'discussions/', 'reviews/']) {
      expect(output).toContain(dir);
    }
  });

  test('specifies slug convention', () => {
    expect(output).toContain('lowercase');
    expect(output).toContain('hyphens');
    expect(output).toContain('no underscores');
  });

  test('specifies timestamp format', () => {
    expect(output).toContain('YYYYMMDD-HHMMSS');
  });

  test('includes mkdir command for structure creation', () => {
    expect(output).toContain('mkdir -p research/');
  });

  test('requires relative paths', () => {
    expect(output).toContain('relative paths');
    expect(output).toContain('Never hardcode absolute paths');
  });
});

describe('LEARNINGS_SEARCH resolver', () => {
  const output = generateLearningsSearch(mockCtx);

  test('calls rstack-learnings-search', () => {
    expect(output).toContain('rstack-learnings-search');
  });

  test('supports cross-project learnings', () => {
    expect(output).toContain('cross_project_learnings');
    expect(output).toContain('--cross-project');
  });

  test('uses correct bin path', () => {
    expect(output).toContain(HOST_PATHS.claude.binDir);
  });

  test('codex host has simpler version', () => {
    const codexCtx = { ...mockCtx, host: 'codex' as const, paths: HOST_PATHS.codex };
    const codexOutput = generateLearningsSearch(codexCtx);
    expect(codexOutput).toContain('$RSTACK_BIN/rstack-learnings-search');
    expect(codexOutput).not.toContain('cross_project_learnings');
  });
});

describe('LEARNINGS_LOG resolver', () => {
  const output = generateLearningsLog(mockCtx);

  test('calls rstack-learnings-log', () => {
    expect(output).toContain('rstack-learnings-log');
  });

  test('documents all learning types', () => {
    for (const type of ['pattern', 'pitfall', 'preference', 'architecture', 'tool', 'operational']) {
      expect(output).toContain(type);
    }
  });

  test('documents all source types', () => {
    for (const source of ['observed', 'user-stated', 'inferred', 'cross-model']) {
      expect(output).toContain(source);
    }
  });

  test('documents confidence range', () => {
    expect(output).toContain('1-10');
  });

  test('interpolates skill name', () => {
    expect(output).toContain('"skill":"test-skill"');
  });
});

describe('SLUG_EVAL resolver', () => {
  const output = generateSlugEval(mockCtx);

  test('calls rstack-slug via eval', () => {
    expect(output).toContain('eval');
    expect(output).toContain('rstack-slug');
  });

  test('uses correct bin path', () => {
    expect(output).toContain(HOST_PATHS.claude.binDir);
  });
});

describe('PREAMBLE resolver', () => {
  const output = generatePreamble(mockCtx);

  test('includes session tracking', () => {
    expect(output).toContain('_SESSION_ID');
    expect(output).toContain('_TEL_START');
  });

  test('includes voice directive', () => {
    expect(output).toContain('Voice');
    expect(output).toContain('direct, concrete');
  });

  test('includes completion status', () => {
    expect(output).toContain('DONE');
    expect(output).toContain('BLOCKED');
    expect(output).toContain('NEEDS_CONTEXT');
  });

  test('tier 2 includes context recovery and extras', () => {
    expect(output).toContain('Context Recovery');
    expect(output).toContain('AskUserQuestion');
    expect(output).toContain('Completeness');
    expect(output).toContain('Search Before Building');
  });

  test('tier 1 omits context recovery and extras', () => {
    const tier1Ctx = { ...mockCtx, preambleTier: 1 };
    const tier1Output = generatePreamble(tier1Ctx);
    expect(tier1Output).not.toContain('Context Recovery');
    expect(tier1Output).not.toContain('Completeness Principle');
    expect(tier1Output).toContain('Voice');
    expect(tier1Output).toContain('DONE');
  });

  test('includes learnings count check', () => {
    expect(output).toContain('_LEARN_FILE');
    expect(output).toContain('_LEARN_COUNT');
  });

  test('includes branch detection', () => {
    expect(output).toContain('_BRANCH');
    expect(output).toContain('git branch --show-current');
  });
});
