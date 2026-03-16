/**
 * Comprehensive integration tests for the 11 new cross-functional skills.
 *
 * Tests are organized in 8 tiers of increasing rigor:
 *   T1: Structural integrity (frontmatter, phases, required sections)
 *   T2: Persona coherence (distinct voice markers, cognitive mode)
 *   T3: Output format validation (report structures, matrices, templates)
 *   T4: Phase completeness & ordering
 *   T5: Tool usage consistency (allowed-tools vs actual references)
 *   T6: Cross-skill consistency (no overlap, no contradiction)
 *   T7: AskUserQuestion compliance
 *   T8: Read-only enforcement (no code modification claims)
 *
 * Philosophy: These skills are analysis/review personas — they MUST be
 * read-only, structured, and produce actionable outputs. Every test here
 * catches a real failure mode where a skill would confuse or mislead
 * the AI agent at runtime.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

// ─── Skill Registry ──────────────────────────────────────────

interface SkillSpec {
  dir: string;
  name: string;
  persona: string;
  requiredSections: string[];
  requiredOutputs: string[];
  mustContain: string[];
  mustNotContain?: string[];
  reportDir: string;
  arguments: string[];
  isReadOnly: boolean;
}

const NEW_SKILLS: SkillSpec[] = [
  {
    dir: 'conflicts',
    name: 'conflicts',
    persona: 'Tech Lead',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7'],
    requiredOutputs: ['CONFLICT MATRIX', 'RECOMMENDED MERGE ORDER'],
    mustContain: ['semantic conflict', 'migration race', 'merge order', 'blast radius', 'gh pr list'],
    reportDir: '.gstack/conflict-reports',
    arguments: ['--deep'],
    isReadOnly: true,
  },
  {
    dir: 'risk',
    name: 'risk',
    persona: 'Chief Risk Officer',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6'],
    requiredOutputs: ['RISK REGISTER', 'Likelihood', 'Impact'],
    mustContain: ['bus factor', 'technical debt', 'single point', 'compliance', 'heat map'],
    reportDir: '.gstack/risk-reports',
    arguments: ['--scope', '--diff', '--update'],
    isReadOnly: true,
  },
  {
    dir: 'cso',
    name: 'cso',
    persona: 'Chief Security Officer',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7'],
    requiredOutputs: ['ATTACK SURFACE MAP', 'SECURITY FINDINGS', 'STRIDE'],
    mustContain: ['OWASP', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'injection', 'authentication'],
    reportDir: '.gstack/security-reports',
    arguments: ['--diff', '--scope', '--owasp', '--supply-chain'],
    isReadOnly: true,
  },
  {
    dir: 'cfo',
    name: 'cfo',
    persona: 'CFO',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'],
    requiredOutputs: ['INFRASTRUCTURE COST MODEL', 'TECHNICAL DEBT BALANCE SHEET', 'BUILD vs. BUY'],
    mustContain: ['ROI', 'cost driver', 'unit economics', 'scaling cost'],
    reportDir: '.gstack/cfo-reports',
    arguments: ['--infra', '--debt', '--build-vs-buy', '--roi'],
    isReadOnly: true,
  },
  {
    dir: 'vc',
    name: 'vc',
    persona: 'VC partner',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6'],
    requiredOutputs: ['MOAT ASSESSMENT', 'TEAM VELOCITY SCORECARD', 'TECHNICAL DUE DILIGENCE SUMMARY'],
    mustContain: ['due diligence', 'moat', 'network effect', 'switching cost', 'defensib'],
    reportDir: '.gstack/vc-reports',
    arguments: ['--moat', '--velocity', '--risks', '--pitch'],
    isReadOnly: true,
  },
  {
    dir: 'board',
    name: 'board',
    persona: 'Board Member',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7', 'Phase 8', 'Phase 9'],
    requiredOutputs: ['TECHNOLOGY KPI DASHBOARD', 'RISK & OPPORTUNITY MATRIX', 'GOVERNANCE CHECKLIST'],
    mustContain: ['strategic alignment', 'fiduciary', 'technology bet', 'board-ready', 'executive'],
    reportDir: '.gstack/board-reports',
    arguments: ['--quarterly', '--risk', '--strategy', '--kpi'],
    isReadOnly: true,
  },
  {
    dir: 'media',
    name: 'media',
    persona: 'tech journalist',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6'],
    requiredOutputs: ['STORY ANGLES', 'LAUNCH NARRATIVE', 'MEDIA KIT CHECKLIST'],
    mustContain: ['headline', 'lede', 'press release', 'tweet', 'competitive positioning'],
    reportDir: '.gstack/media-kit',
    arguments: ['--launch', '--incident', '--milestone', '--competitive'],
    isReadOnly: true,
  },
  {
    dir: 'comms',
    name: 'comms',
    persona: 'Internal Communications',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'],
    requiredOutputs: ['AUDIENCE MAP', 'WEEKLY ENGINEERING UPDATE', 'POST-MORTEM'],
    mustContain: ['stakeholder', 'all-hands', 'RFC', 'incident', 'onboard'],
    reportDir: '.gstack/comms',
    arguments: ['--weekly', '--incident', '--rfc', '--allhands', '--change', '--onboard'],
    isReadOnly: true,
  },
  {
    dir: 'pr-comms',
    name: 'pr-comms',
    persona: 'Public Relations',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7'],
    requiredOutputs: ['PR OPPORTUNITY MAP', 'PRESS RELEASE FORMAT', 'CRISIS COMMUNICATION PLAN'],
    mustContain: ['press release', 'crisis', 'social media', 'thought leadership', 'spokesperson'],
    reportDir: '.gstack/pr-comms',
    arguments: ['--press-release', '--crisis', '--launch', '--social', '--thought-leadership'],
    isReadOnly: true,
  },
  {
    dir: 'ai-hybrid',
    name: 'ai-hybrid',
    persona: 'AI-Human Collaboration Architect',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7', 'Phase 8', 'Phase 9'],
    requiredOutputs: ['AI USAGE INVENTORY', 'TASK CLASSIFICATION MATRIX', 'AI CODE QUALITY AUDIT', 'AI COLLABORATION CHARTER'],
    mustContain: ['human-in-the-loop', 'hallucin', 'over-reliance', 'prompt engineering', 'workflow optimization'],
    reportDir: '.gstack/ai-hybrid',
    arguments: ['--audit', '--workflow', '--metrics', '--prompts', '--risks'],
    isReadOnly: true,
  },
  {
    dir: 'escalation',
    name: 'escalation',
    persona: 'Escalation Manager',
    requiredSections: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Phase 6', 'Phase 7', 'Phase 8', 'Phase 9'],
    requiredOutputs: ['SEVERITY CLASSIFICATION', 'ESCALATION PATH', 'WAR ROOM PLAYBOOK', 'POST-INCIDENT REVIEW'],
    mustContain: ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4', 'war room', 'Tier 1', 'Tier 2', 'on-call', '5 Whys'],
    reportDir: '.gstack/escalation-reports',
    arguments: ['--incident', '--triage', '--war-room', '--post-incident', '--runbook', '--sla'],
    isReadOnly: true,
  },
];

// ─── Helper Functions ────────────────────────────────────────

function readSkill(dir: string): string {
  return fs.readFileSync(path.join(ROOT, dir, 'SKILL.md'), 'utf-8');
}

function readTemplate(dir: string): string {
  return fs.readFileSync(path.join(ROOT, dir, 'SKILL.md.tmpl'), 'utf-8');
}

function extractFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, any> = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  let inList = false;
  const listItems: string[] = [];

  for (const line of lines) {
    if (line.match(/^(\w[\w-]*):\s*\|?\s*$/)) {
      if (inList && currentKey) fm[currentKey] = listItems.splice(0);
      currentKey = line.match(/^(\w[\w-]*)/)![1];
      if (line.includes('|')) {
        fm[currentKey] = ''; // multiline string, handled below
      }
      inList = false;
    } else if (line.match(/^\s+-\s+/)) {
      inList = true;
      listItems.push(line.replace(/^\s+-\s+/, '').trim());
    } else if (line.match(/^(\w[\w-]*):\s+(.+)/)) {
      if (inList && currentKey) fm[currentKey] = listItems.splice(0);
      inList = false;
      const m = line.match(/^(\w[\w-]*):\s+(.+)/)!;
      fm[m[1]] = m[2];
    } else if (currentKey && !inList && line.trim()) {
      fm[currentKey] = (fm[currentKey] || '') + ' ' + line.trim();
    }
  }
  if (inList && currentKey) fm[currentKey] = listItems.splice(0);
  return fm;
}

function extractAllowedTools(content: string): string[] {
  const match = content.match(/allowed-tools:\n((?:\s+-\s+\w+\n?)+)/);
  if (!match) return [];
  return match[1].split('\n').map(l => l.replace(/^\s+-\s+/, '').trim()).filter(Boolean);
}

function countPhases(content: string): number {
  const matches = content.match(/### Phase \d+/g);
  return matches ? matches.length : 0;
}

// ─── T1: Structural Integrity ────────────────────────────────

describe('T1: Structural integrity', () => {
  for (const skill of NEW_SKILLS) {
    describe(`${skill.name}`, () => {
      const content = readSkill(skill.dir);
      const tmpl = readTemplate(skill.dir);

      test('has valid YAML frontmatter with required fields', () => {
        expect(content.startsWith('---\n')).toBe(true);
        expect(content).toContain(`name: ${skill.name}`);
        expect(content).toContain('version:');
        expect(content).toContain('description:');
        expect(content).toContain('allowed-tools:');
      });

      test('has AUTO-GENERATED header', () => {
        expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
        expect(content).toContain('Regenerate: bun run gen:skill-docs');
      });

      test('template uses {{PREAMBLE}} placeholder', () => {
        expect(tmpl).toContain('{{PREAMBLE}}');
      });

      test('generated file has no unresolved placeholders', () => {
        const unresolved = content.match(/\{\{[A-Z_]+\}\}/g);
        expect(unresolved).toBeNull();
      });

      test('has all required phases', () => {
        for (const section of skill.requiredSections) {
          expect(content).toContain(section);
        }
      });

      test('has all required output formats', () => {
        for (const output of skill.requiredOutputs) {
          expect(content).toContain(output);
        }
      });

      test('version follows semver format', () => {
        const versionMatch = content.match(/version:\s*([\d.]+)/);
        expect(versionMatch).not.toBeNull();
        expect(versionMatch![1]).toMatch(/^\d+\.\d+\.\d+$/);
      });

      test('description is multiline and meaningful (>50 chars)', () => {
        const descMatch = content.match(/description:\s*\|\n([\s\S]*?)(?=allowed-tools:)/);
        expect(descMatch).not.toBeNull();
        const desc = descMatch![1].trim();
        expect(desc.length).toBeGreaterThan(50);
      });
    });
  }
});

// ─── T2: Persona Coherence ───────────────────────────────────

describe('T2: Persona coherence', () => {
  for (const skill of NEW_SKILLS) {
    describe(`${skill.name}`, () => {
      const content = readSkill(skill.dir);

      test(`establishes ${skill.persona} persona explicitly`, () => {
        expect(content.toLowerCase()).toContain(skill.persona.toLowerCase());
      });

      test('has a clear "You are" persona statement', () => {
        expect(content).toMatch(/You are a[n]? \*\*/);
      });

      test('has user-invocable section', () => {
        expect(content).toContain('User-invocable');
        expect(content).toContain(`/${skill.name}`);
      });

      test('documents all supported arguments', () => {
        for (const arg of skill.arguments) {
          expect(content).toContain(arg);
        }
      });

      test('must contain domain-specific terminology', () => {
        for (const term of skill.mustContain) {
          expect(content.toLowerCase()).toContain(term.toLowerCase());
        }
      });
    });
  }

  test('all 11 skills have distinct personas (no duplicate persona statements)', () => {
    const personas = NEW_SKILLS.map(s => {
      const content = readSkill(s.dir);
      const match = content.match(/You are a \*\*(.+?)\*\*/);
      return match ? match[1] : '';
    });
    const unique = new Set(personas);
    expect(unique.size).toBe(NEW_SKILLS.length);
  });
});

