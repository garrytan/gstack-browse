import { NextResponse } from 'next/server'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getDbPath } from '@/lib/global-root'
import { EventStore } from '@/lib/event-store'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

// ── JSON fallback helpers ────────────────────────────────────────────────────

function getHrDirFallback(): string {
  const crewRoot = EventStore.findCrewRoot()
  const hrDir = join(crewRoot, 'artifacts', 'hr')
  mkdirSync(hrDir, { recursive: true })
  return hrDir
}

/** Extract YYYY-MM-DD from any HR report filename */
function extractDate(filename: string): string {
  const m = filename.match(/-(\d{4}-\d{2}-\d{2})\.json$/)
  return m ? m[1] : '0000-00-00'
}

function loadFromJson() {
  const hrDir = getHrDirFallback()
  if (!existsSync(hrDir)) return []

  const all = readdirSync(hrDir)
  const weeklyFiles = all.filter(f => f.startsWith('weekly-report-') && f.endsWith('.json'))
  const retroFiles = all.filter(f => f.startsWith('retro-report-') && f.endsWith('.json'))

  return [...weeklyFiles, ...retroFiles]
    .sort((a, b) => extractDate(b).localeCompare(extractDate(a)))
    .map(f => {
      const isRetro = f.startsWith('retro-report-')
      const datePart = extractDate(f)
      try {
        const data = JSON.parse(readFileSync(join(hrDir, f), 'utf-8'))
        return {
          date: datePart,
          filename: f,
          report_date: data.report_date ?? datePart,
          period: data.period ?? null,
          summary: data.summary ?? null,
          agent_count: data.agents?.length ?? 0,
          alert_count: data.alerts?.length ?? 0,
          source: (data.source ?? (isRetro ? 'retro' : 'weekly')) as 'weekly' | 'retro',
          ...(isRetro ? { retro_slug: data.retro_slug ?? null } : {}),
        }
      } catch {
        return {
          date: datePart,
          filename: f,
          report_date: datePart,
          period: null,
          summary: null,
          agent_count: 0,
          alert_count: 0,
          source: (isRetro ? 'retro' : 'weekly') as 'weekly' | 'retro',
          ...(isRetro ? { retro_slug: null } : {}),
        }
      }
    })
}

// ── DB loader ────────────────────────────────────────────────────────────────

interface HrReportRow {
  id: string
  retro_slug: string
  report_date: string
  source: string
  period_start: string | null
  period_end: string | null
  data: string
  created_at: string
  updated_at: string
}

function loadFromDb(dbPath: string) {
  try {
    // bun:sqlite는 서버사이드(Bun 런타임)에서만 사용 가능
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require('bun:sqlite') as typeof import('bun:sqlite')
    const db = new Database(dbPath, { readonly: true })
    const rows = db.prepare<HrReportRow, []>(
      'SELECT * FROM hr_reports ORDER BY report_date DESC, created_at DESC'
    ).all()
    db.close()

    return rows.map(row => {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(row.data) } catch { /* ignore */ }
      const isRetro = row.source === 'retro'
      return {
        date: row.report_date,
        filename: `retro-report-${row.retro_slug}-${row.report_date}.json`,
        report_date: row.report_date,
        period: data.period ?? (row.period_start ? { start: row.period_start, end: row.period_end } : null),
        summary: data.summary ?? null,
        agent_count: (data.agents as unknown[])?.length ?? 0,
        alert_count: (data.alerts as unknown[])?.length ?? 0,
        source: row.source as 'weekly' | 'retro',
        ...(isRetro ? { retro_slug: row.retro_slug } : {}),
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[hr/reports] DB 조회 실패, JSON fallback 사용: ${msg}`)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. DB 우선
    const dbPath = getDbPath()
    if (dbPath) {
      const dbResult = loadFromDb(dbPath)
      if (dbResult !== null) {
        return NextResponse.json(dbResult, { headers: corsHeaders })
      }
    }

    // 2. JSON fallback
    return NextResponse.json(loadFromJson(), { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
