---
description: 멀티에이전트 풀 개발 파이프라인 (기획 -> 구현 -> 테스트 -> 리뷰 -> QG)
argument-hint: <피처 설명 또는 태스크 ID>
---

# Bams Dev

총괄팀 중심 위임 구조의 완전한 개발 파이프라인을 실행합니다.
커맨드는 pipeline-orchestrator에게 Phase 단위 지시를 내리고, orchestrator가 부서장에게, 부서장이 에이전트에게 위임하는 3단 구조입니다.

```
dev.md → pipeline-orchestrator
           → [Phase 0] resource-optimizer (전략)
           → [Phase 1] product-strategy(부서장) → business-analysis, ux-research, project-governance
           → [Phase 1→2 핸드오프] cross-department-coordinator
           → [Phase 2] 개발부장 → FE, BE, devops, data-integration
           → [Phase 2.5] qa-strategy(부서장) → automation-qa
           → [Phase 3] qa-strategy(부서장) → automation-qa, defect-triage, release-quality-gate
           → [Phase 3] product-analytics(부서장) → performance-evaluation, business-kpi
           → [Phase 3.5] project-governance (QG)
           → [Phase 4] executive-reporter (성과 집계)
           → [Phase 4] 자동 회고 (retro-protocol.md)
```

입력: $ARGUMENTS

$ARGUMENTS가 비어있으면, 사용자에게 무엇을 개발할지 물어보고 중단합니다.

## 코드 최신화

Bash로 `git rev-parse --is-inside-work-tree 2>/dev/null`를 실행하여 git 저장소인지 확인합니다.

**git 저장소인 경우**: Bash로 `git branch --show-current`를 실행하여 현재 브랜치를 확인한 뒤, `git pull origin {현재 브랜치}`를 실행하여 원격 저장소의 최신 코드를 가져옵니다. 충돌이 발생하면 사용자에게 알리고 중단합니다.

**git 저장소가 아닌 경우**: 이 단계를 스킵합니다.

## 사전 조건

Glob으로 `.crew/config.md`가 존재하는지 확인합니다. 없으면:
- 출력: "프로젝트가 초기화되지 않았습니다. `/bams:init`을 실행하여 설정하세요."
- 여기서 중단.

`.crew/config.md`와 `.crew/board.md`를 읽습니다.

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


### Viz 이벤트: pipeline_start

사전 조건 확인 후, Bash로 다음을 실행합니다:

```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" pipeline_start "{slug}" "dev" "/bams:dev" "{arguments}"
```

### ★ Viz Agent 이벤트 규칙 (모든 Phase에 적용)

**이 파이프라인의 모든 서브에이전트(pipeline-orchestrator 포함) 호출 전후에 반드시 agent_start/agent_end 이벤트를 emit한다.**

**호출 직전:**
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" agent_start "{slug}" "{call_id}" "{agent_type}" "{model}" "{description}"
```

**호출 직후:**
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" agent_end "{slug}" "{call_id}" "{agent_type}" "{status}" {duration_ms} "{result_summary}"
```

- `{call_id}` 형식: `{agent_type}-phase{N}` (예: `orchestrator-phase0`, `orchestrator-phase1`)
- `{status}`: `success` / `error`
- 이 규칙은 이 파이프라인에서 호출하는 모든 서브에이전트에 적용된다
- **orchestrator 내부에서 부서장/에이전트를 호출할 때도** 동일하게 agent_start/agent_end를 emit해야 한다 (orchestrator.md의 핵심 원칙 참조)

## 작업 범위 결정

**$ARGUMENTS가 태스크 ID인 경우 (예: "TASK-001"):**
- `.crew/board.md`에서 해당 태스크 찾기
- 의존성이 모두 `## Done` 섹션에 있는지 확인
- 의존성이 충족되지 않으면 블로킹 태스크 목록을 표시하고 중단
- 이 단일 태스크로 Phase 2 (구현)로 진행

