---
description: 버그 핫픽스 — 디버깅 → QA → 검증 → 배포 빠른 경로
argument-hint: <버그 설명 또는 에러 메시지>
---

# Bams: Hotfix

버그를 진단하고 수정한 뒤, 검증과 배포까지 빠르게 진행하는 핫픽스 파이프라인입니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

차이점:
- config.md 없어도 계속 진행 가능.
- 인자 비어있으면 AskUserQuestion으로 버그 설명 받기.
- Gotchas에서 버그 영역과 관련된 항목을 디버거 힌트로 전달.

스킬 로딩:

```bash
_QA_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/qa-only/SKILL.md" 2>/dev/null | head -1)
_SHIP_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/ship/SKILL.md" 2>/dev/null | head -1)
_DEPLOY_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/land-and-deploy/SKILL.md" 2>/dev/null | head -1)
```

진행 추적 파일: `templates/hotfix-tracking.md` 기반으로 생성.

### Viz 이벤트: pipeline_start

진행 추적 파일 및 lock 파일 생성 직후, Bash로 다음을 실행합니다:

```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" pipeline_start "{slug}" "hotfix" "/bams:hotfix" "{arguments}"
```

### ★ Viz Agent 이벤트 규칙

**`references/viz-agent-protocol.md` 참조.** 모든 서브에이전트 호출 전후에 반드시 agent_start/agent_end 이벤트를 emit한다. orchestrator 내부에서 부서장/에이전트를 호출할 때도 동일하게 적용한다.

## Step 1: 버그 진단 + 수정

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 1 "버그 진단 + 수정" "Phase 1: 진단/수정"
```

pipeline-orchestrator에게 긴급 진단 및 수정을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **핫픽스 긴급 진단 모드** — 버그를 즉시 진단하고 수정합니다.
>
> **위임 메시지:**
> ```
> phase: 1
> slug: {slug}
> pipeline_type: hotfix
> context:
>   config: .crew/config.md
>   bug_description: {$ARGUMENTS}
>   gotchas: [config.md에서 버그 영역 관련 항목 전달]
> constraints:
>   urgency: critical
> ```
>
> **수행할 작업:**
>
> 1. defect-triage를 호출하여 결함 분류 및 근본 원인 추적을 지시합니다:
> ```
> task_description: "버그를 긴급 분류하고 근본 원인을 추적하라"
> input_artifacts:
>   - .crew/config.md
>   - bug_description: {$ARGUMENTS}
> expected_output:
>   type: defect_analysis
>   paths: [.crew/artifacts/hotfix/{slug}-triage.md]
> quality_criteria:
>   - 근본 원인 식별
>   - 영향 범위(Impact Analysis) 완료
>   - Scope Lock 확정
> ```
>
> 2. defect-triage 결과를 바탕으로 개발부장에게 외과적 수정을 위임합니다:
> ```
> task_description: "근본 원인에 맞는 최소 범위 수정을 적용하고 회귀 테스트를 생성하라"
> input_artifacts:
>   - .crew/artifacts/hotfix/{slug}-triage.md
> expected_output:
>   type: code_fix + regression_tests
> quality_criteria:
>   - 수정 파일 최소화 (범위 외 변경 금지)
>   - Root Cause Verification 통과
>   - 회귀 테스트 생성 완료
> ```
>
> **기대 산출물**: 결함 분석 리포트, 수정된 코드, 회귀 테스트

Step 1 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 1 "done" {duration_ms}
```

## Step 2: QA 검증 (bams browse 스킬, 선택)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 2 "QA 검증" "Phase 2: 검증"
```

**스킬 미설치 시**: `skipped` 기록.

pipeline-orchestrator에게 QA 검증을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **핫픽스 QA 검증 모드** — 수정 사항의 회귀 여부를 빠르게 검증합니다.
>
> **위임 메시지:**
> ```
> phase: 2
> slug: {slug}
> pipeline_type: hotfix
> context:
>   fix_artifacts: .crew/artifacts/hotfix/{slug}-triage.md
> constraints:
>   urgency: critical
>   scope: regression_only
> ```
>
> **수행할 작업:**
> qa-strategy(QA부장)에게 테스트 계획 수립을 위임합니다:
> ```
> task_description: "핫픽스 회귀 테스트 계획을 수립하고 automation-qa로 실행하라"
> input_artifacts:
>   - .crew/artifacts/hotfix/{slug}-triage.md
> expected_output:
>   type: qa_test_plan
> quality_criteria:
>   - 수정된 영역 회귀 테스트 포함
>   - 관련 사이드 이펙트 체크 포함
> ```
>
> qa-strategy는 내부적으로 automation-qa 에이전트를 활용하여 테스트를 실행합니다.

AskUserQuestion — "브라우저 QA 테스트를 진행할까요?"
- **건너뛰기 (Recommended)**
- **QA 진행** — URL 입력 후 `_QA_SKILL` 실행

Step 2 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 2 "{status}" {duration_ms}
```

