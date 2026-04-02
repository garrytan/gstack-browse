---
description: 멀티에이전트 풀 개발 파이프라인 (기획 -> 구현 -> 테스트 -> 리뷰 -> QG)
argument-hint: <피처 설명 또는 태스크 ID>
---

# Bams Dev

Bams 오케스트레이터로서 완전한 개발 파이프라인을 실행합니다: 기획 -> 구현 -> 테스트 -> 리뷰 -> 품질 게이트.

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

### Viz 이벤트: pipeline_start

사전 조건 확인 후, Bash로 다음을 실행합니다:

```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_start "{slug}" "dev" "/bams:dev" "{arguments}"
```

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
- **아티팩트가 없으면** -> Phase 1 (기획)으로 진행

## Phase 1: 기획 (기존 계획이 없는 경우만)

### 1a. product-strategy 에이전트 (PRD)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 1 "PRD 작성" "Phase 1: 기획"
```

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:product-strategy"**, model: **"opus"**):

> **PRD 작성 모드**로 이 피처 요청을 분석합니다.
>
> **피처**: [$ARGUMENTS 삽입]
> **프로젝트 컨텍스트**: [.crew/config.md 내용 삽입]
>
> Glob과 Read를 사용하여 코드베이스를 파악한 후 PRD를 작성합니다.

**미결 질문이 있으면** 사용자에게 제시하고 답변을 기다립니다.

Step 1a 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 1 "done" {duration_ms}
```

### 1b. 기술 설계 (3개 병렬)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 2 "기술 설계 (3개 병렬)" "Phase 1: 기획"
```

**3개 서브에이전트를 동시에 실행:**

**business-analysis 에이전트 (opus):**
서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:business-analysis"**, model: **"opus"**):
> **기능 명세 작성 모드**: PRD 기반 상세 동작 명세 작성.
> 요구사항: [1a의 PRD]

**frontend-engineering 에이전트 (sonnet):**
서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:frontend-engineering"**, model: **"sonnet"**):
> **코드베이스 분석 + 프론트엔드 설계 모드**: 피처 구현을 위한 UI 설계.
> 요구사항: [1a의 PRD], 프로젝트 컨텍스트: [.crew/config.md]

**backend-engineering 에이전트 (sonnet):**
서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:backend-engineering"**, model: **"sonnet"**):
> **코드베이스 분석 + 백엔드 설계 모드**: 피처 구현을 위한 API/로직 설계.
> 요구사항: [1a의 PRD], 프로젝트 컨텍스트: [.crew/config.md]

Step 1b 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 2 "done" {duration_ms}
```

### 1c. 태스크 분해

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 3 "태스크 분해" "Phase 1: 기획"
```

3개 결과를 종합하여 태스크 생성 (명확한 범위, 역할 할당, 우선순위, 의존성, 인수 기준).

Step 1c 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 3 "done" {duration_ms}
```

### 1d. 아티팩트 저장

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 4 "아티팩트 저장" "Phase 1: 기획"
```

1. PRD를 `.crew/artifacts/prd/[slug]-prd.md`에 저장
2. 설계를 `.crew/artifacts/design/[slug]-design.md`에 저장
3. 태스크를 `.crew/board.md`의 `## Backlog`에 추가
4. `.crew/config.md`의 `last_task_id` 업데이트

사용자에게 계획 요약을 제시합니다. 질문: "구현을 진행할까요?"
사용자가 아니라고 하면, 여기서 중단합니다.

Step 1d 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 4 "done" {duration_ms}
```

## Phase 1.5: Git 체크포인트

**AskUserQuestion**으로 체크포인트 방식을 선택받습니다:

Question: "구현 시작 전 코드를 어떻게 보존할까요?"
Header: "Git"
Options:
- **Feature branch** - "새 브랜치를 생성하여 작업 (예: bams/[slug])"
- **Stash** - "현재 변경사항을 stash하고 현재 브랜치에서 작업"
- **스킵** - "체크포인트 없이 바로 진행"

## Phase 2: 구현

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 5 "멀티에이전트 구현" "Phase 2: 구현"
```

board.md에서 태스크 목록을 의존성 순서로 정렬합니다. 배치로 그룹화:
- **배치 1**: 의존성 없는 태스크
- **배치 2**: 의존성이 모두 배치 1에 있는 태스크
- **배치 N**: 모든 태스크가 스케줄될 때까지 계속

