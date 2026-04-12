import { expect, test } from "bun:test";
import { buildRoleContext } from "../src/memory/context-loader";
import { roleMemoryKey } from "../src/memory/namespaces";
import { MemoryStore } from "../src/memory/store";
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
