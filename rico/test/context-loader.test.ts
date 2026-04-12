import { expect, test } from "bun:test";
import { buildRoleContext } from "../src/memory/context-loader";
import { roleMemoryKey } from "../src/memory/namespaces";
import { MemoryStore } from "../src/memory/store";
import { ensureDefaultRolePlaybooks } from "../src/roles/playbooks";
import { openStore } from "../src/state/store";

test("roleMemoryKey isolates qa and customer voice memory", () => {
  expect(roleMemoryKey("mypetroutine", "qa")).toBe(
    "project:mypetroutine:role:qa",
  );
  expect(roleMemoryKey("mypetroutine", "customer-voice")).toBe(
    "project:mypetroutine:role:customer-voice",
  );
});

test("buildRoleContext trims long artifact lists before prompt assembly", () => {
  const context = buildRoleContext({
    role: "qa",
    goalSummary: "short summary",
    artifacts: Array.from({ length: 30 }, (_, index) => ({
      title: `artifact-${index}`,
      body: "x".repeat(500),
    })),
    maxChars: 1200,
  });

  expect(context.length).toBeLessThanOrEqual(1200);
});

test("MemoryStore keeps project, run, and playbook memory in separate buckets", () => {
  const db = openStore(":memory:");
  const store = new MemoryStore(db.db);

  store.putProjectFact("mypetroutine", "goal", "onboarding improvement");
  store.putRunFact("run-1", "qa_status", "blocking");
  store.putPlaybookFact("qa", "default_gate", "regression blocks release");

  expect(store.getProjectMemory("mypetroutine").goal).toBe(
    "onboarding improvement",
  );
  expect(store.getRunMemory("run-1").qa_status).toBe("blocking");
  expect(store.getPlaybookMemory("qa").default_gate).toBe(
    "regression blocks release",
  );

  db.db.close();
});

test("MemoryStore keeps shared and role-scoped project memory separate", () => {
  const db = openStore(":memory:");
  const store = new MemoryStore(db.db);

  store.putProjectFact("mypetroutine", "goal", "onboarding improvement");
  store.putRoleProjectFact("mypetroutine", "qa", "last_summary", "regression blocks release");
  store.putRoleProjectFact("mypetroutine", "customer-voice", "last_summary", "value promise is unclear");

  expect(store.getSharedProjectMemory("mypetroutine")).toEqual({
    goal: "onboarding improvement",
  });
  expect(store.getRoleProjectMemory("mypetroutine", "qa")).toEqual({
    last_summary: "regression blocks release",
  });
  expect(store.getRoleProjectMemory("mypetroutine", "customer-voice")).toEqual({
    last_summary: "value promise is unclear",
  });

  db.db.close();
});

test("default role playbooks are seeded once and exposed per role", () => {
  const db = openStore(":memory:");
  const store = new MemoryStore(db.db);

  ensureDefaultRolePlaybooks(store);
  ensureDefaultRolePlaybooks(store);

  const qaPlaybook = store.getPlaybookMemory("qa");
  const plannerPlaybook = store.getPlaybookMemory("planner");

  expect(qaPlaybook.charter).toBeDefined();
  expect(qaPlaybook.checklist_json).toBeDefined();
  expect(qaPlaybook.skill_pack_json).toBeDefined();
  expect(qaPlaybook.allowed_tools_json).toBeDefined();
  expect(plannerPlaybook.charter).toBeDefined();
  expect(plannerPlaybook.artifact_template).toBeDefined();

  db.db.close();
});