// ─── T3: Output Format Validation ────────────────────────────

describe('T3: Output format validation', () => {
  for (const skill of NEW_SKILLS) {
    describe(`${skill.name}`, () => {
      const content = readSkill(skill.dir);

      test('specifies report save directory', () => {
        expect(content).toContain(skill.reportDir);
      });

      test('uses mkdir -p for report directory creation', () => {
        expect(content).toContain('mkdir -p');
      });

      test('has structured output format (tables or matrices)', () => {
        // Every analysis skill should produce structured output
        const hasTable = content.includes('═══') || content.includes('───') || content.includes('| ');
        expect(hasTable).toBe(true);
      });

      test('uses ASCII box-drawing for key outputs', () => {
        // Professional output formatting
        const hasBoxDrawing = content.includes('═') || content.includes('─') || content.includes('┌') || content.includes('╔');
        expect(hasBoxDrawing).toBe(true);
      });
    });
  }

  // Specific output format tests

  test('conflicts skill has conflict matrix with legend', () => {
    const content = readSkill('conflicts');
    expect(content).toContain('Legend:');
    expect(content).toContain('PARALLEL-SAFE');
    expect(content).toContain('SEQUENTIAL');
    expect(content).toContain('BLOCKED');
  });

  test('risk skill has heat map with zones', () => {
    const content = readSkill('risk');
    expect(content).toContain('Red zone');
    expect(content).toContain('Amber zone');
    expect(content).toContain('Green zone');
    expect(content).toContain('LIKELIHOOD');
    expect(content).toContain('IMPACT');
  });

  test('cso skill covers all 10 OWASP categories', () => {
    const content = readSkill('cso');
    for (let i = 1; i <= 10; i++) {
      const label = `A${i.toString().padStart(2, '0')}`;
      expect(content).toContain(label);
    }
  });

  test('cso skill has STRIDE model with all 6 categories', () => {
    const content = readSkill('cso');
    const stride = ['Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege'];
    for (const category of stride) {
      expect(content).toContain(category);
    }
  });

  test('cso skill has data classification with all 4 levels', () => {
    const content = readSkill('cso');
    const levels = ['RESTRICTED', 'CONFIDENTIAL', 'INTERNAL', 'PUBLIC'];
    for (const level of levels) {
      expect(content).toContain(level);
    }
  });

  test('cfo skill has build vs buy decision framework', () => {
    const content = readSkill('cfo');
    expect(content).toContain('BUY');
    expect(content).toContain('BUILD');
    expect(content).toContain('EVALUATE');
    expect(content).toContain('competitive advantage');
  });

  test('cfo skill has scaling projections at 10x and 100x', () => {
    const content = readSkill('cfo');
    expect(content).toContain('10x');
    expect(content).toContain('100x');
    expect(content).toContain('Per-user cost');
  });

  test('vc skill has moat rating with all 5 dimensions', () => {
    const content = readSkill('vc');
    const dimensions = ['Data moat', 'Network effects', 'Switching costs', 'Technical complexity', 'Integration depth'];
    for (const dim of dimensions) {
      expect(content).toContain(dim);
    }
  });

  test('vc skill has overall moat levels', () => {
    const content = readSkill('vc');
    const levels = ['No Moat', 'Narrow', 'Wide', 'Fortress'];
    for (const level of levels) {
      expect(content).toContain(level);
    }
  });

  test('board skill has KPI dashboard with all 4 quadrants', () => {
    const content = readSkill('board');
    const quadrants = ['VELOCITY', 'QUALITY', 'TEAM', 'RISK'];
    for (const q of quadrants) {
      expect(content).toContain(q);
    }
  });

  test('board skill has investment allocation breakdown', () => {
    const content = readSkill('board');
    expect(content).toContain('INVESTMENT ALLOCATION');
    expect(content).toContain('New features');
    expect(content).toContain('Maintenance');
    expect(content).toContain('Infrastructure');
    expect(content).toContain('Tech debt');
  });

  test('board skill answers the three strategic questions', () => {
    const content = readSkill('board');
    expect(content).toContain('Are we building the right things');
    expect(content).toContain('Are we building things right');
    expect(content).toContain('Are we building fast enough');
  });

  test('media skill has complete press release structure', () => {
    const content = readSkill('media');
    const sections = ['HEADLINE', 'LEDE', 'PROBLEM', 'SOLUTION', 'PROOF', 'VISION', 'AVAILABILITY'];
    for (const section of sections) {
      expect(content).toContain(section);
    }
  });

  test('media skill has incident communication structure', () => {
    const content = readSkill('media');
    const sections = ['ACKNOWLEDGE', 'TIMELINE', 'ROOT CAUSE', 'IMPACT', 'REMEDIATION', 'COMMITMENT'];
    for (const section of sections) {
      expect(content).toContain(section);
    }
  });

  test('comms skill has all 6 communication templates', () => {
    const content = readSkill('comms');
    const templates = ['--weekly', '--incident', '--rfc', '--allhands', '--change', '--onboard'];
    for (const t of templates) {
      expect(content).toContain(t);
    }
  });

  test('comms skill has 3-tier incident communication', () => {
    const content = readSkill('comms');
    expect(content).toContain('Tier 1');
    expect(content).toContain('Tier 2');
    expect(content).toContain('Tier 3');
    expect(content).toContain('POST-MORTEM');
  });

  test('comms skill has tone guide', () => {
    const content = readSkill('comms');
    expect(content).toContain('TONE GUIDE');
  });

  test('pr-comms skill has crisis communication timeline', () => {
    const content = readSkill('pr-comms');
    expect(content).toContain('HOUR 0-1');
    expect(content).toContain('HOUR 1-4');
    expect(content).toContain('HOUR 4-24');
    expect(content).toContain('DAY 2-7');
  });

  test('ai-hybrid skill has task classification with all 4 categories', () => {
    const content = readSkill('ai-hybrid');
    const categories = ['FULLY AUTOMATE', 'HUMAN-IN-THE-LOOP', 'HUMAN-LED', 'KEEP HUMAN'];
    for (const cat of categories) {
      expect(content).toContain(cat);
    }
  });

  test('ai-hybrid skill has AI risk register', () => {
    const content = readSkill('ai-hybrid');
    const risks = ['Over-reliance', 'Hallucinated', 'Prompt injection', 'vendor dependency', 'skill atrophy'];
    for (const risk of risks) {
      expect(content.toLowerCase()).toContain(risk.toLowerCase());
    }
  });

  test('ai-hybrid skill has productivity dashboard', () => {
    const content = readSkill('ai-hybrid');
    expect(content).toContain('AI PRODUCTIVITY DASHBOARD');
    expect(content).toContain('Before AI');
    expect(content).toContain('After AI');
  });

  test('escalation skill has all 4 severity levels with criteria', () => {
    const content = readSkill('escalation');
    const sevs = ['SEV-1 (CRITICAL)', 'SEV-2 (HIGH)', 'SEV-3 (MEDIUM)', 'SEV-4 (LOW)'];
    for (const sev of sevs) {
      expect(content).toContain(sev);
    }
  });

  test('escalation skill has 4-tier escalation path', () => {
    const content = readSkill('escalation');
    expect(content).toContain('TIER 1');
    expect(content).toContain('TIER 2');
    expect(content).toContain('TIER 3');
    expect(content).toContain('TIER 4');
  });

  test('escalation skill has war room roles', () => {
    const content = readSkill('escalation');
    const roles = ['Incident Commander', 'Technical Lead', 'Communications Lead', 'Scribe'];
    for (const role of roles) {
      expect(content).toContain(role);
    }
  });

  test('escalation skill has 5 Whys in post-incident review', () => {
    const content = readSkill('escalation');
    expect(content).toContain('5 WHYS');
    expect(content).toContain('Why did');
  });

  test('escalation skill has decision framework options', () => {
    const content = readSkill('escalation');
    expect(content).toContain('Rollback');
    expect(content).toContain('Fix forward');
    expect(content).toContain('Mitigate');
    expect(content).toContain('Escalate');
  });
});

