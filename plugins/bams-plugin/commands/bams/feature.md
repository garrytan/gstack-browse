---
description: 풀 피처 개발 사이클 — 기획 → 구현 → 검증 → 배포 → 마무리
argument-hint: <기능 설명 또는 기존 slug>
---

# Bams: Feature

피처의 전체 생명주기를 관리합니다. 6개 Phase, 최대 13단계. 각 Phase 전환점에서 사용자 확인을 받습니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

bams-plugin 감지:

```bash
_BAMS_CHECK=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/browse/SKILL.md" 2>/dev/null | head -1)
```

`_BAMS_CHECK`가 비어있으면 bams-plugin 스킬 미설치로 판단. 해당 단계를 대체 행동으로 처리합니다.

추가 항목 (배치 B에서 병렬 스캔):
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

진행 추적 파일: `templates/feature-tracking.md` 기반으로 생성.

### Viz 이벤트: pipeline_start

진행 추적 파일 및 lock 파일 생성 직후, Bash로 다음을 실행합니다:

```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_start "{slug}" "feature" "/bams:feature" "{arguments}"
```

---

## Phase 1: 기획

### Step 1: PRD + 기술설계 + 태스크 분해

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 1 "PRD + 기술설계 + 태스크 분해" "Phase 1: 기획"
```

**컨텍스트 확인**: `.crew/artifacts/prd/[slug]-prd.md` 존재 시 건너뜁니다.
`.crew/artifacts/design/[slug]-design.md` 존재 시 설계도 완료로 간주.

둘 다 없으면 `/bams:plan` 스킬을 인자와 함께 실행합니다.
PM(Opus) PRD → Architect 2명(Sonnet) 병렬 분석 → 태스크 분해.

Step 1 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 1 "done" {duration_ms}
```

### Step 2: 스프린트 설정

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 2 "스프린트 설정" "Phase 1: 기획"
```

`.crew/board.md`에서 이 slug의 태스크가 이미 활성 스프린트에 있으면 건너뜁니다.

AskUserQuestion — "기획 완료. 스프린트를 시작하고 구현 진행?"
- **시작 (Recommended)**
- **기획까지만** — `status: paused_at_step_2` 기록 후 종료.

**시작 시**: `/bams:sprint plan` 실행.

Step 2 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 2 "done" {duration_ms}
```

---

## Phase 2: 구현

### Step 3: 멀티에이전트 개발

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 3 "멀티에이전트 개발" "Phase 2: 구현"
```

**컨텍스트 활용**: config.md의 기술스택 + design 문서의 파일 계획/인터페이스를 `/bams:dev`에 전달.
**Gotchas 경고**: Pre-flight에서 추출한 관련 gotchas를 dev 에이전트에 경고로 전달.

`/bams:dev` 스킬을 slug와 함께 실행합니다.

AskUserQuestion — "구현 완료. 검증 단계로 진행?"
- **검증 진행 (Recommended)**
- **구현까지만** — `status: paused_at_step_3` 기록 후 종료.

Step 3 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 3 "done" {duration_ms}
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

### Step 4: Crew 5관점 코드 리뷰

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 4 "Crew 5관점 코드 리뷰" "Phase 3: 검증"
```

이전 리뷰(24시간 이내, 이후 변경 없음) 있으면 `git diff HEAD`로 변경분만 리뷰.
**Gotchas 경고**: 관련 gotchas를 review 에이전트에 중점 확인 대상으로 전달.

**dev 리뷰 캐시**: `/bams:dev`에서 이미 리뷰 완료된 경우 `.crew/artifacts/review/[slug]-review.md`가 존재하고, 리뷰 이후 코드 변경이 없으면 (`git diff --stat [review-commit]..HEAD`가 비어있으면) **5관점 리뷰를 스킵**하고 기존 리뷰 결과를 재활용합니다. 변경이 있으면 변경분만 리뷰합니다.

리뷰 캐시가 없으면 `/bams:review` 실행. Critical 이슈 시 수정+재리뷰 제안.

Step 4 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 4 "done" {duration_ms}
```

### Step 5-6-7: 브라우저 QA + 성능 + 보안 (병렬 실행)

Bash로 다음을 동시에 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 5 "브라우저 QA" "Phase 3: 검증"
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 6 "성능 베이스라인" "Phase 3: 검증"
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 7 "보안 감사" "Phase 3: 검증"
```

