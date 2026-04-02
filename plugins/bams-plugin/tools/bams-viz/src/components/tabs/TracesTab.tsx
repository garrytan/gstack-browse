'use client'

import { useState, useMemo } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import type { Trace, Span } from '@/lib/types'

const DEPT_COLORS: Record<string, string> = {
  planning: 'var(--dept-planning)',
  engineering: 'var(--dept-engineering)',
  evaluation: 'var(--dept-evaluation)',
  qa: 'var(--dept-qa)',
}

function TraceListItem({
  trace,
  isSelected,
  onClick,
}: {
  trace: Trace
  isSelected: boolean
  onClick: () => void
}) {
  const variant = trace.status === 'error' ? 'error'
    : trace.status === 'running' ? 'running'
    : 'success'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-light)',
        cursor: 'pointer',
        background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <Badge variant={variant} pulse={trace.status === 'running'}>
          {trace.status.toUpperCase()}
        </Badge>
        <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {trace.pipelineSlug}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>{trace.spans.length} spans</span>
        <span>{trace.durationMs != null ? formatDuration(trace.durationMs) : '...'}</span>
        <span>{formatRelativeTime(trace.startedAt)}</span>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>In: {trace.totalInputTokens.toLocaleString()}</span>
        <span>Out: {trace.totalOutputTokens.toLocaleString()}</span>
      </div>
    </div>
  )
}

function WaterfallBar({ span, trace }: { span: Span; trace: Trace }) {
  const [showDetail, setShowDetail] = useState(false)
  const traceStart = new Date(trace.startedAt).getTime()
  const totalMs = trace.durationMs || (Date.now() - traceStart)
  const spanStart = new Date(span.startedAt).getTime()
  const spanDuration = span.durationMs || (span.endedAt ? new Date(span.endedAt).getTime() - spanStart : Date.now() - spanStart)

  const left = totalMs > 0 ? ((spanStart - traceStart) / totalMs * 100) : 0
  const width = totalMs > 0 ? Math.max((spanDuration / totalMs * 100), 1) : 1
  const deptColor = DEPT_COLORS[span.department] || 'var(--text-muted)'

  const variant = span.status === 'error' ? 'error'
    : span.status === 'running' ? 'running'
    : 'success'

  return (
    <div>
      <div
        onClick={() => setShowDetail(!showDetail)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          cursor: 'pointer',
          borderBottom: '1px solid var(--border-light)',
          background: showDetail ? 'var(--bg-hover)' : 'transparent',
        }}
      >
        {/* Label */}
        <div style={{ width: '180px', flexShrink: 0, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: deptColor, fontWeight: 600 }}>{span.agentType}</span>
        </div>

        {/* Bar */}
        <div style={{ flex: 1, position: 'relative', height: '20px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
          <div style={{
            position: 'absolute',
            left: `${Math.min(left, 99)}%`,
            width: `${Math.min(width, 100 - left)}%`,
            height: '100%',
            background: deptColor,
            borderRadius: '3px',
            opacity: span.status === 'error' ? 0.7 : 0.85,
            transition: 'opacity 0.15s',
          }} />
        </div>

        {/* Duration */}
        <div style={{ width: '60px', flexShrink: 0, textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
          {formatDuration(spanDuration)}
        </div>
      </div>

      {/* Detail panel */}
      {showDetail && (
        <div style={{
          padding: '12px 16px 12px 200px',
          background: 'var(--code-bg)',
          borderBottom: '1px solid var(--border-light)',
          fontSize: '12px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px 12px', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>Status</span>
            <span><Badge variant={variant}>{span.status}</Badge></span>

            <span style={{ fontWeight: 600 }}>Department</span>
            <span style={{ color: deptColor }}>{span.department}</span>

            <span style={{ fontWeight: 600 }}>Model</span>
            <span>{span.model || '-'}</span>

            <span style={{ fontWeight: 600 }}>Duration</span>
            <span>{span.durationMs != null ? formatDuration(span.durationMs) : '...'}</span>

            {span.tokenUsage && (
              <>
                <span style={{ fontWeight: 600 }}>Tokens</span>
                <span>In: {span.tokenUsage.input.toLocaleString()} / Out: {span.tokenUsage.output.toLocaleString()}</span>
              </>
            )}

            {span.skillName && (
              <>
                <span style={{ fontWeight: 600 }}>Skill</span>
                <span>{span.skillName}</span>
              </>
            )}

            {span.description && (
              <>
                <span style={{ fontWeight: 600 }}>Description</span>
                <span>{span.description}</span>
              </>
            )}

            {span.input && (
              <>
                <span style={{ fontWeight: 600 }}>Input</span>
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '100px',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {span.input}
                </div>
              </>
            )}

            {span.output && (
              <>
                <span style={{ fontWeight: 600 }}>Output</span>
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '100px',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {span.output}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TraceDetail({ trace }: { trace: Trace }) {
  // Sort spans by start time
  const sortedSpans = useMemo(() =>
    [...trace.spans].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()),
    [trace.spans]
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Trace header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{trace.pipelineSlug}</span>
          <Badge variant={trace.status === 'error' ? 'error' : trace.status === 'running' ? 'running' : 'success'}>
            {trace.status}
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Trace ID: {trace.traceId.slice(0, 12)}...</span>
          <span>Spans: {trace.spans.length}</span>
          <span>Duration: {trace.durationMs != null ? formatDuration(trace.durationMs) : '...'}</span>
          <span>Tokens: {trace.totalInputTokens.toLocaleString()} in / {trace.totalOutputTokens.toLocaleString()} out</span>
        </div>
      </div>

      {/* Waterfall */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Legend */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-light)',
          fontSize: '11px',
        }}>
          {Object.entries(DEPT_COLORS).map(([dept, color]) => (
            <span key={dept} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{dept}</span>
            </span>
          ))}
        </div>

        {sortedSpans.map(span => (
          <WaterfallBar key={span.spanId} span={span} trace={trace} />
        ))}
      </div>
    </div>
  )
}

export function TracesTab() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const { data: traces, error, isLoading } = usePolling<Trace[]>('/api/traces', 2000)

  const selectedTrace = useMemo(() => {
    if (!traces || !selectedTraceId) return null
    return traces.find(t => t.traceId === selectedTraceId) || null
  }, [traces, selectedTraceId])

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading traces...</div>
  }
  if (error) {
    return <div style={{ padding: '20px', color: 'var(--status-fail)' }}>Error: {error.message}</div>
  }
  if (!traces || traces.length === 0) {
    return <EmptyState icon="🔍" title="No traces" description="No trace data available. Traces are recorded when agents have trace_id fields." />
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Left: Trace list */}
      <div style={{
        width: '320px',
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-secondary)',
          zIndex: 1,
        }}>
          Traces ({traces.length})
        </div>
        {traces.map(trace => (
          <TraceListItem
            key={trace.traceId}
            trace={trace}
            isSelected={trace.traceId === selectedTraceId}
            onClick={() => setSelectedTraceId(trace.traceId)}
          />
        ))}
      </div>

      {/* Right: Trace detail */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selectedTrace ? (
          <TraceDetail trace={selectedTrace} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}>
            Select a trace to view its waterfall
          </div>
        )}
      </div>
    </div>
  )
}
