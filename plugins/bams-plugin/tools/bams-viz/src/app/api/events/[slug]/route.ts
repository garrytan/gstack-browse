import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

function headers(source: string) {
  return { 'Access-Control-Allow-Origin': '*', 'X-Data-Source': source }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const data = await bamsApi.getPipeline(slug)
    return NextResponse.json(data, { headers: headers('api') })
  } catch {
    try {
      const store = EventStore.getInstance()
      const pipeline = store.getPipeline(slug)
      if (!pipeline) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: headers('fallback') })
      }
      return NextResponse.json(pipeline, { headers: headers('fallback') })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500, headers: headers('error') })
    }
  }
}