**$ARGUMENTS가 board.md에 태스크가 있는 피처 slug인 경우:**
- 해당 피처의 모든 태스크 수집 (`**Feature**: [slug]` 매칭)
- 해당 태스크들로 Phase 2 (구현)로 진행

**$ARGUMENTS가 새로운 피처 설명인 경우:**
- slug를 생성합니다
- Glob으로 기존 PRD와 설계 문서 검색
- **아티팩트가 존재하면**: "기존 계획 발견" 알림, Phase 2로 진행
- **아티팩트가 없으면** -> Phase 0 (파이프라인 초기화)으로 진행

---

## bams-server 자동 기동 (C1 Control Plane)

파이프라인 시작 전 bams-server가 실행 중인지 확인하고 필요시 백그라운드로 기동한다.

```bash
# bams-server 포트(3099) 확인
if ! curl -sf http://localhost:3099/health > /dev/null 2>&1; then
  echo "[bams] Control Plane 서버 기동 중..."
  # 백그라운드 실행 (nohup — 터미널 종료 후에도 유지)
  nohup bun run plugins/bams-plugin/server/src/app.ts > /tmp/bams-server.log 2>&1 &
  echo "[bams] PID: $! — 로그: /tmp/bams-server.log"
  sleep 1
  if curl -sf http://localhost:3099/health > /dev/null 2>&1; then
    echo "[bams] Control Plane 서버 기동 완료 (http://localhost:3099)"
  else
    echo "[bams] WARNING: 서버 기동 실패 — 파일 fallback 모드로 진행"
  fi
else
  echo "[bams] Control Plane 서버 이미 실행 중 (http://localhost:3099)"
fi
```

---

## Phase 0: 파이프라인 초기화

### Step 0. resource-optimizer 전략 수립

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 0 "파이프라인 초기화" "Phase 0: 초기화"
```

pipeline-orchestrator에게 파이프라인 초기화를 지시합니다.

(★ agent_start/agent_end 규칙에 따라 호출 전후에 viz 이벤트 emit — call_id: `orchestrator-phase0`)

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **파이프라인 초기화 모드**로 dev 파이프라인을 준비합니다.
>
> **위임 메시지:**
> ```
> phase: 0
> slug: {slug}
> pipeline_type: dev
> context:
>   config: .crew/config.md
>   board: .crew/board.md
>   feature_description: {$ARGUMENTS}
> constraints:
>   user_note: "{사용자 지시사항이 있으면 삽입}"
> ```
>
> **수행할 작업:**
> 1. resource-optimizer를 호출하여 파이프라인 유형(dev)과 규모를 전달하고, 각 에이전트별 모델 선택(opus/sonnet/haiku)과 병렬화 전략을 조회합니다.
> 2. executive-reporter를 호출하여 `pipeline_start` 이벤트를 기록 요청합니다.
> 3. Pre-flight 체크리스트를 확인합니다: config.md, gotchas, 기존 아티팩트 존재 여부.
> 4. 파이프라인 실행 계획을 수립하여 보고합니다.
>
> **기대 산출물**: 파이프라인 실행 계획 (모델 전략, 병렬화 가능 구간, 예상 Phase 수, 게이트 조건)

pipeline-orchestrator의 실행 계획을 수신하고, 이후 Phase에서 이 계획(모델 전략, 병렬화 전략)을 참조합니다.

Step 0 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 0 "done" {duration_ms}
```

---

## Phase 1: 기획 (기존 계획이 없는 경우만)

