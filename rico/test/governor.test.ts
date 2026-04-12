import { expect, test } from "bun:test";
import { Governor } from "../src/orchestrator/governor";

test("Governor blocks a third active project", () => {
  const governor = new Governor({ maxActiveProjects: 2 });

  governor.registerProject({ id: "mypetroutine", channelId: "C_PROJECT_1" });
  governor.registerProject({ id: "sherpalabs", channelId: "C_PROJECT_2" });
  governor.registerProject({
    id: "pet-memorial-moltdog",
    channelId: "C_PROJECT_3",
  });

  expect(governor.startProject("mypetroutine")).toEqual({ ok: true });
  expect(governor.startProject("sherpalabs")).toEqual({ ok: true });

  const result = governor.startProject("pet-memorial-moltdog");

  expect(result.ok).toBe(false);
  expect(result.reason).toBe("slot_limit_exceeded");
});

test("Governor rejects unknown projects instead of creating phantom records", () => {
  const governor = new Governor({ maxActiveProjects: 2 });

  expect(() => governor.startProject("unknown-project")).toThrow(
    "unknown project: unknown-project",
  );
});

test("#ai-ops commands can reprioritize and pause a project", () => {
  const governor = new Governor({ maxActiveProjects: 2 });

  governor.registerProject({ id: "mypetroutine", channelId: "C_PROJECT" });
  governor.registerProject({ id: "sherpalabs", channelId: "C_PROJECT_2" });
  governor.handleAiOpsCommand({
    action: "reprioritize",
    projectId: "mypetroutine",
    priority: 10,
  });
  governor.handleAiOpsCommand({ action: "pause", projectId: "mypetroutine" });

  expect(governor.snapshot("mypetroutine")).toMatchObject({
    channelId: "C_PROJECT",
    priority: 10,
    paused: true,
  });
});

test("Governor chooses the next project by priority then queued age while excluding paused work", () => {
  const governor = new Governor({ maxActiveProjects: 2 });

  governor.registerProject({ id: "mypetroutine", channelId: "C_PROJECT" });
  governor.registerProject({ id: "sherpalabs", channelId: "C_PROJECT_2" });
  governor.registerProject({ id: "pet-memorial-moltdog", channelId: "C_PROJECT_3" });

  governor.handleAiOpsCommand({
    action: "reprioritize",
    projectId: "mypetroutine",
    priority: 5,
  });
  governor.handleAiOpsCommand({
    action: "reprioritize",
    projectId: "sherpalabs",
    priority: 5,
  });
  governor.handleAiOpsCommand({
    action: "reprioritize",
    projectId: "pet-memorial-moltdog",
    priority: 9,
  });
  governor.handleAiOpsCommand({ action: "pause", projectId: "pet-memorial-moltdog" });

  governor.markQueued("mypetroutine", "2026-04-12T01:00:00.000Z");
  governor.markQueued("sherpalabs", "2026-04-12T02:00:00.000Z");
  governor.markQueued("pet-memorial-moltdog", "2026-04-12T00:30:00.000Z");

  const winner = governor.chooseNextProject([
    "mypetroutine",
    "sherpalabs",
    "pet-memorial-moltdog",
  ]);

  expect(winner).toBe("mypetroutine");
});
