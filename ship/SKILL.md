---
name: ship
preamble-tier: 4
version: 1.0.0
description: |
  수동 트리거 전용: 사용자가 /ship을 입력할 때만 실행합니다.
  Ship 워크플로우: base branch 감지 + merge, 테스트 실행, diff 리뷰, VERSION bump, CHANGELOG 업데이트, commit, push, PR 생성. "ship", "deploy", "push to main", "PR 만들어", "merge하고 push" 요청 시 사용합니다.
  코드가 준비되었거나 배포에 대해 물을 때 능동적으로 제안합니다.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (먼저 실행)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -delete 2>/dev/null || true
_CONTRIB=$(~/.claude/skills/gstack/bin/gstack-config get gstack_contributor 2>/dev/null || true)
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"
source <(~/.claude/skills/gstack/bin/gstack-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.gstack/analytics
echo '{"skill":"ship","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
# zsh-compatible: use find instead of glob to avoid NOMATCH error
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do [ -f "$_PF" ] && ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true; break; done
```

`PROACTIVE`가 `"false"`이면 gstack 스킬을 능동적으로 제안하지 마세요 — 사용자가 명시적으로 요청할 때만 실행합니다. 사용자가 능동적 제안을 거부한 상태입니다.

출력에 `UPGRADE_AVAILABLE <old> <new>`가 표시되면: `~/.claude/skills/gstack/gstack-upgrade/SKILL.md`를 읽고 "Inline upgrade flow"를 따르세요 (설정되어 있으면 자동 업그레이드, 아니면 AskUserQuestion으로 4가지 옵션 제시, 거부 시 snooze 상태 저장). `JUST_UPGRADED <from> <to>`이면: "gstack v{to}로 실행 중입니다 (방금 업데이트됨!)"라고 알리고 계속 진행합니다.

`LAKE_INTRO`가 `no`이면: 계속하기 전에 Completeness Principle을 소개합니다.
사용자에게 알려주세요: "gstack은 **Boil the Lake** 원칙을 따릅니다 — AI가 한계 비용을 거의 0으로 만들면 항상 완전한 작업을 수행합니다. 자세히 보기: https://garryslist.org/posts/boil-the-ocean"
그런 다음 기본 브라우저에서 에세이를 열지 제안합니다:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

사용자가 동의할 때만 `open`을 실행합니다. `touch`는 항상 실행합니다. 이 과정은 한 번만 발생합니다.

`TEL_PROMPTED`가 `no`이고 `LAKE_INTRO`가 `yes`인 경우: lake intro 처리 후 사용자에게 텔레메트리를 질문합니다. AskUserQuestion을 사용합니다:

> gstack 개선에 도움을 주세요! Community 모드는 사용 데이터(어떤 스킬을 사용하는지, 소요 시간, 충돌 정보)를 안정적인 기기 ID와 함께 공유하여 추세를 파악하고 버그를 빠르게 수정합니다.
> 코드, 파일 경로, 저장소 이름은 절대 전송되지 않습니다.
> `gstack-config set telemetry off`로 언제든 변경 가능합니다.

옵션:
- A) gstack 개선에 도움 주기! (권장)
- B) 괜찮습니다

A인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry community` 실행

B인 경우: 후속 AskUserQuestion을 합니다:

> 익명 모드는 어떠세요? *누군가* gstack을 사용했다는 것만 알 수 있습니다 — 고유 ID 없이, 세션 연결 불가. 누가 사용하는지 알 수 있는 카운터일 뿐입니다.

옵션:
- A) 네, 익명이면 괜찮습니다
- B) 아니요, 완전히 꺼주세요

B→A인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous` 실행
B→B인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry off` 실행

항상 실행합니다:
```bash
touch ~/.gstack/.telemetry-prompted
```

이 과정은 한 번만 발생합니다. `TEL_PROMPTED`가 `yes`이면 이 부분을 완전히 건너뜁니다.

## AskUserQuestion 형식 (질문 양식)

**모든 AskUserQuestion 호출 시 반드시 이 구조를 따르세요:**
1. **상황 정리:** 프로젝트, 현재 branch (preamble에서 출력된 `_BRANCH` 값 사용 — 대화 기록이나 gitStatus의 branch가 아님), 현재 계획/작업을 명시합니다. (1-2문장)
2. **쉽게 설명:** 똑똑한 16세가 이해할 수 있는 평이한 한국어로 문제를 설명합니다. 함수명, 내부 용어, 구현 세부사항 없이. 구체적인 예시와 비유를 사용합니다. 코드가 '무엇을 하는지' 설명하되, '무엇이라 불리는지'는 불필요합니다.
3. **추천:** `추천: [X]를 선택하세요. 이유: [한 줄 설명]` — 항상 지름길보다 완전한 옵션을 권장합니다 (Completeness Principle 참조). 각 옵션에 `완전도: X/10`을 포함합니다. 기준: 10 = 완전한 구현(모든 엣지 케이스, 전체 커버리지), 7 = happy path는 커버하지만 일부 엣지 케이스 누락, 3 = 상당한 작업을 미루는 지름길. 두 옵션 모두 8+ 이면 높은 쪽 선택; 하나가 5 이하면 표시합니다.
4. **옵션:** 알파벳 옵션: `A) ... B) ... C) ...` — 작업이 포함된 옵션은 양쪽 척도를 모두 표시: `(사람: ~X / CC: ~Y)`

사용자가 이 창을 20분간 보지 않았고 코드를 열어보지 않은 상태라고 가정하세요. 본인의 설명을 이해하려면 소스를 읽어야 한다면 너무 복잡한 것입니다.

스킬별 지침이 이 기본 형식 위에 추가 서식 규칙을 더할 수 있습니다.

## Completeness Principle — Boil the Lake (완전성 원칙)

AI는 완전성의 비용을 거의 무료로 만듭니다. 항상 지름길보다 완전한 옵션을 권장하세요 — CC+gstack으로 차이는 몇 분입니다. "lake" (100% 커버리지, 모든 엣지 케이스)는 끓일 수 있고; "ocean" (전면 재작성, 다분기 마이그레이션)은 끓일 수 없습니다. lake는 끓이고, ocean은 표시합니다.

**작업량 참고** — 항상 양쪽 척도를 표시합니다:

| Task type | Human team | CC+gstack | Compression |
|-----------|-----------|-----------|-------------|
| Boilerplate | 2 days | 15 min | ~100x |
| Tests | 1 day | 15 min | ~50x |
| Feature | 1 week | 30 min | ~30x |
| Bug fix | 4 hours | 15 min | ~20x |

각 옵션에 `완전도: X/10`을 포함합니다 (10=모든 엣지 케이스, 7=happy path, 3=지름길).

## Repo Ownership — See Something, Say Something (저장소 소유권)

`REPO_MODE`가 branch 외부 이슈 처리 방식을 결정합니다:
- **`solo`** — 모든 것을 소유합니다. 조사하고 능동적으로 수정을 제안합니다.
- **`collaborative`** / **`unknown`** — AskUserQuestion으로 알리되 수정하지 않습니다 (다른 사람의 영역일 수 있음).

무언가 이상해 보이면 항상 표시합니다 — 한 문장으로 발견한 내용과 영향을 설명합니다.

## Search Before Building (만들기 전에 검색)

익숙하지 않은 것을 만들기 전에 **먼저 검색하세요.** `~/.claude/skills/gstack/ETHOS.md`를 참조합니다.
- **Layer 1** (검증된 방법) — 재발명하지 않습니다. **Layer 2** (새롭고 인기 있는 것) — 면밀히 검토합니다. **Layer 3** (기본 원리) — 무엇보다 소중히 여깁니다.

**Eureka:** 기본 원리 추론이 기존 통념과 모순될 때, 이름을 붙이고 기록합니다:
```bash
jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg skill "SKILL_NAME" --arg branch "$(git branch --show-current 2>/dev/null)" --arg insight "ONE_LINE_SUMMARY" '{ts:$ts,skill:$skill,branch:$branch,insight:$insight}' >> ~/.gstack/analytics/eureka.jsonl 2>/dev/null || true
```

## Contributor Mode (기여자 모드)

`_CONTRIB`가 `true`이면: **기여자 모드**입니다. 주요 워크플로우 단계가 끝날 때마다 gstack 경험을 0-10으로 평가합니다. 10이 아니고 실행 가능한 버그나 개선사항이 있으면 — 필드 리포트를 작성합니다.

**작성 대상:** 입력이 합리적이었지만 gstack이 실패한 도구 버그만. **건너뛰기:** 사용자 앱 버그, 네트워크 오류, 사용자 사이트 인증 실패.

**작성 방법:** `~/.gstack/contributor-logs/{slug}.md`에 작성합니다:
```
# {Title}
**What I tried:** {action} | **What happened:** {result} | **Rating:** {0-10}
## Repro
1. {step}
## What would make this a 10
{one sentence}
**Date:** {YYYY-MM-DD} | **Version:** {version} | **Skill:** /{skill}
```
Slug: 소문자 하이픈, 최대 60자. 이미 존재하면 건너뜁니다. 세션당 최대 3개. 인라인으로 작성하고, 중단하지 않습니다.

## Completion Status Protocol (완료 상태 프로토콜)

스킬 워크플로우를 완료할 때 다음 중 하나로 상태를 보고합니다:
- **DONE** — 모든 단계가 성공적으로 완료되었습니다. 각 주장에 대한 증거가 제공됩니다.
- **DONE_WITH_CONCERNS** — 완료되었지만 사용자가 알아야 할 이슈가 있습니다. 각 우려사항을 나열합니다.
- **BLOCKED** — 진행할 수 없습니다. 차단 원인과 시도한 내용을 명시합니다.
- **NEEDS_CONTEXT** — 계속하기 위한 정보가 부족합니다. 필요한 것을 정확히 명시합니다.

### Escalation (에스컬레이션)

"이건 저한테 너무 어렵습니다" 또는 "이 결과에 확신이 없습니다"라고 멈추는 것은 언제나 괜찮습니다.

잘못된 작업은 작업하지 않는 것보다 나쁩니다. 에스컬레이션으로 불이익을 받지 않습니다.
- 3번 시도해도 성공하지 못했다면, 멈추고 에스컬레이션합니다.
- 보안에 민감한 변경에 확신이 없다면, 멈추고 에스컬레이션합니다.
- 작업 범위가 검증 가능한 범위를 초과하면, 멈추고 에스컬레이션합니다.

에스컬레이션 형식:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```

## Telemetry (텔레메트리 — 마지막에 실행)

스킬 워크플로우가 완료된 후 (성공, 오류, 중단), 텔레메트리 이벤트를 기록합니다.
이 파일의 YAML frontmatter에 있는 `name:` 필드에서 스킬 이름을 확인합니다.
워크플로우 결과에서 outcome을 결정합니다 (정상 완료 시 success, 실패 시 error, 사용자가 중단하면 abort).

**PLAN MODE 예외 — 항상 실행:** 이 명령은 `~/.gstack/analytics/`(사용자 설정 디렉토리, 프로젝트 파일 아님)에 텔레메트리를 기록합니다. 스킬 preamble이 이미 같은 디렉토리에 기록합니다 — 동일한 패턴입니다.
이 명령을 건너뛰면 세션 기간과 outcome 데이터가 손실됩니다.

다음 bash를 실행합니다:

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
~/.claude/skills/gstack/bin/gstack-telemetry-log \
  --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \
  --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
```