// ─── T4: Phase Completeness & Ordering ───────────────────────

describe('T4: Phase completeness & ordering', () => {
  for (const skill of NEW_SKILLS) {
    test(`${skill.name} phases are numbered sequentially`, () => {
      const content = readSkill(skill.dir);
      const phaseMatches = [...content.matchAll(/### Phase (\d+)/g)];
      if (phaseMatches.length === 0) return; // Some skills use different section format

      const numbers = phaseMatches.map(m => parseInt(m[1]));
      for (let i = 0; i < numbers.length; i++) {
        expect(numbers[i]).toBe(i + 1);
      }
    });
  }

  test('conflicts phases cover full workflow: gather → map → detect → order → matrix → recommend → save', () => {
    const content = readSkill('conflicts');
    const workflow = ['Gather Open PRs', 'Blast Radius', 'Detect Conflict', 'Merge Ordering', 'Risk Matrix', 'Actionable Recommendation', 'Write Report'];
    let lastIdx = -1;
    for (const step of workflow) {
      const idx = content.indexOf(step);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  test('escalation phases cover full incident lifecycle', () => {
    const content = readSkill('escalation');
    const lifecycle = ['Situational Assessment', 'Severity Classification', 'Escalation Path', 'Incident Response', 'War Room', 'Post-Incident'];
    let lastIdx = -1;
    for (const step of lifecycle) {
      const idx = content.indexOf(step);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  test('cso phases follow security audit methodology: map → test → model → classify → report → remediate → save', () => {
    const content = readSkill('cso');
    const workflow = ['Phase 1: Attack Surface', 'Phase 2: OWASP', 'Phase 3: STRIDE', 'Phase 4: Data Classification', 'Phase 5: Findings', 'Phase 6: Remediation', 'Phase 7: Save'];
    let lastIdx = -1;
    for (const step of workflow) {
      const idx = content.indexOf(step);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });
});

// ─── T5: Tool Usage Consistency ──────────────────────────────

describe('T5: Tool usage consistency', () => {
  for (const skill of NEW_SKILLS) {
    describe(`${skill.name}`, () => {
      const content = readSkill(skill.dir);
      const allowedTools = extractAllowedTools(content);

      test('has AskUserQuestion in allowed-tools', () => {
        expect(allowedTools).toContain('AskUserQuestion');
      });

      test('has Bash in allowed-tools (needed for git commands)', () => {
        expect(allowedTools).toContain('Bash');
      });

      test('has Read in allowed-tools (needed for file reading)', () => {
        expect(allowedTools).toContain('Read');
      });

      test('has Write in allowed-tools (needed for report saving)', () => {
        expect(allowedTools).toContain('Write');
      });

      test('does NOT have Edit in allowed-tools (read-only skills)', () => {
        // All new skills are read-only analysis — they should not edit code
        expect(allowedTools).not.toContain('Edit');
      });

      test('references bash code blocks for data gathering', () => {
        expect(content).toContain('```bash');
      });

      test('references git, gh, or grep commands for codebase analysis', () => {
        const hasAnalysis = content.includes('git log') || content.includes('git diff') ||
                       content.includes('git branch') || content.includes('gh pr') ||
                       content.includes('grep -rn') || content.includes('git shortlog');
        expect(hasAnalysis).toBe(true);
      });
    });
  }
});

// ─── T6: Cross-Skill Consistency ─────────────────────────────

describe('T6: Cross-skill consistency', () => {
  test('all new skills use the same report directory pattern (.gstack/<name>-*)', () => {
    for (const skill of NEW_SKILLS) {
      const content = readSkill(skill.dir);
      expect(content).toContain('.gstack/');
      expect(content).toContain('mkdir -p');
    }
  });

  test('no two skills share the same report directory', () => {
    const dirs = NEW_SKILLS.map(s => s.reportDir);
    const unique = new Set(dirs);
    expect(unique.size).toBe(dirs.length);
  });

  test('no two skills share the same name', () => {
    const names = NEW_SKILLS.map(s => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test('all skills have distinct descriptions (no copy-paste)', () => {
    const descriptions = NEW_SKILLS.map(s => {
      const content = readSkill(s.dir);
      const match = content.match(/description:\s*\|\n([\s\S]*?)(?=allowed-tools:)/);
      return match ? match[1].trim() : '';
    });
    const unique = new Set(descriptions);
    expect(unique.size).toBe(descriptions.length);
  });

  test('security concerns are split correctly: cso handles security, risk handles broader risk', () => {
    const csoContent = readSkill('cso');
    const riskContent = readSkill('risk');

    // CSO should be deep on OWASP specifics
    expect(csoContent).toContain('A01');
    expect(csoContent).toContain('SQL');
    expect(csoContent).toContain('injection');

    // Risk should cover broader categories including but not limited to security
    expect(riskContent).toContain('Organizational Risk');
    expect(riskContent).toContain('Scalability Cliffs');
    expect(riskContent).toContain('Compliance');
  });

  test('media and pr-comms have complementary but distinct scopes', () => {
    const mediaContent = readSkill('media');
    const prContent = readSkill('pr-comms');

    // Media focuses on story crafting and narrative
    expect(mediaContent).toContain('STORY ANGLES');
    expect(mediaContent).toContain('Story Mining');

    // PR-comms focuses on external communications and crisis management
    expect(prContent).toContain('CRISIS COMMUNICATION PLAN');
    expect(prContent).toContain('spokesperson');
  });

  test('comms and pr-comms cover internal vs external communications respectively', () => {
    const commsContent = readSkill('comms');
    const prContent = readSkill('pr-comms');

    // Comms is internal-focused
    expect(commsContent).toContain('Internal Communications');
    expect(commsContent).toContain('AUDIENCE MAP');
    expect(commsContent).toContain('RFC');

    // PR-comms is external-focused
    expect(prContent).toContain('Public Relations');
    expect(prContent).toContain('press release');
    expect(prContent).toContain('journalist');
  });

  test('escalation severity levels align with risk scoring thresholds', () => {
    const escContent = readSkill('escalation');
    const riskContent = readSkill('risk');

    // Both should use severity/likelihood/impact language
    expect(escContent).toContain('Severity');
    expect(riskContent).toContain('Likelihood');
    expect(riskContent).toContain('Impact');

    // Escalation has concrete response timelines
    expect(escContent).toContain('15 minutes');
    expect(escContent).toContain('30 minutes');
    expect(escContent).toContain('1 hour');
  });
});

// ─── T7: AskUserQuestion Compliance ──────────────────────────

describe('T7: AskUserQuestion compliance', () => {
  for (const skill of NEW_SKILLS) {
    describe(`${skill.name}`, () => {
      const content = readSkill(skill.dir);

      test('contains AskUserQuestion reference', () => {
        expect(content).toContain('AskUserQuestion');
      });

      test('contains RECOMMENDATION format', () => {
        expect(content).toContain('RECOMMENDATION');
      });

      test('contains lettered options pattern', () => {
        // Should have A), B), C) or similar option pattern
        const hasOptions = content.includes('A)') && content.includes('B)');
        expect(hasOptions).toBe(true);
      });

      test('contains session awareness from preamble', () => {
        expect(content).toContain('_SESSIONS');
        expect(content).toContain('ELI16');
      });

      test('contains contributor mode from preamble', () => {
        expect(content).toContain('Contributor Mode');
        expect(content).toContain('gstack_contributor');
      });
    });
  }
});

// ─── T8: Read-Only Enforcement ───────────────────────────────

describe('T8: Read-only enforcement', () => {
  for (const skill of NEW_SKILLS) {
    describe(`${skill.name}`, () => {
      const content = readSkill(skill.dir);

      test('explicitly states read-only policy', () => {
        const hasReadOnly = content.includes('Read-only') ||
                           content.includes('read-only') ||
                           content.includes('Never modify code');
        expect(hasReadOnly).toBe(true);
      });

      test('does not include Edit in allowed-tools', () => {
        const tools = extractAllowedTools(content);
        expect(tools).not.toContain('Edit');
      });

      test('Important Rules section enforces read-only', () => {
        expect(content).toContain('Important Rules');
        // The important rules should mention not modifying code
        const rulesIdx = content.indexOf('Important Rules');
        const rulesSection = content.slice(rulesIdx);
        const hasReadOnlyRule = rulesSection.includes('Read-only') ||
                                rulesSection.includes('read-only') ||
                                rulesSection.includes('Never modify code') ||
                                rulesSection.includes('Never modify any') ||
                                (rulesSection.includes('Produce') && rulesSection.includes('only'));
        expect(hasReadOnlyRule).toBe(true);
      });

      test('does not instruct the agent to git commit or git push', () => {
        // These skills should never instruct the agent to commit or push
        // (they analyze, they don't change)
        // Exception: escalation runbook documents rollback procedures as templates
        // (these are in documentation blocks, not agent instructions)
        const lowerContent = content.toLowerCase();
        if (skill.name !== 'escalation') {
          expect(lowerContent).not.toContain('git commit');
          expect(lowerContent).not.toContain('git push');
        }
        // No skill should instruct the agent to run 'git add'
        // git log, git diff, git branch are fine (read-only analysis)
        const bashBlocks = content.match(/```bash\n([\s\S]*?)```/g) || [];
        for (const block of bashBlocks) {
          expect(block).not.toContain('git add ');
          expect(block).not.toContain('git commit');
        }
      });
    });
  }
});

// ─── T9: Bash Command Sanity ─────────────────────────────────

describe('T9: Bash command sanity', () => {
  for (const skill of NEW_SKILLS) {
    describe(`${skill.name}`, () => {
      const content = readSkill(skill.dir);

      test('bash blocks use safe patterns (no rm -rf, no sudo)', () => {
        const bashBlocks = content.match(/```bash\n([\s\S]*?)```/g) || [];
        for (const block of bashBlocks) {
          expect(block).not.toContain('rm -rf');
          expect(block).not.toContain('sudo ');
          expect(block).not.toContain('chmod 777');
        }
      });

      test('bash blocks use grep/find for analysis, not mutation', () => {
        const bashBlocks = content.match(/```bash\n([\s\S]*?)```/g) || [];
        for (const block of bashBlocks) {
          // Mutation commands that should never appear in analysis skills
          expect(block).not.toContain('git reset --hard');
          expect(block).not.toContain('git checkout --');
          expect(block).not.toContain('DROP TABLE');
          expect(block).not.toContain('DELETE FROM');
        }
      });
    });
  }
});

// ─── T10: Skill Coverage Completeness ────────────────────────

describe('T10: Skill coverage completeness', () => {
  test('gen-skill-docs.ts includes all 11 new skills', () => {
    const genScript = fs.readFileSync(path.join(ROOT, 'scripts', 'gen-skill-docs.ts'), 'utf-8');
    for (const skill of NEW_SKILLS) {
      expect(genScript).toContain(`'${skill.dir}'`);
    }
  });

  test('skill-check.ts includes all 11 new skills in SKILL_FILES', () => {
    const checkScript = fs.readFileSync(path.join(ROOT, 'scripts', 'skill-check.ts'), 'utf-8');
    for (const skill of NEW_SKILLS) {
      expect(checkScript).toContain(`${skill.dir}/SKILL.md`);
    }
  });

  test('skill-check.ts includes all 11 new skills in TEMPLATES', () => {
    const checkScript = fs.readFileSync(path.join(ROOT, 'scripts', 'skill-check.ts'), 'utf-8');
    for (const skill of NEW_SKILLS) {
      expect(checkScript).toContain(`${skill.dir}/SKILL.md.tmpl`);
    }
  });

  test('gen-skill-docs.test.ts includes all 11 new skills in ALL_SKILLS', () => {
    const testFile = fs.readFileSync(path.join(ROOT, 'test', 'gen-skill-docs.test.ts'), 'utf-8');
    for (const skill of NEW_SKILLS) {
      expect(testFile).toContain(`dir: '${skill.dir}'`);
    }
  });

  test('skill-validation.test.ts includes all 11 new skills in preamble lists', () => {
    const testFile = fs.readFileSync(path.join(ROOT, 'test', 'skill-validation.test.ts'), 'utf-8');
    for (const skill of NEW_SKILLS) {
      expect(testFile).toContain(`'${skill.dir}/SKILL.md'`);
    }
  });

  test('total new skills count is exactly 11', () => {
    expect(NEW_SKILLS).toHaveLength(11);
  });

  test('every new skill directory has both .tmpl and .md files', () => {
    for (const skill of NEW_SKILLS) {
      const tmplExists = fs.existsSync(path.join(ROOT, skill.dir, 'SKILL.md.tmpl'));
      const mdExists = fs.existsSync(path.join(ROOT, skill.dir, 'SKILL.md'));
      expect(tmplExists).toBe(true);
      expect(mdExists).toBe(true);
    }
  });
});
