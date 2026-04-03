---
description: 풀 피처 개발 사이클 — 기획 → 구현 → 검증 → 배포 → 마무리
argument-hint: <기능 설명 또는 기존 slug>
---

# Bams: Feature

총괄팀 중심 위임 구조의 풀 피처 생명주기를 관리합니다. 6개 Phase, 최대 13단계.
커맨드는 pipeline-orchestrator에게 Phase 단위 지시를 내리고, orchestrator가 부서장에게, 부서장이 에이전트에게 위임하는 3단 구조입니다.

```
feature.md → pipeline-orchestrator
               → [Phase 0] resource-optimizer (전략)
               → [Phase 1] product-strategy(기획부장) → BA, UX, PG
               → [Phase 1→2 핸드오프] cross-department-coordinator
               → [Phase 2] 개발부장 → FE, BE, devops, data-integration
               → [Phase 3 Step 4] qa-strategy(QA부장) → automation-qa (5관점 코드 리뷰)
               → [Phase 3 Step 5-7] qa-strategy(QA부장) + product-analytics(평가부장) (병렬)
               → [Phase 3 Step 8] platform-devops (CI/CD)
               → [Phase 4] executive-reporter (보고) + Ship/Deploy
               → [Phase 5 Step 11] product-strategy(기획부장) → 문서 갱신
               → [Phase 5 Step 12] project-governance → 스프린트 종료
               → [Phase 5 Step 13] executive-reporter + 부서장들 (자동 강제 회고)
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


추가 스캔 (병렬):
- **`.crew/artifacts/prd/`** — 기존 PRD 확인. 인자가 기존 slug와 일치하면 해당 PRD 로딩.
- **`.crew/artifacts/design/`** — 기존 기술설계 문서 확인.

스킬 로딩 (필요 시):

```bash
_BROWSE_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/browse/SKILL.md" 2>/dev/null | head -1)
_QA_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/qa-only/SKILL.md" 2>/dev/null | head -1)
_BENCHMARK_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/benchmark/SKILL.md" 2>/dev/null | head -1)
_CSO_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/cso/SKILL.md" 2>/dev/null | head -1)
_SHIP_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/ship/SKILL.md" 2>/dev/null | head -1)
_DEPLOY_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/land-and-deploy/SKILL.md" 2>/dev/null | head -1)
_DOCRELEASE_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/document-release/SKILL.md" 2>/dev/null | head -1)
_RETRO_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/retro/SKILL.md" 2>/dev/null | head -1)
```

```bash
_BAMS_CHECK=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/browse/SKILL.md" 2>/dev/null | head -1)
```

`_BAMS_CHECK`가 비어있으면 bams-plugin 스킬 미설치로 판단. 해당 단계를 대체 행동으로 처리합니다.

진행 추적 파일: `templates/feature-tracking.md` 기반으로 생성.

### Viz 이벤트: pipeline_start

진행 추적 파일 및 lock 파일 생성 직후, Bash로 다음을 실행합니다:

```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" pipeline_start "{slug}" "feature" "/bams:feature" "{arguments}"
```

### ★ Viz Agent 이벤트 규칙

**`references/viz-agent-protocol.md` 참조.** 모든 서브에이전트 호출 전후에 반드시 agent_start/agent_end 이벤트를 emit한다. orchestrator 내부에서 부서장/에이전트를 호출할 때도 동일하게 적용한다.

## 작업 범위 결정

**$ARGUMENTS가 기존 slug와 일치하고 PRD/설계 문서가 존재하는 경우:**
- 기존 아티팩트 로딩
- 해당 피처의 태스크가 board.md에 있으면 Phase 2 (구현)로 진행
- 없으면 Phase 1 (기획)로 진행

**$ARGUMENTS가 새로운 피처 설명인 경우:**
- slug를 생성합니다
- Phase 0 (파이프라인 초기화)으로 진행

---

## Phase 0: 파이프라인 초기화

### Step 0. resource-optimizer 전략 수립

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 0 "파이프라인 초기화" "Phase 0: 초기화"
```

