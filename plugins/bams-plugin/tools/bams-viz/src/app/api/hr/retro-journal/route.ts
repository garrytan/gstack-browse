import { NextResponse } from 'next/server'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getDbPath } from '@/lib/global-root'
import { EventStore } from '@/lib/event-store'
import type { RetroJournalEntry } from '@/lib/types'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

// ── JSON fallback helpers ────────────────────────────────────────────────────

function getHrDirFallback(): string {
  const crewRoot = EventStore.findCrewRoot()
  if (!crewRoot) {
    throw new Error('[retro-journal] crew root not found — is this a bams-managed project? (.crew/ directory missing)')
  }
  const hrDir = join(crewRoot, 'artifacts', 'hr')
  mkdirSync(hrDir, { recursive: true })
  return hrDir
}

function extractDate(filename: string): string {
  const m = filename.match(/-(\d{4}-\d{2}-\d{2})\.json$/)
  return m ? m[1] : '0000-00-00'
}

function loadJournalFromJson(slug?: string | null): RetroJournalEntry[] {
  const hrDir = getHrDirFallback()
  if (!existsSync(hrDir)) return []

  const retroFiles = readdirSync(hrDir)
    .filter(f => f.startsWith('retro-report-') && f.endsWith('.json'))
    .sort((a, b) => extractDate(b).localeCompare(extractDate(a)))

  const entries: RetroJournalEntry[] = []
  for (const filename of retroFiles) {
    try {
      const data = JSON.parse(readFileSync(join(hrDir, filename), 'utf-8'))
      if (!data.retro_metadata) continue

      entries.push({
        retro_slug: data.retro_slug ?? filename.replace(/^retro-report-/, '').replace(/-\d{4}-\d{2}-\d{2}\.json$/, ''),
        report_date: data.report_date ?? extractDate(filename),
        period: data.period ?? { start: null, end: null },
        agent_count: data.agents?.length ?? 0,
        alert_count: data.alerts?.length ?? 0,
        retro_metadata: data.retro_metadata,
        agents: data.agents ?? [],
      })
    } catch (err) {
      console.warn(`[retro-journal] Skipping malformed retro report file: ${filename}`, err)
    }
  }

  if (slug) return entries.filter(e => e.retro_slug === slug)
  return entries
}

// ── DB loader ────────────────────────────────────────────────────────────────

interface HrReportRow {
  retro_slug: string
  report_date: string
  period_start: string | null
  period_end: string | null
  data: string
}

function loadJournalFromDb(dbPath: string, slug?: string | null): RetroJournalEntry[] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require('bun:sqlite') as typeof import('bun:sqlite')
    const db = new Database(dbPath, { readonly: true })
    const rows = slug
      ? db.prepare<HrReportRow, [string]>(
          `SELECT retro_slug, report_date, period_start, period_end, data
           FROM hr_reports
           WHERE source = 'retro' AND retro_slug = ?
           ORDER BY report_date DESC, created_at DESC`
        ).all(slug)
      : db.prepare<HrReportRow, []>(
          `SELECT retro_slug, report_date, period_start, period_end, data
           FROM hr_reports
           WHERE source = 'retro'
           ORDER BY report_date DESC, created_at DESC`
        ).all()
    db.close()

    const entries: RetroJournalEntry[] = []
    for (const row of rows) {
      try {
        let data: Record<string, unknown> = {}
        try { data = JSON.parse(row.data) } catch { /* ignore */ }

        if (!data.retro_metadata) continue

        entries.push({
          retro_slug: row.retro_slug,
          report_date: row.report_date,
          period: data.period as RetroJournalEntry['period'] ?? {
            start: row.period_start,
            end: row.period_end,
          },
          agent_count: (data.agents as unknown[])?.length ?? 0,
          alert_count: (data.alerts as unknown[])?.length ?? 0,
          retro_metadata: data.retro_metadata as RetroJournalEntry['retro_metadata'],
          agents: (data.agents as RetroJournalEntry['agents']) ?? [],
        })
      } catch (err) {
        console.warn(`[retro-journal] Skipping malformed DB row: ${row.retro_slug}`, err)
      }
    }
    return entries
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[retro-journal] DB 조회 실패, JSON fallback 사용: ${msg}`)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const slug = url.searchParams.get('slug') || undefined

    // 1. DB 우선
    const dbPath = getDbPath()
    if (dbPath) {
      const dbResult = loadJournalFromDb(dbPath, slug)
      if (dbResult !== null) {
        return NextResponse.json(dbResult, { headers: corsHeaders })
      }
    }

    // 2. JSON fallback
    return NextResponse.json(loadJournalFromJson(slug), { headers: corsHeaders })
  } catch (error) {
    console.error('[retro-journal] Unexpected error:', error)
    return NextResponse.json([], { headers: corsHeaders, status: 200 })
  }
}
