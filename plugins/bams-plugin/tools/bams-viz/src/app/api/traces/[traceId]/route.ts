import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traceId: string }> }
) {
  try {
    const { traceId } = await params
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