### Step 1. PRD 작성 (기획부장 위임)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 1 "PRD 작성" "Phase 1: 기획"
```

pipeline-orchestrator에게 기획 Phase의 PRD 작성을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 기획 실행 — PRD 작성**
>
> **위임 메시지:**
> ```
> phase: 1
> slug: {slug}
> pipeline_type: dev
> context:
>   config: .crew/config.md
>   feature_description: {$ARGUMENTS}
> ```
>
> **수행할 작업:**
> product-strategy(기획부장)에게 다음을 위임합니다:
>
> ```
> task_description: "피처 요청을 분석하고 PRD를 작성하라"
> input_artifacts:
>   - .crew/config.md
> expected_output:
>   type: prd_document
>   paths: [.crew/artifacts/prd/{slug}-prd.md]
> quality_criteria:
>   - 명확한 문제 정의와 목표
>   - 사용자 스토리 포함
>   - 인수 기준 정의
>   - 스코프 경계 명시
> ```
>
> product-strategy는 내부적으로 business-analysis, ux-research 에이전트를 활용하여 PRD를 작성합니다.
>
> **미결 질문이 있으면** 반드시 보고하세요.

**미결 질문이 있으면** 사용자에게 제시하고 답변을 기다립니다.

Step 1 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 1 "done" {duration_ms}
```

### Step 2. 기술 설계 + 태스크 분해 (기획부장 + 개발부장 병렬)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 2 "기술 설계 + 태스크 분해" "Phase 1: 기획"
```

pipeline-orchestrator에게 기술 설계와 태스크 분해를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 기획 실행 — 기술 설계 + 태스크 분해**
>
> **위임 메시지:**
> ```
> phase: 1
> slug: {slug}
> pipeline_type: dev
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   config: .crew/config.md
> ```
>
> **수행할 작업 (병렬 위임):**
>
> 1. product-strategy(기획부장)에게 business-analysis를 통한 기능 명세 작성을 위임:
> ```
> task_description: "PRD 기반 상세 동작 명세를 작성하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
> expected_output:
>   type: functional_spec
>   paths: [.crew/artifacts/design/{slug}-spec.md]
> quality_criteria:
>   - 모든 유저 플로우 커버
>   - 엣지 케이스 정의
>   - 데이터 모델 명시
> ```
>
> 2. 개발부장에게 프론트엔드/백엔드 기술 설계를 위임:
>    - frontend-engineering: UI 설계, 컴포넌트 구조, 상태 관리 설계
>    - backend-engineering: API 설계, DB 스키마, 비즈니스 로직 설계
>    (두 에이전트를 병렬로 실행)
>
> ```
> task_description: "PRD 기반 프론트엔드/백엔드 기술 설계를 작성하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - .crew/config.md
> expected_output:
>   type: technical_design
>   paths: [.crew/artifacts/design/{slug}-design.md]
> quality_criteria:
>   - 컴포넌트 구조 명확
>   - API 엔드포인트 정의
>   - 데이터 흐름 명시
> ```
>
> 3. 3개 결과를 종합하여 태스크를 분해:
>    - 각 태스크에 명확한 범위, 역할 할당, 우선순위, 의존성, 인수 기준 포함
>    - board.md에 추가할 형식으로 정리
>
> **기대 산출물**: 기능 명세, 기술 설계, 태스크 분해 결과

Step 2 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 2 "done" {duration_ms}
```

### Step 3. 아티팩트 저장

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 3 "아티팩트 저장" "Phase 1: 기획"
```

orchestrator로부터 받은 결과물을 저장합니다:

1. PRD를 `.crew/artifacts/prd/{slug}-prd.md`에 저장
2. 설계를 `.crew/artifacts/design/{slug}-design.md`에 저장
3. 태스크를 `.crew/board.md`의 `## Backlog`에 추가
4. `.crew/config.md`의 `last_task_id` 업데이트

사용자에게 계획 요약을 제시합니다. 질문: "구현을 진행할까요?"
사용자가 아니라고 하면, 여기서 중단합니다.

Step 3 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 3 "done" {duration_ms}
```

### Step 4. 기획 → 구현 핸드오프

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 4 "기획→구현 핸드오프" "Phase 1→2: 핸드오프"
```

