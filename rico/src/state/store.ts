import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { BOOTSTRAP_SQL } from "./schema";
import { createRepositories } from "./repositories";

function ensureColumn(
  db: Database,
  table: string,
  column: string,
  definition: string,
) {
  const columns = db
    .query(`pragma table_info(${table})`)
    .all()
    .map((row: any) => row.name as string);
  if (columns.includes(column)) return;
  db.exec(`alter table ${table} add column ${column} ${definition};`);
}

export function openStore(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, { create: true });
  db.exec("pragma foreign_keys = on;");
  const pragmaRow = db.query("pragma foreign_keys").get() as
    | { foreign_keys: number }
    | null;
  if (!pragmaRow || pragmaRow.foreign_keys !== 1) {
    throw new Error("Failed to enable SQLite foreign keys");
  }
  db.exec(BOOTSTRAP_SQL);
  ensureColumn(db, "tasks", "attempt_count", "integer not null default 0");
  ensureColumn(db, "tasks", "started_at", "text");
  ensureColumn(db, "tasks", "finished_at", "text");

  return {
    db,
    listTables() {
      return db
        .query("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name")
        .all()
        .map((row: any) => row.name as string);
    },
    repositories: createRepositories(db),
  };
}
