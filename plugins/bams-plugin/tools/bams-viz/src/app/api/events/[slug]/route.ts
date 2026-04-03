import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // API 우선: Control Plane에서 파이프라인 상세 조회
  try {
    const data = await bamsApi.getPipeline(slug)
    return NextResponse.json(data, { headers: corsHeaders })
  } catch {
    // Fallback: EventStore (파일 기반)
    try {
      const store = EventStore.getInstance()
      const pipeline = store.getPipeline(slug)
      if (!pipeline) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
      }
      return NextResponse.json(pipeline, { headers: corsHeaders })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
    }
  }
}