`SKILL_NAME`을 frontmatter의 실제 스킬 이름으로, `OUTCOME`을 success/error/abort로, `USED_BROWSE`를 `$B` 사용 여부에 따라 true/false로 대체합니다.
outcome을 판단할 수 없으면 "unknown"을 사용합니다. 이 명령은 백그라운드에서 실행되며 사용자를 차단하지 않습니다.

## Plan Status Footer (플랜 상태 푸터)

plan mode에서 ExitPlanMode를 호출하려는 시점에:

1. 플랜 파일에 이미 `## GSTACK REVIEW REPORT` 섹션이 있는지 확인합니다.
2. **있으면** — 건너뜁니다 (리뷰 스킬이 이미 더 풍부한 리포트를 작성한 상태).
3. **없으면** — 이 명령을 실행합니다:

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-review-read
\`\`\`

그런 다음 플랜 파일 끝에 `## GSTACK REVIEW REPORT` 섹션을 작성합니다:

- 출력에 리뷰 항목(`---CONFIG---` 앞의 JSONL 라인)이 있으면: 스킬별 실행 횟수/상태/발견사항으로 표준 리포트 테이블을 작성합니다 (리뷰 스킬과 동일한 형식).
- 출력이 `NO_REVIEWS`이거나 비어있으면: 다음 플레이스홀더 테이블을 작성합니다:

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | 0 | — | — |
| Codex Review | \`/codex review\` | Independent 2nd opinion | 0 | — | — |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | 0 | — | — |
| Design Review | \`/plan-design-review\` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run \`/autoplan\` for full review pipeline, or individual reviews above.
\`\`\`

**PLAN MODE 예외 — 항상 실행:** 이 명령은 플랜 파일에 기록하며, plan mode에서 편집이 허용된 유일한 파일입니다. 플랜 파일 리뷰 리포트는 플랜의 실시간 상태의 일부입니다.

## Step 0: Base branch 감지

이 PR이 어떤 branch를 대상으로 하는지 결정합니다. 결과를 이후 모든 단계에서 "base branch"로 사용합니다.

1. 이 branch에 이미 PR이 있는지 확인합니다:
   `gh pr view --json baseRefName -q .baseRefName`
   성공하면 출력된 branch 이름을 base branch로 사용합니다.

2. PR이 없으면 (명령 실패), 저장소의 기본 branch를 감지합니다:
   `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`

3. 두 명령 모두 실패하면 `main`으로 대체합니다.

감지된 base branch 이름을 출력합니다. 이후 모든 `git diff`, `git log`, `git fetch`, `git merge`, `gh pr create` 명령에서 "base branch"라고 표시된 곳에 감지된 branch 이름을 대입합니다.

---

# Ship: 완전 자동 Ship 워크플로우

`/ship` 워크플로우를 실행합니다. 이것은 **비대화형, 완전 자동** 워크플로우입니다. 어떤 단계에서도 확인을 요청하지 마세요. 사용자가 `/ship`이라고 했으므로 바로 실행합니다. 끝까지 진행하고 PR URL을 출력합니다.

**멈춰야 하는 경우:**
- base branch에 있을 때 (중단)
- 자동 해결할 수 없는 merge 충돌 (중단, 충돌 표시)
- branch 내 테스트 실패 (기존 실패는 분류만 하고 자동 차단하지 않음)
- pre-landing 리뷰에서 사용자 판단이 필요한 ASK 항목 발견
- MINOR 또는 MAJOR version bump 필요 (질문 — Step 4 참조)
- 사용자 결정이 필요한 Greptile 리뷰 코멘트 (복잡한 수정, 오탐)
- TODOS.md가 없고 사용자가 생성하고 싶은 경우 (질문 — Step 5.5 참조)
- TODOS.md가 정리되지 않았고 사용자가 정리하고 싶은 경우 (질문 — Step 5.5 참조)

**멈추지 않는 경우:**
- 커밋되지 않은 변경사항 (항상 포함)
- version bump 선택 (MICRO 또는 PATCH 자동 선택 — Step 4 참조)
- CHANGELOG 내용 (diff에서 자동 생성)
- commit 메시지 승인 (자동 커밋)
- 다중 파일 변경 세트 (bisect 가능한 commit으로 자동 분할)
- TODOS.md 완료 항목 감지 (자동 표시)
- 자동 수정 가능한 리뷰 발견사항 (데드 코드, N+1, 오래된 주석 — 자동 수정)
- 테스트 커버리지 격차 (자동 생성 및 커밋, 또는 PR 본문에 표시)

---

## Step 1: 사전 점검

1. 현재 branch를 확인합니다. base branch 또는 저장소의 기본 branch에 있으면 **중단**: "base branch에 있습니다. feature branch에서 ship하세요."

2. `git status`를 실행합니다 (`-uall` 사용 금지). 커밋되지 않은 변경사항은 항상 포함됩니다 — 질문할 필요 없습니다.

3. `git diff <base>...HEAD --stat`와 `git log <base>..HEAD --oneline`을 실행하여 무엇을 ship하는지 파악합니다.

4. 리뷰 준비 상태를 확인합니다:

## Review Readiness Dashboard (리뷰 준비 현황)

리뷰 완료 후 리뷰 로그와 설정을 읽어 대시보드를 표시합니다.

```bash
~/.claude/skills/gstack/bin/gstack-review-read
```

출력을 파싱합니다. 각 스킬(plan-ceo-review, plan-eng-review, review, plan-design-review, design-review-lite, adversarial-review, codex-review, codex-plan-review)의 최신 항목을 찾습니다. 7일보다 오래된 타임스탬프의 항목은 무시합니다. Eng Review 행은 `review` (diff 범위 pre-landing 리뷰)와 `plan-eng-review` (plan 단계 아키텍처 리뷰) 중 더 최근 것을 표시합니다. 구분을 위해 상태에 "(DIFF)" 또는 "(PLAN)"을 추가합니다. Adversarial 행은 `adversarial-review` (새 자동 스케일링)와 `codex-review` (레거시) 중 더 최근 것을 표시합니다. Design Review는 `plan-design-review` (전체 시각 감사)와 `design-review-lite` (코드 수준 확인) 중 더 최근 것을 표시합니다. 구분을 위해 상태에 "(FULL)" 또는 "(LITE)"를 추가합니다. 표시 형식:

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

**리뷰 등급:**
- **Eng Review (기본적으로 필수):** shipping을 차단하는 유일한 리뷰입니다. 아키텍처, 코드 품질, 테스트, 성능을 다룹니다. `gstack-config set skip_eng_review true`로 전역 비활성화 가능합니다 ("귀찮게 하지 마" 설정).
- **CEO Review (선택):** 판단을 사용하세요. 큰 제품/비즈니스 변경, 새로운 사용자 대면 기능, 범위 결정에 권장합니다. 버그 수정, 리팩터링, 인프라, 정리 작업은 건너뜁니다.
- **Design Review (선택):** 판단을 사용하세요. UI/UX 변경에 권장합니다. 백엔드 전용, 인프라, 프롬프트 전용 변경은 건너뜁니다.
- **Adversarial Review (자동):** diff 크기에 따라 자동 조절됩니다. 작은 diff (<50줄)는 adversarial을 건너뜁니다. 중간 diff (50-199줄)는 cross-model adversarial을 실행합니다. 큰 diff (200+줄)는 4개 패스 모두 실행: Claude structured, Codex structured, Claude adversarial subagent, Codex adversarial. 설정 불필요합니다.
- **Outside Voice (선택):** 다른 AI 모델의 독립적인 플랜 리뷰입니다. /plan-ceo-review와 /plan-eng-review의 모든 리뷰 섹션 완료 후 제공됩니다. Codex 사용 불가 시 Claude subagent로 대체됩니다. shipping을 차단하지 않습니다.

**판정 로직:**
- **CLEARED**: Eng Review가 7일 이내에 `review` 또는 `plan-eng-review`에서 "clean" 상태로 1개 이상 항목이 있는 경우 (또는 `skip_eng_review`가 `true`)
- **NOT CLEARED**: Eng Review가 없거나, 오래되었거나 (7일 초과), 미해결 이슈가 있는 경우
- CEO, Design, Codex 리뷰는 참고용으로만 표시되며 shipping을 차단하지 않습니다
- `skip_eng_review` 설정이 `true`이면 Eng Review에 "SKIPPED (global)"을 표시하고 판정은 CLEARED입니다

**Staleness 감지:** 대시보드를 표시한 후 기존 리뷰가 오래되었을 수 있는지 확인합니다:
- bash 출력의 `---HEAD---` 섹션에서 현재 HEAD commit 해시를 파싱합니다
- `commit` 필드가 있는 각 리뷰 항목: 현재 HEAD와 비교합니다. 다르면 경과한 commit 수를 셉니다: `git rev-list --count STORED_COMMIT..HEAD`. 표시: "참고: {skill} 리뷰 ({date})가 오래되었을 수 있습니다 — 리뷰 이후 {N}개 commit"
- `commit` 필드가 없는 항목 (레거시 항목): 표시: "참고: {skill} 리뷰 ({date})에 commit 추적이 없습니다 — 정확한 staleness 감지를 위해 재실행을 고려하세요"
- 모든 리뷰가 현재 HEAD와 일치하면 staleness 메모를 표시하지 않습니다

Eng Review가 "CLEAR"가 아닌 경우:

1. **이 branch에 이전 override가 있는지 확인합니다:**
   ```bash
   eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
   grep '"skill":"ship-review-override"' ~/.gstack/projects/$SLUG/$BRANCH-reviews.jsonl 2>/dev/null || echo "NO_OVERRIDE"
   ```
   override가 있으면 대시보드를 표시하고 "리뷰 게이트가 이전에 수락됨 — 계속합니다."라고 표시합니다. 다시 질문하지 마세요.

2. **override가 없으면** AskUserQuestion을 사용합니다:
   - Eng Review가 없거나 미해결 이슈가 있음을 표시합니다
   - 추천: 변경이 명백히 사소하면 C 선택 (< 20줄, 오타 수정, 설정만 변경); 더 큰 변경은 B 선택
   - 옵션: A) 그래도 ship  B) 중단 — /review 또는 /plan-eng-review를 먼저 실행  C) 변경이 너무 작아서 eng review 불필요
   - CEO Review가 없으면 참고 정보로 언급 ("CEO Review 미실행 — 제품 변경에 권장") 하되 차단하지 않습니다
   - Design Review: `source <(~/.claude/skills/gstack/bin/gstack-diff-scope <base> 2>/dev/null)`를 실행합니다. `SCOPE_FRONTEND=true`이고 대시보드에 design review (plan-design-review 또는 design-review-lite)가 없으면 언급: "Design Review 미실행 — 이 PR은 프론트엔드 코드를 변경합니다. lite 디자인 검사가 Step 3.5에서 자동 실행되지만, 구현 후 전체 시각 감사를 위해 /design-review 실행을 고려하세요." 그래도 차단하지 않습니다.

3. **사용자가 A 또는 C를 선택하면** 이 branch의 향후 `/ship` 실행에서 게이트를 건너뛰도록 결정을 저장합니다:
   ```bash
   eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
   echo '{"skill":"ship-review-override","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","decision":"USER_CHOICE"}' >> ~/.gstack/projects/$SLUG/$BRANCH-reviews.jsonl
   ```
   USER_CHOICE를 "ship_anyway" 또는 "not_relevant"로 대체합니다.

---

## Step 1.5: Distribution Pipeline 검사

diff가 새로운 독립형 artifact(CLI 바이너리, 라이브러리 패키지, 도구)를 도입하는 경우 — 기존 배포가 있는 웹 서비스가 아닌 — 배포 파이프라인이 있는지 확인합니다.

1. diff가 새로운 `cmd/` 디렉토리, `main.go`, 또는 `bin/` 진입점을 추가하는지 확인합니다:
   ```bash
   git diff origin/<base> --name-only | grep -E '(cmd/.*/main\.go|bin/|Cargo\.toml|setup\.py|package\.json)' | head -5
   ```

2. 새 artifact가 감지되면 릴리스 워크플로우를 확인합니다:
   ```bash
   ls .github/workflows/ 2>/dev/null | grep -iE 'release|publish|dist'
   ```

3. **릴리스 파이프라인이 없고 새 artifact가 추가된 경우:** AskUserQuestion을 사용합니다:
   - "이 PR은 새로운 바이너리/도구를 추가하지만 빌드하고 배포할 CI/CD 파이프라인이 없습니다.
     merge 후 사용자가 artifact를 다운로드할 수 없습니다."
   - A) 지금 릴리스 워크플로우 추가 (GitHub Actions 크로스 플랫폼 빌드 + GitHub Releases)
   - B) 보류 — TODOS.md에 추가
   - C) 필요 없음 — 내부용/웹 전용이며, 기존 배포로 충분함

4. **릴리스 파이프라인이 있으면:** 조용히 계속합니다.
5. **새 artifact가 감지되지 않으면:** 조용히 건너뜁니다.

---

## Step 2: Base branch merge (테스트 전에)

merge된 상태에서 테스트가 실행되도록 base branch를 feature branch에 fetch하고 merge합니다:

```bash
git fetch origin <base> && git merge origin/<base> --no-edit
```

**merge 충돌이 있는 경우:** 단순한 충돌이면 자동 해결을 시도합니다 (VERSION, schema.rb, CHANGELOG 순서). 충돌이 복잡하거나 모호하면 **멈추고** 표시합니다.

**이미 최신 상태이면:** 조용히 계속합니다.

---

## Step 2.5: 테스트 프레임워크 부트스트랩

## Test Framework Bootstrap (테스트 프레임워크 부트스트랩)

**기존 테스트 프레임워크와 프로젝트 런타임을 감지합니다:**

```bash
# Detect project runtime
[ -f Gemfile ] && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "RUNTIME:python"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
[ -f composer.json ] && echo "RUNTIME:php"
[ -f mix.exs ] && echo "RUNTIME:elixir"
# Detect sub-frameworks
[ -f Gemfile ] && grep -q "rails" Gemfile 2>/dev/null && echo "FRAMEWORK:rails"
[ -f package.json ] && grep -q '"next"' package.json 2>/dev/null && echo "FRAMEWORK:nextjs"
# Check for existing test infrastructure
ls jest.config.* vitest.config.* playwright.config.* .rspec pytest.ini pyproject.toml phpunit.xml 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ cypress/ e2e/ 2>/dev/null
# Check opt-out marker
[ -f .gstack/no-test-bootstrap ] && echo "BOOTSTRAP_DECLINED"
```

**테스트 프레임워크가 감지되면** (설정 파일이나 테스트 디렉토리가 발견된 경우):
"테스트 프레임워크 감지됨: {name} (기존 테스트 {N}개). 부트스트랩을 건너뜁니다."라고 출력합니다.
기존 테스트 파일 2-3개를 읽어 관례(네이밍, import, assertion 스타일, 설정 패턴)를 학습합니다.
Phase 8e.5 또는 Step 3.4에서 사용할 산문 컨텍스트로 관례를 저장합니다. **나머지 부트스트랩을 건너뜁니다.**

**BOOTSTRAP_DECLINED이 표시되면:** "테스트 부트스트랩이 이전에 거부됨 — 건너뜁니다."라고 출력합니다. **나머지 부트스트랩을 건너뜁니다.**

**런타임이 감지되지 않으면** (설정 파일 없음): AskUserQuestion을 사용합니다:
"프로젝트의 언어를 감지할 수 없습니다. 어떤 런타임을 사용하시나요?"
옵션: A) Node.js/TypeScript B) Ruby/Rails C) Python D) Go E) Rust F) PHP G) Elixir H) 이 프로젝트는 테스트가 필요 없습니다.
사용자가 H를 선택하면 → `.gstack/no-test-bootstrap`을 작성하고 테스트 없이 계속합니다.

**런타임은 감지되었지만 테스트 프레임워크가 없는 경우 — 부트스트랩:**

### B2. 모범 사례 조사

WebSearch로 감지된 런타임의 현재 모범 사례를 찾습니다:
- `"[runtime] best test framework 2025 2026"`
- `"[framework A] vs [framework B] comparison"`

WebSearch를 사용할 수 없으면 다음 내장 지식 테이블을 사용합니다:

| Runtime | Primary recommendation | Alternative |
|---------|----------------------|-------------|
| Ruby/Rails | minitest + fixtures + capybara | rspec + factory_bot + shoulda-matchers |
| Node.js | vitest + @testing-library | jest + @testing-library |
| Next.js | vitest + @testing-library/react + playwright | jest + cypress |
| Python | pytest + pytest-cov | unittest |
| Go | stdlib testing + testify | stdlib only |
| Rust | cargo test (built-in) + mockall | — |
| PHP | phpunit + mockery | pest |
| Elixir | ExUnit (built-in) + ex_machina | — |

### B3. 프레임워크 선택

AskUserQuestion을 사용합니다:
"[Runtime/Framework] 프로젝트인데 테스트 프레임워크가 없음을 감지했습니다. 현재 모범 사례를 조사했습니다. 옵션은 다음과 같습니다:
A) [Primary] — [근거]. 포함: [패키지]. 지원: unit, integration, smoke, e2e
B) [Alternative] — [근거]. 포함: [패키지]
C) 건너뛰기 — 지금은 테스트를 설정하지 않겠습니다
추천: A를 선택하세요. 이유: [프로젝트 맥락에 기반한 이유]"

사용자가 C를 선택하면 → `.gstack/no-test-bootstrap`을 작성합니다. "나중에 마음이 바뀌면 `.gstack/no-test-bootstrap`을 삭제하고 다시 실행하세요."라고 알립니다. 테스트 없이 계속합니다.

여러 런타임이 감지되면 (모노레포) → 어떤 런타임을 먼저 설정할지 물어보고, 둘 다 순차적으로 하는 옵션도 제공합니다.

### B4. 설치 및 설정

1. 선택된 패키지를 설치합니다 (npm/bun/gem/pip/등)
2. 최소한의 설정 파일을 생성합니다
3. 디렉토리 구조를 생성합니다 (test/, spec/, 등)
4. 설정이 작동하는지 검증하기 위해 프로젝트 코드에 맞는 예제 테스트 1개를 생성합니다

패키지 설치가 실패하면 → 한 번 디버그합니다. 그래도 실패하면 → `git checkout -- package.json package-lock.json` (또는 런타임에 맞는 동등한 명령)으로 되돌립니다. 사용자에게 경고하고 테스트 없이 계속합니다.

### B4.5. 첫 번째 실제 테스트

기존 코드에 대한 실제 테스트 3-5개를 생성합니다:

1. **최근 변경된 파일 찾기:** `git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10`
2. **위험도에 따라 우선순위 지정:** 에러 핸들러 > 조건부 비즈니스 로직 > API 엔드포인트 > 순수 함수
3. **각 파일마다:** 의미 있는 assertion으로 실제 동작을 테스트하는 테스트 1개를 작성합니다. 절대 `expect(x).toBeDefined()` 같은 것은 사용하지 않습니다 — 코드가 **무엇을 하는지** 테스트합니다.
4. 각 테스트를 실행합니다. 통과하면 → 유지. 실패하면 → 한 번 수정. 그래도 실패하면 → 조용히 삭제.
5. 최소 1개 테스트를 생성하고, 최대 5개로 제한합니다.

테스트 파일에서 시크릿, API 키, 자격 증명을 절대 import하지 않습니다. 환경 변수나 테스트 fixture를 사용합니다.

### B5. 검증

```bash
# Run the full test suite to confirm everything works
{detected test command}
```

테스트가 실패하면 → 한 번 디버그합니다. 그래도 실패하면 → 모든 부트스트랩 변경사항을 되돌리고 사용자에게 경고합니다.

### B5.5. CI/CD 파이프라인

```bash
# Check CI provider
ls -d .github/ 2>/dev/null && echo "CI:github"
ls .gitlab-ci.yml .circleci/ bitrise.yml 2>/dev/null
```

`.github/`이 있으면 (또는 CI가 감지되지 않으면 — GitHub Actions를 기본으로):
`.github/workflows/test.yml`을 생성합니다:
- `runs-on: ubuntu-latest`
- 런타임에 맞는 setup action (setup-node, setup-ruby, setup-python 등)
- B5에서 검증된 동일한 테스트 명령
- 트리거: push + pull_request

GitHub이 아닌 CI가 감지되면 → CI 생성을 건너뛰고 메모: "{provider}가 감지됨 — CI 파이프라인 생성은 GitHub Actions만 지원합니다. 기존 파이프라인에 테스트 단계를 수동으로 추가하세요."

### B6. TESTING.md 생성

먼저 확인: TESTING.md가 이미 있으면 → 읽고 덮어쓰기 대신 업데이트/추가합니다. 기존 내용을 절대 삭제하지 않습니다.

TESTING.md에 다음을 작성합니다:
- 철학: "100% 테스트 커버리지는 훌륭한 vibe coding의 핵심입니다. 테스트를 통해 빠르게 움직이고, 직감을 신뢰하며, 자신 있게 ship할 수 있습니다 — 테스트 없는 vibe coding은 그냥 yolo coding입니다. 테스트가 있으면 초능력이 됩니다."
- 프레임워크 이름과 버전
- 테스트 실행 방법 (B5에서 검증된 명령)
- 테스트 레이어: Unit 테스트 (무엇, 어디, 언제), Integration 테스트, Smoke 테스트, E2E 테스트
- 관례: 파일 네이밍, assertion 스타일, setup/teardown 패턴

### B7. CLAUDE.md 업데이트

먼저 확인: CLAUDE.md에 이미 `## Testing` 섹션이 있으면 → 건너뜁니다. 중복하지 않습니다.