## Step 3-4: CI/CD 프리플라이트 + 출시 준비 검토 (오버랩)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 3 "CI/CD 프리플라이트" "Phase 3: 배포 준비"
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 4 "출시 준비 검토" "Phase 3: 배포 준비"
```

**Step 3 — CI/CD 프리플라이트:**
pipeline-orchestrator에게 CI/CD 검증을 지시합니다. orchestrator는 개발부장에게 `/bams:verify` 실행을 위임합니다. FAIL 시 자동 수정(최대 2회) / 수동 / 무시.

**Step 4 — 출시 준비 검토 (Step 3 PASS 시):**
**스킬 미설치 시**: "수동 PR 생성" 안내 후 `skipped`.

pipeline-orchestrator에게 출시 준비 검토를 지시합니다. orchestrator는 qa-strategy(QA부장)에게 release-quality-gate 실행을 위임합니다.
**최적화**: verify PASS 판정이 나오면 release-quality-gate는 verify 결과를 기다리지 않고 즉시 코드 리뷰 기반 검토를 시작합니다. verify 결과는 RQG에 후속 전달됩니다.

AskUserQuestion — "PR을 생성할까요?"
- **Ship (Recommended)** — `_SHIP_SKILL` 실행
- **나중에** — `status: paused_at_step_4` 기록 후 종료.

Step 3-4 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 3 "{status}" {duration_ms}
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 4 "{status}" {duration_ms}
```

## Step 5: 배포 (bams deploy 스킬, 선택)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 5 "배포" "Phase 4: 배포"
```

pipeline-orchestrator에게 배포 환경 점검을 지시합니다. orchestrator는 개발부장을 통해 `platform-devops` 에이전트로 배포 환경을 점검합니다.

AskUserQuestion — "즉시 배포할까요?"
- **나중에 (Recommended)**
- **배포** — `_DEPLOY_SKILL` 실행

Step 5 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 5 "{status}" {duration_ms}
```

## 마무리

### 자동 회고 (축소판)

pipeline_end 직전, pipeline-orchestrator에게 핫픽스 축소 회고를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **핫픽스 축소 회고 모드** — 파이프라인 완료 후 핵심 학습만 빠르게 수집합니다.
>
> **위임 메시지:**
> ```
> phase: retro
> slug: {slug}
> pipeline_type: hotfix
> context:
>   triage: .crew/artifacts/hotfix/{slug}-triage.md
> ```
>
> **수행할 작업:**
> executive-reporter를 호출하여 다음 항목을 기록합니다:
> 1. `hotfix:` — 근본 원인 + 영향 범위 요약
> 2. `vulnerable:` — 같은 영역에서 반복 버그가 감지되면 경고 수준 상향
> 3. `regression-test:` — 추가된 회귀 테스트 경로
>
> `.crew/board.md`의 관련 태스크를 `Done`으로 변경합니다.

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 5)

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `hotfix:` — 근본 원인 + 영향 범위
2. `vulnerable:` — 같은 영역 반복 버그 시 경고 수준 상향
3. `regression-test:` — 추가된 회귀 테스트 경로

`.crew/board.md` 업데이트: 관련 태스크 있으면 `Done`으로 변경.


### TaskDB 연동 (DB가 존재하면 board.md 대신 DB 사용)

`.crew/db/bams.db`가 존재하면 DB를 우선 사용합니다:

```bash
# DB 존재 확인
if [ -f ".crew/db/bams.db" ]; then
  echo "[bams-db] DB 모드 활성화"
fi
```

**태스크 등록 시 (DB가 존재하면):** Bash로 bun 스크립트를 실행하여 TaskDB에 태스크를 등록합니다.

```bash
# DB가 존재하면 TaskDB에 태스크 등록
if [ -f ".crew/db/bams.db" ]; then
  bun -e "
    import { TaskDB } from './plugins/bams-plugin/tools/bams-db/index.ts';
    const db = new TaskDB('.crew/db/bams.db');
    db.createTask({ pipeline_slug: '{slug}', title: '{task_title}', status: 'in_progress', assignee_agent: '{agent}', phase: {phase} });
    db.close();
  "
fi
```

**파이프라인 완료 시 (DB가 존재하면):** board.md를 DB 스냅샷으로 갱신합니다.

```bash
if [ -f ".crew/db/bams.db" ]; then
  bun run plugins/bams-plugin/tools/bams-db/sync-board.ts {slug} --write
fi
```

DB가 없으면 기존 board.md 방식을 유지합니다.

