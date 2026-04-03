import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

function headers(source: string) {
  return { 'Access-Control-Allow-Origin': '*', 'X-Data-Source': source }
}

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get('since')
  const pipeline = request.nextUrl.searchParams.get('pipeline') ?? undefined

  if (!since) {
    try {
      const data = await bamsApi.getPipelines()
      return NextResponse.json(
        { events: data.pipelines, serverTime: new Date().toISOString() },
        { headers: headers('api') }
      )
    } catch {
      // Fallback
    }
    return NextResponse.json(
      { error: 'Missing required query parameter: since (ISO timestamp)' },
      { status: 400, headers: headers('error') }
    )
  }

  try {
    const store = EventStore.getInstance()
    const events = store.getEventsSince(since, pipeline)
    return NextResponse.json(
      { events, serverTime: new Date().toISOString() },
      { headers: headers('fallback') }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: headers('error') })
  }
}