`## Testing` 섹션을 추가합니다:
- 실행 명령과 테스트 디렉토리
- TESTING.md 참조
- 테스트 기대사항:
  - 100% 테스트 커버리지가 목표입니다 — 테스트가 vibe coding을 안전하게 만듭니다
  - 새 함수를 작성할 때 해당 테스트도 작성합니다
  - 버그를 수정할 때 회귀 테스트를 작성합니다
  - 에러 처리를 추가할 때 해당 에러를 트리거하는 테스트를 작성합니다
  - 조건문(if/else, switch)을 추가할 때 양쪽 경로 모두에 대한 테스트를 작성합니다
  - 기존 테스트를 실패시키는 코드를 절대 커밋하지 않습니다

### B8. 커밋

```bash
git status --porcelain
```

변경사항이 있을 때만 커밋합니다. 모든 부트스트랩 파일을 staging합니다 (설정, 테스트 디렉토리, TESTING.md, CLAUDE.md, .github/workflows/test.yml이 생성된 경우):
`git commit -m "chore: bootstrap test framework ({framework name})"`

---

---

## Step 3: 테스트 실행 (merge된 코드에서)

**`RAILS_ENV=test bin/rails db:migrate`를 실행하지 마세요** — `bin/test-lane`이 내부적으로 이미 `db:test:prepare`를 호출하여 올바른 lane 데이터베이스에 스키마를 로드합니다.
INSTANCE 없이 테스트 마이그레이션을 실행하면 고아 DB를 사용하고 structure.sql을 손상시킵니다.

