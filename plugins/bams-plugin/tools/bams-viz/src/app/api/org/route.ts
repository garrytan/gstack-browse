import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { generateOrgChart } from '@/lib/org-gen'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

/**
 * Find jojikdo.json by searching known relative paths.
 * The file lives at plugins/bams-plugin/references/jojikdo.json,
 * which is ../../references/jojikdo.json relative to tools/bams-viz (process.cwd()).
 */
function findJojikdo(): string | null {
  const cwd = process.cwd()
  const candidates = [
    // Standard path: tools/bams-viz -> plugins/bams-plugin/references
    join(cwd, '..', '..', 'references', 'jojikdo.json'),
    // Fallback: local references directory
    join(cwd, 'references', 'jojikdo.json'),
  ]

  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Structured types for department/agent data                        */
/* ------------------------------------------------------------------ */

interface OrgSkill {
  skill_id: string
  skill_name: string
  purpose: string
}

interface OrgAgent {
  agent_id: string
  agent_name: string
  role: string
  model: string
  responsibility: string
  skills: OrgSkill[]
  collaborates_with: string[]
}

interface OrgDepartment {
  department_id: string
  department_name: string
  agent_count: number
  agents: OrgAgent[]
}

/* ------------------------------------------------------------------ */
/*  collaborates_with extraction from cross_department_workflows      */
/* ------------------------------------------------------------------ */

/**
 * Build a map of agent_id -> Set<collaborator_agent_id> by scanning
 * cross_department_workflows.  Two agents collaborate if they appear
 * in the same workflow's steps list.
 */
function buildCollaborationMap(
  jojikdo: Record<string, unknown>
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()

  const workflows = jojikdo.cross_department_workflows
  if (!Array.isArray(workflows)) return map

  for (const wf of workflows) {
    const steps: Array<{ owner_agent: string }> = Array.isArray(wf.steps)
      ? wf.steps
      : []
    const participantIds = steps
      .map((s) => String(s.owner_agent ?? ''))
      .filter(Boolean)

    for (const agentId of participantIds) {
      if (!map.has(agentId)) map.set(agentId, new Set())
      for (const other of participantIds) {
        if (other !== agentId) {
          map.get(agentId)!.add(other)
        }
      }
    }
  }

  return map
}

/**
 * Parse jojikdo.json departments into a structured array.
 * Falls back to empty array on any parse error.
 */
function parseDepartments(jojikdo: Record<string, unknown>): OrgDepartment[] {
  const rawDepts = jojikdo.departments
  if (!Array.isArray(rawDepts)) return []

  const collaborationMap = buildCollaborationMap(jojikdo)

  return rawDepts.map((dept: Record<string, unknown>) => {
    const rawAgents = Array.isArray(dept.agents) ? dept.agents : []
    const agents: OrgAgent[] = rawAgents.map((a: Record<string, unknown>) => {
      const agentId = String(a.agent_id ?? '')

      // Parse skills array
      const rawSkills = Array.isArray(a.skills) ? a.skills : []
      const skills: OrgSkill[] = rawSkills.map((s: Record<string, unknown>) => ({
        skill_id: String(s.skill_id ?? ''),
        skill_name: String(s.skill_name ?? ''),
        purpose: String(s.purpose ?? ''),
      }))

      // Extract collaborates_with from workflow participation map
      const collaboratesWithSet = collaborationMap.get(agentId)
      const collaborates_with = collaboratesWithSet
        ? Array.from(collaboratesWithSet)
        : []

      return {
        agent_id: agentId,
        agent_name: String(a.agent_name ?? ''),
        role: String(a.role ?? 'specialist'),
        model: String(a.model ?? 'sonnet'),
        responsibility: String(a.responsibility ?? ''),
        skills,
        collaborates_with,
      }
    })

    return {
      department_id: String(dept.department_id ?? ''),
      department_name: String(dept.department_name ?? ''),
      agent_count: agents.length,
      agents,
    }
  })
}

export async function GET() {
  try {
    const jojikdoPath = findJojikdo()
    if (!jojikdoPath) {
      return NextResponse.json(
        { error: 'jojikdo.json not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    const jojikdo = JSON.parse(readFileSync(jojikdoPath, 'utf-8'))
    const mermaid = generateOrgChart(jojikdo)
    const departments = parseDepartments(jojikdo)

    return NextResponse.json({ mermaid, departments }, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
