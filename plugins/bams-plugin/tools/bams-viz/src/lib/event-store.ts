import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import type { Pipeline, AgentData, Trace, PipelineEvent } from './types'
import { parseEvents, parseAgentEvents, buildTraces } from './parser'
import { generateFlowchart, generateGantt } from './mermaid-gen'

const EMPTY_AGENT_DATA: AgentData = {
  calls: [],
  stats: [],
  collaborations: [],
  totalCalls: 0,
  totalErrors: 0,
  runningCount: 0,
}

class EventStore {
  private static instance: EventStore | null = null

  private pipelineDir: string = ''
  private agentsDir: string = ''
  private initialized = false

  /** Validate slug/date to prevent path traversal */
  private static validateParam(param: string): void {
    if (!param || !/^[a-zA-Z0-9_\-]{1,128}$/.test(param)) {
      throw new Error(`Invalid parameter: ${param}`)
    }
  }

  static getInstance(): EventStore {
    if (!EventStore.instance) {
      EventStore.instance = new EventStore()
    }
    return EventStore.instance
  }

  initialize(crewRoot: string): void {
    this.pipelineDir = join(crewRoot, 'artifacts', 'pipeline')
    this.agentsDir = join(crewRoot, 'artifacts', 'agents')
    mkdirSync(this.pipelineDir, { recursive: true })
    mkdirSync(this.agentsDir, { recursive: true })
    this.initialized = true
  }

  /**
   * Find .crew directory by walking up from cwd
   */
  static findCrewRoot(): string {
    let dir = process.cwd()
    for (let i = 0; i < 10; i++) {
      const target = join(dir, '.crew')
      if (existsSync(target)) return target
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
    const fallback = join(process.cwd(), '.crew')
    mkdirSync(fallback, { recursive: true })
    return fallback
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize(EventStore.findCrewRoot())
    }
  }

  /**
   * List all pipelines with summary info
   */
  getPipelines(): Array<{ slug: string; type: string; status: string; startedAt: string | null }> {
    this.ensureInitialized()
    try {
      return readdirSync(this.pipelineDir)
        .filter((f: string) => f.endsWith('-events.jsonl'))
        .map((f: string) => {
          const slug = f.replace('-events.jsonl', '')
          try {
            const content = readFileSync(join(this.pipelineDir, f), 'utf-8')
            const pipeline = parseEvents(content)
            return { slug, type: pipeline.type, status: pipeline.status, startedAt: pipeline.startedAt }
          } catch {
            return { slug, type: 'unknown', status: 'unknown', startedAt: null }
          }
        })
        .sort((a: { startedAt: string | null }, b: { startedAt: string | null }) => (b.startedAt || '').localeCompare(a.startedAt || ''))
    } catch {
      return []
    }
  }

  /**
   * Get parsed pipeline data for a given slug
   */
  getPipeline(slug: string): Pipeline | null {
    this.ensureInitialized()
    EventStore.validateParam(slug)
    const file = join(this.pipelineDir, `${slug}-events.jsonl`)
    if (!existsSync(file)) return null
    try {
      const content = readFileSync(file, 'utf-8')
      return parseEvents(content)
    } catch {
      return null
    }
  }

  /**
   * Get Mermaid flowchart and gantt chart for a pipeline slug
   */
  getMermaid(slug: string): { flowchart: string; gantt: string } | null {
    const pipeline = this.getPipeline(slug)
    if (!pipeline) return null
    return {
      flowchart: generateFlowchart(pipeline),
      gantt: generateGantt(pipeline),
    }
  }