두 테스트 스위트를 병렬로 실행합니다:

```bash
bin/test-lane 2>&1 | tee /tmp/ship_tests.txt &
npm run test 2>&1 | tee /tmp/ship_vitest.txt &
wait
```

둘 다 완료되면 출력 파일을 읽고 통과/실패를 확인합니다.

**테스트가 실패하면:** 즉시 멈추지 마세요. 테스트 실패 소유권 분류를 적용합니다:

## Test Failure Ownership Triage (테스트 실패 소유권 분류)

테스트가 실패하면 즉시 멈추지 마세요. 먼저 소유권을 판단합니다:

### Step T1: 각 실패를 분류합니다

각 실패한 테스트에 대해:

1. **이 branch에서 변경된 파일을 가져옵니다:**
   ```bash
   git diff origin/<base>...HEAD --name-only
   ```

2. **실패를 분류합니다:**
   - **branch 내 실패**: 실패한 테스트 파일 자체가 이 branch에서 수정되었거나, 테스트 출력이 이 branch에서 변경된 코드를 참조하거나, branch diff의 변경사항으로 실패를 추적할 수 있는 경우.
   - **기존 실패 가능성**: 테스트 파일도 테스트하는 코드도 이 branch에서 수정되지 않았고, 식별할 수 있는 branch 변경과 관련 없는 경우.
   - **모호한 경우 branch 내 실패로 기본 분류합니다.** 깨진 테스트를 ship하는 것보다 개발자를 멈추게 하는 것이 안전합니다. 확신이 있을 때만 기존 실패로 분류합니다.

   이 분류는 휴리스틱입니다 — diff와 테스트 출력을 읽어 판단합니다. 프로그래밍적 의존성 그래프는 없습니다.

### Step T2: Branch 내 실패 처리

**멈춥니다.** 이것은 당신의 실패입니다. 표시하고 진행하지 않습니다. 개발자가 ship하기 전에 깨진 테스트를 직접 수정해야 합니다.

### Step T3: 기존 실패 처리

preamble 출력에서 `REPO_MODE`를 확인합니다.

**REPO_MODE가 `solo`인 경우:**

AskUserQuestion을 사용합니다:

> 이 테스트 실패는 기존 실패로 보입니다 (branch 변경으로 인한 것이 아님):
>
> [각 실패를 file:line과 간단한 에러 설명으로 나열]
>
> solo 저장소이므로 이를 수정할 수 있는 사람은 본인뿐입니다.
>
> 추천: A를 선택하세요 — 맥락이 살아있을 때 지금 수정합니다. 완전도: 9/10.
> A) 지금 조사하고 수정 (사람: ~2-4시간 / CC: ~15분) — 완전도: 10/10
> B) P0 TODO로 추가 — 이 branch 병합 후 수정 — 완전도: 7/10
> C) 건너뛰기 — 이미 알고 있음, 그래도 ship — 완전도: 3/10

**REPO_MODE가 `collaborative` 또는 `unknown`인 경우:**

AskUserQuestion을 사용합니다:

> 이 테스트 실패는 기존 실패로 보입니다 (branch 변경으로 인한 것이 아님):
>
> [각 실패를 file:line과 간단한 에러 설명으로 나열]
>
> collaborative 저장소입니다 — 다른 사람의 책임일 수 있습니다.
>
> 추천: B를 선택하세요 — 올바른 사람이 수정하도록 원인 제공자에게 할당합니다. 완전도: 9/10.
> A) 어쨌든 지금 조사하고 수정 — 완전도: 10/10
> B) Blame + 작성자에게 GitHub issue 할당 — 완전도: 9/10
> C) P0 TODO로 추가 — 완전도: 7/10
> D) 건너뛰기 — 그래도 ship — 완전도: 3/10

### Step T4: 선택된 조치를 실행합니다

**"지금 조사하고 수정"인 경우:**
- /investigate 마인드셋으로 전환: 먼저 근본 원인, 그 다음 최소한의 수정.
- 기존 실패를 수정합니다.
- branch 변경사항과 별도로 수정을 커밋합니다: `git commit -m "fix: pre-existing test failure in <test-file>"`
- 워크플로우를 계속합니다.

**"P0 TODO로 추가"인 경우:**
- `TODOS.md`가 있으면 `review/TODOS-format.md` (또는 `.claude/skills/review/TODOS-format.md`)의 형식을 따라 항목을 추가합니다.
- `TODOS.md`가 없으면 표준 헤더로 생성하고 항목을 추가합니다.
- 항목에 포함: 제목, 에러 출력, 발견된 branch, 우선순위 P0.
- 워크플로우를 계속합니다 — 기존 실패를 비차단으로 처리합니다.

**"Blame + GitHub issue 할당" (collaborative 전용)인 경우:**
- 누가 깨뜨렸는지 찾습니다. 테스트 파일과 테스트하는 프로덕션 코드 모두를 확인합니다:
  ```bash
  # Who last touched the failing test?
  git log --format="%an (%ae)" -1 -- <failing-test-file>
  # Who last touched the production code the test covers? (often the actual breaker)
  git log --format="%an (%ae)" -1 -- <source-file-under-test>
  ```
  다른 사람이면 프로덕션 코드 작성자를 우선합니다 — 회귀를 도입했을 가능성이 높습니다.
- 해당 사람에게 할당된 GitHub issue를 생성합니다:
  ```bash
  gh issue create \
    --title "Pre-existing test failure: <test-name>" \
    --body "Found failing on branch <current-branch>. Failure is pre-existing.\n\n**Error:**\n```\n<first 10 lines>\n```\n\n**Last modified by:** <author>\n**Noticed by:** gstack /ship on <date>" \
    --assignee "<github-username>"
  ```
- `gh`를 사용할 수 없거나 `--assignee`가 실패하면 (사용자가 조직에 없는 경우 등), assignee 없이 issue를 생성하고 본문에 누가 봐야 하는지 기록합니다.
- 워크플로우를 계속합니다.

**"건너뛰기"인 경우:**
- 워크플로우를 계속합니다.
- 출력에 메모: "기존 테스트 실패 건너뜀: <test-name>"

**분류 후:** branch 내 실패가 수정되지 않은 채 남아있으면 **멈춥니다**. 진행하지 않습니다. 모든 실패가 기존 실패이고 처리되었으면 (수정, TODO, 할당, 건너뛰기) Step 3.25로 계속합니다.

**모두 통과하면:** 조용히 계속합니다 — 개수만 간단히 메모합니다.

---

## Step 3.25: Eval 스위트 (조건부)

프롬프트 관련 파일이 변경되면 Eval은 필수입니다. diff에 프롬프트 파일이 없으면 이 단계를 완전히 건너뜁니다.

**1. diff가 프롬프트 관련 파일을 건드리는지 확인합니다:**

```bash
git diff origin/<base> --name-only
```

다음 패턴과 매칭합니다 (CLAUDE.md에서):
- `app/services/*_prompt_builder.rb`
- `app/services/*_generation_service.rb`, `*_writer_service.rb`, `*_designer_service.rb`
- `app/services/*_evaluator.rb`, `*_scorer.rb`, `*_classifier_service.rb`, `*_analyzer.rb`
- `app/services/concerns/*voice*.rb`, `*writing*.rb`, `*prompt*.rb`, `*token*.rb`
- `app/services/chat_tools/*.rb`, `app/services/x_thread_tools/*.rb`
- `config/system_prompts/*.txt`
- `test/evals/**/*` (eval 인프라 변경은 모든 스위트에 영향)

**매칭되는 것이 없으면:** "프롬프트 관련 파일 변경 없음 — eval을 건너뜁니다."라고 출력하고 Step 3.5로 계속합니다.

**2. 영향받는 eval 스위트를 식별합니다:**

각 eval runner (`test/evals/*_eval_runner.rb`)는 어떤 소스 파일이 영향을 미치는지 `PROMPT_SOURCE_FILES`를 선언합니다. 변경된 파일과 매칭되는 스위트를 grep으로 찾습니다:

```bash
grep -l "changed_file_basename" test/evals/*_eval_runner.rb
```

runner → 테스트 파일로 매핑: `post_generation_eval_runner.rb` → `post_generation_eval_test.rb`.

**특수한 경우:**
- `test/evals/judges/*.rb`, `test/evals/support/*.rb`, 또는 `test/evals/fixtures/`의 변경은 해당 judge/support 파일을 사용하는 모든 스위트에 영향을 미칩니다. eval 테스트 파일의 import를 확인하여 어떤 것이 영향받는지 판단합니다.
- `config/system_prompts/*.txt` 변경 — eval runner에서 프롬프트 파일명을 grep하여 영향받는 스위트를 찾습니다.
- 어떤 스위트가 영향받는지 불확실하면 관련 가능성이 있는 모든 스위트를 실행합니다. 과도한 테스트가 회귀를 놓치는 것보다 낫습니다.

**3. 영향받는 스위트를 `EVAL_JUDGE_TIER=full`로 실행합니다:**

`/ship`은 pre-merge 게이트이므로 항상 full tier를 사용합니다 (Sonnet structural + Opus persona judge).

```bash
EVAL_JUDGE_TIER=full EVAL_VERBOSE=1 bin/test-lane --eval test/evals/<suite>_eval_test.rb 2>&1 | tee /tmp/ship_evals.txt
```

여러 스위트를 실행해야 하면 순차적으로 실행합니다 (각각 test lane이 필요). 첫 번째 스위트가 실패하면 즉시 중단합니다 — 나머지 스위트에 API 비용을 낭비하지 않습니다.

**4. 결과를 확인합니다:**

- **eval이 실패하면:** 실패, 비용 대시보드를 표시하고 **멈춥니다**. 진행하지 않습니다.
- **모두 통과하면:** 통과 개수와 비용을 기록합니다. Step 3.5로 계속합니다.

**5. eval 출력을 저장합니다** — eval 결과와 비용 대시보드를 PR 본문 (Step 8)에 포함합니다.

**Tier 참고 (맥락용 — /ship은 항상 `full`을 사용):**
| Tier | When | Speed (cached) | Cost |
|------|------|----------------|------|
| `fast` (Haiku) | Dev iteration, smoke tests | ~5s (14x faster) | ~$0.07/run |
| `standard` (Sonnet) | Default dev, `bin/test-lane --eval` | ~17s (4x faster) | ~$0.37/run |
| `full` (Opus persona) | **`/ship` and pre-merge** | ~72s (baseline) | ~$1.27/run |

---

## Step 3.4: 테스트 커버리지 감사

100% 커버리지가 목표입니다 — 테스트되지 않은 모든 경로는 버그가 숨고 vibe coding이 yolo coding이 되는 곳입니다. 계획된 것이 아니라 diff에서 실제로 코딩된 것을 평가합니다.

### 테스트 프레임워크 감지

커버리지를 분석하기 전에 프로젝트의 테스트 프레임워크를 감지합니다:

1. **CLAUDE.md를 읽습니다** — 테스트 명령과 프레임워크 이름이 있는 `## Testing` 섹션을 찾습니다. 있으면 이를 정본 소스로 사용합니다.
2. **CLAUDE.md에 테스트 섹션이 없으면 자동 감지합니다:**

```bash
# Detect project runtime
[ -f Gemfile ] && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "RUNTIME:python"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
# Check for existing test infrastructure
ls jest.config.* vitest.config.* playwright.config.* cypress.config.* .rspec pytest.ini phpunit.xml 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ cypress/ e2e/ 2>/dev/null
```

3. **프레임워크가 감지되지 않으면:** Test Framework Bootstrap 단계 (Step 2.5)로 넘어가서 전체 설정을 처리합니다.

**0. 전후 테스트 개수:**

```bash
# Count test files before any generation
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
```

이 숫자를 PR 본문용으로 저장합니다.

**1. 변경된 모든 코드 경로를 추적합니다** (`git diff origin/<base>...HEAD` 사용):

변경된 모든 파일을 읽습니다. 각각에 대해 데이터가 코드를 통해 어떻게 흐르는지 추적합니다 — 함수를 나열하는 것이 아니라 실행을 실제로 따라갑니다:

1. **diff를 읽습니다.** 변경된 각 파일에 대해 맥락을 이해하기 위해 전체 파일(diff hunk만이 아닌)을 읽습니다.
2. **데이터 흐름을 추적합니다.** 각 진입점(라우트 핸들러, export된 함수, 이벤트 리스너, 컴포넌트 렌더)부터 시작하여 모든 분기를 통해 데이터를 따라갑니다:
   - 입력은 어디서 오는가? (요청 파라미터, props, 데이터베이스, API 호출)
   - 무엇이 변환하는가? (검증, 매핑, 계산)
   - 어디로 가는가? (데이터베이스 쓰기, API 응답, 렌더링된 출력, 부수 효과)
   - 각 단계에서 무엇이 잘못될 수 있는가? (null/undefined, 잘못된 입력, 네트워크 실패, 빈 컬렉션)
3. **실행을 다이어그램으로 그립니다.** 변경된 각 파일에 대해 다음을 보여주는 ASCII 다이어그램을 그립니다:
   - 추가되거나 수정된 모든 함수/메서드
   - 모든 조건 분기 (if/else, switch, 삼항 연산자, 가드 절, 조기 반환)
   - 모든 에러 경로 (try/catch, rescue, 에러 바운더리, 폴백)
   - 다른 함수 호출 (그 안으로 추적 — 테스트되지 않은 분기가 있는가?)
   - 모든 엣지: null 입력은? 빈 배열은? 잘못된 타입은?

이것이 핵심 단계입니다 — 입력에 따라 다르게 실행될 수 있는 모든 코드 라인의 맵을 구축하는 것입니다. 이 다이어그램의 모든 분기에 테스트가 필요합니다.

**2. 사용자 흐름, 인터랙션, 에러 상태를 매핑합니다:**

코드 커버리지만으로는 충분하지 않습니다 — 실제 사용자가 변경된 코드와 어떻게 상호작용하는지 커버해야 합니다. 변경된 각 기능에 대해 다음을 생각합니다:

- **사용자 흐름:** 사용자가 이 코드를 건드리는 어떤 순서의 행동을 취하는가? 전체 여정을 매핑합니다 (예: "사용자가 '결제'를 클릭 → 폼 검증 → API 호출 → 성공/실패 화면"). 여정의 각 단계에 테스트가 필요합니다.
- **인터랙션 엣지 케이스:** 사용자가 예상치 못한 행동을 하면 어떻게 되는가?
  - 더블 클릭/빠른 재제출
  - 작업 중 이탈 (뒤로 가기, 탭 닫기, 다른 링크 클릭)
  - 오래된 데이터로 제출 (페이지를 30분간 열어두었고, 세션 만료)
  - 느린 연결 (API가 10초 걸림 — 사용자가 뭘 보는가?)
  - 동시 작업 (두 개의 탭, 같은 폼)
- **사용자가 볼 수 있는 에러 상태:** 코드가 처리하는 모든 에러에 대해 사용자가 실제로 경험하는 것은 무엇인가?
  - 명확한 에러 메시지가 있는가, 조용한 실패인가?
  - 사용자가 복구할 수 있는가 (재시도, 뒤로 가기, 입력 수정) 아니면 막혀있는가?
  - 네트워크가 없으면? API에서 500이 오면? 서버에서 잘못된 데이터가 오면?
- **빈/0/경계 상태:** 결과가 0개일 때 UI는 무엇을 보여주는가? 10,000개일 때? 한 글자 입력일 때? 최대 길이 입력일 때?

이들을 코드 분기와 함께 다이어그램에 추가합니다. 테스트 없는 사용자 흐름은 테스트 없는 if/else만큼의 격차입니다.

**3. 기존 테스트와 각 분기를 대조합니다:**

다이어그램을 분기별로 살펴봅니다 — 코드 경로와 사용자 흐름 모두. 각각에 대해 이를 실행하는 테스트를 검색합니다:
- 함수 `processPayment()` → `billing.test.ts`, `billing.spec.ts`, `test/billing_test.rb`를 찾습니다
- if/else → true와 false 경로 모두를 커버하는 테스트를 찾습니다
- 에러 핸들러 → 해당 특정 에러 조건을 트리거하는 테스트를 찾습니다
- 자체 분기가 있는 `helperFn()` 호출 → 그 분기들도 테스트가 필요합니다
- 사용자 흐름 → 여정을 따라가는 통합 또는 E2E 테스트를 찾습니다
- 인터랙션 엣지 케이스 → 예상치 못한 행동을 시뮬레이션하는 테스트를 찾습니다

품질 점수 기준:
- ★★★  엣지 케이스와 에러 경로까지 동작을 테스트
- ★★   올바른 동작을 테스트하되, happy path만
- ★    스모크 테스트 / 존재 여부 확인 / 사소한 assertion (예: "렌더링됨", "throw하지 않음")

### E2E 테스트 결정 매트릭스

각 분기를 확인할 때, unit 테스트와 E2E/통합 테스트 중 어떤 것이 적합한지도 판단합니다:

**E2E 권장 (다이어그램에 [→E2E]로 표시):**
- 3개 이상의 컴포넌트/서비스에 걸친 일반적인 사용자 흐름 (예: 가입 → 이메일 인증 → 첫 로그인)
- mocking이 실제 실패를 숨기는 통합 지점 (예: API → 큐 → 워커 → DB)
- 인증/결제/데이터 삭제 흐름 — unit 테스트만으로는 신뢰할 수 없을 만큼 중요

**EVAL 권장 (다이어그램에 [→EVAL]로 표시):**
- 품질 eval이 필요한 중요한 LLM 호출 (예: 프롬프트 변경 → 출력이 여전히 품질 기준 충족하는지 테스트)
- 프롬프트 템플릿, 시스템 지침, 도구 정의의 변경

**Unit 테스트를 유지하는 경우:**
- 명확한 입력/출력이 있는 순수 함수
- 부수 효과가 없는 내부 헬퍼
- 단일 함수의 엣지 케이스 (null 입력, 빈 배열)
- 고객 대면이 아닌 모호한/드문 흐름

### REGRESSION RULE (회귀 규칙, 필수)

**철칙:** 커버리지 감사에서 REGRESSION — 이전에 작동했지만 diff가 깨뜨린 코드 — 을 발견하면 즉시 회귀 테스트를 작성합니다. AskUserQuestion 없이. 건너뛰기 없이. 회귀는 무언가 깨졌다는 것을 증명하므로 가장 높은 우선순위 테스트입니다.

회귀란:
- diff가 기존 동작을 수정하는 경우 (새 코드가 아님)
- 기존 테스트 스위트(있는 경우)가 변경된 경로를 커버하지 않는 경우
- 변경이 기존 호출자에 대해 새로운 실패 모드를 도입하는 경우

변경이 회귀인지 불확실할 때는 테스트를 작성하는 쪽으로 기울입니다.

형식: `test: regression test for {what broke}`로 커밋

**4. ASCII 커버리지 다이어그램을 출력합니다:**

코드 경로와 사용자 흐름을 같은 다이어그램에 포함합니다. E2E 및 eval 대상 경로를 표시합니다:

```
CODE PATH COVERAGE
===========================
[+] src/services/billing.ts
    │
    ├── processPayment()
    │   ├── [★★★ TESTED] Happy path + card declined + timeout — billing.test.ts:42
    │   ├── [GAP]         Network timeout — NO TEST
    │   └── [GAP]         Invalid currency — NO TEST
    │
    └── refundPayment()
        ├── [★★  TESTED] Full refund — billing.test.ts:89
        └── [★   TESTED] Partial refund (checks non-throw only) — billing.test.ts:101

USER FLOW COVERAGE
===========================
[+] Payment checkout flow
    │
    ├── [★★★ TESTED] Complete purchase — checkout.e2e.ts:15
    ├── [GAP] [→E2E] Double-click submit — needs E2E, not just unit
    ├── [GAP]         Navigate away during payment — unit test sufficient
    └── [★   TESTED]  Form validation errors (checks render only) — checkout.test.ts:40

[+] Error states
    │
    ├── [★★  TESTED] Card declined message — billing.test.ts:58
    ├── [GAP]         Network timeout UX (what does user see?) — NO TEST
    └── [GAP]         Empty cart submission — NO TEST

[+] LLM integration
    │
    └── [GAP] [→EVAL] Prompt template change — needs eval test

─────────────────────────────────
COVERAGE: 5/13 paths tested (38%)
  Code paths: 3/5 (60%)
  User flows: 2/8 (25%)
QUALITY:  ★★★: 2  ★★: 2  ★: 1
GAPS: 8 paths need tests (2 need E2E, 1 needs eval)
─────────────────────────────────
```

**빠른 경로:** 모든 경로가 커버되면 → "Step 3.4: 모든 새 코드 경로에 테스트 커버리지 있음 ✓" 계속합니다.

**5. 미커버 경로에 대한 테스트를 생성합니다:**

테스트 프레임워크가 감지되었으면 (또는 Step 2.5에서 부트스트랩):
- 에러 핸들러와 엣지 케이스를 먼저 우선시합니다 (happy path는 이미 테스트되었을 가능성이 높음)
- 기존 테스트 파일 2-3개를 읽어 관례를 정확히 맞춥니다
- unit 테스트를 생성합니다. 모든 외부 의존성 (DB, API, Redis)을 mock합니다.
- [→E2E]로 표시된 경로: 프로젝트의 E2E 프레임워크 (Playwright, Cypress, Capybara 등)를 사용하여 통합/E2E 테스트를 생성합니다
- [→EVAL]로 표시된 경로: 프로젝트의 eval 프레임워크를 사용하여 eval 테스트를 생성하거나, 없으면 수동 eval로 표시합니다
- 특정 미커버 경로를 실제 assertion으로 테스트하는 테스트를 작성합니다
- 각 테스트를 실행합니다. 통과하면 → `test: coverage for {feature}`로 커밋
- 실패하면 → 한 번 수정. 그래도 실패하면 → 되돌리고, 다이어그램에 격차를 기록합니다.

제한: 최대 30개 코드 경로, 최대 20개 테스트 생성 (코드 + 사용자 흐름 합산), 테스트당 탐색 2분 제한.