pipeline-orchestrator에게 파이프라인 초기화를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **파이프라인 초기화 모드**로 feature 파이프라인을 준비합니다.
>
> **위임 메시지:**
> ```
> phase: 0
> slug: {slug}
> pipeline_type: feature
> context:
>   config: .crew/config.md
>   board: .crew/board.md
>   feature_description: {$ARGUMENTS}
> constraints:
>   user_note: "{사용자 지시사항이 있으면 삽입}"
> ```
>
> **수행할 작업:**
> 1. resource-optimizer를 호출하여 파이프라인 유형(feature)과 규모를 전달하고, 각 에이전트별 모델 선택(opus/sonnet/haiku)과 병렬화 전략을 조회합니다. feature는 dev보다 확장된 파이프라인이므로 검증/배포/마무리 Phase의 리소스도 계획합니다.
> 2. executive-reporter를 호출하여 `pipeline_start` 이벤트를 기록 요청합니다.
> 3. Pre-flight 체크리스트를 확인합니다: config.md, gotchas, 기존 아티팩트 존재 여부.
> 4. 파이프라인 실행 계획을 수립하여 보고합니다 (13단계 전체 범위).
>
> **기대 산출물**: 파이프라인 실행 계획 (모델 전략, 병렬화 가능 구간, 예상 Phase 수, 게이트 조건)

pipeline-orchestrator의 실행 계획을 수신하고, 이후 Phase에서 이 계획(모델 전략, 병렬화 전략)을 참조합니다.

Step 0 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 0 "done" {duration_ms}
```

---

## Phase 1: 기획 (기획부장 위임)

### Step 1. PRD 작성

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 1 "PRD 작성" "Phase 1: 기획"
```

**컨텍스트 확인**: `.crew/artifacts/prd/[slug]-prd.md` 존재 시 건너뜁니다.

pipeline-orchestrator에게 기획 Phase의 PRD 작성을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 기획 실행 — PRD 작성**
>
> **위임 메시지:**
> ```
> phase: 1
> slug: {slug}
> pipeline_type: feature
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

### Step 2. 기술 설계 + 태스크 분해 + 스프린트 설정

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 2 "기술 설계 + 태스크 분해 + 스프린트" "Phase 1: 기획"
```

**컨텍스트 확인**: `.crew/artifacts/design/[slug]-design.md` 존재 시 설계 단계를 건너뜁니다.

pipeline-orchestrator에게 기술 설계, 태스크 분해, 스프린트 설정을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 기획 실행 — 기술 설계 + 태스크 분해 + 스프린트 설정**
>
> **위임 메시지:**
> ```
> phase: 1
> slug: {slug}
> pipeline_type: feature
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   config: .crew/config.md
>   board: .crew/board.md
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
> 4. project-governance에게 스프린트 설정을 위임:
>    - 분해된 태스크를 board.md의 `## Backlog`에 추가
>    - 스프린트 계획 수립 (`/bams:sprint plan` 실행)
>    - `.crew/config.md`의 `last_task_id` 업데이트
>
> **기대 산출물**: 기능 명세, 기술 설계, 태스크 분해 결과, 스프린트 설정 완료

### 기획 → 구현 핸드오프

pipeline-orchestrator에게 Phase 전환 핸드오프를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 → Phase 2 핸드오프 실행**
>
> **위임 메시지:**
> ```
> phase: 1→2 handoff
> slug: {slug}
> pipeline_type: feature
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   board: .crew/board.md
> ```
>
> **수행할 작업:**
> 1. Phase 게이트 판단: Phase 1 완료 조건 검증 (PRD 승인, 기술 설계 완료, 태스크 분해 완료, 스프린트 설정 완료)
> 2. cross-department-coordinator에게 기획→구현 핸드오프 조율 위임:
>    - 기획부장의 산출물(PRD, 설계, 태스크)이 개발부장에게 올바르게 전달되는지 확인
>    - 부서 간 인터페이스(API 계약, 데이터 스키마) 정합성 확인
>    - 누락되거나 모호한 인터페이스 항목이 있으면 보고
> 3. executive-reporter에게 Phase 1 완료 상태 보고 요청
>
> **기대 산출물**: Phase 게이트 판단 결과 (GO/NO-GO/CONDITIONAL-GO), 핸드오프 체크리스트 결과

