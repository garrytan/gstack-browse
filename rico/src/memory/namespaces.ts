export function roleMemoryKey(projectId: string, role: string) {
  return `project:${projectId}:role:${role}`;
}

export function projectMemoryKey(projectId: string) {
  return `project:${projectId}`;
}

export function runMemoryKey(runId: string) {
  return `run:${runId}`;
}