테스트 프레임워크가 없고 사용자가 부트스트랩을 거부한 경우 → 다이어그램만, 생성 없음. 메모: "테스트 생성 건너뜀 — 테스트 프레임워크가 설정되지 않았습니다."

**diff가 테스트 전용 변경인 경우:** Step 3.4를 완전히 건너뜁니다: "감사할 새 애플리케이션 코드 경로가 없습니다."

**6. 후속 개수와 커버리지 요약:**

```bash
# Count test files after generation
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' | grep -v node_modules | wc -l
```

PR 본문용: `Tests: {before} → {after} (+{delta} new)`
커버리지 라인: `Test Coverage Audit: N new code paths. M covered (X%). K tests generated, J committed.`

### Test Plan Artifact (테스트 플랜 산출물)

커버리지 다이어그램을 생성한 후, `/qa`와 `/qa-only`가 사용할 수 있도록 테스트 플랜 산출물을 작성합니다:

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
```

`~/.gstack/projects/{slug}/{user}-{branch}-ship-test-plan-{datetime}.md`에 작성합니다:

```markdown
# Test Plan
Generated by /ship on {date}
Branch: {branch}
Repo: {owner/repo}

## Affected Pages/Routes
- {URL path} — {what to test and why}

## Key Interactions to Verify
- {interaction description} on {page}

## Edge Cases
- {edge case} on {page}

## Critical Paths
- {end-to-end flow that must work}
```

---

## Step 3.5: Pre-Landing 리뷰

테스트가 잡지 못하는 구조적 이슈를 위해 diff를 리뷰합니다.

1. `.claude/skills/review/checklist.md`를 읽습니다. 파일을 읽을 수 없으면 **멈추고** 에러를 보고합니다.

2. `git diff origin/<base>`를 실행하여 전체 diff를 가져옵니다 (방금 fetch한 base branch에 대한 feature 변경 범위).

3. 리뷰 체크리스트를 두 패스로 적용합니다:
   - **패스 1 (CRITICAL):** SQL & 데이터 안전성, LLM 출력 신뢰 경계
   - **패스 2 (INFORMATIONAL):** 나머지 모든 카테고리

## Design Review (디자인 리뷰, 조건부, diff 범위)

diff가 프론트엔드 파일을 건드리는지 `gstack-diff-scope`로 확인합니다:

```bash
source <(~/.claude/skills/gstack/bin/gstack-diff-scope <base> 2>/dev/null)
```

**`SCOPE_FRONTEND=false`이면:** 조용히 디자인 리뷰를 건너뜁니다. 출력 없음.

**`SCOPE_FRONTEND=true`이면:**

1. **DESIGN.md를 확인합니다.** 저장소 루트에 `DESIGN.md` 또는 `design-system.md`가 있으면 읽습니다. 모든 디자인 발견사항은 이를 기준으로 보정합니다 — DESIGN.md에서 승인된 패턴은 플래그하지 않습니다. 없으면 보편적인 디자인 원칙을 사용합니다.

2. **`.claude/skills/review/design-checklist.md`를 읽습니다.** 파일을 읽을 수 없으면 메모와 함께 디자인 리뷰를 건너뜁니다: "디자인 체크리스트를 찾을 수 없음 — 디자인 리뷰를 건너뜁니다."

3. **변경된 각 프론트엔드 파일을 읽습니다** (diff hunk만이 아닌 전체 파일). 프론트엔드 파일은 체크리스트에 나열된 패턴으로 식별합니다.

4. **변경된 파일에 디자인 체크리스트를 적용합니다.** 각 항목에 대해:
   - **[HIGH] 기계적 CSS 수정** (`outline: none`, `!important`, `font-size < 16px`): AUTO-FIX로 분류
   - **[HIGH/MEDIUM] 디자인 판단 필요**: ASK로 분류
   - **[LOW] 의도 기반 감지**: "가능성 있음 — 시각적으로 확인하거나 /design-review를 실행하세요"로 제시

5. **발견사항을 포함합니다** — 리뷰 출력에 "Design Review" 헤더 아래에, 체크리스트의 출력 형식을 따릅니다. 디자인 발견사항은 코드 리뷰 발견사항과 같은 Fix-First 흐름으로 병합됩니다.

6. **Review Readiness Dashboard에 결과를 기록합니다:**

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"design-review-lite","timestamp":"TIMESTAMP","status":"STATUS","findings":N,"auto_fixed":M,"commit":"COMMIT"}'
```

대체: TIMESTAMP = ISO 8601 datetime, STATUS = 발견사항 0이면 "clean" 아니면 "issues_found", N = 총 발견사항, M = 자동 수정 개수, COMMIT = `git rev-parse --short HEAD` 출력.

7. **Codex 디자인 보이스** (선택, 사용 가능하면 자동):

```bash
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
```

Codex가 사용 가능하면 diff에 대해 경량 디자인 검사를 실행합니다:

```bash
TMPERR_DRL=$(mktemp /tmp/codex-drl-XXXXXXXX)
codex exec "Review the git diff on this branch. Run 7 litmus checks (YES/NO each): 1. Brand/product unmistakable in first screen? 2. One strong visual anchor present? 3. Page understandable by scanning headlines only? 4. Each section has one job? 5. Are cards actually necessary? 6. Does motion improve hierarchy or atmosphere? 7. Would design feel premium with all decorative shadows removed? Flag any hard rejections: 1. Generic SaaS card grid as first impression 2. Beautiful image with weak brand 3. Strong headline with no clear action 4. Busy imagery behind text 5. Sections repeating same mood statement 6. Carousel with no narrative purpose 7. App UI made of stacked cards instead of layout 5 most important design findings only. Reference file:line." -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached 2>"$TMPERR_DRL"
```

5분 timeout을 사용합니다 (`timeout: 300000`). 명령 완료 후 stderr를 읽습니다:
```bash
cat "$TMPERR_DRL" && rm -f "$TMPERR_DRL"
```

**에러 처리:** 모든 에러는 비차단입니다. 인증 실패, timeout, 빈 응답 시 — 간단한 메모와 함께 건너뛰고 계속합니다.

Codex 출력을 `CODEX (design):` 헤더 아래에 제시하고, 위의 체크리스트 발견사항과 병합합니다.

   디자인 발견사항을 코드 리뷰 발견사항과 함께 포함합니다. 아래의 동일한 Fix-First 흐름을 따릅니다.

4. **각 발견사항을 AUTO-FIX 또는 ASK로 분류합니다** — checklist.md의 Fix-First Heuristic에 따라. Critical 발견사항은 ASK 쪽으로; informational은 AUTO-FIX 쪽으로 기울입니다.

5. **모든 AUTO-FIX 항목을 자동 수정합니다.** 각 수정을 적용합니다. 수정당 한 줄 출력:
   `[AUTO-FIXED] [file:line] 문제 → 수행한 작업`

6. **ASK 항목이 남아있으면** 하나의 AskUserQuestion에 제시합니다:
   - 각각 번호, 심각도, 문제, 권장 수정과 함께 나열
   - 항목별 옵션: A) 수정  B) 건너뛰기
   - 전체 추천
   - ASK 항목이 3개 이하면 개별 AskUserQuestion 호출을 사용할 수 있습니다

7. **모든 수정 후 (자동 + 사용자 승인):**
   - 수정이 적용되었으면: 수정된 파일을 이름으로 커밋합니다 (`git add <fixed-files> && git commit -m "fix: pre-landing review fixes"`), 그 다음 **멈추고** 사용자에게 재테스트를 위해 `/ship`을 다시 실행하라고 알립니다.
   - 수정이 적용되지 않았으면 (모든 ASK 항목을 건너뛰었거나 이슈가 없는 경우): Step 4로 계속합니다.

8. 요약 출력: `Pre-Landing Review: N개 이슈 — M개 자동 수정, K개 질문 (J개 수정, L개 건너뜀)`

   이슈가 없으면: `Pre-Landing Review: 이슈 없음.`

리뷰 출력을 저장합니다 — Step 8의 PR 본문에 들어갑니다.

---

## Step 3.75: Greptile 리뷰 코멘트 처리 (PR이 있는 경우)

`.claude/skills/review/greptile-triage.md`를 읽고 fetch, filter, classify, **escalation 감지** 단계를 따릅니다.

**PR이 없거나, `gh`가 실패하거나, API가 에러를 반환하거나, Greptile 코멘트가 0개이면:** 이 단계를 조용히 건너뜁니다. Step 4로 계속합니다.

**Greptile 코멘트가 발견되면:**

출력에 Greptile 요약을 포함합니다: `+ N개 Greptile 코멘트 (X개 유효, Y개 수정, Z개 오탐)`

코멘트에 응답하기 전에, greptile-triage.md의 **Escalation Detection** 알고리즘을 실행하여 Tier 1 (친절한) 또는 Tier 2 (단호한) 응답 템플릿 중 어느 것을 사용할지 결정합니다.

분류된 각 코멘트에 대해:

**유효하고 조치 가능:** AskUserQuestion을 사용합니다:
- 코멘트 (file:line 또는 [top-level] + 본문 요약 + permalink URL)
- `추천: A를 선택하세요. 이유: [한 줄 이유]`
- 옵션: A) 지금 수정, B) 확인하고 그래도 ship, C) 오탐입니다
- 사용자가 A를 선택하면: 수정을 적용하고, 수정된 파일을 커밋 (`git add <fixed-files> && git commit -m "fix: address Greptile review — <brief description>"`), greptile-triage.md의 **Fix reply template**으로 응답 (인라인 diff + 설명 포함), 프로젝트별과 전역 greptile-history 모두에 저장 (type: fix).
- 사용자가 C를 선택하면: greptile-triage.md의 **False Positive reply template**으로 응답 (증거 + 재순위 제안 포함), 프로젝트별과 전역 greptile-history 모두에 저장 (type: fp).

**유효하지만 이미 수정됨:** greptile-triage.md의 **Already Fixed reply template**으로 응답합니다 — AskUserQuestion 불필요:
- 수행한 작업과 수정 commit SHA를 포함
- 프로젝트별과 전역 greptile-history 모두에 저장 (type: already-fixed)

**오탐:** AskUserQuestion을 사용합니다:
- 코멘트와 왜 틀렸다고 생각하는지 표시 (file:line 또는 [top-level] + 본문 요약 + permalink URL)
- 옵션:
  - A) 오탐을 설명하는 Greptile 응답 (명확히 틀린 경우 권장)
  - B) 어쨌든 수정 (사소한 경우)
  - C) 조용히 무시
- 사용자가 A를 선택하면: greptile-triage.md의 **False Positive reply template**으로 응답 (증거 + 재순위 제안 포함), 프로젝트별과 전역 greptile-history 모두에 저장 (type: fp)

**억제됨:** 조용히 건너뜁니다 — 이전 분류에서 알려진 오탐입니다.

**모든 코멘트 해결 후:** 수정이 적용되었으면, Step 3의 테스트는 이제 오래된 것입니다. Step 4로 진행하기 전에 **테스트를 재실행** (Step 3)합니다. 수정이 없으면 Step 4로 계속합니다.

---

## Step 3.8: Adversarial 리뷰 (자동 스케일링)

Adversarial 리뷰의 철저함은 diff 크기에 따라 자동으로 조절됩니다. 설정 불필요합니다.

**diff 크기와 도구 가용성을 감지합니다:**

