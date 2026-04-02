import { readFileSync } from 'node:fs';

/**
 * Parse NDJSON events file into structured pipeline data
 * @param {string} filePath - Path to .jsonl file
 * @returns {Pipeline}
 */
export function parseEventsFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return parseEvents(content);
}

/**
 * Parse NDJSON string into structured pipeline data
 * @param {string} content - NDJSON string
 * @returns {Pipeline}
 */
export function parseEvents(content) {
  const lines = content.trim().split('\n').filter(Boolean);
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      events.push(JSON.parse(lines[i]));
    } catch {
      // Skip malformed lines
    }
  }

  return buildPipeline(events);
}

/**
 * Parse NDJSON agent events file into flat agent call list
 * @param {string} filePath - Path to agents .jsonl file
 * @returns {AgentData}
 */
export function parseAgentEventsFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return parseAgentEvents(content);
}

/**
 * Parse agent events into agent-centric data
 * @param {string} content - NDJSON string
 * @returns {AgentData}
 */
export function parseAgentEvents(content) {
  const lines = content.trim().split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return buildAgentData(events);
}

/**
 * Build agent-centric data from raw events
 */
function buildAgentData(events) {
  const agentMap = new Map();
  const calls = [];

  for (const ev of events) {
    if (ev.type === 'agent_start') {
      agentMap.set(ev.call_id, {
        callId: ev.call_id,
        agentType: ev.agent_type || 'unknown',
        model: ev.model || '',
        description: ev.description || '',
        promptSummary: ev.prompt_summary || '',
        background: ev.background || false,
        pipelineSlug: ev.pipeline_slug || null,
        startedAt: ev.ts,
        endedAt: null,
        durationMs: null,
        isError: false,
        errorMessage: '',
        resultSummary: '',
      });
    } else if (ev.type === 'agent_end') {
      const agent = agentMap.get(ev.call_id);
      if (agent) {
        agent.endedAt = ev.ts;
        agent.isError = ev.is_error || false;
        agent.errorMessage = ev.error_message || '';
        agent.resultSummary = ev.result_summary || '';
        agent.durationMs = ev.duration_ms ||
          (agent.startedAt ? new Date(ev.ts) - new Date(agent.startedAt) : null);
      } else {
        // Orphaned end event — still record it
        agentMap.set(ev.call_id, {
          callId: ev.call_id,
          agentType: ev.agent_type || 'unknown',
          model: '',
          description: '',
          promptSummary: '',
          background: false,
          pipelineSlug: ev.pipeline_slug || null,
          startedAt: null,
          endedAt: ev.ts,
          durationMs: ev.duration_ms || null,
          isError: ev.is_error || false,
          errorMessage: ev.error_message || '',
          resultSummary: ev.result_summary || '',
        });
      }
    }
  }

  const allCalls = Array.from(agentMap.values())
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));

  // Compute per-agent-type stats
  const statsByType = {};
  for (const call of allCalls) {
    const t = call.agentType;
    if (!statsByType[t]) {
      statsByType[t] = {
        agentType: t,
        dept: DEPT_MAP[t] || 'unknown',
        callCount: 0,
        errorCount: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        minDurationMs: Infinity,
        maxDurationMs: 0,
        models: {},
      };
    }
    const s = statsByType[t];
    s.callCount++;
    if (call.isError) s.errorCount++;
    if (call.durationMs != null) {
      s.totalDurationMs += call.durationMs;
      s.minDurationMs = Math.min(s.minDurationMs, call.durationMs);
      s.maxDurationMs = Math.max(s.maxDurationMs, call.durationMs);
    }
    if (call.model) {
      s.models[call.model] = (s.models[call.model] || 0) + 1;
    }
  }
  // Finalize averages
  for (const s of Object.values(statsByType)) {
    const completed = s.callCount - s.errorCount;
    s.avgDurationMs = completed > 0 ? Math.round(s.totalDurationMs / completed) : 0;
    if (s.minDurationMs === Infinity) s.minDurationMs = 0;
    s.errorRate = s.callCount > 0 ? Math.round((s.errorCount / s.callCount) * 100) : 0;
  }

  // Detect collaboration (agents called within 2s of each other in same pipeline)
  const collaborations = detectCollaborations(allCalls);

  return {
    calls: allCalls,
    stats: Object.values(statsByType).sort((a, b) => b.callCount - a.callCount),
    collaborations,
    totalCalls: allCalls.length,
    totalErrors: allCalls.filter(c => c.isError).length,
    runningCount: allCalls.filter(c => c.startedAt && !c.endedAt).length,
  };
}

/**
 * Detect agent collaboration patterns
 */
