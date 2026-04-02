'use client'

import { useState, useMemo } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import type { AgentData, AgentCall } from '@/lib/types'

const DEPT_MAP: Record<string, { color: string; label: string }> = {
  planning: { color: '#3b82f6', label: 'Planning' },
  engineering: { color: '#22c55e', label: 'Engineering' },
  evaluation: { color: '#f97316', label: 'Evaluation' },
  qa: { color: '#a855f7', label: 'QA' },
}

const DEPT_LAYOUT: Record<string, { x: number; y: number; w: number; h: number }> = {
  planning: { x: 40, y: 40, w: 360, h: 280 },
  engineering: { x: 440, y: 40, w: 360, h: 280 },
  evaluation: { x: 40, y: 360, w: 360, h: 280 },
  qa: { x: 440, y: 360, w: 360, h: 280 },
}

interface AgentNode {
  agentType: string
  department: string
  status: 'idle' | 'working' | 'error'
  lastCall: AgentCall | null
  recentCalls: AgentCall[]
  x: number
  y: number
}

interface MetaverseTabProps {
  onNavigateToTraces?: () => void
}

function buildAgentNodes(data: AgentData): AgentNode[] {
  const agentMap = new Map<string, { dept: string; calls: AgentCall[] }>()

  for (const call of data.calls) {
    const key = call.agentType
    if (!agentMap.has(key)) {
      const stat = data.stats.find(s => s.agentType === call.agentType)
      agentMap.set(key, { dept: stat?.dept || call.department || 'engineering', calls: [] })
    }
    agentMap.get(key)!.calls.push(call)
  }

  const deptAgents: Record<string, AgentNode[]> = {}

  for (const [agentType, { dept, calls }] of agentMap) {
    const sorted = [...calls].sort((a, b) => {
      const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0
      const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0
      return tb - ta
    })

    const lastCall = sorted[0] || null
    const isRunning = lastCall && lastCall.startedAt && !lastCall.endedAt
    const hasError = lastCall?.isError

    const status: 'idle' | 'working' | 'error' = hasError ? 'error' : isRunning ? 'working' : 'idle'

    if (!deptAgents[dept]) deptAgents[dept] = []
    deptAgents[dept].push({
      agentType,
      department: dept,
      status,
      lastCall,
      recentCalls: sorted.slice(0, 5),
      x: 0,
      y: 0,
    })
  }

  // Position agents within department areas
  const result: AgentNode[] = []
  for (const [dept, agents] of Object.entries(deptAgents)) {
    const layout = DEPT_LAYOUT[dept] || DEPT_LAYOUT.engineering
    const cols = Math.ceil(Math.sqrt(agents.length))
    const cellW = (layout.w - 40) / Math.max(cols, 1)
    const cellH = 80

    agents.forEach((agent, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      agent.x = layout.x + 20 + col * cellW + cellW / 2
      agent.y = layout.y + 50 + row * cellH + cellH / 2
      result.push(agent)
    })
  }

  return result
}

function AgentNodeSVG({
  node,
  onClick,
}: {
  node: AgentNode
  onClick: () => void
}) {
  const deptInfo = DEPT_MAP[node.department] || { color: '#6c757d', label: 'Unknown' }
  const fillColor = node.status === 'working' ? deptInfo.color
    : node.status === 'error' ? '#ef4444'
    : '#6c757d'

  const pulseClass = node.status === 'working' ? 'agent-pulse' : node.status === 'error' ? 'agent-blink' : ''

  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Outer ring for working/error */}
      {node.status !== 'idle' && (
        <circle
          cx={node.x}
          cy={node.y}
          r={22}
          fill="none"
          stroke={fillColor}
          strokeWidth={2}
          opacity={0.3}
          className={pulseClass}
        />
      )}
      {/* Main circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={16}
        fill={fillColor}
        opacity={0.9}
      />
      {/* Icon */}
      <text
        x={node.x}
        y={node.y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
        fill="white"
      >
        {node.status === 'error' ? '!' : node.status === 'working' ? '>' : '-'}
      </text>
      {/* Label */}
      <text
        x={node.x}
        y={node.y + 30}
        textAnchor="middle"
        fontSize={10}
        fill="var(--text-secondary)"
      >
        {node.agentType.length > 16 ? node.agentType.slice(0, 14) + '..' : node.agentType}
      </text>
    </g>
  )
}

