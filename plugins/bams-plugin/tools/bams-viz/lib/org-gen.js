import { readFileSync } from 'node:fs';

const DEPT_COLORS = {
  planning_department: { fill: '#3b82f6', stroke: '#2563eb', label: '기획부서' },
  engineering_department: { fill: '#22c55e', stroke: '#16a34a', label: '개발부서' },
  evaluation_department: { fill: '#f97316', stroke: '#ea580c', label: '평가부서' },
  qa_department: { fill: '#a855f7', stroke: '#9333ea', label: 'QA부서' },
};

/**
 * Generate org chart from jojikdo.json
 * @param {string} jojikdoPath - Path to jojikdo.json
 * @param {string[]} [activeAgents] - Currently active agent IDs to highlight
 * @returns {string} Mermaid code
 */
export function generateOrgChart(jojikdoPath, activeAgents = []) {
  let jojikdo;
  try {
    jojikdo = JSON.parse(readFileSync(jojikdoPath, 'utf-8'));
  } catch {
    return '```\n조직도 파일을 찾을 수 없습니다: ' + jojikdoPath + '\n```';
  }

  const lines = ['flowchart TB'];
  lines.push('  ROOT(("bams-plugin<br/>v1.2.0"))');

  const departments = jojikdo.departments || [];

  for (const dept of departments) {
    const deptId = dept.department_id || dept.name;
    const deptInfo = DEPT_COLORS[deptId] || { fill: '#6b7280', stroke: '#4b5563', label: dept.department_name || dept.name };

    lines.push(`  ROOT --> ${sanitize(deptId)}["${deptInfo.label}"]`);

    const agents = dept.agents || [];
    for (const agent of agents) {
      const agentId = agent.agent_id || agent.name;
      const shortName = (agent.agent_name || agent.name || agentId).replace(/ Agent$/, '');
      const model = agent.model || 'sonnet';
      const isActive = activeAgents.includes(agentId);

      lines.push(`  ${sanitize(deptId)} --> ${sanitize(agentId)}["${shortName}<br/><small>${model}</small>"]`);

      if (isActive) {
        lines.push(`  style ${sanitize(agentId)} fill:#fbbf24,stroke:#f59e0b,color:#000`);
      }
    }

    // Department style
    lines.push(`  style ${sanitize(deptId)} fill:${deptInfo.fill},stroke:${deptInfo.stroke},color:#fff`);
  }

  // Agent call relationships (if available)
  if (jojikdo.agent_calls) {
    lines.push('');
    lines.push('  %% Agent collaboration edges');
    for (const [caller, callees] of Object.entries(jojikdo.agent_calls)) {
      if (Array.isArray(callees)) {
        for (const callee of callees) {
          const purpose = typeof callee === 'object' ? callee.purpose : '';
          const calleeId = typeof callee === 'object' ? callee.agent_id : callee;
          if (purpose) {
            lines.push(`  ${sanitize(caller)} -.->|"${purpose}"| ${sanitize(calleeId)}`);
          } else {
            lines.push(`  ${sanitize(caller)} -.-> ${sanitize(calleeId)}`);
          }
        }
      }
    }
  }

  lines.push('');
  lines.push('  style ROOT fill:#1e293b,stroke:#0f172a,color:#fff');

  return lines.join('\n');
}

function sanitize(str) {
  return (str || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
}