```bash
DIFF_INS=$(git diff origin/<base> --stat | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
DIFF_DEL=$(git diff origin/<base> --stat | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
DIFF_TOTAL=$((DIFF_INS + DIFF_DEL))
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
# Respect old opt-out
OLD_CFG=$(~/.claude/skills/gstack/bin/gstack-config get codex_reviews 2>/dev/null || true)
echo "DIFF_SIZE: $DIFF_TOTAL"
echo "OLD_CFG: ${OLD_CFG:-not_set}"
```

`OLD_CFG`가 `disabled`이면: 이 단계를 조용히 건너뜁니다. 다음 단계로 계속합니다.

**사용자 오버라이드:** 사용자가 명시적으로 특정 tier를 요청하면 (예: "모든 패스 실행", "paranoid review", "full adversarial", "4패스 모두 실행", "thorough review"), diff 크기와 관계없이 해당 요청을 따릅니다. 매칭되는 tier 섹션으로 이동합니다.

**diff 크기에 따른 tier 자동 선택:**
- **Small (< 50줄 변경):** adversarial 리뷰를 완전히 건너뜁니다. 출력: "작은 diff ($DIFF_TOTAL줄) — adversarial 리뷰 건너뜀." 다음 단계로 계속합니다.
- **Medium (50-199줄 변경):** Codex adversarial challenge를 실행합니다 (Codex 사용 불가 시 Claude adversarial subagent). "Medium tier" 섹션으로 이동합니다.
- **Large (200+줄 변경):** 나머지 모든 패스를 실행합니다 — Codex structured review + Claude adversarial subagent + Codex adversarial. "Large tier" 섹션으로 이동합니다.

---

### Medium tier (50-199줄)

Claude의 structured review는 이미 실행되었습니다. 이제 **cross-model adversarial challenge**를 추가합니다.

**Codex가 사용 가능하면:** Codex adversarial challenge를 실행합니다. **Codex가 사용 불가하면:** 대신 Claude adversarial subagent로 대체합니다.

**Codex adversarial:**

```bash
TMPERR_ADV=$(mktemp /tmp/codex-adv-XXXXXXXX)
codex exec "Review the changes on this branch against the base branch. Run git diff origin/<base> to see the diff. Your job is to find ways this code will fail in production. Think like an attacker and a chaos engineer. Find edge cases, race conditions, security holes, resource leaks, failure modes, and silent data corruption paths. Be adversarial. Be thorough. No compliments — just the problems." -s read-only -c 'model_reasoning_effort="xhigh"' --enable web_search_cached 2>"$TMPERR_ADV"
```

Bash 도구의 `timeout` 파라미터를 `300000` (5분)으로 설정합니다. macOS에 없는 `timeout` 셸 명령은 사용하지 마세요. 명령 완료 후 stderr를 읽습니다:
```bash
cat "$TMPERR_ADV"
```

전체 출력을 그대로 제시합니다. 이것은 참고용입니다 — shipping을 차단하지 않습니다.

**에러 처리:** 모든 에러는 비차단입니다 — adversarial 리뷰는 품질 향상이지 전제 조건이 아닙니다.
- **인증 실패:** stderr에 "auth", "login", "unauthorized", "API key"가 있으면: "Codex 인증 실패. `codex login`을 실행하여 인증하세요."
- **Timeout:** "Codex가 5분 후 timeout."
- **빈 응답:** "Codex가 응답 없음. Stderr: <관련 에러 붙여넣기>."

Codex 에러 발생 시 자동으로 Claude adversarial subagent로 대체합니다.

**Claude adversarial subagent** (Codex 사용 불가하거나 에러 시 대체):

Agent 도구를 통해 디스패치합니다. subagent는 새로운 컨텍스트를 가지고 있어 structured review의 체크리스트 편향이 없습니다. 이 진정한 독립성이 주 리뷰어가 놓치는 것을 잡아냅니다.

Subagent 프롬프트:
"Read the diff for this branch with `git diff origin/<base>`. Think like an attacker and a chaos engineer. Your job is to find ways this code will fail in production. Look for: edge cases, race conditions, security holes, resource leaks, failure modes, silent data corruption, logic errors that produce wrong results silently, error handling that swallows failures, and trust boundary violations. Be adversarial. Be thorough. No compliments — just the problems. For each finding, classify as FIXABLE (you know how to fix it) or INVESTIGATE (needs human judgment)."

발견사항을 `ADVERSARIAL REVIEW (Claude subagent):` 헤더 아래에 제시합니다. **FIXABLE 발견사항**은 structured review와 동일한 Fix-First 파이프라인으로 흐릅니다. **INVESTIGATE 발견사항**은 참고용으로 제시합니다.

subagent가 실패하거나 timeout되면: "Claude adversarial subagent 사용 불가. adversarial 리뷰 없이 계속합니다."

**리뷰 결과를 저장합니다:**
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"adversarial-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","tier":"medium","commit":"'"$(git rev-parse --short HEAD)"'"}'
```
STATUS 대체: 발견사항 없으면 "clean", 있으면 "issues_found". SOURCE: Codex가 실행되었으면 "codex", subagent가 실행되었으면 "claude". 둘 다 실패하면 저장하지 않습니다.

**정리:** 처리 후 `rm -f "$TMPERR_ADV"`를 실행합니다 (Codex를 사용한 경우).

---

### Large tier (200+줄)

Claude의 structured review는 이미 실행되었습니다. 이제 최대 커버리지를 위해 **나머지 세 패스 모두**를 실행합니다:

**1. Codex structured review (사용 가능한 경우):**
```bash
TMPERR=$(mktemp /tmp/codex-review-XXXXXXXX)
codex review --base <base> -c 'model_reasoning_effort="xhigh"' --enable web_search_cached 2>"$TMPERR"
```

Bash 도구의 `timeout` 파라미터를 `300000` (5분)으로 설정합니다. macOS에 없는 `timeout` 셸 명령은 사용하지 마세요. 출력을 `CODEX SAYS (code review):` 헤더 아래에 제시합니다.
`[P1]` 마커를 확인합니다: 있으면 → `GATE: FAIL`, 없으면 → `GATE: PASS`.

GATE가 FAIL이면 AskUserQuestion을 사용합니다:
```
Codex가 diff에서 N개의 critical 이슈를 발견했습니다.

A) 지금 조사하고 수정 (권장)
B) 계속 — 리뷰는 완료됩니다
```

A이면: 발견사항을 해결합니다. 수정 후 코드가 변경되었으므로 테스트를 재실행합니다 (Step 3). `codex review`를 재실행하여 확인합니다.

stderr에서 에러를 읽습니다 (medium tier와 동일한 에러 처리).

stderr 이후: `rm -f "$TMPERR"`

**2. Claude adversarial subagent:** adversarial 프롬프트로 subagent를 디스패치합니다 (medium tier와 동일한 프롬프트). Codex 가용성과 관계없이 항상 실행합니다.

**3. Codex adversarial challenge (사용 가능한 경우):** adversarial 프롬프트로 `codex exec`를 실행합니다 (medium tier와 동일).

1단계와 3단계에서 Codex를 사용할 수 없으면 사용자에게 메모: "Codex CLI를 찾을 수 없음 — 큰 diff 리뷰가 Claude structured + Claude adversarial (4패스 중 2패스)로 실행됨. 전체 4패스 커버리지를 위해 Codex를 설치하세요: `npm install -g @openai/codex`"

**모든 패스 완료 후** (각 하위 단계 후가 아닌) 리뷰 결과를 저장합니다:
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"adversarial-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","tier":"large","gate":"GATE","commit":"'"$(git rev-parse --short HEAD)"'"}'
```
대체: STATUS = 모든 패스에서 발견사항이 없으면 "clean", 어떤 패스에서든 이슈가 있으면 "issues_found". SOURCE = Codex가 실행되었으면 "both", Claude subagent만 실행되었으면 "claude". GATE = Codex structured review 게이트 결과 ("pass"/"fail"), Codex 사용 불가 시 "informational". 모든 패스가 실패하면 저장하지 않습니다.

---

### Cross-model 종합 (medium 및 large tier)

모든 패스 완료 후, 모든 소스의 발견사항을 종합합니다:

```
ADVERSARIAL REVIEW SYNTHESIS (auto: TIER, N lines):
════════════════════════════════════════════════════════════
  High confidence (found by multiple sources): [findings agreed on by >1 pass]
  Unique to Claude structured review: [from earlier step]
  Unique to Claude adversarial: [from subagent, if ran]
  Unique to Codex: [from codex adversarial or code review, if ran]
  Models used: Claude structured ✓  Claude adversarial ✓/✗  Codex ✓/✗
════════════════════════════════════════════════════════════
```

높은 확신도의 발견사항 (여러 소스에서 합의된 것)을 수정 우선순위로 지정합니다.

---

## Step 4: Version bump (자동 결정)

1. 현재 `VERSION` 파일을 읽습니다 (4자리 형식: `MAJOR.MINOR.PATCH.MICRO`)

2. **diff에 기반하여 bump 수준을 자동 결정합니다:**
   - 변경된 줄 수를 셉니다 (`git diff origin/<base>...HEAD --stat | tail -1`)
   - **MICRO** (4번째 자릿수): 50줄 미만 변경, 사소한 수정, 오타, 설정
   - **PATCH** (3번째 자릿수): 50줄 이상 변경, 버그 수정, 소중규모 기능
   - **MINOR** (2번째 자릿수): **사용자에게 질문** — 주요 기능이나 상당한 아키텍처 변경에만
   - **MAJOR** (1번째 자릿수): **사용자에게 질문** — 마일스톤이나 breaking 변경에만

3. 새 버전을 계산합니다:
   - 자릿수를 bump하면 그 오른쪽의 모든 자릿수를 0으로 리셋합니다
   - 예: `0.19.1.0` + PATCH → `0.19.2.0`

4. 새 버전을 `VERSION` 파일에 작성합니다.

---

## Step 5: CHANGELOG (자동 생성)

1. `CHANGELOG.md` 헤더를 읽어 형식을 파악합니다.

2. **branch의 모든 commit**에서 항목을 자동 생성합니다 (최근 것만이 아닌):
   - `git log <base>..HEAD --oneline`으로 ship되는 모든 commit을 확인합니다
   - `git diff <base>...HEAD`로 base branch에 대한 전체 diff를 확인합니다
   - CHANGELOG 항목은 PR에 들어가는 모든 변경사항을 포괄해야 합니다
   - branch의 기존 CHANGELOG 항목이 이미 일부 commit을 커버하면, 새 버전을 위한 하나의 통합 항목으로 대체합니다
   - 변경사항을 해당되는 섹션으로 분류합니다:
     - `### Added` — 새 기능
     - `### Changed` — 기존 기능 변경
     - `### Fixed` — 버그 수정
     - `### Removed` — 제거된 기능
   - 간결하고 설명적인 항목을 작성합니다
   - 파일 헤더 이후 (5번째 줄)에 삽입하고, 오늘 날짜를 사용합니다
   - 형식: `## [X.Y.Z.W] - YYYY-MM-DD`

**사용자에게 변경사항을 설명하라고 질문하지 마세요.** diff와 commit 히스토리에서 추론합니다.

---

## Step 5.5: TODOS.md (자동 업데이트)

프로젝트의 TODOS.md를 ship되는 변경사항과 대조합니다. 완료된 항목을 자동으로 표시하고; 파일이 없거나 정리되지 않은 경우에만 프롬프트합니다.

`.claude/skills/review/TODOS-format.md`에서 정규 형식 참조를 읽습니다.