pipeline-orchestrator에게 Phase 전환 핸드오프를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 → Phase 2 핸드오프 실행**
>
> **위임 메시지:**
> ```
> phase: 1→2 handoff
> slug: {slug}
> pipeline_type: dev
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   board: .crew/board.md
> ```
>
> **수행할 작업:**
> 1. Phase 게이트 판단: Phase 1 완료 조건 검증 (PRD 승인, 기술 설계 완료, 태스크 분해 완료)
> 2. cross-department-coordinator에게 기획→구현 핸드오프 조율 위임:
>    - 기획부장의 산출물(PRD, 설계, 태스크)이 개발부장에게 올바르게 전달되는지 확인
>    - 부서 간 인터페이스(API 계약, 데이터 스키마) 정합성 확인
>    - 누락되거나 모호한 인터페이스 항목이 있으면 보고
> 3. executive-reporter에게 Phase 1 완료 상태 보고 요청
>
> **기대 산출물**: Phase 게이트 판단 결과 (GO/NO-GO/CONDITIONAL-GO), 핸드오프 체크리스트 결과

**Phase 게이트 결과가 NO-GO이면**: 미충족 항목을 사용자에게 보고하고, 해결 후 재시도합니다.

Step 4 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 4 "done" {duration_ms}
```

---

## Phase 1.5: Git 체크포인트

**AskUserQuestion**으로 체크포인트 방식을 선택받습니다:

Question: "구현 시작 전 코드를 어떻게 보존할까요?"
Header: "Git"
Options:
- **Feature branch** - "새 브랜치를 생성하여 작업 (예: bams/{slug})"
- **Stash** - "현재 변경사항을 stash하고 현재 브랜치에서 작업"
- **스킵** - "체크포인트 없이 바로 진행"

---

## Phase 2: 구현

### Step 5. 멀티에이전트 구현 (개발부장 위임)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 5 "멀티에이전트 구현" "Phase 2: 구현"
```

board.md에서 태스크 목록을 의존성 순서로 정렬합니다. 배치로 그룹화:
- **배치 1**: 의존성 없는 태스크
- **배치 2**: 의존성이 모두 배치 1에 있는 태스크
- **배치 N**: 모든 태스크가 스케줄될 때까지 계속

각 배치에 대해 pipeline-orchestrator에게 구현을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 2 구현 실행 — 배치 {N}**
>
> **위임 메시지:**
> ```
> phase: 2
> slug: {slug}
> pipeline_type: dev
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   board: .crew/board.md
>   model_strategy: {Phase 0에서 받은 모델 전략}
> constraints:
>   batch: {N}
>   tasks: [{이 배치의 태스크 ID 목록}]
> ```
>
> **수행할 작업:**
> 태스크의 파일 범위와 태그에 따라 적절한 부서장을 결정하여 위임합니다 (delegation-protocol.md 3-1, 3-2, 3-3 참조):
>
> - UI/컴포넌트/스타일 관련 -> frontend-engineering(부서장)에게 위임
> - API/DB/비즈니스 로직 관련 -> backend-engineering(부서장)에게 위임
> - 인프라/배포 관련 -> platform-devops(부서장)에게 위임
> - 데이터 관련 -> data-integration(부서장)에게 위임
> - 겹치는 경우 -> 파일 기준으로 분리하여 병렬 위임, cross-department-coordinator에게 조율 요청
>
> 각 부서장에게 delegation-protocol.md 2-2 형식으로 위임 메시지를 전달합니다:
> ```
> task_description: "{태스크 제목과 설명}"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - .crew/artifacts/design/{slug}-design.md
> expected_output:
>   type: code_implementation
>   paths: [{태스크에서 정의된 파일 경로}]
> quality_criteria:
>   - 인수 기준 충족
>   - 타입 에러 0건
>   - 린트 에러 0건
> constraints:
>   allowed_files: [{태스크 파일 범위}]
> ```
>
> 같은 배치의 파일 겹침이 없는 태스크는 **병렬로** 실행합니다.
> 각 부서장은 소속 에이전트에게 하위 작업을 분배하여 구현합니다.
>
> **기대 산출물**: 구현된 코드, 각 태스크별 완료 상태 보고

각 배치의 orchestrator 반환 후:
- 파일을 읽어 올바르게 생성/수정되었는지 확인
- board.md에서 해당 태스크를 `## In Review`로 이동

### 구현 변경사항 확인

git 저장소인 경우, 각 배치 완료 후 `git diff --stat` 표시.

