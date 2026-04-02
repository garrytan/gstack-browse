'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { DagTab } from '@/components/tabs/DagTab'
import { GanttTab } from '@/components/tabs/GanttTab'
import { OrgTab } from '@/components/tabs/OrgTab'
import { AgentsTab } from '@/components/tabs/AgentsTab'
import { TimelineTab } from '@/components/tabs/TimelineTab'
import { LogsTab } from '@/components/tabs/LogsTab'
import { TracesTab } from '@/components/tabs/TracesTab'
import { MetaverseTab } from '@/components/tabs/MetaverseTab'

const TABS = [
  { id: 'dag', label: 'DAG', icon: '🔀' },
  { id: 'gantt', label: 'Gantt', icon: '📊' },
  { id: 'org', label: 'Org', icon: '🏢' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
  { id: 'timeline', label: 'Timeline', icon: '📅' },
  { id: 'logs', label: 'Logs', icon: '📋' },
  { id: 'traces', label: 'Traces', icon: '🔍' },
  { id: 'metaverse', label: 'Metaverse', icon: '🌐' },
] as const

type TabId = (typeof TABS)[number]['id']

interface PipelineListItem {
  slug: string
  type: string
  status: string
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('dag')
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [logHighlightTs, setLogHighlightTs] = useState<string | null>(null)

  // Poll pipeline list
  const { data: pipelines } = usePolling<PipelineListItem[]>('/api/pipelines', 3000)

  // Connection status (reuses pipeline list endpoint)
  const { isValidating, error: connError } = usePolling<unknown>('/api/pipelines', 5000)

  // Auto-select first pipeline
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !selectedPipeline) {
      setSelectedPipeline(pipelines[0].slug)
    }
  }, [pipelines, selectedPipeline])

  // Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem('bams-viz-theme')
    if (saved === 'light' || saved === 'dark') setTheme(saved)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('bams-viz-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  // Cross-tab navigation: Timeline -> Logs
  const handleNavigateToLogs = useCallback((timestamp?: string) => {
    setActiveTab('logs')
    if (timestamp) setLogHighlightTs(timestamp)
  }, [])

  // Cross-tab navigation: Metaverse -> Traces
  const handleNavigateToTraces = useCallback(() => {
    setActiveTab('traces')
  }, [])

  const connectionStatus = connError ? 'disconnected' : isValidating ? 'connecting' : 'connected'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '0 20px',
        height: '50px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📡</span>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>bams-viz</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>v2.0</span>
        </div>

        {/* Pipeline selector */}
        <select
          value={selectedPipeline || ''}
          onChange={e => setSelectedPipeline(e.target.value || null)}
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            minWidth: '200px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">Select pipeline...</option>
          {pipelines?.map(p => (
            <option key={p.slug} value={p.slug}>
              {p.slug} ({p.status})
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: connectionStatus === 'connected' ? 'var(--status-done)'
              : connectionStatus === 'connecting' ? 'var(--status-running)'
              : 'var(--status-fail)',
          }} />
          <span style={{ color: 'var(--text-muted)' }}>
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
          }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      {/* Tab bar */}
      <nav style={{
        display: 'flex',
        gap: '0',
        padding: '0 20px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <span style={{ fontSize: '13px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <TabErrorBoundary key={activeTab}>
          {activeTab === 'dag' && <DagTab pipelineSlug={selectedPipeline} />}
          {activeTab === 'gantt' && <GanttTab pipelineSlug={selectedPipeline} />}
          {activeTab === 'org' && <OrgTab />}
          {activeTab === 'agents' && <AgentsTab />}
          {activeTab === 'timeline' && <TimelineTab pipelineSlug={selectedPipeline} onNavigateToLogs={handleNavigateToLogs} />}
          {activeTab === 'logs' && <LogsTab pipelineSlug={selectedPipeline} highlightTimestamp={logHighlightTs} />}
          {activeTab === 'traces' && <TracesTab />}
          {activeTab === 'metaverse' && <MetaverseTab onNavigateToTraces={handleNavigateToTraces} />}
        </TabErrorBoundary>
      </main>

      {/* Footer */}
      <footer style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: '35px',
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <span>
          Pipeline: {selectedPipeline || 'none'}
          {pipelines && ` | ${pipelines.length} pipeline(s)`}
        </span>
        <span>
          Last update: {new Date().toLocaleTimeString('ko-KR', { hour12: false })}
        </span>
      </footer>
    </div>
  )
}

// Error boundary for individual tabs
import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Tab error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠</div>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>Something went wrong</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
