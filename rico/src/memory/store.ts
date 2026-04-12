import type { Database } from "bun:sqlite";

function rowsToRecord(rows: Array<{ key: string; value: string }>) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export class MemoryStore {
  constructor(private readonly db: Database) {}

  putProjectFact(projectId: string, key: string, value: string) {
    this.db.query(
      `insert into project_memory (project_id, key, value)
       values (?, ?, ?)
       on conflict(project_id, key) do update set value = excluded.value`,
    ).run(projectId, key, value);
  }

  putRunFact(runId: string, key: string, value: string) {
    this.db.query(
      `insert into run_memory (run_id, key, value)
       values (?, ?, ?)
       on conflict(run_id, key) do update set value = excluded.value`,
    ).run(runId, key, value);
  }

  putPlaybookFact(role: string, key: string, value: string) {
    this.db.query(
      `insert into role_playbooks (role, key, value)
       values (?, ?, ?)
       on conflict(role, key) do update set value = excluded.value`,
    ).run(role, key, value);
  }

  getProjectMemory(projectId: string) {
    return rowsToRecord(
      this.db
        .query("select key, value from project_memory where project_id = ?")
        .all(projectId) as Array<{ key: string; value: string }>,
    );
  }

  getRunMemory(runId: string) {
    return rowsToRecord(
      this.db
        .query("select key, value from run_memory where run_id = ?")
        .all(runId) as Array<{ key: string; value: string }>,
    );
  }

  getPlaybookMemory(role: string) {
    return rowsToRecord(
      this.db
        .query("select key, value from role_playbooks where role = ?")
        .all(role) as Array<{ key: string; value: string }>,
    );
  }
}
