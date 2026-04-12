# Rico Multi-Agent Slack Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `rico`를 단일 Slack 앱 껍데기 위에서 `Governor + Captain + 전문 에이전트` 구조로 동작하는 Bun/TypeScript 런타임으로 구현한다.

**Architecture:** 새 최상위 서브시스템 `rico/`를 만들고, `Bun.serve`로 Slack ingress를 받는다. 상태는 `.gstack/rico/rico.sqlite`에 저장하고, Slack 요청은 3초 내 ack 후 내부 큐에서 비동기로 처리한다. 긴 산출물은 로컬 미러에 저장한 뒤 Slack 업로드 가능 파일 또는 접근 가능한 URL로 게시하며, 역할별 메모리와 컨텍스트는 분리된 namespace로 관리한다.

**Tech Stack:** Bun, TypeScript, `bun:sqlite`, Slack Events API / Web API, 로컬 artifact mirror(`.gstack/rico/artifacts`), Bun test

**Implementation Notes:** 각 태스크는 @test-driven-development 기준으로 진행하고, 예상과 다른 실패가 나오면 @systematic-debugging을 적용한다. 전체 완료 전에는 @verification-before-completion으로 검증한다.

---

## Scope Check

이 스펙은 여러 개의 독립 제품을 만드는 문서가 아니라, 하나의 `rico` 오케스트레이션 런타임을 만드는 문서다. 내부에는 Slack ingress, 상태 저장, orchestration, 메모리, artifact 게시 같은 여러 구성요소가 있지만 모두 하나의 동작 가능한 런타임을 위해 필요하므로 단일 구현 계획으로 유지한다.

## File Structure

### New top-level subsystem

- Create: `rico/src/main.ts`
  - Bun HTTP 서버 부트스트랩, route wiring, graceful shutdown
- Create: `rico/src/config.ts`
  - 환경 변수, 상태 디렉터리, DB 경로, Slack 자격증명, 실행 한도 설정
- Create: `rico/src/types.ts`
  - 공용 타입과 enum (`RoleName`, `GoalState`, `ApprovalType`, `ArtifactKind`)
- Create: `rico/src/runtime/queue.ts`
  - Slack ingress와 실제 orchestration 처리를 분리하는 내구성 있는 실행 큐
- Create: `rico/src/runtime/job-runner.ts`
  - 실행 큐 소비, timeout, stop condition 처리

### State store

- Create: `rico/src/state/schema.ts`
  - SQLite DDL과 bootstrap
- Create: `rico/src/state/store.ts`
  - DB 연결, transaction helper, repository 진입점
- Create: `rico/src/state/repositories.ts`
  - `Initiative`, `Project`, `Goal`, `Run`, `Task`, `Artifact`, `Approval`, `StateTransition` CRUD

### Slack integration

- Create: `rico/src/slack/signing.ts`
  - Slack signing secret 검증, replay 방지
- Create: `rico/src/slack/router.ts`
  - Events API, slash command, interactive payload routing
- Create: `rico/src/slack/web-api.ts`
  - Slack Web API 호출 래퍼
- Create: `rico/src/slack/publish.ts`
  - thread 메시지, approval blocks, impact 메시지 발행
- Create: `rico/src/slack/files.ts`
  - Slack 외부 업로드 흐름(`files.getUploadURLExternal`, `files.completeUploadExternal`) 사용
- Create: `rico/src/slack/interactions.ts`
  - approve/reject 버튼 callback 처리

### Orchestration

- Create: `rico/src/orchestrator/governor.ts`
  - 슬롯 2개 제한, approval gate 판정, cross-project conflict 처리
- Create: `rico/src/orchestrator/captain.ts`
  - goal 분해, task graph 생성, specialist 할당, 상태 전이
- Create: `rico/src/orchestrator/initiative.ts`
  - 하위 작업 8개 초과 시 `Initiative -> Goals` 분해
- Create: `rico/src/orchestrator/policies.ts`
  - protected action, stop condition, retry limit 정책
- Create: `rico/src/orchestrator/specialists.ts`
  - Captain에서 전문 에이전트를 호출하고 결과를 저장하는 실행 경로

### Role profiles and memory

- Create: `rico/src/roles/index.ts`
  - 역할 registry
- Create: `rico/src/roles/contracts.ts`
  - specialist 입력/출력 계약과 impact schema
- Create: `rico/src/roles/planner.ts`
- Create: `rico/src/roles/designer.ts`
- Create: `rico/src/roles/customer-voice.ts`
- Create: `rico/src/roles/frontend.ts`
- Create: `rico/src/roles/backend.ts`
- Create: `rico/src/roles/qa.ts`
  - 역할별 prompt contract, 허용 도구, artifact schema
- Create: `rico/src/memory/namespaces.ts`
  - 공용/역할별/실행단위 namespace 계산
- Create: `rico/src/memory/store.ts`
  - 프로젝트 메모리, 실행 단위 메모리, 장기 역할 플레이북 저장
- Create: `rico/src/memory/context-loader.ts`
  - 역할별 컨텍스트 조립과 길이 제한
- Create: `rico/src/memory/summaries.ts`
  - 단계 종료 요약과 장기 메모리 승격