**Phase 게이트 결과가 NO-GO이면**: 미충족 항목을 사용자에게 보고하고, 해결 후 재시도합니다.

AskUserQuestion — "기획 완료. 구현을 진행할까요?"
- **진행 (Recommended)**
- **기획까지만** — `status: paused_at_step_2` 기록 후 종료.

Step 2 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 2 "done" {duration_ms}
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

## Phase 2: 구현 (개발부장 위임)

### Step 3. 멀티에이전트 개발

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 3 "멀티에이전트 개발" "Phase 2: 구현"
```

**컨텍스트 활용**: config.md의 기술스택 + design 문서의 파일 계획/인터페이스를 전달.
**Gotchas 경고**: Pre-flight에서 추출한 관련 gotchas를 개발 에이전트에 경고로 전달.

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
> pipeline_type: feature
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
> gotchas:
>   - {관련 gotchas 목록}
> ```
>
> 같은 배치의 파일 겹침이 없는 태스크는 **병렬로** 실행합니다.
> 각 부서장은 소속 에이전트에게 하위 작업을 분배하여 구현합니다.
>
> **기대 산출물**: 구현된 코드, 각 태스크별 완료 상태 보고

각 배치의 orchestrator 반환 후:
- 파일을 읽어 올바르게 생성/수정되었는지 확인
- board.md에서 해당 태스크를 `## In Review`로 이동
- git 저장소인 경우 `git diff --stat` 표시

### 구현 → 검증 핸드오프

pipeline-orchestrator에게 Phase 전환 핸드오프를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 2 → Phase 3 핸드오프 실행**
>
> **위임 메시지:**
> ```
> phase: 2→3 handoff
> slug: {slug}
> pipeline_type: feature
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   changed_files: [{구현에서 수정/생성된 파일 목록}]
>   board: .crew/board.md
> ```
>
> **수행할 작업:**
> 1. Phase 게이트 판단: Phase 2 완료 조건 검증 (빌드 성공, 타입 체크 통과, 린트 통과)
> 2. cross-department-coordinator에게 구현→검증 핸드오프 조율 위임:
>    - 개발부장의 산출물이 QA부장에게 올바르게 전달되는지 확인
>    - 검증 대상 파일 목록, 테스트 범위 확인
> 3. executive-reporter에게 Phase 2 완료 상태 보고 요청
>
> **기대 산출물**: Phase 게이트 판단 결과 (GO/NO-GO/CONDITIONAL-GO), 핸드오프 체크리스트 결과

**Phase 게이트 결과가 NO-GO이면**: 미충족 항목을 사용자에게 보고하고, 해결 후 재시도합니다.

AskUserQuestion — "구현 완료. 검증 단계로 진행?"
- **검증 진행 (Recommended)**
- **구현까지만** — `status: paused_at_step_3` 기록 후 종료.

Step 3 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 3 "done" {duration_ms}
```

---

## Phase 3: 검증 (다층 방어)

**bams-plugin 스킬 미설치 시**: Step 5, 6, 7을 일괄 `skipped (bams 스킬 미설치)` 처리 후 Step 8로.

**스킬 미설치 시 대체 행동**:
- **Step 5 (QA)**: AskUserQuestion — "수동 QA 체크리스트를 생성할까요? / Playwright 테스트 코드를 생성할까요? / 건너뛰기"
- **Step 6 (성능)**: AskUserQuestion — "Lighthouse CLI로 측정할까요? (`npx lighthouse <url> --output json`) / 건너뛰기"
- **Step 7 (보안)**: `/bams:review`에 보안 관점을 추가하여 코드 기반 보안 점검을 자동 수행합니다.
- **Step 9 (Ship)**: 수동 PR 생성 가이드 제공 — `git push` → `gh pr create` 명령어 안내
- **Step 11 (문서)**: CHANGELOG.md와 README.md 업데이트를 직접 수행합니다.

스킬 설치를 권장하는 메시지: "bams-plugin 스킬을 설치하면 이 단계를 자동화할 수 있습니다."

### Step 4. 5관점 코드 리뷰 (QA부장 위임)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 4 "5관점 코드 리뷰" "Phase 3: 검증"
```

