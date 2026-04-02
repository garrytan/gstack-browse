'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { EmptyState } from '@/components/ui/EmptyState'

interface MermaidResponse {
  flowchart: string
  gantt: string
}

export function DagTab({ pipelineSlug }: { pipelineSlug: string | null }) {
  const { data, error, isLoading } = usePolling<MermaidResponse>(
    pipelineSlug ? `/api/mermaid/${pipelineSlug}` : null,
    2000
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const mermaidRef = useRef<typeof import('mermaid') | null>(null)

  const renderMermaid = useCallback(async (code: string) => {
    if (!containerRef.current) return
    if (!mermaidRef.current) {
      mermaidRef.current = await import('mermaid')
      mermaidRef.current.default.initialize({
        startOnLoad: false,
        theme: 'neutral',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
        securityLevel: 'strict',
      })
    }
    try {
      const id = `dag-${Date.now()}`
      const { svg } = await mermaidRef.current.default.render(id, code)
      containerRef.current.innerHTML = svg
    } catch (err) {
      console.error('Mermaid render error:', err)
      if (containerRef.current) {
        containerRef.current.innerHTML = `<pre style="color:var(--status-fail);padding:20px;white-space:pre-wrap">${code}</pre>`
      }
    }
  }, [])

  useEffect(() => {
    if (data?.flowchart) {
      renderMermaid(data.flowchart)
    }
  }, [data?.flowchart, renderMermaid])

  if (!pipelineSlug) {
    return <EmptyState icon="🔀" title="Select a pipeline" description="Choose a pipeline from the dropdown to view its DAG" />
  }
  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading DAG...</div>
  }
  if (error) {
    return <div style={{ padding: '20px', color: 'var(--status-fail)' }}>Error loading DAG: {error.message}</div>
  }
  if (!data?.flowchart) {
    return <EmptyState icon="🔀" title="No DAG data" description="Pipeline has no DAG visualization yet" />
  }

  return (
    <div style={{ padding: '20px', overflow: 'auto', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: '200px',
        }}
      />
    </div>
  )
}
