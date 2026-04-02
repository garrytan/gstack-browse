'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { EmptyState } from '@/components/ui/EmptyState'
import type { PipelineEvent } from '@/lib/types'

interface LogsTabProps {
  pipelineSlug: string | null
  highlightTimestamp?: string | null
}

function JsonTreeNode({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isObject = value !== null && typeof value === 'object'

  if (!isObject) {
    const color = typeof value === 'string' ? '#22c55e'
      : typeof value === 'number' ? '#3b82f6'
      : typeof value === 'boolean' ? '#f97316'
      : 'var(--text-muted)'
    return (
      <div style={{ paddingLeft: `${depth * 16}px`, fontSize: '12px', fontFamily: 'monospace', lineHeight: '20px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}: </span>
        <span style={{ color }}>{JSON.stringify(value)}</span>
      </div>
    )
  }

  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as object)

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: 'var(--text-primary)',
          padding: 0,
          lineHeight: '20px',
        }}
      >
        <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        {!expanded && (
          <span style={{ color: 'var(--text-muted)' }}>
            {' '}{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        )}
      </button>
      {expanded && entries.map(([k, v]) => (
        <JsonTreeNode key={k} label={k} value={v} depth={depth + 1} />
      ))}
    </div>
  )
}

function LogRow({
  event,
  index,
  searchTerm,
  isHighlighted,
}: {
  event: PipelineEvent
  index: number
  searchTerm: string
  isHighlighted: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const raw = JSON.stringify(event)
  const hasMatch = searchTerm && raw.toLowerCase().includes(searchTerm.toLowerCase())

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border-light)',
        background: isHighlighted ? 'rgba(59,130,246,0.08)' : hasMatch ? 'rgba(245,158,11,0.06)' : 'transparent',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          gap: '8px',
          padding: '6px 16px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '20px',
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right', flexShrink: 0, userSelect: 'none' }}>
          {index + 1}
        </span>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: event.type === 'error' ? 'var(--status-fail)' : 'var(--text-primary)',
        }}>
          {raw}
        </span>
      </div>
      {expanded && (
        <div style={{
          padding: '8px 16px 12px 60px',
          background: 'var(--code-bg)',
          borderTop: '1px solid var(--border-light)',
        }}>
          <JsonTreeNode label="root" value={event} />
        </div>
      )}
    </div>
  )
}

export function LogsTab({ pipelineSlug, highlightTimestamp }: LogsTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)

  const { data, error, isLoading } = usePolling<PipelineEvent[]>(
    pipelineSlug ? `/api/events/${pipelineSlug}` : null,
    1000
  )

  const filtered = useMemo(() => {
    if (!data) return []
    if (!searchTerm) return data
    const term = searchTerm.toLowerCase()
    return data.filter(e => JSON.stringify(e).toLowerCase().includes(term))
  }, [data, searchTerm])

  // Auto scroll on new data
  useEffect(() => {
    if (autoScroll && scrollRef.current && filtered.length > prevLengthRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevLengthRef.current = filtered.length
  }, [filtered.length, autoScroll])

  // Scroll to highlighted timestamp
  const highlightIndex = useMemo(() => {
    if (!highlightTimestamp || !filtered) return -1
    return filtered.findIndex(e => e.ts === highlightTimestamp)
  }, [filtered, highlightTimestamp])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  if (!pipelineSlug) {
    return <EmptyState icon="📋" title="Select a pipeline" description="Choose a pipeline to view its raw event logs" />
  }
  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</div>
  }
  if (error) {
    return <div style={{ padding: '20px', color: 'var(--status-fail)' }}>Error: {error.message}</div>
  }
  if (!data || data.length === 0) {
    return <EmptyState icon="📋" title="No logs" description="No event logs for this pipeline" />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: '10px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {filtered.length}/{data.length} events
        </span>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: autoScroll ? 'var(--accent)' : 'var(--border)',
            background: autoScroll ? 'rgba(59,130,246,0.1)' : 'transparent',
            color: autoScroll ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Auto-scroll {autoScroll ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Log list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {filtered.map((event, i) => (
          <LogRow
            key={`${event.ts}-${i}`}
            event={event}
            index={i}
            searchTerm={searchTerm}
            isHighlighted={i === highlightIndex}
          />
        ))}
      </div>
    </div>
  )
}