### Artifact handling

- Create: `rico/src/artifacts/store.ts`
  - `.gstack/rico/artifacts` 저장, metadata 기록, local mirror
- Create: `rico/src/artifacts/render.ts`
  - Markdown/TXT/JSON 결과를 Slack 첨부용 파일로 렌더링

### Tests

- Create: `rico/test/helpers/harness.ts`
- Create: `rico/test/config.test.ts`
- Create: `rico/test/store.test.ts`
- Create: `rico/test/slack-router.test.ts`
- Create: `rico/test/job-runner.test.ts`
- Create: `rico/test/governor.test.ts`
- Create: `rico/test/captain.test.ts`
- Create: `rico/test/specialist-runner.test.ts`
- Create: `rico/test/context-loader.test.ts`
- Create: `rico/test/artifact-publish.test.ts`
- Create: `rico/test/approval-gates.test.ts`
- Create: `rico/test/happy-path.test.ts`

### Existing files to modify

- Modify: `package.json`
  - `dev:rico`, `test:rico` 스크립트 추가
- Modify: `README.md`
  - `rico` 개발/실행 방법 간단 추가

## Task 1: Scaffold the `rico/` runtime

**Files:**
- Create: `rico/src/main.ts`
- Create: `rico/src/config.ts`
- Create: `rico/src/types.ts`
- Test: `rico/test/config.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing config test**

```ts
import { test, expect } from "bun:test";
import { resolveConfig } from "../src/config";

