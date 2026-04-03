import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET() {
  // API 우선: Control Plane에서 에이전트 통계 조회
  try {
    const data = await bamsApi.getAgentStats()
    return NextResponse.json(data, { headers: corsHeaders })
  } catch {
    // Fallback: EventStore (파일 기반)
    try {
      const store = EventStore.getInstance()
      const stats = store.getAgentStats()
      return NextResponse.json(stats, { headers: corsHeaders })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
    }
  }
}
