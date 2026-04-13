import { expect, test } from "bun:test";
import {
  resolveSimulationCredentials,
  summarizeBrowserSimulation,
  type BrowserSimulationEvidence,
} from "../src/simulation/browser";

test("resolveSimulationCredentials maps credential refs from the environment snapshot", () => {
  expect(
    resolveSimulationCredentials({
      credentialRefs: ["TEST_EMAIL", "TEST_PASSWORD", "MISSING_KEY"],
      env: {
        TEST_EMAIL: "test@example.com",
        TEST_PASSWORD: "secret",
      },
    }),
  ).toEqual({
    TEST_EMAIL: "test@example.com",
    TEST_PASSWORD: "secret",
  });
});

test("summarizeBrowserSimulation produces compact evidence lines", () => {
  const summary = summarizeBrowserSimulation({
    enabled: true,
    baseUrl: "http://127.0.0.1:5173",
    visited: [
      {
        path: "/",
        ok: true,
        title: "Sherpa Labs",
        heading: "AI employee",
        notes: ["CTA 2개 확인"],
      },
      {
        path: "/ai-employee",
        ok: false,
        title: null,
        heading: null,
        notes: ["500 response"],
      },
    ],
    loginAttempted: false,
    loginSucceeded: false,
    missingCredentialRefs: ["TEST_EMAIL"],
  } satisfies BrowserSimulationEvidence);

  expect(summary.some((line) => line.includes("/"))).toBe(true);
  expect(summary.some((line) => line.includes("/ai-employee"))).toBe(true);
  expect(summary.some((line) => line.includes("TEST_EMAIL"))).toBe(true);
});