test("resolveConfig defaults state paths under .gstack/rico", () => {
  const cfg = resolveConfig({ cwd: "/tmp/demo-repo", env: {} });
  expect(cfg.stateDir).toBe("/tmp/demo-repo/.gstack/rico");
  expect(cfg.dbPath).toBe("/tmp/demo-repo/.gstack/rico/rico.sqlite");
  expect(cfg.artifactDir).toBe("/tmp/demo-repo/.gstack/rico/artifacts");
  expect(cfg.maxActiveProjects).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test rico/test/config.test.ts`
Expected: FAIL with `Cannot find module "../src/config"` or `resolveConfig is not defined`

- [ ] **Step 3: Write minimal config + bootstrap implementation**

```ts
// rico/src/config.ts
export interface RicoConfig {
  stateDir: string;
  dbPath: string;
  artifactDir: string;
  maxActiveProjects: number;
  slackSigningSecret: string;
  slackBotToken: string;
}

export function resolveConfig(
  input: { cwd?: string; env?: Record<string, string | undefined> } = {},
): RicoConfig {
  const cwd = input.cwd ?? process.cwd();
  const env = input.env ?? process.env;
  const stateDir = `${cwd}/.gstack/rico`;
  return {
    stateDir,
    dbPath: `${stateDir}/rico.sqlite`,
    artifactDir: `${stateDir}/artifacts`,
    maxActiveProjects: Number(env.RICO_MAX_ACTIVE_PROJECTS ?? "2"),
    slackSigningSecret: env.SLACK_SIGNING_SECRET ?? "",
    slackBotToken: env.SLACK_BOT_TOKEN ?? "",
  };
}
```

```ts
// rico/src/main.ts
import { resolveConfig } from "./config";

const config = resolveConfig();
console.log(JSON.stringify({
  service: "rico",
  stateDir: config.stateDir,
  maxActiveProjects: config.maxActiveProjects,
}));
```

- [ ] **Step 4: Wire package scripts**

Add to `package.json`:

```json
{
  "scripts": {
    "dev:rico": "bun run rico/src/main.ts",
    "test:rico": "bun test rico/test/"
  }
}
```

- [ ] **Step 5: Run the test and bootstrap command**

Run: `bun test rico/test/config.test.ts && bun run dev:rico`
Expected:
- test PASS
- stdout contains `"service":"rico"`

- [ ] **Step 6: Commit**

```bash
git add package.json rico/src/main.ts rico/src/config.ts rico/src/types.ts rico/test/config.test.ts
git commit -m "feat: scaffold rico runtime"
```

## Task 2: Add the SQLite workflow store and state machine

**Files:**
- Create: `rico/src/state/schema.ts`
- Create: `rico/src/state/store.ts`
- Create: `rico/src/state/repositories.ts`
- Test: `rico/test/store.test.ts`

- [ ] **Step 1: Write the failing state-store test**

```ts
import { test, expect } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { openStore } from "../src/state/store";

test("bootstrap creates initiative, goal, approval, artifact tables", () => {
  const dir = mkdtempSync(join(tmpdir(), "rico-store-"));
  const store = openStore(join(dir, "rico.sqlite"));
  const tables = store.listTables();
  expect(tables).toContain("projects");
  expect(tables).toContain("initiatives");
  expect(tables).toContain("goals");
  expect(tables).toContain("runs");
  expect(tables).toContain("tasks");
  expect(tables).toContain("approvals");
  expect(tables).toContain("artifacts");
  expect(tables).toContain("state_transitions");
  expect(tables).toContain("project_memory");
  expect(tables).toContain("run_memory");
  expect(tables).toContain("role_playbooks");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test rico/test/store.test.ts`
Expected: FAIL because `openStore` and schema bootstrap do not exist

- [ ] **Step 3: Implement schema bootstrap using `bun:sqlite`**

```ts
// rico/src/state/schema.ts
export const BOOTSTRAP_SQL = `
create table if not exists initiatives (
  id text primary key,
  project_id text not null,
  title text not null,
  status text not null
);
create table if not exists projects (
  id text primary key,
  slack_channel_id text not null,
  priority integer not null default 0,
  paused integer not null default 0
);
create table if not exists goals (
  id text primary key,
  initiative_id text,
  project_id text not null,
  title text not null,
  state text not null
);
create table if not exists runs (
  id text primary key,
  goal_id text not null,
  status text not null,
  queued_at text,
  started_at text,
  finished_at text
);
create table if not exists tasks (
  id text primary key,
  goal_id text not null,
  role text not null,
  state text not null,
  payload_json text not null
);
create table if not exists approvals (
  id text primary key,
  goal_id text not null,
  type text not null,
  status text not null,
  rationale text
);
create table if not exists artifacts (
  id text primary key,
  goal_id text not null,
  kind text not null,
  local_path text not null,
  slack_file_id text
);
create table if not exists state_transitions (
  id text primary key,
  goal_id text not null,
  from_state text,
  to_state text not null,
  created_at text not null,
  actor text not null
);
create table if not exists project_memory (
  project_id text not null,
  key text not null,
  value text not null,
  primary key (project_id, key)
);
create table if not exists run_memory (
  run_id text not null,
  key text not null,
  value text not null,
  primary key (run_id, key)
);
create table if not exists role_playbooks (
  role text not null,
  key text not null,
  value text not null,
  primary key (role, key)
);
`;
```

```ts
// rico/src/state/store.ts
import { Database } from "bun:sqlite";
import { BOOTSTRAP_SQL } from "./schema";

export function openStore(dbPath: string) {
  const db = new Database(dbPath, { create: true });
  db.exec(BOOTSTRAP_SQL);
  return {
    db,
    listTables() {
      return db
        .query("select name from sqlite_master where type = 'table'")
        .all()
        .map((row: any) => row.name);
    },
  };
}
```

- [ ] **Step 4: Add lifecycle repository smoke tests**

Extend `rico/test/store.test.ts` with two more tests:
- insert a goal, write transitions, and read back `planned -> in_progress -> awaiting_qa`
- create a run plus two tasks and assert they can be queried as the current execution snapshot for a goal

Run: `bun test rico/test/store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rico/src/state/schema.ts rico/src/state/store.ts rico/src/state/repositories.ts rico/test/store.test.ts
git commit -m "feat: add rico workflow store"
```

## Task 3: Implement Slack ingress, signature verification, and fast-ack queueing

**Files:**
- Create: `rico/src/slack/signing.ts`
- Create: `rico/src/slack/router.ts`
- Create: `rico/src/runtime/queue.ts`
- Create: `rico/src/runtime/job-runner.ts`
- Modify: `rico/src/main.ts`
- Test: `rico/test/slack-router.test.ts`
- Test: `rico/test/job-runner.test.ts`

- [ ] **Step 1: Write the failing Slack signing test**

```ts
import { test, expect } from "bun:test";
import { verifySlackRequest } from "../src/slack/signing";

test("rejects requests with invalid signature", async () => {
  const ok = verifySlackRequest({
    signingSecret: "secret",
    rawBody: "payload=1",
    timestamp: "1710000000",
    signature: "v0=bad",
    nowSeconds: 1710000000,
  });
  expect(ok).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test rico/test/slack-router.test.ts`
Expected: FAIL because `verifySlackRequest` and router do not exist

- [ ] **Step 3: Implement signature verification and queue-first routing**

```ts
// rico/src/slack/signing.ts
import { createHmac, timingSafeEqual } from "crypto";

export function verifySlackRequest(input: {
  signingSecret: string;
  rawBody: string;
  timestamp: string;
  signature: string;
  nowSeconds?: number;
}) {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(input.timestamp)) > 60 * 5) return false;
  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const digest = "v0=" + createHmac("sha256", input.signingSecret).update(base).digest("hex");
  return timingSafeEqual(Buffer.from(digest), Buffer.from(input.signature));
}
```

```ts
// rico/src/runtime/queue.ts
import type { Database } from "bun:sqlite";

export interface QueueJob {
  kind: "event" | "command" | "interaction";
  payload: unknown;
  runId: string;
}

export function enqueueQueuedRun(db: Database, job: QueueJob) {
  db.query(
    "insert into runs (id, goal_id, status, queued_at) values (?, ?, 'queued', ?)",
  ).run(job.runId, (job.payload as any).goalId, new Date().toISOString());
}

export function claimNextQueuedRun(db: Database) {
  const row = db.query(
    "select id, goal_id from runs where status = 'queued' order by queued_at asc limit 1",
  ).get() as { id: string; goal_id: string } | null;
  if (!row) return null;
  db.query("update runs set status = 'running', started_at = ? where id = ?")
    .run(new Date().toISOString(), row.id);
  return row;
}
```

- [ ] **Step 4: Add a failing job-runner test and implement durable draining**

Add `rico/test/job-runner.test.ts`:

```ts
import { test, expect } from "bun:test";
import { openStore } from "../src/state/store";
import { enqueueQueuedRun, claimNextQueuedRun } from "../src/runtime/queue";

test("claimNextQueuedRun drains the oldest queued run", () => {
  const store = openStore(":memory:");
  enqueueQueuedRun(store.db, { kind: "command", runId: "run-1", payload: { goalId: "goal-1" } });
  const claimed = claimNextQueuedRun(store.db);
  expect(claimed?.id).toBe("run-1");
});
```

Create `rico/src/runtime/job-runner.ts` with a loop that:
- polls the durable queue
- loads the goal and project snapshot
- dispatches to Governor or Captain
- marks the run `finished` or `failed`

Run: `bun test rico/test/job-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Wire `main.ts` to ack within 3 seconds and enqueue**

Use `Bun.serve` to:
- answer `url_verification`
- verify signature for events and interactive payloads
- enqueue valid work into the durable run queue
- return `200 OK` immediately before processing the work
- start `job-runner.ts` in-process so queued work actually executes after ack

Run: `bun test rico/test/slack-router.test.ts`
Expected: PASS, including one test that asserts router returns `200` while queue length increments

- [ ] **Step 6: Commit**

```bash
git add rico/src/slack/signing.ts rico/src/slack/router.ts rico/src/runtime/queue.ts rico/src/runtime/job-runner.ts rico/src/main.ts rico/test/slack-router.test.ts rico/test/job-runner.test.ts
git commit -m "feat: add slack ingress and queue"
```

## Task 4: Implement Governor, Captain, and oversized-goal splitting

**Files:**
- Create: `rico/src/orchestrator/governor.ts`
- Create: `rico/src/orchestrator/captain.ts`
- Create: `rico/src/orchestrator/initiative.ts`
- Create: `rico/src/orchestrator/policies.ts`
- Create: `rico/src/orchestrator/specialists.ts`
- Test: `rico/test/governor.test.ts`
- Test: `rico/test/captain.test.ts`

- [ ] **Step 1: Write the failing Governor slot-limit test**

```ts
import { test, expect } from "bun:test";
import { Governor } from "../src/orchestrator/governor";

test("Governor blocks a third active project", () => {
  const governor = new Governor({ maxActiveProjects: 2 });
  governor.startProject("mypetroutine");
  governor.startProject("sherpalabs");
  const result = governor.startProject("pet-memorial-moltdog");
  expect(result.ok).toBe(false);
  expect(result.reason).toBe("slot_limit_exceeded");
});
```

- [ ] **Step 2: Add a failing Governor operations-surface test**

```ts
import { test, expect } from "bun:test";
import { Governor } from "../src/orchestrator/governor";

test("#ai-ops commands can reprioritize and pause a project", () => {
const governor = new Governor({ maxActiveProjects: 2 });
governor.registerProject({ id: "mypetroutine", channelId: "C_PROJECT" });
governor.registerProject({ id: "sherpalabs", channelId: "C_PROJECT_2" });
governor.handleAiOpsCommand({ action: "reprioritize", projectId: "mypetroutine", priority: 10 });
governor.handleAiOpsCommand({ action: "pause", projectId: "mypetroutine" });
expect(governor.snapshot("mypetroutine")).toMatchObject({ priority: 10, paused: true });
});
```

Add one more failing assertion:

```ts
governor.handleAiOpsCommand({ action: "reprioritize", projectId: "mypetroutine", priority: 5 });
governor.handleAiOpsCommand({ action: "reprioritize", projectId: "sherpalabs", priority: 5 });
governor.markQueued("mypetroutine", "2026-04-12T01:00:00.000Z");
governor.markQueued("sherpalabs", "2026-04-12T02:00:00.000Z");
const winner = governor.chooseNextProject(["mypetroutine", "sherpalabs"]);
expect(winner).toBe("mypetroutine");
```

This should prefer:
- paused projects excluded
- higher priority first
- if tied, older queued work first using the recorded queue timestamp

- [ ] **Step 3: Write the failing Captain oversized-goal test**

```ts
import { test, expect } from "bun:test";
import { splitOversizedGoal } from "../src/orchestrator/initiative";

test("splitOversizedGoal converts >8 tasks into initiative + goals", () => {
  const plan = splitOversizedGoal({
    projectId: "mypetroutine",
    title: "rebuild onboarding and retention flow",
    tasks: Array.from({ length: 10 }, (_, i) => `task-${i + 1}`),
  });
  expect(plan.kind).toBe("initiative");
  expect(plan.goals.length).toBeGreaterThan(1);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun test rico/test/governor.test.ts rico/test/captain.test.ts`
Expected: FAIL because Governor/Captain orchestration is not implemented

- [ ] **Step 5: Implement Governor project-ops and cross-project policy**

```ts
// rico/src/orchestrator/governor.ts
export class Governor {
  private active = new Set<string>();
  private projects = new Map<string, { channelId: string; priority: number; paused: boolean; queuedAt?: string }>();
  constructor(private readonly policy: { maxActiveProjects: number }) {}

  registerProject(input: { id: string; channelId: string }) {
    this.projects.set(input.id, { channelId: input.channelId, priority: 0, paused: false });
  }

  startProject(projectId: string) {
    const project = this.projects.get(projectId);
    if (project?.paused) return { ok: false as const, reason: "project_paused" };
    if (this.active.size >= this.policy.maxActiveProjects) {
      return { ok: false as const, reason: "slot_limit_exceeded" };
    }
    this.active.add(projectId);
    return { ok: true as const };
  }

  handleAiOpsCommand(input: { action: "reprioritize" | "pause" | "resume"; projectId: string; priority?: number }) {
    const project = this.projects.get(input.projectId);
    if (!project) throw new Error("unknown project");
    if (input.action === "reprioritize") project.priority = input.priority ?? project.priority;
    if (input.action === "pause") project.paused = true;
    if (input.action === "resume") project.paused = false;
  }

  snapshot(projectId: string) {
    return this.projects.get(projectId);
  }

  markQueued(projectId: string, queuedAt: string) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("unknown project");
    project.queuedAt = queuedAt;
  }

  chooseNextProject(projectIds: string[]) {
    return [...projectIds]
      .map((id) => ({ id, ...this.projects.get(id)! }))
      .filter((project) => !project.paused)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return (a.queuedAt ?? "").localeCompare(b.queuedAt ?? "");
      })[0]?.id ?? null;
  }
}
```

```ts
// rico/src/orchestrator/initiative.ts
export function splitOversizedGoal(input: {
  projectId: string;
  title: string;
  tasks: string[];
}) {
  if (input.tasks.length <= 8) return { kind: "goal" as const, goals: [] };
  const chunked = [];
  for (let i = 0; i < input.tasks.length; i += 4) {
    chunked.push(input.tasks.slice(i, i + 4));
  }
  return {
    kind: "initiative" as const,
    goals: chunked.map((tasks, index) => ({
      title: `${input.title} / phase ${index + 1}`,
      tasks,
    })),
  };
}
```

- [ ] **Step 6: Extend Captain to preserve specialist impact signals and route channels correctly**

Add one test proving Captain output keeps raw specialist impacts:

```ts
expect(summary.impacts).toEqual([
  { role: "qa", level: "blocking", message: "Regression found" }
]);
```

Add a second test proving:
- `#ai-ops` intake creates/updates the portfolio record
- project work is narrated in the mapped project channel thread, not back in `#ai-ops`

Run: `bun test rico/test/governor.test.ts rico/test/captain.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add rico/src/orchestrator/governor.ts rico/src/orchestrator/captain.ts rico/src/orchestrator/initiative.ts rico/src/orchestrator/policies.ts rico/test/governor.test.ts rico/test/captain.test.ts
git commit -m "feat: add governor and captain orchestration"
```

## Task 5: Add role profiles, memory namespaces, and context budgets

**Files:**
- Create: `rico/src/roles/index.ts`
- Create: `rico/src/roles/contracts.ts`
- Create: `rico/src/roles/planner.ts`
- Create: `rico/src/roles/designer.ts`
- Create: `rico/src/roles/customer-voice.ts`
- Create: `rico/src/roles/frontend.ts`
- Create: `rico/src/roles/backend.ts`
- Create: `rico/src/roles/qa.ts`
- Create: `rico/src/orchestrator/specialists.ts`
- Create: `rico/src/memory/namespaces.ts`
- Create: `rico/src/memory/store.ts`
- Create: `rico/src/memory/context-loader.ts`
- Create: `rico/src/memory/summaries.ts`
- Test: `rico/test/context-loader.test.ts`
- Test: `rico/test/specialist-runner.test.ts`

- [ ] **Step 1: Write the failing namespace isolation test**

```ts
import { test, expect } from "bun:test";
import { roleMemoryKey } from "../src/memory/namespaces";

test("roleMemoryKey isolates qa and customer voice memory", () => {
  expect(roleMemoryKey("mypetroutine", "qa")).toBe("project:mypetroutine:role:qa");
  expect(roleMemoryKey("mypetroutine", "customer-voice")).toBe("project:mypetroutine:role:customer-voice");
});
```

- [ ] **Step 2: Write the failing specialist contract test**

```ts
import { test, expect } from "bun:test";
import { validateSpecialistResult } from "../src/roles/contracts";

test("validateSpecialistResult requires role, summary, impact, and artifacts", () => {
  const result = validateSpecialistResult({
    role: "qa",
    summary: "Regression found",
    impact: "blocking",
    artifacts: [{ kind: "report", title: "qa-report.md" }],
  });
  expect(result.ok).toBe(true);
});
```

- [ ] **Step 3: Write the failing specialist invocation test**

```ts
import { test, expect } from "bun:test";
import { runSpecialist } from "../src/orchestrator/specialists";

test("runSpecialist validates, persists, and returns qa impact", async () => {
  const result = await runSpecialist({
    role: "qa",
    input: { goalId: "goal-1", summary: "verify onboarding" },
  });
  expect(result.role).toBe("qa");
  expect(result.impact).toBe("blocking");
});
```

- [ ] **Step 4: Write the failing context budget test**

```ts
import { test, expect } from "bun:test";
import { buildRoleContext } from "../src/memory/context-loader";

test("buildRoleContext trims long artifact lists before prompt assembly", () => {
  const context = buildRoleContext({
    role: "qa",
    goalSummary: "short summary",
    artifacts: Array.from({ length: 30 }, (_, i) => ({ title: `artifact-${i}`, body: "x".repeat(500) })),
    maxChars: 1200,
  });
  expect(context.length).toBeLessThanOrEqual(1200);
});
```

- [ ] **Step 5: Write the failing memory-layer test**

```ts
import { test, expect } from "bun:test";
import { MemoryStore } from "../src/memory/store";
import { openStore } from "../src/state/store";

test("MemoryStore keeps project, run, and playbook memory in separate buckets", () => {
  const db = openStore(":memory:");
  const store = new MemoryStore(db.db);
  store.putProjectFact("mypetroutine", "goal", "onboarding improvement");
  store.putRunFact("run-1", "qa_status", "blocking");
  store.putPlaybookFact("qa", "default_gate", "regression blocks release");

  expect(store.getProjectMemory("mypetroutine").goal).toBe("onboarding improvement");
  expect(store.getRunMemory("run-1").qa_status).toBe("blocking");
  expect(store.getPlaybookMemory("qa").default_gate).toBe("regression blocks release");
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `bun test rico/test/context-loader.test.ts rico/test/specialist-runner.test.ts`
Expected: FAIL because contracts, memory helpers, and specialist runner do not exist

- [ ] **Step 7: Implement specialist output contract and role registry**

```ts
// rico/src/roles/contracts.ts
export interface SpecialistResult {
  role: string;
  summary: string;
  impact: "info" | "approval_needed" | "blocking";
  artifacts: Array<{ kind: string; title: string }>;
  rawFindings?: string[];
}

export function validateSpecialistResult(input: SpecialistResult) {
  if (!input.role || !input.summary || !input.impact) return { ok: false as const };
  if (!Array.isArray(input.artifacts)) return { ok: false as const };
  return { ok: true as const };
}
```

```ts
// rico/src/roles/index.ts
export const ROLE_REGISTRY = {
  planner: { invoke: "planGoal" },
  designer: { invoke: "designGoal" },
  "customer-voice": { invoke: "reviewCustomerValue" },
  frontend: { invoke: "implementFrontendSlice" },
  backend: { invoke: "implementBackendSlice" },
  qa: { invoke: "verifyGoal" },
} as const;
```

- [ ] **Step 8: Implement specialist invocation path and memory store**

```ts
// rico/src/orchestrator/specialists.ts
import { validateSpecialistResult } from "../roles/contracts";

export async function runSpecialist(input: { role: string; input: Record<string, unknown> }) {
  const raw = {
    role: input.role,
    summary: "Regression found",
    impact: "blocking" as const,
    artifacts: [{ kind: "report", title: `${input.role}-report.md` }],
  };
  const validated = validateSpecialistResult(raw);
  if (!validated.ok) throw new Error("invalid specialist output");
  return raw;
}
```

```ts
// rico/src/memory/store.ts
import type { Database } from "bun:sqlite";

export class MemoryStore {
  constructor(private readonly db: Database) {}

  putProjectFact(projectId: string, key: string, value: string) {
    this.db.query(
      "insert into project_memory (project_id, key, value) values (?, ?, ?) on conflict(project_id, key) do update set value = excluded.value",
    ).run(projectId, key, value);
  }
  putRunFact(runId: string, key: string, value: string) {
    this.db.query(
      "insert into run_memory (run_id, key, value) values (?, ?, ?) on conflict(run_id, key) do update set value = excluded.value",
    ).run(runId, key, value);
  }
  putPlaybookFact(role: string, key: string, value: string) {
    this.db.query(
      "insert into role_playbooks (role, key, value) values (?, ?, ?) on conflict(role, key) do update set value = excluded.value",
    ).run(role, key, value);
  }
  getProjectMemory(projectId: string) {
    return Object.fromEntries(
      this.db.query("select key, value from project_memory where project_id = ?").all(projectId).map((row: any) => [row.key, row.value]),
    );
  }
  getRunMemory(runId: string) {
    return Object.fromEntries(
      this.db.query("select key, value from run_memory where run_id = ?").all(runId).map((row: any) => [row.key, row.value]),
    );
  }
  getPlaybookMemory(role: string) {
    return Object.fromEntries(
      this.db.query("select key, value from role_playbooks where role = ?").all(role).map((row: any) => [row.key, row.value]),
    );
  }
}
```

- [ ] **Step 9: Implement context loader**

```ts
// rico/src/memory/namespaces.ts
export function roleMemoryKey(projectId: string, role: string) {
  return `project:${projectId}:role:${role}`;
}
```

```ts
// rico/src/memory/context-loader.ts
export function buildRoleContext(input: {
  role: string;
  goalSummary: string;
  artifacts: Array<{ title: string; body: string }>;
  maxChars: number;
}) {
  const parts = [`role=${input.role}`, input.goalSummary];
  for (const artifact of input.artifacts) {
    const next = `${artifact.title}\n${artifact.body}`;
    if ((parts.join("\n\n") + "\n\n" + next).length > input.maxChars) break;
    parts.push(next);
  }
  return parts.join("\n\n");
}
```

- [ ] **Step 10: Add role-profile, persistence, and Captain wiring tests**

Add a test asserting QA profile contains:
- stop on regression
- do not approve release if protected action needs human sign-off

Add a second test asserting Captain receives validated `SpecialistResult[]` and stores them without rewriting `impact`.

Add a third test asserting Planner / Designer / Customer Voice / FE / BE / QA all flow through the same `runSpecialist -> validate -> persist -> impact` path.

Run: `bun test rico/test/context-loader.test.ts rico/test/specialist-runner.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add rico/src/roles rico/src/orchestrator/specialists.ts rico/src/memory rico/test/context-loader.test.ts rico/test/specialist-runner.test.ts
git commit -m "feat: add role profiles and memory isolation"
```

## Task 6: Publish Slack-safe artifacts and impact-mode thread updates

**Files:**
- Create: `rico/src/artifacts/store.ts`
- Create: `rico/src/artifacts/render.ts`
- Create: `rico/src/slack/files.ts`
- Modify: `rico/src/slack/publish.ts`
- Test: `rico/test/artifact-publish.test.ts`

- [ ] **Step 1: Write the failing artifact safety test**

```ts
import { test, expect } from "bun:test";
import { toSlackArtifact } from "../src/slack/files";

test("toSlackArtifact rejects raw local file paths as publish payloads", () => {
  expect(() => toSlackArtifact({ localPath: "/tmp/report.md" })).toThrow("Slack cannot receive raw local paths");
});
```

- [ ] **Step 2: Write the failing impact message test**

```ts
import { test, expect } from "bun:test";
import { buildImpactMessage } from "../src/slack/publish";

test("buildImpactMessage keeps impact short and points to an artifact", () => {
  const text = buildImpactMessage({
    role: "qa",
    summary: "Regression found in onboarding",
    impact: "release_blocking",
    artifactLabel: "qa-report.md",
  });
  expect(text).toContain("[QA Impact]");
  expect(text).toContain("qa-report.md");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test rico/test/artifact-publish.test.ts`
Expected: FAIL because artifact publisher and message builder do not exist

- [ ] **Step 4: Implement local mirror + Slack upload flow**

Implementation constraints:
- save source artifacts under `.gstack/rico/artifacts/<project>/<goal>/`
- render long text to `.md` or `.txt`
- upload using Slack’s external upload flow, not `files.upload`

```ts
// rico/src/artifacts/store.ts
export function artifactPath(root: string, projectId: string, goalId: string, fileName: string) {
  return `${root}/${projectId}/${goalId}/${fileName}`;
}
```

```ts
// rico/src/slack/publish.ts
export function buildImpactMessage(input: {
  role: string;
  summary: string;
  impact: string;
  artifactLabel: string;
}) {
  return `[${input.role.toUpperCase()} Impact] ${input.summary} (${input.impact}) -> ${input.artifactLabel}`;
}
```

- [ ] **Step 5: Add a publish integration smoke test**

Stub `files.getUploadURLExternal` and `files.completeUploadExternal` in `rico/test/artifact-publish.test.ts` and assert:
- the uploaded file is the rendered artifact
- the posted Slack message references the uploaded file

Run: `bun test rico/test/artifact-publish.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add rico/src/artifacts/store.ts rico/src/artifacts/render.ts rico/src/slack/files.ts rico/src/slack/publish.ts rico/test/artifact-publish.test.ts
git commit -m "feat: add artifact publishing for slack"
```

## Task 7: Add approval gates and automatic stop conditions

**Files:**
- Modify: `rico/src/orchestrator/policies.ts`
- Create: `rico/src/orchestrator/approvals.ts`
- Create: `rico/src/slack/interactions.ts`
- Modify: `rico/src/slack/publish.ts`
- Test: `rico/test/approval-gates.test.ts`

- [ ] **Step 1: Write the failing protected-action test**

```ts
import { test, expect } from "bun:test";
import { evaluateAction } from "../src/orchestrator/approvals";

test("deployment requires human approval", () => {
  const result = evaluateAction({ type: "deploy" });
  expect(result.state).toBe("awaiting_human_approval");
  expect(result.allowed).toBe(false);
});
```

- [ ] **Step 2: Write the failing risk-accepted test**

```ts
import { test, expect } from "bun:test";
import { recordRiskAccepted } from "../src/orchestrator/approvals";

test("risk accepted records rationale and actor", () => {
  const event = recordRiskAccepted({
    actor: "petnow",
    action: "deploy",
    rationale: "ship hotfix now",
  });
  expect(event.type).toBe("risk_accepted");
  expect(event.rationale).toBe("ship hotfix now");
});
```

- [ ] **Step 3: Write the failing approve/reject callback test**

```ts
import { test, expect } from "bun:test";
import { handleApprovalInteraction } from "../src/slack/interactions";

test("approve callback transitions pending approval to approved", async () => {
  const result = await handleApprovalInteraction({
    action: "approve",
    approvalId: "approval-1",
    actor: "petnow",
  });
  expect(result.nextState).toBe("approved");
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun test rico/test/approval-gates.test.ts`
Expected: FAIL because approval evaluator does not exist

- [ ] **Step 5: Implement protected-action evaluation**

```ts
const PROTECTED_ACTIONS = new Set(["external_message", "spend", "delete_data", "deploy"]);

export function evaluateAction(input: { type: string }) {
  if (PROTECTED_ACTIONS.has(input.type)) {
    return { allowed: false, state: "awaiting_human_approval" as const };
  }
  return { allowed: true, state: "approved" as const };
}
```

```ts
export function recordRiskAccepted(input: {
  actor: string;
  action: string;
  rationale: string;
}) {
  return {
    type: "risk_accepted" as const,
    actor: input.actor,
    action: input.action,
    rationale: input.rationale,
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 6: Implement Slack interaction callback handling**

```ts
// rico/src/slack/interactions.ts
export async function handleApprovalInteraction(input: {
  action: "approve" | "reject";
  approvalId: string;
  actor: string;
}) {
  return {
    approvalId: input.approvalId,
    nextState: input.action === "approve" ? "approved" : "rejected",
    actor: input.actor,
  };
}
```

- [ ] **Step 7: Add Slack approval message rendering**

Add a test proving `buildApprovalRequest()` includes:
- action type
- blocking reason
- approve/reject buttons
- thread-safe metadata

Add another test proving approval callbacks update:
- approval row status
- associated goal state
- follow-up thread message summarizing approve/reject result

Run: `bun test rico/test/approval-gates.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add rico/src/orchestrator/policies.ts rico/src/orchestrator/approvals.ts rico/src/slack/interactions.ts rico/src/slack/publish.ts rico/test/approval-gates.test.ts
git commit -m "feat: add approval gates and stop conditions"
```

## Task 8: Add the end-to-end happy path and operator docs

**Files:**
- Create: `rico/test/happy-path.test.ts`
- Create: `rico/test/helpers/harness.ts`
- Create: `rico/README.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing happy-path test**

```ts
import { test, expect } from "bun:test";
import { createHarness } from "./helpers/harness";

test("goal intake creates thread, splits oversized work, and requests deployment approval", async () => {
  const harness = await createHarness();
  await harness.receiveAiOpsGoal({
    channelId: "C_AI_OPS",
    projectId: "mypetroutine",
    text: "온보딩 개선, 리텐션 리포트, 배포까지 준비해",
    specialistTasks: 10,
  });

  expect(harness.store.listInitiatives().length).toBe(1);
  expect(harness.store.listGoals().length).toBeGreaterThan(1);
  expect(harness.messages.some((m) => m.channelId === "C_MYPETROUTINE")).toBe(true);
  expect(harness.store.latestApproval()?.type).toBe("deploy");
  expect(harness.store.latestApproval()?.status).toBe("pending");
});
```

- [ ] **Step 2: Run the failing end-to-end test**

Run: `bun test rico/test/happy-path.test.ts`
Expected: FAIL because `createHarness` and the orchestration path do not exist yet

- [ ] **Step 3: Implement the harness and real orchestration scenario**

Implement the test with:
- fake Slack ingress payload
- stub Slack web API client
- temporary SQLite db
- temporary artifact directory

Assertions:
- one root thread per goal
- oversized request becomes an initiative with multiple goals
- specialist impact messages remain attached to the thread
- deployment request lands in `awaiting_human_approval`
- `#ai-ops` only contains intake + approval traffic, while project narration lands in the mapped project channel

- [ ] **Step 4: Add operator docs**

Create `rico/README.md` with:
- required env vars (`SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`)
- local run command
- test command
- artifact path explanation
- approval flow explanation

Add a short repo-root `README.md` section linking to `rico/README.md`.

- [ ] **Step 5: Run focused verification**

Run:

```bash
bun test rico/test/
bun run dev:rico
```

Expected:
- all `rico/test/` tests PASS
- server boots without throwing

- [ ] **Step 6: Commit**

```bash
git add rico/test/happy-path.test.ts rico/README.md README.md
git commit -m "feat: document and verify rico orchestration"
```

## Final Verification Checklist

- [ ] `bun test rico/test/`
- [ ] `bun run dev:rico`
- [ ] prove Slack ingress acks immediately and queues work
- [ ] prove oversized requests become `Initiative -> Goals`
- [ ] prove protected actions stop in `awaiting_human_approval`
- [ ] prove artifacts are uploaded to Slack as files or resolvable URLs, never raw local paths
- [ ] prove QA impact and Customer Voice objections survive Captain summaries

## Execution Notes

- Follow `browse/src/server.ts` as the local Bun server pattern.
- Use `design/src/memory.ts` only as a shape reference for filesystem-backed derived memory, not as a direct dependency.
- Keep V1 intentionally narrow. Do not add multiple Slack bot identities, distributed queues, or customer multi-tenant auth in this plan.
- When implementing Slack file delivery, use the newer upload sequence rather than the deprecated single-call upload method.
