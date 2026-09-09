/**
 * Section resolvers (v2 plan T9, progressive carve).
 *
 * A carved skill keeps its prose-heavy steps in `<skill>/sections/<id>.md`, read
 * on demand. The SAME template ships to every host, so these resolvers make the
 * carve host-aware:
 *
 *  - On CLAUDE: {{SECTION:id}} emits a STOP-Read pointer to the generated section
 *    file (the skeleton), and the section .md is generated + installed separately.
 *  - On CODEX: {{SECTION:id}} emits a STOP-cat pointer to the generated Codex
 *    section file. Setup installs generated Codex skill directories with their
 *    runtime assets, so the section is available globally and in-repo.
 *  - On every OTHER host: {{SECTION:id}} INLINES the section template's content.
 *    Inlined content keeps its own {{RESOLVER}} tokens, which the generator's
 *    multi-pass resolve expands.
 *
 * {{SECTION_INDEX:skill}} renders the situation→section table from the PASSIVE
 * manifest on progressive hosts (empty on inline hosts). The manifest is the
 * single source of id/file/title/trigger text (CM2; v2_PLAN.md:663).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ResolverFn, TemplateContext } from './types';

const ROOT = path.resolve(import.meta.dir, '..', '..');

interface SectionEntry {
  id: string;
  file: string;
  title: string;
  trigger: string;
}
interface SectionManifest {
  skill: string;
  sections: SectionEntry[];
}

function loadManifest(skill: string): SectionManifest {
  const p = path.join(ROOT, skill, 'sections', 'manifest.json');
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as SectionManifest;
}

function findSection(skill: string, id: string): SectionEntry {
  const entry = loadManifest(skill).sections.find(s => s.id === id);
  if (!entry) {
    throw new Error(`{{SECTION:${id}}} — no section "${id}" in ${skill}/sections/manifest.json`);
  }
  return entry;
}

function isProgressiveSectionHost(ctx: TemplateContext): boolean {
  return ctx.host === 'claude' || ctx.host === 'codex';
}

function codexSkillDir(skillName: string): string {
  return skillName.startsWith('gstack-') ? skillName : `gstack-${skillName}`;
}

/**
 * {{SECTION:id}} — pointer on progressive hosts, inline on other hosts.
 * Claude path uses the stable gstack-root install (`{skillRoot}/{skill}/sections/`),
 * which always exists, instead of a naked relative path (Codex outside-voice #7).
 */
export const SECTION: ResolverFn = (ctx: TemplateContext, args?: string[]): string => {
  const id = args?.[0];
  if (!id) throw new Error('{{SECTION:id}} requires a section id');
  const entry = findSection(ctx.skillName, id);

  if (ctx.host === 'claude') {
    const sectionPath = `${ctx.paths.skillRoot}/${ctx.skillName}/sections/${entry.file}`;
    return [
      `> **STOP.** Before ${entry.trigger}, Read \`${sectionPath}\` and execute it`,
      `> in full. Do not work from memory — that section is the source of truth for this step.`,
    ].join('\n');
  }

  if (ctx.host === 'codex') {
  const externalName = codexSkillDir(ctx.skillName);
  const globalPath = `$HOME/.codex/skills/${externalName}/sections/${entry.file}`;
  const localPath = `.agents/skills/${externalName}/sections/${entry.file}`;
  return [
    `> **STOP.** Before ${entry.trigger}, load the canonical section for this phase.`,
    `> Run \`cat "${globalPath}"\`. If that file is missing, run \`cat "${localPath}"\`.`,
    `> Execute the loaded section in full. Do not work from memory — it is the source of truth for this step.`,
  ].join('\n');
}

// Remaining hosts inline the section template content (monolith preserved).
// Inner {{RESOLVER}} tokens are expanded by the generator's multi-pass resolve.
const tmplPath = path.join(ROOT, ctx.skillName, 'sections', `${entry.file}.tmpl`);
return fs.readFileSync(tmplPath, 'utf-8').trimEnd();
};

/**
 * {{SECTION_INDEX:skill}} — situation→section table from the passive manifest.
 * Progressive hosts only; inline hosts already carry the full section payload.
 */
export const SECTION_INDEX: ResolverFn = (ctx: TemplateContext, args?: string[]): string => {
  if (!isProgressiveSectionHost(ctx)) return '';
  const skill = args?.[0] ?? ctx.skillName;
  const manifest = loadManifest(skill);
  const lines: string[] = [
    '## Section index — Read each section when its situation applies',
    '',
    'This skill is a decision-tree skeleton. The steps below point to on-demand',
    'sections. Read a section in full before doing its step; do not work from memory.',
    '',
    '| When | Read this section |',
    '|------|-------------------|',
  ];
  for (const s of manifest.sections) {
    lines.push(`| ${s.trigger} | \`sections/${s.file}\` |`);
  }
  return lines.join('\n');
};
