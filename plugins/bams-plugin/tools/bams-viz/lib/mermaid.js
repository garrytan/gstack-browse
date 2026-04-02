import { DEPT_MAP } from './parser.js';

const DEPT_COLORS = {
  planning: '#3b82f6',
  engineering: '#22c55e',
  evaluation: '#f97316',
  qa: '#a855f7',
};

const STATUS_STYLES = {
  done: 'fill:#22c55e,stroke:#16a34a,color:#fff',
  success: 'fill:#22c55e,stroke:#16a34a,color:#fff',
  fail: 'fill:#ef4444,stroke:#dc2626,color:#fff',
  failure: 'fill:#ef4444,stroke:#dc2626,color:#fff',
  skipped: 'fill:#9ca3af,stroke:#6b7280,color:#fff',
  running: 'fill:#3b82f6,stroke:#2563eb,color:#fff',
  pending: 'fill:#e5e7eb,stroke:#d1d5db,color:#374151',
};

/**
 * Generate Mermaid flowchart DAG from pipeline data
 * @param {Pipeline} pipeline
 * @returns {string} Mermaid code
 */
export function generateFlowchart(pipeline) {
  const lines = ['flowchart LR'];

  // Group agents by step for subgraphs
  let currentPhase = '';
  for (const step of pipeline.steps) {
    if (step.phase && step.phase !== currentPhase) {
      if (currentPhase) lines.push('  end');
      currentPhase = step.phase;
      lines.push(`  subgraph ${sanitizeId(step.phase)}["${step.phase}"]`);
    }

    const agents = pipeline.agents.filter(a => a.stepNumber === step.number);
    if (agents.length === 0) {
      // Step without agents
      const dur = step.durationMs ? formatDuration(step.durationMs) : '';
      lines.push(`    S${step.number}["${step.name}${dur ? '<br/>' + dur : ''}"]`);
    } else if (agents.length === 1) {
      const a = agents[0];
      const dur = a.durationMs ? formatDuration(a.durationMs) : '...';
      const dept = DEPT_MAP[a.agentType] || 'engineering';
      lines.push(`    S${step.number}["${step.name}<br/>${a.agentType} (${a.model})<br/>${dur}"]`);
    } else {
      // Parallel agents — create a fork node
      lines.push(`    S${step.number}{"${step.name}"}`);
      for (const a of agents) {
        const dur = a.durationMs ? formatDuration(a.durationMs) : '...';
        const nodeId = `A_${a.callId || sanitizeId(a.agentType + step.number)}`;
        lines.push(`    ${nodeId}["${a.agentType}<br/>${a.model} · ${dur}"]`);
        lines.push(`    S${step.number} --> ${nodeId}`);
      }
    }
  }
  if (currentPhase) lines.push('  end');

  // Sequential edges between steps
  for (let i = 0; i < pipeline.steps.length - 1; i++) {
    const curr = pipeline.steps[i];
    const next = pipeline.steps[i + 1];
    lines.push(`  S${curr.number} --> S${next.number}`);
  }

  // Style classes
  lines.push('');
  for (const step of pipeline.steps) {
    const status = step.status || 'pending';
    const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
    lines.push(`  style S${step.number} ${style}`);

    // Style parallel agent nodes
    const agents = pipeline.agents.filter(a => a.stepNumber === step.number);
    if (agents.length > 1) {
      for (const a of agents) {
        const nodeId = `A_${a.callId || sanitizeId(a.agentType + step.number)}`;
        const aStatus = a.isError ? 'fail' : (a.endedAt ? 'done' : 'running');
        const aStyle = STATUS_STYLES[aStatus] || STATUS_STYLES.pending;
        lines.push(`  style ${nodeId} ${aStyle}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate Mermaid gantt chart from pipeline data
 * @param {Pipeline} pipeline
 * @returns {string} Mermaid code
 */
export function generateGantt(pipeline) {
  const lines = [
    'gantt',
    `  title ${pipeline.type}: ${pipeline.slug}`,
    '  dateFormat YYYY-MM-DDTHH:mm:ss',
    '  axisFormat %H:%M',
  ];

  let currentPhase = '';

  for (const step of pipeline.steps) {
    // Section per phase
    if (step.phase && step.phase !== currentPhase) {
      currentPhase = step.phase;
      lines.push(`  section ${step.phase}`);
    }

    const agents = pipeline.agents.filter(a => a.stepNumber === step.number);

    if (agents.length === 0) {
      // Step without agents
      const tag = statusToGanttTag(step.status);
      if (step.startedAt && step.durationMs) {
        const durSec = Math.max(1, Math.ceil(step.durationMs / 1000));
        lines.push(`  ${step.name} :${tag} s${step.number}, ${step.startedAt}, ${durSec}s`);
      }
    } else {
      // Each agent as a separate bar
      for (const a of agents) {
        const tag = a.isError ? 'crit,' : (a.endedAt ? 'done,' : 'active,');
        const dept = DEPT_MAP[a.agentType] || 'engineering';
        if (a.startedAt) {
          const durSec = a.durationMs ? Math.max(1, Math.ceil(a.durationMs / 1000)) : 60;
          lines.push(`  ${a.agentType} (${a.model}) :${tag} ${a.callId || 'a' + step.number}, ${a.startedAt}, ${durSec}s`);
        }
      }
    }
  }

  return lines.join('\n');
}

function statusToGanttTag(status) {
  switch (status) {
    case 'done': return 'done,';
    case 'fail': return 'crit,';
    case 'skipped': return 'done,';
    case 'running': return 'active,';
    default: return '';
  }
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}
