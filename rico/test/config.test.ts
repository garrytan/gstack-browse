import { test, expect } from "bun:test";
import { resolveConfig } from "../src/config";

test("resolveConfig defaults state paths under .gstack/rico", () => {
  const cfg = resolveConfig({ cwd: "/tmp/demo-repo", env: {} });
  expect(cfg.stateDir).toBe("/tmp/demo-repo/.gstack/rico");
  expect(cfg.dbPath).toBe("/tmp/demo-repo/.gstack/rico/rico.sqlite");
  expect(cfg.artifactDir).toBe("/tmp/demo-repo/.gstack/rico/artifacts");
  expect(cfg.maxActiveProjects).toBe(2);
  expect(cfg.slackSigningSecret).toBe("");
  expect(cfg.slackBotToken).toBe("");
});

test("resolveConfig reads slack env fields when present", () => {
  const cfg = resolveConfig({
    cwd: "/tmp/demo-repo",
    env: {
      RICO_AI_OPS_CHANNEL_ID: "C_AI_OPS",
      SLACK_SIGNING_SECRET: "signing-secret",
      SLACK_BOT_TOKEN: "bot-token",
    },
  });

  expect(cfg.aiOpsChannelId).toBe("C_AI_OPS");
  expect(cfg.slackSigningSecret).toBe("signing-secret");
  expect(cfg.slackBotToken).toBe("bot-token");
});

test("resolveConfig accepts a valid positive integer override", () => {
  const cfg = resolveConfig({
    cwd: "/tmp/demo-repo",
    env: {
      RICO_MAX_ACTIVE_PROJECTS: "5",
    },
  });

  expect(cfg.maxActiveProjects).toBe(5);
});

for (const value of ["", "abc", "0", "-1", "1.5", "Infinity"]) {
  test(`resolveConfig rejects malformed max active projects: ${JSON.stringify(value)}`, () => {
    expect(() =>
      resolveConfig({
        cwd: "/tmp/demo-repo",
        env: {
          RICO_MAX_ACTIVE_PROJECTS: value,
        },
      }),
    ).toThrow(/Invalid RICO_MAX_ACTIVE_PROJECTS/);
  });
}
