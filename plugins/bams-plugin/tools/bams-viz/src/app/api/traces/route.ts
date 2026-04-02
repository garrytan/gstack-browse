import { NextRequest, NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const params = {
      pipeline: searchParams.get('pipeline') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
    }

    const store = EventStore.getInstance()
    const traces = store.getTraces(params)
    return NextResponse.json(traces, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