**Step 5, 6, 7은 서로 독립적이므로 동시에 실행합니다:**

**Step 5 — 브라우저 QA** (bams browse 스킬):
URL 있으면 `_QA_SKILL` 실행. URL은 config.md에서 확인하거나 AskUserQuestion.

**Step 6 — 성능 베이스라인** (bams benchmark 스킬):
`performance-*.md` 중 `mode: baseline`, `status: completed` 파일 확인.
없으면 `_BENCHMARK_SKILL`로 `--baseline` 캡처, 있으면 비교 모드.

**Step 7 — 보안 감사** (bams cso 스킬):
`git diff --name-only` 기반으로 보안 관련 파일(인증, 암호화, .env, 의존성 등) 변경 여부 확인.
변경 없으면 건너뜀. 변경 있거나 이전 감사 없으면 `_CSO_SKILL` 실행 (일일 모드).

3개 결과를 모두 수집한 후, 각 Step의 완료 이벤트를 Bash로 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 5 "{status}" {duration_ms}
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 6 "{status}" {duration_ms}
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 7 "{status}" {duration_ms}
```
(`{status}`는 각 Step의 결과에 따라 `done` 또는 `skipped`)

다음 단계로 진행합니다.

### Step 8: CI/CD 프리플라이트

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 8 "CI/CD 프리플라이트" "Phase 3: 검증"
```

`/bams:verify` 실행. FAIL 시 자동 수정(최대 2회) / 수동 / 무시 선택.

AskUserQuestion — "모든 검증 완료. Ship 할까요?"
- **Ship (Recommended)**
- **검증까지만** — `status: paused_at_step_8` 기록 후 종료.

Step 8 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 8 "done" {duration_ms}
```

---

## Phase 4: 배포

**스킬 미설치 시**: Step 9 `skipped` (수동 PR 생성 안내) → Phase 5로.

### Step 9: Ship (bams ship 스킬)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 9 "Ship" "Phase 4: 배포"
```

`_SHIP_SKILL` 실행. 베이스 머지 → 테스트 → 리뷰 → 버전범프 → CHANGELOG → PR 생성.

AskUserQuestion — "PR 생성됨. 즉시 배포?"
- **나중에 (Recommended)**
- **배포** — Step 10 실행.

Step 9 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 9 "{status}" {duration_ms}
```

### Step 10: Land & Deploy (bams deploy 스킬, 선택)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 10 "Land & Deploy" "Phase 4: 배포"
```

배포 전 체크리스트 확인: (1) PR 머지 완료, (2) CI 통과, (3) Step 4-8 검증 통과.
모두 통과 시 `_DEPLOY_SKILL` 실행.

Step 10 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 10 "{status}" {duration_ms}
```

---

## Phase 5: 마무리

**스킬 미설치 시**: Step 11 `skipped`.

### Step 11: 문서 갱신 (bams document-release 스킬) — Ship 직후 시작

**최적화**: 문서 갱신은 Deploy(Step 10)와 독립적이므로, **Step 9(Ship) 완료 직후 백그라운드로 시작**합니다.
Step 10(Deploy) 선택 시 문서 갱신과 배포가 병렬로 진행됩니다.

`_DOCRELEASE_SKILL` 실행.

Step 11 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 11 "{status}" {duration_ms}
```

### Step 12: 스프린트 종료

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 12 "스프린트 종료" "Phase 5: 마무리"
```

`.crew/board.md`에서 이 feature의 모든 태스크 완료 시 `/bams:sprint close` 제안.

Step 12 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 12 "done" {duration_ms}
```

### Step 13: 회고 (bams retro 스킬, 선택)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 13 "회고" "Phase 5: 마무리"
```

AskUserQuestion — "회고 진행?"
- **건너뛰기 (Recommended)** — "/bams:weekly에서 한꺼번에"
- **진행** — `_RETRO_SKILL` 실행

Step 13 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 13 "{status}" {duration_ms}
```

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

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 13)

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `pattern:` — 새로 도입한 패턴/라이브러리
2. `convention:` — 리뷰(Step 4)에서 발견된 코드 컨벤션
3. `vulnerable:` — 보안 감사(Step 7)/리뷰에서 반복 지적된 영역
4. `perf-baseline:` — 벤치마크(Step 6) 수치
5. `deploy:` — Ship/Deploy 결과 요약
