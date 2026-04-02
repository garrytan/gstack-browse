import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET() {
  try {
    const store = EventStore.getInstance()
    const pipelines = store.getPipelines()
    return NextResponse.json(pipelines, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