  /**
   * Get agent data, optionally filtered by date
   */
  getAgents(date?: string): AgentData {
    this.ensureInitialized()
    try {
      if (!date || date === 'all') {
        const files: string[] = readdirSync(this.agentsDir)
          .filter((f: string) => f.endsWith('.jsonl'))
          .sort()
          .reverse()
        let content = ''
        for (const f of files.slice(0, 30)) {
          try {
            content += readFileSync(join(this.agentsDir, f), 'utf-8') + '\n'
          } catch {
            // skip unreadable files
          }
        }
        if (!content.trim()) return { ...EMPTY_AGENT_DATA }
        return parseAgentEvents(content)
      } else {
        const file = join(this.agentsDir, `${date}.jsonl`)
        if (!existsSync(file)) return { ...EMPTY_AGENT_DATA }
        const content = readFileSync(file, 'utf-8')
        return parseAgentEvents(content)
      }
    } catch {
      return { ...EMPTY_AGENT_DATA }
    }
  }

  /**
   * List available agent date files
   */
  getAgentDates(): string[] {
    this.ensureInitialized()
    try {
      return readdirSync(this.agentsDir)
        .filter((f: string) => f.endsWith('.jsonl'))
        .map((f: string) => f.replace('.jsonl', ''))
        .sort()
        .reverse()
    } catch {
      return []
    }
  }

  /**
   * Get events since a given ISO timestamp, optionally filtered by pipeline
   */
  getEventsSince(since: string, pipeline?: string): PipelineEvent[] {
    this.ensureInitialized()
    const sinceTime = new Date(since).getTime()
    const results: PipelineEvent[] = []

    try {
      const files: string[] = readdirSync(this.pipelineDir)
        .filter((f: string) => f.endsWith('-events.jsonl'))
        .filter((f: string) => !pipeline || f.startsWith(`${pipeline}-`))

      for (const f of files) {
        try {
          const content = readFileSync(join(this.pipelineDir, f), 'utf-8')
          const lines = content.trim().split('\n').filter(Boolean)
          for (const line of lines) {
            try {
              const event: PipelineEvent = JSON.parse(line)
              if (event.ts && new Date(event.ts).getTime() > sinceTime) {
                results.push(event)
              }
            } catch {
              // skip malformed lines
            }
          }
        } catch {
          // skip unreadable files
        }
      }
    } catch {
      // directory not readable
    }

    return results.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''))
  }

  /**
   * Build Langfuse-style traces from all pipeline events
   */
  getTraces(params?: { pipeline?: string; agent?: string; from?: string; to?: string }): Trace[] {
    this.ensureInitialized()
    const allEvents: PipelineEvent[] = []

    try {
      const files: string[] = readdirSync(this.pipelineDir)
        .filter((f: string) => f.endsWith('-events.jsonl'))
        .filter((f: string) => !params?.pipeline || f.startsWith(`${params.pipeline}-`))

      for (const f of files) {
        try {
          const content = readFileSync(join(this.pipelineDir, f), 'utf-8')
          const lines = content.trim().split('\n').filter(Boolean)
          for (const line of lines) {
            try {
              allEvents.push(JSON.parse(line))
            } catch {
              // skip
            }
          }
        } catch {
          // skip
        }
      }
    } catch {
      return []
    }

    let traces = buildTraces(allEvents)

    // Filter by agent type
    if (params?.agent) {
      traces = traces.filter(t =>
        t.spans.some(s => s.agentType === params.agent)
      )
    }

    // Filter by time range
    if (params?.from) {
      const fromTime = new Date(params.from).getTime()
      traces = traces.filter(t => new Date(t.startedAt).getTime() >= fromTime)
    }
    if (params?.to) {
      const toTime = new Date(params.to).getTime()
      traces = traces.filter(t => new Date(t.startedAt).getTime() <= toTime)
    }

    return traces.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  /**
   * Get a single trace by ID
   */
  getTrace(traceId: string): Trace | null {
    const traces = this.getTraces()
    return traces.find(t => t.traceId === traceId) ?? null
  }

  /**
   * Get aggregated agent statistics
   */
  getAgentStats(): { byAgentType: Array<{ agentType: string; count: number; avgDurationMs: number; errorRate: number }> } {
    const agentData = this.getAgents('all')
    return {
      byAgentType: agentData.stats.map(s => ({
        agentType: s.agentType,
        count: s.callCount,
        avgDurationMs: s.avgDurationMs,
        errorRate: s.errorRate,
      })),
    }
  }
}

export { EventStore }
