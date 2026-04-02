import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { generateOrgChart } from '@/lib/org-gen'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

/**
 * Find jojikdo.json by searching known relative paths.
 * The file lives at plugins/bams-plugin/references/jojikdo.json,
 * which is ../../references/jojikdo.json relative to tools/bams-viz (process.cwd()).
 */
function findJojikdo(): string | null {
  const cwd = process.cwd()
  const candidates = [
    // Standard path: tools/bams-viz -> plugins/bams-plugin/references
    join(cwd, '..', '..', 'references', 'jojikdo.json'),
    // Fallback: local references directory
    join(cwd, 'references', 'jojikdo.json'),
  ]

  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

export async function GET() {
  try {
    const jojikdoPath = findJojikdo()
    if (!jojikdoPath) {
      return NextResponse.json(
        { error: 'jojikdo.json not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    const jojikdo = JSON.parse(readFileSync(jojikdoPath, 'utf-8'))
    const mermaid = generateOrgChart(jojikdo)

    return NextResponse.json({ mermaid }, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