각 배치의 Developer 태스크를 처리합니다:

### frontend-engineering / backend-engineering 태스크:

태스크의 파일 범위에 따라 적절한 에이전트를 선택합니다:
- UI/컴포넌트/스타일 관련 -> frontend-engineering
- API/DB/비즈니스 로직 관련 -> backend-engineering
- 겹치는 경우 -> 파일 기준으로 분리하여 병렬 실행

같은 배치의 여러 태스크가 파일 겹침이 없으면 **병렬로** 실행합니다.

**frontend-engineering 에이전트** (Task tool, subagent_type: **"bams-plugin:frontend-engineering"**, model: **"opus"**):
> **구현 모드**로 이 태스크를 구현합니다.
> **태스크**: [제목과 설명]
> **생성/수정할 파일**: [태스크에서]
> **기술 설계**: [설계 문서의 관련 섹션]
> **코드베이스 컨벤션**: [CLAUDE.md와 .crew/config.md에서]
> **인수 기준**: [태스크에서]

**backend-engineering 에이전트** (Task tool, subagent_type: **"bams-plugin:backend-engineering"**, model: **"opus"**):
> **구현 모드**로 이 태스크를 구현합니다.
> (동일한 컨텍스트 전달)

각 에이전트 반환 후:
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
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 5 "done" {duration_ms}
```

## Phase 2.5: 테스트 코드 생성 (구현과 오버랩)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 6 "테스트 코드 생성" "Phase 2.5: 테스트"
```

**최적화**: 테스트 작성은 모든 배치 완료를 기다리지 않고, **배치 단위로 오버랩**합니다.

### Step 1: 테스트 작성 여부 묻기 (Phase 2 첫 배치 시작 전)

**AskUserQuestion**:
Question: "구현과 병렬로 테스트 코드를 작성할까요?"
Header: "Tests"
Options:
- **Yes** - "각 배치 완료 즉시 테스트 작성 (구현과 병렬)"
- **나중에** - "모든 구현 완료 후 일괄 작성"
- **Skip** - "이번에는 테스트 스킵"

### Step 2: 배치별 오버랩 실행

**Yes 선택 시**: 각 배치 N의 구현이 완료되면:
1. 배치 N의 수정/생성 파일에 대해 기존 테스트 파일 검색
2. 테스트 커버리지가 없는 파일에 대해 **automation-qa 에이전트를 백그라운드로 실행**
3. 동시에 배치 N+1의 구현을 시작

즉, `배치 N 테스트 작성 ∥ 배치 N+1 구현`이 병렬로 진행됩니다.

**나중에 선택 시**: 기존 방식대로 모든 구현 완료 후 일괄 실행.

### Step 3: automation-qa 에이전트로 테스트 작성

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:automation-qa"**, model: **"sonnet"**):

> **테스트 작성 모드**로 최근 구현된 코드에 대한 테스트를 작성합니다.
>
> **테스트할 파일**: [테스트 커버리지가 없는 파일 목록]
> **테스트 위치**: [test_dir 설정]
> **요구사항**: [PRD에서]
> **테스트 패턴**: [코드베이스 컨벤션에서 감지]
> **인수 기준**: [태스크에서]

테스트 계획을 `.crew/artifacts/test/[slug]-tests.md`에 저장.
테스트 러너가 있으면 실행하여 결과 보고.

Phase 2.5 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 6 "{status}" {duration_ms}
```

## Phase 3: 리뷰

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 7 "3관점 리뷰" "Phase 3: 리뷰"
```

모든 구현 태스크 완료 후, **3개 qa-strategy 에이전트를 병렬로 실행** (Task tool, subagent_type: **"bams-plugin:qa-strategy"**, model: **"sonnet"**):

### qa-strategy 1 - 정확성:

> **관점: 정확성** -- 기능적 정확성 중심으로 리뷰합니다.
> **변경된 파일**: [수정/생성된 모든 파일 목록]
> **요구사항**: [PRD에서]
> **프로젝트 가이드라인**: [CLAUDE.md 참조]

### qa-strategy 2 - 보안 및 성능:

> **관점: 보안 + 성능** -- 보안 취약점과 성능 이슈를 점검합니다.
> **변경된 파일**: [목록]

