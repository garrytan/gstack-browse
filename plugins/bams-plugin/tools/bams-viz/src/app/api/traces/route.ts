import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

function headers(source: string) {
  return { 'Access-Control-Allow-Origin': '*', 'X-Data-Source': source }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const params = {
    pipeline: searchParams.get('pipeline') ?? undefined,
    agent: searchParams.get('agent') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  }

  // API 우선: Control Plane에서 트레이스 조회
  try {
    const data = await bamsApi.getTraces(params)
    return NextResponse.json(data, { headers: headers('api') })
  } catch {
    // Fallback: EventStore (파일 기반)
    try {
      const store = EventStore.getInstance()
      const traces = store.getTraces(params)
      return NextResponse.json(traces, { headers: headers('fallback') })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500, headers: headers('error') })
    }
  }
}