이전 리뷰(24시간 이내, 이후 변경 없음) 있으면 `git diff HEAD`로 변경분만 리뷰.

**dev 리뷰 캐시**: `/bams:dev`에서 이미 리뷰 완료된 경우 `.crew/artifacts/review/[slug]-review.md`가 존재하고, 리뷰 이후 코드 변경이 없으면 (`git diff --stat [review-commit]..HEAD`가 비어있으면) **5관점 리뷰를 스킵**하고 기존 리뷰 결과를 재활용합니다. 변경이 있으면 변경분만 리뷰합니다.

리뷰 캐시가 없으면 pipeline-orchestrator에게 5관점 리뷰를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 3 검증 실행 — 5관점 코드 리뷰**
>
> **위임 메시지:**
> ```
> phase: 3
> slug: {slug}
> pipeline_type: feature
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   changed_files: [{수정/생성된 모든 파일 목록}]
>   config: .crew/config.md
> ```
>
> **수행할 작업:**
> qa-strategy(QA부장)에게 5관점 코드 리뷰를 위임합니다:
>
> ```
> task_description: "5관점 병렬 코드 리뷰를 실행하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - {변경된 파일 목록}
> expected_output:
>   type: review_report
>   paths: [.crew/artifacts/review/{slug}-review.md]
> quality_criteria:
>   - 5관점 모두 커버 (기능적 정확성, 보안, 성능, 코드 품질, 유지보수성)
>   - 심각도별 분류 (Critical/Major/Minor)
>   - 중복 제거
> gotchas:
>   - {관련 gotchas를 중점 확인 대상으로 전달}
> ```
>
> QA부장은 내부적으로 automation-qa 에이전트를 활용하여 5관점 리뷰를 병렬 실행합니다.
>
> **기대 산출물**: 5관점 리뷰 리포트

**Critical 이슈 발견 시:** 사용자에게 제시 후 수정+재리뷰 제안.

Step 4 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 4 "done" {duration_ms}
```

### Step 5-6-7. QA + 성능 + 보안 (QA부장 + 평가부장 병렬)

Bash로 다음을 동시에 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 5 "브라우저 QA" "Phase 3: 검증"
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 6 "성능 베이스라인" "Phase 3: 검증"
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 7 "보안 감사" "Phase 3: 검증"
```

pipeline-orchestrator에게 3개 검증을 병렬로 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 3 검증 실행 — QA + 성능 + 보안 병렬**
>
> **위임 메시지:**
> ```
> phase: 3
> slug: {slug}
> pipeline_type: feature
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   design: .crew/artifacts/design/{slug}-design.md
>   changed_files: [{수정/생성된 모든 파일 목록}]
>   config: .crew/config.md
>   review_report: .crew/artifacts/review/{slug}-review.md
> ```
>
> **수행할 작업 (2개 부서장 병렬 위임):**
>
> **1. qa-strategy(QA부장)에게 브라우저 QA + 보안 감사 위임:**
>
> Step 5 — 브라우저 QA:
> ```
> task_description: "브라우저 기반 QA 테스트를 실행하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - {config.md의 URL 정보}
> expected_output:
>   type: qa_report
>   paths: [.crew/artifacts/qa/{slug}-qa.md]
> quality_criteria:
>   - 핵심 유저 플로우 검증
>   - 스크린샷 포함
> ```
> URL 있으면 `_QA_SKILL` 실행. URL은 config.md에서 확인하거나 AskUserQuestion.
>
> Step 7 — 보안 감사:
> ```
> task_description: "보안 감사를 실행하라"
> input_artifacts:
>   - {변경된 파일 목록}
> expected_output:
>   type: security_report
>   paths: [.crew/artifacts/security/{slug}-security.md]
> quality_criteria:
>   - OWASP Top 10 체크
>   - 시크릿 노출 확인
> ```
> `git diff --name-only` 기반으로 보안 관련 파일(인증, 암호화, .env, 의존성 등) 변경 여부 확인.
> 변경 없으면 건너뜀. 변경 있거나 이전 감사 없으면 `_CSO_SKILL` 실행 (일일 모드).
>
> **2. product-analytics(평가부장)에게 성능 베이스라인 위임:**
>
> Step 6 — 성능 베이스라인:
> ```
> task_description: "성능 베이스라인을 측정하라"
> input_artifacts:
>   - {config.md의 URL 정보}
> expected_output:
>   type: performance_report
>   paths: [.crew/artifacts/performance/{slug}-performance.md]
> quality_criteria:
>   - Core Web Vitals 측정
>   - 이전 베이스라인 대비 비교 (있는 경우)
> ```
> `performance-*.md` 중 `mode: baseline`, `status: completed` 파일 확인.
> 없으면 `_BENCHMARK_SKILL`로 `--baseline` 캡처, 있으면 비교 모드.
>
> **기대 산출물**: QA 리포트, 성능 리포트, 보안 리포트