**AskUserQuestion**으로 확인:
Question: "구현 결과를 적용할까요?"
Header: "Confirm"
Options:
- **적용** - "변경사항을 유지하고 다음 단계로 진행"
- **되돌리기** - "모든 변경사항을 되돌리고 중단"
- **부분 되돌리기** - "특정 파일만 되돌리기"

Phase 2 구현 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 5 "done" {duration_ms}
```

---

## Phase 2.5: 테스트 코드 생성 (QA부장 위임)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 6 "테스트 코드 생성" "Phase 2.5: 테스트"
```

### Step 6a. 테스트 작성 여부 묻기

**AskUserQuestion**:
Question: "구현과 병렬로 테스트 코드를 작성할까요?"
Header: "Tests"
Options:
- **Yes** - "각 배치 완료 즉시 테스트 작성 (구현과 병렬)"
- **나중에** - "모든 구현 완료 후 일괄 작성"
- **Skip** - "이번에는 테스트 스킵"

### Step 6b. 테스트 작성 (QA부장 위임)

pipeline-orchestrator에게 테스트 작성을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 2.5 테스트 작성 실행**
>
> **위임 메시지:**
> ```
> phase: 2.5
> slug: {slug}
> pipeline_type: dev
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   changed_files: [{구현에서 수정/생성된 파일 목록}]
>   test_dir: {config.md의 test_dir 설정}
> ```
>
> **수행할 작업:**
> qa-strategy(QA부장)에게 테스트 작성을 위임합니다:
>
> ```
> task_description: "최근 구현된 코드에 대한 테스트를 작성하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - {테스트 커버리지가 없는 파일 목록}
> expected_output:
>   type: test_code
>   paths: [{test_dir}/**]
> quality_criteria:
>   - 핵심 유저 플로우 커버
>   - 엣지 케이스 테스트 포함
>   - 인수 기준 검증
> ```
>
> QA부장은 automation-qa 에이전트에게 테스트 작성을 분배합니다.
> 테스트 러너가 있으면 실행하여 결과를 보고합니다.
>
> **기대 산출물**: 테스트 코드, 테스트 계획 (.crew/artifacts/test/{slug}-tests.md), 실행 결과

**Yes 선택 시**: 배치별 오버랩 - `배치 N 테스트 작성 || 배치 N+1 구현`이 병렬로 진행됩니다.
**나중에 선택 시**: 모든 구현 완료 후 일괄 실행.

Phase 2.5 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 6 "{status}" {duration_ms}
```

---

## Phase 3: 검증 (QA부장 + 평가부장 병렬)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 7 "검증 (QA + 평가 병렬)" "Phase 3: 검증"
```

### Step 7. 3관점 리뷰 + 성과 평가 (병렬 실행)

pipeline-orchestrator에게 검증 Phase를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 3 검증 실행**
>
> **위임 메시지:**
> ```
> phase: 3
> slug: {slug}
> pipeline_type: dev
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   changed_files: [{수정/생성된 모든 파일 목록}]
>   test_results: .crew/artifacts/test/{slug}-tests.md
>   config: .crew/config.md
> ```
>
> **수행할 작업 (2개 부서장 병렬 위임):**
>
> **1. qa-strategy(QA부장)에게 3관점 리뷰 위임:**
> ```
> task_description: "3관점(정확성, 보안+성능, 코드품질) 병렬 리뷰를 실행하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - {변경된 파일 목록}
> expected_output:
>   type: review_report
>   paths: [.crew/artifacts/review/{slug}-review.md]
> quality_criteria:
>   - 3관점 모두 커버
>   - 심각도별 분류 (Critical/Major/Minor)
>   - 중복 제거
> ```
>
> QA부장은 내부적으로 automation-qa, defect-triage, release-quality-gate 에이전트를 활용하여 3관점 리뷰를 병렬 실행합니다:
> - 관점 1: 기능적 정확성
> - 관점 2: 보안 + 성능
> - 관점 3: 코드 품질 + 유지보수성
>
> **2. product-analytics(평가부장)에게 성과 평가 위임:**
> ```
> task_description: "구현 결과의 성능과 비즈니스 지표를 평가하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - {변경된 파일 목록}
> expected_output:
>   type: evaluation_report
>   paths: [.crew/artifacts/evaluation/{slug}-eval.md]
> quality_criteria:
>   - 성능 기준 측정 (있는 경우)
>   - 비즈니스 KPI 영향 분석
> ```
>
> 평가부장은 performance-evaluation, business-kpi 에이전트를 활용합니다.
>
> **기대 산출물**: 리뷰 리포트, 평가 리포트

