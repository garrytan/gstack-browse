import { sanitizeId } from './utils'

interface DeptColor {
  fill: string
  stroke: string
  label: string
}

const DEPT_COLORS: Record<string, DeptColor> = {
  planning_department: { fill: '#3b82f6', stroke: '#2563eb', label: '기획부서' },
  engineering_department: { fill: '#22c55e', stroke: '#16a34a', label: '개발부서' },
  evaluation_department: { fill: '#f97316', stroke: '#ea580c', label: '평가부서' },
  qa_department: { fill: '#a855f7', stroke: '#9333ea', label: 'QA부서' },
}

interface JojikdoAgent {
  agent_id?: string
  name?: string
  agent_name?: string
  model?: string
}

interface JojikdoDepartment {
  department_id?: string
  name?: string
  department_name?: string
  agents?: JojikdoAgent[]
}

interface AgentCallTarget {
  agent_id?: string
  purpose?: string
}

interface Jojikdo {
  departments?: JojikdoDepartment[]
  agent_calls?: Record<string, (string | AgentCallTarget)[]>
}

/**
 * Generate org chart Mermaid code from jojikdo JSON data
 */
export function generateOrgChart(jojikdo: Jojikdo, activeAgents: string[] = []): string {
  const lines: string[] = ['flowchart TB']
  lines.push('  ROOT(("bams-plugin<br/>v1.2.0"))')

  const departments = jojikdo.departments || []

  for (const dept of departments) {
    const deptId = dept.department_id || dept.name || 'unknown'
    const deptInfo: DeptColor = DEPT_COLORS[deptId] || {
      fill: '#6b7280',
      stroke: '#4b5563',
      label: dept.department_name || dept.name || deptId,
    }

    lines.push(`  ROOT --> ${sanitizeId(deptId)}["${deptInfo.label}"]`)

    const agents = dept.agents || []
    for (const agent of agents) {
      const agentId = agent.agent_id || agent.name || 'unknown'
      const shortName = (agent.agent_name || agent.name || agentId).replace(/ Agent$/, '')
      const model = agent.model || 'sonnet'
      const isActive = activeAgents.includes(agentId)

      lines.push(`  ${sanitizeId(deptId)} --> ${sanitizeId(agentId)}["${shortName}<br/><small>${model}</small>"]`)

      if (isActive) {
        lines.push(`  style ${sanitizeId(agentId)} fill:#fbbf24,stroke:#f59e0b,color:#000`)
      }
    }

    // Department style
    lines.push(`  style ${sanitizeId(deptId)} fill:${deptInfo.fill},stroke:${deptInfo.stroke},color:#fff`)
  }

  // Agent call relationships (if available)
  if (jojikdo.agent_calls) {
    lines.push('')
    lines.push('  %% Agent collaboration edges')
    for (const [caller, callees] of Object.entries(jojikdo.agent_calls)) {
      if (Array.isArray(callees)) {
        for (const callee of callees) {
          const purpose = typeof callee === 'object' ? callee.purpose : ''
          const calleeId = typeof callee === 'object' ? (callee.agent_id || '') : callee
          if (purpose) {
            lines.push(`  ${sanitizeId(caller)} -.->|"${purpose}"| ${sanitizeId(calleeId)}`)
          } else {
            lines.push(`  ${sanitizeId(caller)} -.-> ${sanitizeId(calleeId)}`)
          }
        }
      }
    }
  }

  lines.push('')
  lines.push('  style ROOT fill:#1e293b,stroke:#0f172a,color:#fff')

  return lines.join('\n')
}

/**
 * Generate org chart from a JSON file path (server-side only)
 * This function reads from the filesystem and should only be used in API routes or server components.
 */
export async function generateOrgChartFromFile(
  jojikdoPath: string,
  activeAgents: string[] = []
): Promise<string> {
  try {
    const { readFileSync } = await import('node:fs')
    const jojikdo: Jojikdo = JSON.parse(readFileSync(jojikdoPath, 'utf-8'))
    return generateOrgChart(jojikdo, activeAgents)
  } catch {
    return '```\n조직도 파일을 찾을 수 없습니다: ' + jojikdoPath + '\n```'
  }
}
