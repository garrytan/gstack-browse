import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const store = EventStore.getInstance()
    const mermaid = store.getMermaid(slug)
    if (!mermaid) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
    }
    return NextResponse.json(mermaid, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
