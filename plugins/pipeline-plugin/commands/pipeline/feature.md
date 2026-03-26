---
description: 풀 피처 개발 사이클 — 기획 → 구현 → 검증 → 배포 → 마무리
argument-hint: <기능 설명 또는 기존 slug>
---

# Pipeline: Feature

피처의 전체 생명주기를 관리합니다. 6개 Phase, 최대 13단계. 각 Phase 전환점에서 사용자 확인을 받습니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

추가 항목 (배치 B에서 병렬 스캔):
- **`.crew/artifacts/prd/`** — 기존 PRD 확인. 인자가 기존 slug와 일치하면 해당 PRD 로딩.
- **`.crew/artifacts/design/`** — 기존 기술설계 문서 확인.

진행 추적 파일: `templates/feature-tracking.md` 기반으로 생성.

---

## Phase 1: 기획

### Step 1: PRD + 기술설계 + 태스크 분해

**컨텍스트 확인**: `.crew/artifacts/prd/[slug]-prd.md` 존재 시 건너뜁니다.
`.crew/artifacts/design/[slug]-design.md` 존재 시 설계도 완료로 간주.

둘 다 없으면 `/crew:plan` 스킬을 인자와 함께 실행합니다.
PM(Opus) PRD → Architect 2명(Sonnet) 병렬 분석 → 태스크 분해.

### Step 2: 스프린트 설정

`.crew/board.md`에서 이 slug의 태스크가 이미 활성 스프린트에 있으면 건너뜁니다.

AskUserQuestion — "기획 완료. 스프린트를 시작하고 구현 진행?"
- **시작 (Recommended)**
- **기획까지만** — `status: paused_at_step_2` 기록 후 종료.

**시작 시**: `/crew:sprint plan` 실행.

---

## Phase 2: 구현

### Step 3: 멀티에이전트 개발

**컨텍스트 활용**: config.md의 기술스택 + design 문서의 파일 계획/인터페이스를 `/crew:dev`에 전달.
**Gotchas 경고**: Pre-flight에서 추출한 관련 gotchas를 dev 에이전트에 경고로 전달.

`/crew:dev` 스킬을 slug와 함께 실행합니다.

AskUserQuestion — "구현 완료. 검증 단계로 진행?"
- **검증 진행 (Recommended)**
- **구현까지만** — `status: paused_at_step_3` 기록 후 종료.

---

## Phase 3: 검증 (다층 방어)

**GSTACK_NOT_AVAILABLE 시**: Step 5, 6, 7을 일괄 `skipped (GSTACK_NOT_AVAILABLE)` 처리 후 Step 8로.

**GSTACK_NOT_AVAILABLE 시 대체 행동**:
- **Step 5 (QA)**: AskUserQuestion — "수동 QA 체크리스트를 생성할까요? / Playwright 테스트 코드를 생성할까요? / 건너뛰기"
- **Step 6 (성능)**: AskUserQuestion — "Lighthouse CLI로 측정할까요? (`npx lighthouse <url> --output json`) / 건너뛰기"
- **Step 7 (보안)**: `/crew:review`에 보안 관점을 추가하여 코드 기반 보안 점검을 자동 수행합니다.
- **Step 9 (Ship)**: 수동 PR 생성 가이드 제공 — `git push` → `gh pr create` 명령어 안내
- **Step 11 (문서)**: CHANGELOG.md와 README.md 업데이트를 직접 수행합니다.

gstack 설치를 권장하는 메시지: "gstack-plugin을 설치하면 이 단계를 자동화할 수 있습니다: `/plugin install gstack-plugin@ezar-plugins`"

### Step 4: Crew 5관점 코드 리뷰

이전 리뷰(24시간 이내, 이후 변경 없음) 있으면 `git diff HEAD`로 변경분만 리뷰.
**Gotchas 경고**: 관련 gotchas를 review 에이전트에 중점 확인 대상으로 전달.

`/crew:review` 실행. Critical 이슈 시 수정+재리뷰 제안.

### Step 5: 브라우저 QA (gstack)

URL 있으면 `/qa-only <url>` 실행. URL은 config.md에서 확인하거나 AskUserQuestion.

### Step 6: 성능 베이스라인 (gstack)

`performance-*.md` 중 `mode: baseline`, `status: completed` 파일 확인.
없으면 `/benchmark <url> --baseline`, 있으면 `/benchmark <url>` 비교 모드.

### Step 7: 보안 감사 (gstack)

7일 이내 `security-*.md`(`status: completed`) 있고 보안 관련 파일 변경 없으면 건너뜀.
없으면 `/cso` 실행 (일일 모드).

### Step 8: CI/CD 프리플라이트

`/crew:verify` 실행. FAIL 시 자동 수정(최대 2회) / 수동 / 무시 선택.

AskUserQuestion — "모든 검증 완료. Ship 할까요?"
- **Ship (Recommended)**
- **검증까지만** — `status: paused_at_step_8` 기록 후 종료.

---

## Phase 4: 배포

**GSTACK_NOT_AVAILABLE 시**: Step 9 `skipped` (수동 PR 생성 안내) → Phase 5로.

### Step 9: Ship (gstack)

`/ship` 실행. 베이스 머지 → 테스트 → 리뷰 → 버전범프 → CHANGELOG → PR 생성.

AskUserQuestion — "PR 생성됨. 즉시 배포?"
- **나중에 (Recommended)**
- **배포** — Step 10 실행.

### Step 10: Land & Deploy (gstack, 선택)

배포 전 체크리스트 확인: (1) PR 머지 완료, (2) CI 통과, (3) Step 4-8 검증 통과.
모두 통과 시 `/land-and-deploy` 실행.

---

## Phase 5: 마무리

**GSTACK_NOT_AVAILABLE 시**: Step 11 `skipped`.

### Step 11: 문서 갱신 (gstack)

`/document-release` 실행.

### Step 12: 스프린트 종료

`.crew/board.md`에서 이 feature의 모든 태스크 완료 시 `/crew:sprint close` 제안.

### Step 13: 회고 (gstack, 선택)

AskUserQuestion — "회고 진행?"
- **건너뛰기 (Recommended)** — "/pipeline:weekly에서 한꺼번에"
- **진행** — "/retro 실행"

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

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `pattern:` — 새로 도입한 패턴/라이브러리
2. `convention:` — 리뷰(Step 4)에서 발견된 코드 컨벤션
3. `vulnerable:` — 보안 감사(Step 7)/리뷰에서 반복 지적된 영역
4. `perf-baseline:` — 벤치마크(Step 6) 수치
5. `deploy:` — Ship/Deploy 결과 요약
