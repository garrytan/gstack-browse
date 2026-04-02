'use client'

import { usePolling } from '@/hooks/usePolling'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import type { AgentData, AgentCall, AgentTypeStat } from '@/lib/types'

const DEPT_COLORS: Record<string, string> = {
  planning: 'var(--dept-planning)',
  engineering: 'var(--dept-engineering)',
  evaluation: 'var(--dept-evaluation)',
  qa: 'var(--dept-qa)',
}

function StatCard({ stat }: { stat: AgentTypeStat }) {
  const deptColor = DEPT_COLORS[stat.dept] || 'var(--text-muted)'
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-light)',
      borderRadius: '8px',
      padding: '16px',
      borderLeft: `3px solid ${deptColor}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{stat.agentType}</span>
        <span style={{ fontSize: '11px', color: deptColor, fontWeight: 500 }}>{stat.dept}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div>Calls: <strong style={{ color: 'var(--text-primary)' }}>{stat.callCount}</strong></div>
        <div>Errors: <strong style={{ color: stat.errorCount > 0 ? 'var(--status-fail)' : 'var(--text-primary)' }}>{stat.errorCount}</strong></div>
        <div>Avg: <strong style={{ color: 'var(--text-primary)' }}>{formatDuration(stat.avgDurationMs)}</strong></div>
        <div>Total: <strong style={{ color: 'var(--text-primary)' }}>{formatDuration(stat.totalDurationMs)}</strong></div>
      </div>
      {stat.errorRate > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            height: '3px',
            background: 'var(--bg-tertiary)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(stat.errorRate, 100)}%`,
              background: 'var(--status-fail)',
              borderRadius: '2px',
            }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {stat.errorRate.toFixed(1)}% error rate
          </div>
        </div>
      )}
    </div>
  )
}

function AgentRow({ agent }: { agent: AgentCall }) {
  const isRunning = !!(agent.startedAt && !agent.endedAt)
  const variant = agent.isError ? 'error' : isRunning ? 'running' : 'success'
  const label = agent.isError ? 'ERROR' : isRunning ? 'RUNNING' : 'DONE'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 16px',
      borderBottom: '1px solid var(--border-light)',
      fontSize: '13px',
    }}>
      <Badge variant={variant} pulse={isRunning}>{label}</Badge>
      <span style={{ fontWeight: 600, minWidth: '140px' }}>{agent.agentType}</span>
      <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {agent.description || agent.promptSummary || '-'}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '60px', textAlign: 'right' }}>
        {agent.durationMs != null ? formatDuration(agent.durationMs) : isRunning ? '...' : '-'}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '70px', textAlign: 'right' }}>
        {agent.startedAt ? formatRelativeTime(agent.startedAt) : '-'}
      </span>
    </div>
  )
}

export function AgentsTab() {
  const { data, error, isLoading } = usePolling<AgentData>('/api/agents?date=all', 2000)

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading agents...</div>
  }
  if (error) {
    return <div style={{ padding: '20px', color: 'var(--status-fail)' }}>Error loading agents: {error.message}</div>
  }
  if (!data || data.totalCalls === 0) {
    return <EmptyState icon="🤖" title="No agent calls" description="No agent invocations recorded yet" />
  }

  const sortedCalls = [...data.calls].sort((a, b) => {
    const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0
    const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0
    return tb - ta
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex',
        gap: '20px',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}>
        <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{data.totalCalls}</strong></span>
        <span>Running: <strong style={{ color: 'var(--status-running)' }}>{data.runningCount}</strong></span>
        <span>Errors: <strong style={{ color: data.totalErrors > 0 ? 'var(--status-fail)' : 'var(--text-primary)' }}>{data.totalErrors}</strong></span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', gap: '0' }}>
        {/* Stats panel */}
        <div style={{
          width: '300px',
          flexShrink: 0,
          borderRight: '1px solid var(--border-light)',
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Agent Types
          </div>
          {data.stats.map(stat => (
            <StatCard key={stat.agentType} stat={stat} />
          ))}
        </div>

        {/* Call list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderBottom: '1px solid var(--border-light)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-secondary)',
            zIndex: 1,
          }}>
            Recent Calls
          </div>
          {sortedCalls.map(agent => (
            <AgentRow key={agent.callId} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  )
}