function detectCollaborations(calls) {
  const edges = new Map(); // "typeA→typeB" => count

  // Group calls by pipeline slug
  const byPipeline = new Map();
  for (const c of calls) {
    if (!c.pipelineSlug) continue;
    if (!byPipeline.has(c.pipelineSlug)) byPipeline.set(c.pipelineSlug, []);
    byPipeline.get(c.pipelineSlug).push(c);
  }

  for (const [slug, pCalls] of byPipeline) {
    const sorted = pCalls
      .filter(c => c.startedAt)
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      if (curr.agentType === next.agentType) continue;

      const gap = Math.abs(new Date(next.startedAt) - new Date(curr.endedAt || curr.startedAt));
      if (gap < 5000) { // within 5 seconds = sequential collaboration
        const key = `${curr.agentType}→${next.agentType}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
  }

  return Array.from(edges.entries())
    .map(([edge, count]) => {
      const [from, to] = edge.split('→');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Build structured pipeline from raw events
 * @param {Object[]} events
 * @returns {Pipeline}
 */
function buildPipeline(events) {
  const pipeline = {
    slug: '',
    type: '',
    status: 'running',
    command: '',
    startedAt: null,
    endedAt: null,
    durationMs: null,
    steps: [],
    agents: [],
    errors: [],
    parallelGroups: new Map(),
  };

  const stepMap = new Map();
  const agentMap = new Map();

  for (const event of events) {
    pipeline.slug = pipeline.slug || event.pipeline_slug;

    switch (event.type) {
      case 'pipeline_start':
        pipeline.type = event.pipeline_type;
        pipeline.command = event.command || '';
        pipeline.startedAt = event.ts;
        break;

      case 'pipeline_end':
        pipeline.status = event.status;
        pipeline.endedAt = event.ts;
        pipeline.durationMs = event.duration_ms;
        break;

      case 'step_start': {
        const step = {
          number: event.step_number,
          name: event.step_name,
          phase: event.phase,
          status: 'running',
          startedAt: event.ts,
          endedAt: null,
          durationMs: null,
          agentCallIds: [],
        };
        stepMap.set(event.step_number, step);
        break;
      }

      case 'step_end': {
        const step = stepMap.get(event.step_number);
        if (step) {
          step.status = event.status;
          step.endedAt = event.ts;
          step.durationMs = event.duration_ms;
        }
        break;
      }

      case 'agent_start': {
        const agent = {
          callId: event.call_id,
          agentType: event.agent_type,
          model: event.model || '',
          stepNumber: event.step_number,
          description: event.description || '',
          promptSummary: event.prompt_summary || '',
          parallelGroup: event.parallel_group || null,
          startedAt: event.ts,
          endedAt: null,
          durationMs: null,
          isError: false,
        };
        agentMap.set(event.call_id, agent);

        // Link to step
        const step = stepMap.get(event.step_number);
        if (step) step.agentCallIds.push(event.call_id);
        break;
      }

      case 'agent_end': {
        const agent = agentMap.get(event.call_id);
        if (agent) {
          agent.endedAt = event.ts;
          agent.isError = event.is_error || false;
          agent.durationMs = event.duration_ms ||
            (agent.startedAt ? new Date(event.ts) - new Date(agent.startedAt) : null);
        }
        break;
      }

      case 'error':
        pipeline.errors.push({
          message: event.message,
          stepNumber: event.step_number,
          errorCode: event.error_code,
          callId: event.call_id,
          ts: event.ts,
        });
        break;
    }
  }

  pipeline.steps = Array.from(stepMap.values()).sort((a, b) => a.number - b.number);
  pipeline.agents = Array.from(agentMap.values());

  // Identify parallel groups (agents starting within 500ms of each other in same step)
  identifyParallelGroups(pipeline);

  return pipeline;
}

/**
 * Group agents that execute in parallel
 */
function identifyParallelGroups(pipeline) {
  const byStep = new Map();
  for (const agent of pipeline.agents) {
    if (!byStep.has(agent.stepNumber)) byStep.set(agent.stepNumber, []);
    byStep.get(agent.stepNumber).push(agent);
  }

  let groupCounter = 0;
  for (const [step, agents] of byStep) {
    if (agents.length < 2) continue;

    // Use explicit parallel_group if present
    const explicit = agents.filter(a => a.parallelGroup);
    if (explicit.length > 0) continue; // Already grouped

    // Time-based grouping: within 500ms
    const sorted = agents.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    let group = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].startedAt) - new Date(sorted[i - 1].startedAt);
      if (gap <= 500) {
        group.push(sorted[i]);
      } else {
        if (group.length > 1) {
          const gid = `pg-${step}-${++groupCounter}`;
          group.forEach(a => { a.parallelGroup = gid; });
        }
        group = [sorted[i]];
      }
    }
    if (group.length > 1) {
      const gid = `pg-${step}-${++groupCounter}`;
      group.forEach(a => { a.parallelGroup = gid; });
    }
  }
}

// Department mapping for color coding
export const DEPT_MAP = {
  'product-strategy': 'planning',
  'business-analysis': 'planning',
  'ux-research': 'planning',
  'project-governance': 'planning',
  'frontend-engineering': 'engineering',
  'backend-engineering': 'engineering',
  'platform-devops': 'engineering',
  'data-integration': 'engineering',
  'product-analytics': 'evaluation',
  'experimentation': 'evaluation',
  'performance-evaluation': 'evaluation',
  'business-kpi': 'evaluation',
  'qa-strategy': 'qa',
  'automation-qa': 'qa',
  'defect-triage': 'qa',
  'release-quality-gate': 'qa',
  // Non-org agents (general purpose, Explore, Plan, etc.)
  'general-purpose': 'engineering',
  'Explore': 'engineering',
  'Plan': 'planning',
};
