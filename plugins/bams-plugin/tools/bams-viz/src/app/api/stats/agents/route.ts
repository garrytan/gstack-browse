import { NextResponse } from 'next/server'
import { EventStore } from '@/lib/event-store'
import { bamsApi } from '@/lib/bams-api'

function headers(source: string) {
  return { 'Access-Control-Allow-Origin': '*', 'X-Data-Source': source }
}

export async function GET() {
  try {
    const data = await bamsApi.getAgentStats()
    return NextResponse.json(data, { headers: headers('api') })
  } catch {
    try {
      const store = EventStore.getInstance()
      const stats = store.getAgentStats()
      return NextResponse.json(stats, { headers: headers('fallback') })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return NextResponse.json({ error: message }, { status: 500, headers: headers('error') })
    }
  }
}