3개 결과를 모두 수집한 후, 각 Step의 완료 이벤트를 Bash로 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 5 "{status}" {duration_ms}
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 6 "{status}" {duration_ms}
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 7 "{status}" {duration_ms}
```
(`{status}`는 각 Step의 결과에 따라 `done` 또는 `skipped`)

### Step 8. CI/CD 프리플라이트 (platform-devops 위임)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 8 "CI/CD 프리플라이트" "Phase 3: 검증"
```

### 검증 → 배포 핸드오프

pipeline-orchestrator에게 Phase 전환 핸드오프를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 3 CI/CD + Phase 3 → Phase 4 핸드오프 실행**
>
> **위임 메시지:**
> ```
> phase: 3→4 handoff
> slug: {slug}
> pipeline_type: feature
> context:
>   prd: .crew/artifacts/prd/{slug}-prd.md
>   review_report: .crew/artifacts/review/{slug}-review.md
>   qa_report: .crew/artifacts/qa/{slug}-qa.md
>   performance_report: .crew/artifacts/performance/{slug}-performance.md
>   security_report: .crew/artifacts/security/{slug}-security.md
>   config: .crew/config.md
> ```
>
> **수행할 작업:**
> 1. platform-devops에게 CI/CD 프리플라이트를 위임 (`/bams:verify` 실행):
>    - 빌드, 린트, 타입체크, 테스트 실행
>    - FAIL 시 자동 수정 (최대 2회) / 수동 / 무시 선택
> 2. Phase 게이트 판단: Phase 3 완료 조건 검증 (테스트 전체 통과, QA 리포트 생성, 성능 기준 충족, 코드 리뷰 승인, 보안 스캔 통과)
> 3. cross-department-coordinator에게 검증→배포 핸드오프 조율 위임
> 4. executive-reporter에게 Phase 3 완료 상태 보고 요청
>
> **기대 산출물**: CI/CD 결과, Phase 게이트 판단 결과 (GO/NO-GO/CONDITIONAL-GO)

**Phase 게이트 결과가 NO-GO이면**: 미충족 항목을 사용자에게 보고하고, 해결 후 재시도합니다.

AskUserQuestion — "모든 검증 완료. Ship 할까요?"
- **Ship (Recommended)**
- **검증까지만** — `status: paused_at_step_8` 기록 후 종료.

Step 8 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 8 "done" {duration_ms}
```

---

## Phase 4: 배포

**스킬 미설치 시**: Step 9 `skipped` (수동 PR 생성 안내) → Phase 5로.

### Step 9. Ship (executive-reporter 보고 + bams ship 스킬)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 9 "Ship" "Phase 4: 배포"
```

pipeline-orchestrator에게 Ship을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 4 배포 실행 — Ship**
>
> **위임 메시지:**
> ```
> phase: 4
> slug: {slug}
> pipeline_type: feature
> context:
>   all_artifacts: .crew/artifacts/
>   config: .crew/config.md
> ```
>
> **수행할 작업:**
> 1. executive-reporter에게 배포 전 상태 보고 요청:
>    - 전체 Phase 진행 상황 요약
>    - 잔여 리스크 항목 정리
>    - Ship 준비 상태 판단
>
> 2. `_SHIP_SKILL` 실행: 베이스 머지 → 테스트 → 리뷰 → 버전범프 → CHANGELOG → PR 생성
>
> **기대 산출물**: PR 번호, Ship 결과 보고