### 리뷰 결과 처리

1. 모든 발견 사항 수집, 중복 제거, 심각도 순 정렬
2. 리뷰 리포트를 `.crew/artifacts/review/{slug}-review.md`에 저장
3. 평가 리포트를 `.crew/artifacts/evaluation/{slug}-eval.md`에 저장

**Critical 이슈 발견 시:** 사용자에게 제시 후 Edit 도구로 수정 적용.
**Major 이슈 발견 시:** 사용자에게 제시 후 수정 여부 확인.

Phase 3 검증 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 7 "done" {duration_ms}
```

---

## Phase 3.5: Quality Gate (최대 3회 반복, 델타 기반)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 8 "Quality Gate" "Phase 3.5: QG"
```

### Step 8. Quality Gate (project-governance 위임)

현재 반복 횟수를 `iteration = 1`로 초기화합니다.
`qg_baseline_commit`을 현재 HEAD 커밋 해시로 기록합니다.

### Quality Gate 루프

**iteration 1 (최초)**: 전체 구현 파일 검증.
**iteration 2-3 (반복)**: `git diff --name-only {qg_baseline_commit}..HEAD`로 **변경된 파일만** 검증 대상으로 전달. 이전 QG에서 PASS된 파일은 재검증하지 않습니다.

pipeline-orchestrator에게 Quality Gate를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 3.5 Quality Gate 실행**
>
> **위임 메시지:**
> ```
> phase: 3.5
> slug: {slug}
> pipeline_type: dev
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   review_report: .crew/artifacts/review/{slug}-review.md
>   evaluation_report: .crew/artifacts/evaluation/{slug}-eval.md
>   test_results: .crew/artifacts/test/{slug}-tests.md
>   iteration: {iteration}
>   max_iterations: 3
>   verification_files: [{iteration 1이면 전체 파일, 2-3이면 변경된 파일만}]
>   previous_qg_result: [{iteration 2-3이면 이전 QG의 PASS/FAIL 파일별 상세}]
> ```
>
> **수행할 작업:**
> project-governance에게 Quality Gate 검증을 위임합니다:
>
> ```
> task_description: "구현 결과물의 최종 품질을 검증하라 (iteration {iteration}/3)"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - .crew/artifacts/design/{slug}-design.md
>   - .crew/artifacts/review/{slug}-review.md
>   - .crew/artifacts/test/{slug}-tests.md
> expected_output:
>   type: quality_gate_result
>   paths: [.crew/artifacts/qg/{slug}-qg-{iteration}.md]
> quality_criteria:
>   - 인수 기준 전체 충족
>   - Critical 이슈 0건
>   - 빌드 성공
>   - 타입 체크 통과
> ```
>
> 검증 대상 파일들을 직접 Read 도구로 읽어서 검증합니다.
>
> **기대 산출물**: Quality Gate 판단 (PASS/FAIL), 파일별 상세 결과

**PASS인 경우:** board.md에서 태스크를 `## Done`으로 이동. Phase 4로 진행.

**FAIL인 경우 (iteration <= 3):**
- `qg_baseline_commit`을 현재 HEAD로 업데이트
- pipeline-orchestrator에게 재작업을 지시 (QG에서 지적한 이슈를 해당 부서장에게 위임)
- 완료 후 Quality Gate 루프 재시작 (변경된 파일만 재검증)

**iteration > 3:** 사용자에게 수동 확인 안내. Phase 4로 진행.

