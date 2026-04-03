import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET() {
  // API 우선: Control Plane에서 파이프라인 목록 조회
  try {
    const data = await bamsApi.getPipelines()
    return NextResponse.json(data, { headers: corsHeaders })
  } catch {
    // Fallback: EventStore (파일 기반)
    try {
      const store = EventStore.getInstance()
      const pipelines = store.getPipelines()
      return NextResponse.json(pipelines, { headers: corsHeaders })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
    }
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug')
    const store = EventStore.getInstance()

    if (slug) {
      const deleted = store.deletePipeline(slug)
      if (!deleted) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
      }
      return NextResponse.json({ deleted: slug }, { headers: corsHeaders })
    } else {
      const count = store.deleteAllPipelines()
      return NextResponse.json({ deleted: 'all', count }, { headers: corsHeaders })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
