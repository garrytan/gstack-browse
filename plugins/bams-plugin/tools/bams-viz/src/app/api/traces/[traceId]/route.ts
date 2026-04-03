import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traceId: string }> }
) {
  const { traceId } = await params

  // API 우선: Control Plane에서 트레이스 조회
  try {
    const data = await bamsApi.getTrace(traceId)
    return NextResponse.json(data, { headers: corsHeaders })
  } catch {
    // Fallback: EventStore (파일 기반)
    try {
      const store = EventStore.getInstance()
      const trace = store.getTrace(traceId)
      if (!trace) {
        return NextResponse.json({ error: 'Trace not found' }, { status: 404, headers: corsHeaders })
      }
      return NextResponse.json(trace, { headers: corsHeaders })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
    }
  }
}