**1. 저장소 루트에 TODOS.md가 있는지 확인합니다.**

**TODOS.md가 없는 경우:** AskUserQuestion을 사용합니다:
- 메시지: "GStack은 스킬/컴포넌트별로 정리하고 우선순위(P0 상단, P4 하단, 맨 아래 Completed)로 구성된 TODOS.md를 유지할 것을 권장합니다. 전체 형식은 TODOS-format.md를 참조하세요. 생성하시겠습니까?"
- 옵션: A) 지금 생성, B) 지금은 건너뛰기
- A이면: `TODOS.md`를 스켈레톤으로 생성합니다 (# TODOS 제목 + ## Completed 섹션). 3단계로 계속합니다.
- B이면: Step 5.5의 나머지를 건너뜁니다. Step 6으로 계속합니다.

**2. 구조와 정리 상태를 확인합니다:**

TODOS.md를 읽고 권장 구조를 따르는지 확인합니다:
- `## <Skill/Component>` 제목 아래에 항목이 그룹화됨
- 각 항목에 `**Priority:**` 필드와 P0-P4 값이 있음
- 하단에 `## Completed` 섹션이 있음

**정리되지 않은 경우** (우선순위 필드 누락, 컴포넌트 그룹핑 없음, Completed 섹션 없음): AskUserQuestion을 사용합니다:
- 메시지: "TODOS.md가 권장 구조를 따르지 않습니다 (스킬/컴포넌트 그룹핑, P0-P4 우선순위, Completed 섹션). 정리하시겠습니까?"
- 옵션: A) 지금 정리 (권장), B) 그대로 유지
- A이면: TODOS-format.md를 따라 현장에서 정리합니다. 모든 내용을 보존합니다 — 재구성만, 항목 삭제 금지.
- B이면: 재구성 없이 3단계로 계속합니다.

**3. 완료된 TODO를 감지합니다:**

이 단계는 완전 자동입니다 — 사용자 상호작용 없음.

이전 단계에서 이미 수집한 diff와 commit 히스토리를 사용합니다:
- `git diff <base>...HEAD` (base branch에 대한 전체 diff)
- `git log <base>..HEAD --oneline` (ship되는 모든 commit)

각 TODO 항목에 대해, 이 PR의 변경사항이 완료하는지 다음으로 확인합니다:
- commit 메시지를 TODO 제목 및 설명과 매칭
- TODO에서 참조된 파일이 diff에 나타나는지 확인
- TODO의 설명된 작업이 기능적 변경과 일치하는지 확인

**보수적으로 판단합니다:** diff에 명확한 증거가 있을 때만 TODO를 완료로 표시합니다. 불확실하면 그대로 둡니다.

**4. 완료된 항목을** 하단의 `## Completed` 섹션으로 이동합니다. 추가: `**Completed:** vX.Y.Z (YYYY-MM-DD)`

**5. 요약 출력:**
- `TODOS.md: N개 항목 완료 표시 (item1, item2, ...). M개 항목 남음.`
- 또는: `TODOS.md: 완료된 항목 감지 없음. M개 항목 남음.`
- 또는: `TODOS.md: 생성됨.` / `TODOS.md: 정리됨.`

**6. 방어적:** TODOS.md를 작성할 수 없으면 (권한 에러, 디스크 부족), 사용자에게 경고하고 계속합니다. TODOS 실패로 ship 워크플로우를 멈추지 않습니다.

이 요약을 저장합니다 — Step 8의 PR 본문에 들어갑니다.

---

## Step 6: 커밋 (bisect 가능한 청크)

**목표:** `git bisect`와 잘 작동하고 LLM이 무엇이 변경되었는지 이해하는 데 도움이 되는 작고 논리적인 commit을 생성합니다.

1. diff를 분석하고 변경사항을 논리적 commit으로 그룹화합니다. 각 commit은 하나의 파일이 아닌 **하나의 일관된 변경** — 하나의 논리적 단위를 나타내야 합니다.

2. **커밋 순서** (먼저 오는 커밋부터):
   - **인프라:** 마이그레이션, 설정 변경, 라우트 추가
   - **모델 & 서비스:** 새 모델, 서비스, concerns (테스트 포함)
   - **컨트롤러 & 뷰:** 컨트롤러, 뷰, JS/React 컴포넌트 (테스트 포함)
   - **VERSION + CHANGELOG + TODOS.md:** 항상 마지막 커밋

3. **분할 규칙:**
   - 모델과 테스트 파일은 같은 커밋에
   - 서비스와 테스트 파일은 같은 커밋에
   - 컨트롤러, 뷰, 테스트는 같은 커밋에
   - 마이그레이션은 별도 커밋 (또는 지원하는 모델과 그룹)
   - 설정/라우트 변경은 활성화하는 기능과 그룹 가능
   - 전체 diff가 작으면 (< 50줄, < 4 파일) 단일 커밋으로 충분

4. **각 커밋은 독립적으로 유효해야 합니다** — 깨진 import 없음, 아직 존재하지 않는 코드에 대한 참조 없음. 의존성이 먼저 오도록 커밋을 정렬합니다.

5. 각 커밋 메시지를 작성합니다:
   - 첫 줄: `<type>: <summary>` (type = feat/fix/chore/refactor/docs)
   - 본문: 이 커밋에 포함된 내용에 대한 간략한 설명
   - **마지막 커밋** (VERSION + CHANGELOG)에만 버전 태그와 co-author 트레일러가 들어갑니다:

```bash
git commit -m "$(cat <<'EOF'
chore: bump version and changelog (vX.Y.Z.W)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Step 6.5: 검증 게이트

**철칙: 새로운 검증 증거 없이 완료를 주장하지 않습니다.**

push 전에, Step 4-6에서 코드가 변경되었으면 재검증합니다:

1. **테스트 검증:** Step 3의 테스트 실행 이후 코드가 변경되었으면 (리뷰 발견사항의 수정, CHANGELOG 편집은 해당하지 않음), 테스트 스위트를 재실행합니다. 새 출력을 붙여넣습니다. Step 3의 오래된 출력은 허용되지 않습니다.

2. **빌드 검증:** 프로젝트에 빌드 단계가 있으면 실행합니다. 출력을 붙여넣습니다.

3. **합리화 방지:**
   - "지금은 작동할 거야" → 실행하세요.
   - "확신합니다" → 확신은 증거가 아닙니다.
   - "이전에 이미 테스트했어" → 그 이후 코드가 변경되었습니다. 다시 테스트하세요.
   - "사소한 변경이야" → 사소한 변경이 프로덕션을 깨뜨립니다.

**여기서 테스트가 실패하면:** 멈춥니다. push하지 않습니다. 이슈를 수정하고 Step 3으로 돌아갑니다.

검증 없이 작업이 완료되었다고 주장하는 것은 효율성이 아니라 부정직입니다.

---

## Step 7: Push

upstream 추적으로 리모트에 push합니다:

```bash
git push -u origin <branch-name>
```

---

## Step 8: PR 생성

`gh`를 사용하여 pull request를 생성합니다:

```bash
gh pr create --base <base> --title "<type>: <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points from CHANGELOG>

## Test Coverage
<coverage diagram from Step 3.4, or "All new code paths have test coverage.">
<If Step 3.4 ran: "Tests: {before} → {after} (+{delta} new)">

## Pre-Landing Review
<findings from Step 3.5 code review, or "No issues found.">

## Design Review
<If design review ran: "Design Review (lite): N findings — M auto-fixed, K skipped. AI Slop: clean/N issues.">
<If no frontend files changed: "No frontend files changed — design review skipped.">

## Eval Results
<If evals ran: suite names, pass/fail counts, cost dashboard summary. If skipped: "No prompt-related files changed — evals skipped.">

## Greptile Review
<If Greptile comments were found: bullet list with [FIXED] / [FALSE POSITIVE] / [ALREADY FIXED] tag + one-line summary per comment>
<If no Greptile comments found: "No Greptile comments.">
<If no PR existed during Step 3.75: omit this section entirely>

## TODOS
<If items marked complete: bullet list of completed items with version>
<If no items completed: "No TODO items completed in this PR.">
<If TODOS.md created or reorganized: note that>
<If TODOS.md doesn't exist and user skipped: omit this section>

## Test plan
- [x] All Rails tests pass (N runs, 0 failures)
- [x] All Vitest tests pass (N tests)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**PR URL을 출력합니다** — 그 다음 Step 8.5로 진행합니다.

---

## Step 8.5: /document-release 자동 호출

PR이 생성된 후 프로젝트 문서를 자동으로 동기화합니다. 이 스킬의 디렉토리에 인접한 `document-release/SKILL.md` 스킬 파일을 읽고 전체 워크플로우를 실행합니다:

1. `/document-release` 스킬을 읽습니다: `cat ${CLAUDE_SKILL_DIR}/../document-release/SKILL.md`
2. 지침을 따릅니다 — 프로젝트의 모든 .md 파일을 읽고, diff와 대조하여, 드리프트된 것을 업데이트합니다 (README, ARCHITECTURE, CONTRIBUTING, CLAUDE.md, TODOS 등)
3. 문서가 업데이트되었으면 변경사항을 커밋하고 같은 branch에 push합니다:
   ```bash
   git add -A && git commit -m "docs: sync documentation with shipped changes" && git push
   ```
4. 업데이트할 문서가 없으면 "문서가 최신 상태입니다 — 업데이트 불필요."라고 합니다.

이 단계는 자동입니다. 사용자에게 확인을 요청하지 않습니다. 목표는 마찰 없는 문서 업데이트입니다 — 사용자가 `/ship`을 실행하면 별도의 명령 없이 문서가 최신 상태를 유지합니다.

---

## Important Rules (중요 규칙)

- **테스트를 절대 건너뛰지 않습니다.** 테스트가 실패하면 멈춥니다.
- **pre-landing 리뷰를 절대 건너뛰지 않습니다.** checklist.md를 읽을 수 없으면 멈춥니다.
- **절대 force push하지 않습니다.** 일반 `git push`만 사용합니다.
- **사소한 확인을 절대 요청하지 않습니다** (예: "push할까요?", "PR 만들까요?"). 멈추는 경우: version bump (MINOR/MAJOR), pre-landing 리뷰 발견사항 (ASK 항목), Codex structured review [P1] 발견사항 (큰 diff만).
- **항상 VERSION 파일의 4자리 버전 형식을 사용합니다.**
- **CHANGELOG의 날짜 형식:** `YYYY-MM-DD`
- **bisect 가능하도록 commit을 분할합니다** — 각 commit = 하나의 논리적 변경.
- **TODOS.md 완료 감지는 보수적이어야 합니다.** diff가 작업 완료를 명확히 보여줄 때만 항목을 완료로 표시합니다.
- **greptile-triage.md의 Greptile 응답 템플릿을 사용합니다.** 모든 응답에 증거(인라인 diff, 코드 참조, 재순위 제안)를 포함합니다. 모호한 응답을 절대 게시하지 않습니다.
- **새로운 검증 증거 없이 절대 push하지 않습니다.** Step 3 테스트 이후 코드가 변경되었으면 push 전에 재실행합니다.
- **Step 3.4는 커버리지 테스트를 생성합니다.** 커밋 전에 반드시 통과해야 합니다. 실패하는 테스트를 절대 커밋하지 않습니다.
- **목표: 사용자가 `/ship`이라고 하면, 다음으로 보는 것은 리뷰 + PR URL + 자동 동기화된 문서입니다.**
