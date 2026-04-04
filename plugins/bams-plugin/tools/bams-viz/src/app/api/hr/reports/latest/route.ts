import { NextResponse } from 'next/server'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getDbPath } from '@/lib/global-root'
import { EventStore } from '@/lib/event-store'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

const EMPTY_REPORT = {
  report_date: null,
  source: 'weekly' as const,
  period: { start: null, end: null },
  summary: {
    total_pipelines: 0,
    total_invocations: 0,
    overall_success_rate: 0,
  },
  departments: [],
  agents: [],
  alerts: [],
  recommendations: [],
}

// ── JSON fallback helpers ────────────────────────────────────────────────────

function getHrDirFallback(): string {
  const crewRoot = EventStore.findCrewRoot()
  const hrDir = join(crewRoot, 'artifacts', 'hr')
  mkdirSync(hrDir, { recursive: true })
  return hrDir
}

function extractDate(filename: string): string {
  const m = filename.match(/-(\d{4}-\d{2}-\d{2})\.json$/)
  return m ? m[1] : '0000-00-00'
}

function loadLatestFromJson(requestedFilename?: string | null) {
  const hrDir = getHrDirFallback()
  if (!existsSync(hrDir)) return null

  const all = readdirSync(hrDir)
  const weeklyFiles = all.filter(f => f.startsWith('weekly-report-') && f.endsWith('.json'))
  const retroFiles = all.filter(f => f.startsWith('retro-report-') && f.endsWith('.json'))

  const allFiles = [...weeklyFiles, ...retroFiles]
    .sort((a, b) => extractDate(b).localeCompare(extractDate(a)))

  if (allFiles.length === 0) return null

  const targetFile = requestedFilename && allFiles.includes(requestedFilename)
    ? requestedFilename
    : allFiles[0]

  try {
    const data = JSON.parse(readFileSync(join(hrDir, targetFile), 'utf-8'))
    if (!data.source) {
      data.source = targetFile.startsWith('retro-report-') ? 'retro' : 'weekly'
    }
    return data
  } catch {
    return null
  }
}

// ── DB loader ────────────────────────────────────────────────────────────────

interface HrReportRow {
  retro_slug: string
  report_date: string
  source: string
  data: string
}

function loadLatestFromDb(dbPath: string, requestedSlug?: string | null) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require('bun:sqlite') as typeof import('bun:sqlite')
    const db = new Database(dbPath, { readonly: true })

    const row = requestedSlug
      ? db.prepare<HrReportRow, [string]>(
          'SELECT retro_slug, report_date, source, data FROM hr_reports WHERE retro_slug = ? LIMIT 1'
        ).get(requestedSlug)
      : db.prepare<HrReportRow, []>(
          'SELECT retro_slug, report_date, source, data FROM hr_reports ORDER BY report_date DESC, created_at DESC LIMIT 1'
        ).get()

    db.close()
    if (!row) return null

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(row.data) } catch { /* ignore */ }
    if (!data.source) data.source = row.source
    return data
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[hr/reports/latest] DB 조회 실패, JSON fallback 사용: ${msg}`)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const requestedFile = url.searchParams.get('filename')
    // filename 파라미터에서 slug 추출: retro-report-{slug}-{date}.json
    const slugMatch = requestedFile?.match(/^retro-report-(.+)-\d{4}-\d{2}-\d{2}\.json$/)
    const requestedSlug = slugMatch ? slugMatch[1] : requestedFile

    // 1. DB 우선
    const dbPath = getDbPath()
    if (dbPath) {
      const dbResult = loadLatestFromDb(dbPath, requestedSlug)
      if (dbResult !== null) {
        return NextResponse.json(dbResult, { headers: corsHeaders })
      }
    }

    // 2. JSON fallback
    const jsonResult = loadLatestFromJson(requestedFile)
    return NextResponse.json(jsonResult ?? EMPTY_REPORT, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