export function MetaverseTab({ onNavigateToTraces }: MetaverseTabProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null)
  const { data, error, isLoading } = usePolling<AgentData>('/api/agents?date=all', 2000)

  const nodes = useMemo(() => {
    if (!data) return []
    return buildAgentNodes(data)
  }, [data])

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading metaverse...</div>
  }
  if (error) {
    return <div style={{ padding: '20px', color: 'var(--status-fail)' }}>Error: {error.message}</div>
  }
  if (!data || data.totalCalls === 0) {
    return <EmptyState icon="🌐" title="No agents" description="No agent data to visualize. Run a pipeline to see agents appear." />
  }

  const svgWidth = 840
  const svgHeight = 680

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px' }}>
      <style>{`
        @keyframes agentPulse {
          0%, 100% { r: 22; opacity: 0.3; }
          50% { r: 28; opacity: 0.1; }
        }
        @keyframes agentBlink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        .agent-pulse { animation: agentPulse 1.5s ease-in-out infinite; }
        .agent-blink { animation: agentBlink 0.8s ease-in-out infinite; }
      `}</style>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          width: '100%',
          maxWidth: `${svgWidth}px`,
          height: 'auto',
          margin: '0 auto',
          display: 'block',
        }}
      >
        {/* Department areas */}
        {Object.entries(DEPT_LAYOUT).map(([dept, layout]) => {
          const deptInfo = DEPT_MAP[dept] || { color: '#6c757d', label: dept }
          return (
            <g key={dept}>
              <rect
                x={layout.x}
                y={layout.y}
                width={layout.w}
                height={layout.h}
                rx={8}
                fill={deptInfo.color}
                opacity={0.06}
                stroke={deptInfo.color}
                strokeWidth={1}
                strokeOpacity={0.2}
              />
              <text
                x={layout.x + 12}
                y={layout.y + 24}
                fontSize={13}
                fontWeight={600}
                fill={deptInfo.color}
                opacity={0.7}
              >
                {deptInfo.label}
              </text>
            </g>
          )
        })}

        {/* Agent nodes */}
        {nodes.map(node => (
          <AgentNodeSVG
            key={node.agentType}
            node={node}
            onClick={() => setSelectedAgent(node)}
          />
        ))}
      </svg>

      {/* Agent detail modal */}
      <Modal
        open={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
        title={selectedAgent?.agentType || ''}
        width="520px"
      >
        {selectedAgent && (
          <div>
            {/* Status */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge
                variant={selectedAgent.status === 'error' ? 'error' : selectedAgent.status === 'working' ? 'running' : 'pending'}
                pulse={selectedAgent.status === 'working'}
              >
                {selectedAgent.status.toUpperCase()}
              </Badge>
              <span style={{ fontSize: '12px', color: DEPT_MAP[selectedAgent.department]?.color || 'var(--text-muted)' }}>
                {selectedAgent.department}
              </span>
            </div>

            {/* Current task */}
            {selectedAgent.lastCall && selectedAgent.status === 'working' && (
              <div style={{
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '12px',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>Current Task</div>
                <div>{selectedAgent.lastCall.promptSummary || selectedAgent.lastCall.description || '-'}</div>
              </div>
            )}

            {/* Recent history */}
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Recent History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedAgent.recentCalls.map((call, i) => (
                <div
                  key={call.callId || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  <Badge variant={call.isError ? 'error' : !call.endedAt ? 'running' : 'success'}>
                    {call.isError ? 'ERR' : !call.endedAt ? 'RUN' : 'OK'}
                  </Badge>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {call.description || call.promptSummary || call.model || '-'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    {call.durationMs != null ? formatDuration(call.durationMs) : '...'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    {call.startedAt ? formatRelativeTime(call.startedAt) : ''}
                  </span>
                </div>
              ))}
              {selectedAgent.recentCalls.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>No recent calls</div>
              )}
            </div>

            {/* Link to traces */}
            {onNavigateToTraces && (
              <button
                onClick={() => {
                  setSelectedAgent(null)
                  onNavigateToTraces()
                }}
                style={{
                  marginTop: '16px',
                  background: 'none',
                  border: '1px solid var(--accent)',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                View in Traces tab
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