AskUserQuestion — "PR 생성됨. 즉시 배포?"
- **나중에 (Recommended)**
- **배포** — Step 10 실행.

Step 9 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 9 "{status}" {duration_ms}
```

### Step 10. Land & Deploy (선택)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 10 "Land & Deploy" "Phase 4: 배포"
```

배포 전 체크리스트 확인: (1) PR 머지 완료, (2) CI 통과, (3) Step 4-8 검증 통과.
모두 통과 시 `_DEPLOY_SKILL` 실행.

Step 10 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 10 "{status}" {duration_ms}
```

---

## Phase 5: 마무리

### Step 11. 문서 갱신 (기획부장 위임) — Ship 직후 시작

**최적화**: 문서 갱신은 Deploy(Step 10)와 독립적이므로, **Step 9(Ship) 완료 직후 백그라운드로 시작**합니다.
Step 10(Deploy) 선택 시 문서 갱신과 배포가 병렬로 진행됩니다.

**스킬 미설치 시**: Step 11 `skipped`.

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 11 "문서 갱신" "Phase 5: 마무리"
```

pipeline-orchestrator에게 문서 갱신을 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 5 마무리 실행 — 문서 갱신**
>
> **위임 메시지:**
> ```
> phase: 5
> slug: {slug}
> pipeline_type: feature
> context:
>   all_artifacts: .crew/artifacts/
>   config: .crew/config.md
> ```
>
> **수행할 작업:**
> product-strategy(기획부장)에게 문서 갱신을 위임합니다:
>
> ```
> task_description: "Ship된 피처에 맞춰 프로젝트 문서를 갱신하라"
> input_artifacts:
>   - .crew/artifacts/prd/{slug}-prd.md
>   - .crew/artifacts/design/{slug}-design.md
> expected_output:
>   type: documentation_update
>   paths: [README.md, CHANGELOG.md, ARCHITECTURE.md]
> quality_criteria:
>   - README.md 피처 반영
>   - CHANGELOG.md 엔트리 추가
>   - 아키텍처 문서 변경 반영 (해당 시)
> ```
>
> 기획부장은 `_DOCRELEASE_SKILL`을 활용하여 문서를 갱신합니다.
>
> **기대 산출물**: 갱신된 문서 파일 목록

Step 11 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 11 "{status}" {duration_ms}
```

### Step 12. 스프린트 종료 (project-governance 위임)

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 12 "스프린트 종료" "Phase 5: 마무리"
```

pipeline-orchestrator에게 스프린트 종료를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 5 마무리 실행 — 스프린트 종료**
>
> **위임 메시지:**
> ```
> phase: 5
> slug: {slug}
> pipeline_type: feature
> context:
>   board: .crew/board.md
>   config: .crew/config.md
> ```
>
> **수행할 작업:**
> project-governance에게 스프린트 종료를 위임합니다:
>
> ```
> task_description: "이 피처의 스프린트를 종료하라"
> input_artifacts:
>   - .crew/board.md
> expected_output:
>   type: sprint_closure
>   paths: [.crew/board.md]
> quality_criteria:
>   - 모든 태스크가 Done으로 이동
>   - 스프린트 통계 기록
> ```
>
> `.crew/board.md`에서 이 feature의 모든 태스크 완료 시 `/bams:sprint close` 제안.
>
> **기대 산출물**: 스프린트 종료 결과, 업데이트된 board.md

Step 12 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 12 "done" {duration_ms}
```

### Step 13. 자동 강제 회고 (executive-reporter + 부서장들)

**이 단계는 건너뛸 수 없습니다. 자동으로 강제 실행됩니다.**

Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 13 "자동 강제 회고" "Phase 5: 마무리"
```

