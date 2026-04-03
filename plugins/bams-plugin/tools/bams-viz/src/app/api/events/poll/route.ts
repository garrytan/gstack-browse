import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get('since')
  const pipeline = request.nextUrl.searchParams.get('pipeline') ?? undefined

  // poll 엔드포인트는 since 파라미터 기반 — 파일 기반 유지 (EventStore가 적합)
  // API 서버에는 SSE 스트리밍(/api/events/stream)이 있어 polling 대신 SSE 권장
  // 단, since 없이 전체 파이프라인 목록 요청이면 API 우선
  if (!since) {
    // since 없음: 파이프라인 목록으로 해석 — API 우선
    try {
      const data = await bamsApi.getPipelines()
      return NextResponse.json(
        { events: data.pipelines, serverTime: new Date().toISOString() },
        { headers: corsHeaders }
      )
    } catch {
      // Fallback
    }
    return NextResponse.json(
      { error: 'Missing required query parameter: since (ISO timestamp)' },
      { status: 400, headers: corsHeaders }
    )
  }

  // since 있음: 기존 EventStore 사용
  try {
    const store = EventStore.getInstance()
    const events = store.getEventsSince(since, pipeline)
    return NextResponse.json(
      { events, serverTime: new Date().toISOString() },
      { headers: corsHeaders }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
