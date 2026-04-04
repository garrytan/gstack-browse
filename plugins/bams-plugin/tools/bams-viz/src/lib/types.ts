// Pipeline events
export interface PipelineEvent {
  type: string
  pipeline_slug?: string
  ts: string
  [key: string]: unknown
}

export interface PipelineStartEvent extends PipelineEvent {
  type: 'pipeline_start'
  pipeline_type: string
  command?: string
  arguments?: string
}

export interface PipelineEndEvent extends PipelineEvent {
  type: 'pipeline_end'
  status: 'completed' | 'failed' | 'paused' | 'rolled_back'
  total_steps?: number
  completed_steps?: number
  failed_steps?: number
  skipped_steps?: number
  duration_ms?: number
}

export interface StepStartEvent extends PipelineEvent {
  type: 'step_start'
  step_number: number
  step_name: string
  phase: string
}

export interface StepEndEvent extends PipelineEvent {
  type: 'step_end'
  step_number: number
  status: 'done' | 'fail' | 'skipped'
  duration_ms?: number
}

export interface AgentStartEvent extends PipelineEvent {
  type: 'agent_start'
  call_id: string
  agent_type: string
  model?: string
  description?: string
  prompt_summary?: string
  background?: boolean
  step_number?: number
  parallel_group?: string | null
  // Enhanced tracing fields
  trace_id?: string
  input?: string
  department?: string
  skill_name?: string
  parent_span_id?: string | null
}

export interface AgentEndEvent extends PipelineEvent {
  type: 'agent_end'
  call_id: string
  agent_type: string
  is_error?: boolean
  duration_ms?: number
  result_summary?: string
  error_message?: string
  // Enhanced tracing fields
  output?: string
  token_usage?: { input: number; output: number }
  status?: 'success' | 'error'
}

export interface ErrorEvent extends PipelineEvent {
  type: 'error'
  message: string
  step_number?: number
  error_code?: string
  call_id?: string | null
}

// Parsed structures
export interface Pipeline {
  slug: string
  type: string
  status: string
  command: string
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  steps: PipelineStep[]
  agents: AgentCall[]
  errors: PipelineError[]
}

export interface PipelineStep {
  number: number
  name: string
  phase: string
  status: string
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  agentCallIds: string[]
}

export interface AgentCall {
  callId: string
  agentType: string
  model: string
  stepNumber?: number
  description: string
  promptSummary: string
  parallelGroup: string | null
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  isError: boolean
  // Enhanced fields
  traceId?: string
  input?: string
  output?: string
  department?: string
  skillName?: string
  parentSpanId?: string | null
  tokenUsage?: { input: number; output: number }
  resultSummary?: string
  errorMessage?: string
  background?: boolean
  pipelineSlug?: string | null
}

export interface PipelineError {
  message: string
  stepNumber?: number
  errorCode?: string
  callId?: string | null
  ts: string
}

export interface AgentData {
  calls: AgentCall[]
  stats: AgentTypeStat[]
  collaborations: Collaboration[]
  totalCalls: number
  totalErrors: number
  runningCount: number
}

export interface AgentTypeStat {
  agentType: string
  dept: string
  callCount: number
  errorCount: number
  totalDurationMs: number
  avgDurationMs: number
  minDurationMs: number
  maxDurationMs: number
  errorRate: number
  models: Record<string, number>
}

export interface Collaboration {
  from: string
  to: string
  count: number
}

// Trace/Span types (Langfuse-style)
export interface Trace {
  traceId: string
  pipelineSlug: string
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  status: 'running' | 'completed' | 'error'
  spans: Span[]
  totalInputTokens: number
  totalOutputTokens: number
}

export interface Span {
  spanId: string
  traceId: string
  parentSpanId: string | null
  agentType: string
  model: string
  department: string
  skillName: string | null
  input: string
  output: string
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  status: 'running' | 'success' | 'error'
  tokenUsage: { input: number; output: number } | null
  description: string
}

// HR Report types
export interface HRReportSummary {
  total_pipelines: number
  total_invocations: number
  overall_success_rate: number | null
}

export interface HRDepartment {
  department_id: string
  agent_count: number
  avg_success_rate: number | null
  total_invocations: number
}

export interface HRAgent {
  agent_id: string
  department: string
  grade: string
  invocation_count: number
  success_rate: number | null
  avg_duration_ms: number
  retry_count: number
  escalation_count: number
  trend: 'improving' | 'declining' | 'stable'
}

export interface AgentImprovement {
  agent_id: string
  grade_before: string
  grade_target: string
  changes: string[]
}

export interface RetroMetadata {
  analyzed_pipelines: number
  retro_date: string
  action_items: string[]
  keep_count: number
  problem_count: number
  try_count: number
  grade_distribution?: Record<string, number>
  improvements?: AgentImprovement[]
}

export interface HRReport {
  report_date: string | null
  source?: 'weekly' | 'retro'
  retro_slug?: string
  period: { start: string | null; end: string | null }
  summary: HRReportSummary
  departments: HRDepartment[]
  agents: HRAgent[]
  alerts: string[]
  recommendations: string[]
  retro_metadata?: RetroMetadata
}

export interface RetroJournalEntry {
  retro_slug: string
  report_date: string
  period: { start: string | null; end: string | null }
  agent_count: number
  alert_count: number
  retro_metadata: RetroMetadata
  agents: HRAgent[]
}