pipeline-orchestrator에게 회고를 지시합니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 5 자동 강제 회고 실행**
>
> retro-protocol.md에 따라 파이프라인 회고를 **반드시** 실행합니다. 이 단계는 스킵할 수 없습니다.
>
> **위임 메시지:**
> ```
> phase: 5-retro
> slug: {slug}
> pipeline_type: feature
> context:
>   all_artifacts: .crew/artifacts/
>   board: .crew/board.md
>   history: .crew/history.md
>   review_report: .crew/artifacts/review/{slug}-review.md
>   evaluation_report: .crew/artifacts/evaluation/{slug}-eval.md
>   qa_report: .crew/artifacts/qa/{slug}-qa.md
>   performance_report: .crew/artifacts/performance/{slug}-performance.md
>   security_report: .crew/artifacts/security/{slug}-security.md
> ```
>
> **수행할 작업 (retro-protocol.md 절차):**
> 1. executive-reporter에게 정량 데이터 수집 요청:
>    - 총 소요 시간, Phase별 소요 시간
>    - Step 성공률, 재시도 횟수
>    - 에이전트별 호출 통계
>    - 품질 지표 요약 (리뷰 Critical/Major/Minor 건수, QA 결과, 성능 수치, 보안 스캔 결과)
>    - 이전 3회 feature 파이프라인 대비 트렌드
>
> 2. 각 부서장에게 KPT 항목 제출 요청: Keep(유지), Problem(문제), Try(시도).
>    이 파이프라인에 참여한 부서장만 대상:
>    - 기획부장 (Phase 1 참여)
>    - 개발부장 (Phase 2 참여)
>    - QA부장 (Phase 3 참여)
>    - 평가부장 (Phase 3 참여, 해당 시)
>
> 3. 합의 도출:
>    - 수집된 KPT를 종합하여 Problem 우선순위 정렬
>    - 액션 아이템 확정
>    - 교차 검증
>
> 4. 피드백 반영:
>    - 에이전트 교훈 저장
>    - gotchas 승격 검사
>    - Pipeline Learnings 갱신
>    - 프로세스 개선 제안
>
> 5. 보드 및 히스토리 업데이트:
>    - 완료된 모든 태스크를 board.md의 `## Done`으로 이동
>    - `.crew/history.md`에 타임스탬프와 함께 추가
>    - board.md의 `> Last updated:` 업데이트
>
> 6. 회고 결과를 tracking 파일에 기록
>
> **기대 산출물**: 회고 결과 (KPT 요약, 액션 아이템, 피드백 반영 내역), 업데이트된 board.md/history.md

Step 13 완료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 13 "done" {duration_ms}
```

---

## Phase 5.5: CLAUDE.md 상태 업데이트

`CLAUDE.md`의 `## Bams 현재 상태` 섹션을 업데이트합니다 (없으면 파일 끝에 추가, 있으면 Edit으로 교체). `.crew/board.md`를 읽어 다음을 포함:
- 마지막 업데이트 타임스탬프
- 진행 중인 작업
- 활성 스프린트 정보
- 이번 실행에서 생성된 아티팩트 경로
- 다음에 실행 가능한 태스크/명령 제안

---

## 롤백 시스템

### 롤백 포인트 기록
각 Phase 완료 시 tracking 파일에 롤백 정보를 자동 기록합니다:
- **Phase 2 완료**: `commit_before` (구현 시작 전 커밋 해시), `branch`, `files_created`
- **Phase 4 완료**: `pr_number`, `version_bump` (있는 경우)

### 롤백 실행
AskUserQuestion에서 "롤백" 선택 시:
1. **Phase 4 롤백**: PR 닫기 → 버전 범프 리버트 → CHANGELOG 리버트
2. **Phase 2 롤백**: `git reset --soft {commit_before}` → 변경사항 스태시 저장
3. 트래킹 파일에 `status: rolled_back` 기록

---

## 마무리

### 최종 요약 제시

피처명, 생성/수정 파일 목록, 테스트 파일 목록, 리뷰 이슈 요약, QA 결과, 성능 수치, 보안 스캔 결과, 성과 지표, 회고 KPT 요약, 아티팩트 경로, 완료 태스크 수, PR 번호 (있는 경우).

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 13)

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `pattern:` — 새로 도입한 패턴/라이브러리
2. `convention:` — 리뷰(Step 4)에서 발견된 코드 컨벤션
3. `vulnerable:` — 보안 감사(Step 7)/리뷰에서 반복 지적된 영역
4. `perf-baseline:` — 벤치마크(Step 6) 수치
5. `deploy:` — Ship/Deploy 결과 요약