### qa-strategy 3 - 코드 품질:

> **관점: 코드 품질** -- 유지보수성과 코드 표준 관점에서 리뷰합니다.
> **변경된 파일**: [목록]
> **프로젝트 컨벤션**: [CLAUDE.md와 .crew/config.md에서]

### 리뷰 결과 처리

1. 모든 발견 사항 수집, 중복 제거, 심각도 순 정렬
2. 리뷰 리포트를 `.crew/artifacts/review/[slug]-review.md`에 저장

**Critical 이슈 발견 시:** 사용자에게 제시 후 Edit 도구로 수정 적용.
**Major 이슈 발견 시:** 사용자에게 제시 후 수정 여부 확인.

Phase 3 리뷰 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 7 "done" {duration_ms}
```

## Phase 3.5: Quality Gate (최대 3회 반복, 델타 기반)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 8 "Quality Gate" "Phase 3.5: QG"
```

리뷰 완료 후, project-governance 에이전트가 최종 품질을 검증합니다.

현재 반복 횟수를 `iteration = 1`로 초기화합니다.
`qg_baseline_commit`을 현재 HEAD 커밋 해시로 기록합니다.

### Quality Gate 루프

**iteration 1 (최초)**: 전체 구현 파일 검증.
**iteration 2-3 (반복)**: `git diff --name-only {qg_baseline_commit}..HEAD`로 **변경된 파일만** 검증 대상으로 전달. 이전 QG에서 PASS된 파일은 재검증하지 않습니다.

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:project-governance"**, model: **"opus"**):

> **Quality Gate 모드**로 구현 결과물의 최종 품질을 검증합니다.
>
> **PRD (인수 기준)**: [PRD 전문 삽입]
> **기술 설계**: [설계 문서 요약]
> **검증 대상 파일**: [iteration 1이면 전체 파일 목록, iteration 2-3이면 변경된 파일만]
> **이전 QG 결과**: [iteration 2-3이면 이전 QG의 PASS/FAIL 파일별 상세]
> **리뷰 리포트**: [리뷰 결과 전문]
> **테스트 결과**: [있으면 삽입]
> **현재 반복**: [iteration]/3
>
> 검증 대상 파일들을 직접 Read 도구로 읽어서 검증합니다.

**PASS인 경우:** board.md에서 태스크를 `## Done`으로 이동. Phase 4로 진행.

**FAIL인 경우 (iteration <= 3):**
- `qg_baseline_commit`을 현재 HEAD로 업데이트
- 재개발 필요 시: frontend-engineering/backend-engineering 에이전트 재실행
- 재리뷰 필요 시: qa-strategy 에이전트 재실행
- 완료 후 Quality Gate 루프 재시작 (변경된 파일만 재검증)

**iteration > 3:** 사용자에게 수동 확인 안내. Phase 4로 진행.

Quality Gate 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 8 "{status}" {duration_ms}
```

## Phase 4: 마무리

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 9 "마무리" "Phase 4: 마무리"
```

### README.md 동기화

README.md에 영향을 줄 수 있는 변경이 있는지 판단하고 필요 시 업데이트.

### 보드 및 히스토리 업데이트

1. 완료된 모든 태스크를 board.md의 `## Done`으로 이동
2. `.crew/history.md`에 타임스탬프와 함께 추가
3. board.md의 `> Last updated:` 업데이트

최종 요약 제시: 피처명, 생성/수정 파일 목록, 테스트 파일 목록, 리뷰 이슈 요약, QG 결과, 아티팩트 경로, 완료 태스크 수.

Step 9 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 9 "done" {duration_ms}
```

## Phase 5: CLAUDE.md 상태 업데이트

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 10 "CLAUDE.md 상태 업데이트" "Phase 5: 상태 업데이트"
```

`CLAUDE.md`의 `## Bams 현재 상태` 섹션을 업데이트합니다 (없으면 파일 끝에 추가, 있으면 Edit으로 교체). `.crew/board.md`를 읽어 다음을 포함:
- 마지막 업데이트 타임스탬프
- 진행 중인 작업
- 활성 스프린트 정보
- 이번 실행에서 생성된 아티팩트 경로
- 다음에 실행 가능한 태스크/명령 제안

Step 10 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 10 "done" {duration_ms}
```

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 10)
