import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET(request: NextRequest) {
  try {
    const since = request.nextUrl.searchParams.get('since')
    const pipeline = request.nextUrl.searchParams.get('pipeline') ?? undefined

    if (!since) {
      return NextResponse.json(
        { error: 'Missing required query parameter: since (ISO timestamp)' },
        { status: 400, headers: corsHeaders }
      )
    }

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