Quality Gate 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 8 "{status}" {duration_ms}
```

---

## Phase 4: 마무리 + 회고

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 9 "마무리 + 회고" "Phase 4: 마무리"
```

### Step 9a. 성과 집계 (executive-reporter 위임)

pipeline-orchestrator에게 마무리를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 4 마무리 실행 — 성과 집계**
>
> **위임 메시지:**
> ```
> phase: 4
> slug: {slug}
> pipeline_type: dev
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   review_report: .crew/artifacts/review/{slug}-review.md
>   evaluation_report: .crew/artifacts/evaluation/{slug}-eval.md
>   qg_result: .crew/artifacts/qg/{slug}-qg-{final_iteration}.md
>   board: .crew/board.md
> ```
>
> **수행할 작업:**
> 1. executive-reporter에게 파이프라인 성과 집계를 요청:
>    - 총 소요 시간, Phase별 소요 시간
>    - Step 성공률, 재시도 횟수
>    - 에이전트별 호출 통계
>    - 품질 지표 요약
>    - 이전 파이프라인 대비 트렌드
>
> 2. 보드 및 히스토리 업데이트:
>    - 완료된 모든 태스크를 board.md의 `## Done`으로 이동
>    - `.crew/history.md`에 타임스탬프와 함께 추가
>    - board.md의 `> Last updated:` 업데이트
>
> 3. README.md에 영향을 줄 수 있는 변경이 있는지 판단하고 필요 시 업데이트
>
> **기대 산출물**: 성과 집계 리포트, 업데이트된 board.md/history.md

### Step 9b. 자동 회고 (retro-protocol.md)

pipeline-orchestrator에게 회고를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 4 회고 실행**
>
> retro-protocol.md에 따라 파이프라인 회고를 **반드시** 실행합니다.
>
> **위임 메시지:**
> ```
> phase: 4-retro
> slug: {slug}
> pipeline_type: dev
> context:
>   all_artifacts: .crew/artifacts/
>   board: .crew/board.md
>   history: .crew/history.md
> ```
>
> **수행할 작업 (retro-protocol.md 절차):**
> 1. executive-reporter에게 정량 데이터 수집 요청: 총 소요 시간, Phase별 소요 시간, Step 성공률, 재시도 횟수, 에이전트별 호출 통계, 품질 지표, 이전 3회 대비 트렌드
> 2. 각 부서장에게 KPT 항목 제출 요청: Keep(유지), Problem(문제), Try(시도). 이 파이프라인에 참여한 부서장만 대상
> 3. 합의 도출: 수집된 KPT를 종합하여 Problem 우선순위 정렬, 액션 아이템 확정, 교차 검증
> 4. 피드백 반영: 에이전트 교훈 저장, gotchas 승격 검사, Pipeline Learnings 갱신, 프로세스 개선 제안
> 5. 회고 결과를 tracking 파일에 기록
>
> **기대 산출물**: 회고 결과 (KPT 요약, 액션 아이템, 피드백 반영 내역)

### 최종 요약 제시

최종 요약 제시: 피처명, 생성/수정 파일 목록, 테스트 파일 목록, 리뷰 이슈 요약, QG 결과, 성과 지표, 회고 KPT 요약, 아티팩트 경로, 완료 태스크 수.

Step 9 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 9 "done" {duration_ms}
```

---

## Phase 5: CLAUDE.md 상태 업데이트

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 10 "CLAUDE.md 상태 업데이트" "Phase 5: 상태 업데이트"
```

`CLAUDE.md`의 `## Bams 현재 상태` 섹션을 업데이트합니다 (없으면 파일 끝에 추가, 있으면 Edit으로 교체). `.crew/board.md`를 읽어 다음을 포함:
- 마지막 업데이트 타임스탬프
- 진행 중인 작업
- 활성 스프린트 정보
- 이번 실행에서 생성된 아티팩트 경로
- 다음에 실행 가능한 태스크/명령 제안

Step 10 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 10 "done" {duration_ms}
```

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 10)
