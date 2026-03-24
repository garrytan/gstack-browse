---
name: retro
preamble-tier: 2
version: 2.0.0
description: |
  MANUAL TRIGGER ONLY: /retro 입력 시에만 실행합니다.
  주간 엔지니어링 회고입니다. commit 히스토리, 작업 패턴, 코드 품질 지표를
  분석하며 지속적인 히스토리 및 트렌드 추적을 지원합니다.
  팀 인식: 개인별 기여도를 분석하고 칭찬 및 성장 영역을 제시합니다.
  "weekly retro", "이번 주 뭐 했지", "engineering retrospective" 요청 시 사용하세요.
  작업 주간 또는 sprint 종료 시 사전 제안합니다.
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - AskUserQuestion
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
echo '{"skill":"retro","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
# zsh-compatible: use find instead of glob to avoid NOMATCH error
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do [ -f "$_PF" ] && ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true; break; done
```

`PROACTIVE`가 `"false"`인 경우, gstack 스킬을 사전 제안하지 마세요 — 사용자가 명시적으로 요청할 때만 실행합니다. 사용자가 사전 제안을 거부한 것입니다.

출력에 `UPGRADE_AVAILABLE <old> <new>`가 표시된 경우: `~/.claude/skills/gstack/gstack-upgrade/SKILL.md`를 읽고 "Inline upgrade flow"를 따르세요 (설정되어 있으면 자동 업그레이드, 아니면 AskUserQuestion으로 4가지 옵션 제시, 거부 시 snooze 상태 저장). `JUST_UPGRADED <from> <to>`인 경우: 사용자에게 "gstack v{to}로 실행 중입니다 (방금 업데이트됨!)"라고 알리고 계속 진행하세요.

`LAKE_INTRO`가 `no`인 경우: 계속하기 전에 완전성 원칙을 소개하세요.
사용자에게 다음과 같이 알려주세요: "gstack은 **Boil the Lake** 원칙을 따릅니다 — AI가 한계 비용을 거의 0에 가깝게 만들 때 항상 완전한 구현을 합니다. 자세히: https://garryslist.org/posts/boil-the-ocean"
그런 다음 기본 브라우저로 에세이를 열지 물어보세요:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

사용자가 동의한 경우에만 `open`을 실행하세요. `touch`는 항상 실행합니다. 이것은 한 번만 발생합니다.

`TEL_PROMPTED`가 `no`이고 `LAKE_INTRO`가 `yes`인 경우: Lake 소개가 처리된 후 사용자에게 텔레메트리에 대해 물어보세요. AskUserQuestion을 사용하세요:

> gstack 개선에 도움을 주세요! 커뮤니티 모드는 사용 데이터(어떤 스킬을 사용하는지, 소요 시간, 충돌 정보)를 안정적인 디바이스 ID와 함께 공유하여 트렌드 추적과 버그 수정을 빠르게 합니다.
> 코드, 파일 경로, 저장소 이름은 절대 전송되지 않습니다.
> `gstack-config set telemetry off`로 언제든 변경할 수 있습니다.

옵션:
- A) gstack 개선에 도움을 줄게요! (권장)
- B) 아니요, 괜찮습니다

A를 선택한 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry community` 실행

B를 선택한 경우: 후속 AskUserQuestion을 물어보세요:

> 익명 모드는 어떠세요? *누군가*가 gstack을 사용했다는 것만 알게 됩니다 — 고유 ID 없이, 세션을 연결할 방법도 없습니다. 누군가 쓰고 있는지 알 수 있는 카운터일 뿐입니다.

옵션:
- A) 네, 익명 모드는 괜찮아요
- B) 아니요, 완전히 끄겠습니다

B→A인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous` 실행
B→B인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry off` 실행

항상 실행하세요:
```bash
touch ~/.gstack/.telemetry-prompted
```

이것은 한 번만 발생합니다. `TEL_PROMPTED`가 `yes`이면 이 부분을 완전히 건너뛰세요.

## AskUserQuestion 형식

**모든 AskUserQuestion 호출 시 반드시 이 구조를 따르세요:**
1. **현재 상태 확인:** 프로젝트, 현재 브랜치(preamble에서 출력된 `_BRANCH` 값 사용 — 대화 기록이나 gitStatus의 브랜치가 아님), 현재 계획/작업을 명시하세요. (1-2문장)
2. **쉽게 설명:** 똑똑한 16세가 이해할 수 있는 평이한 한국어로 문제를 설명하세요. 원시 함수명, 내부 전문 용어, 구현 세부 사항 없이. 구체적인 예시와 비유를 사용하세요. 뭐라고 부르는지가 아니라 무엇을 하는지 설명하세요.
3. **추천:** `추천: [X]를 선택하세요. 이유: [한 줄 설명]` — 항상 지름길보다 완전한 옵션을 선호하세요 (완전성 원칙 참조). 각 옵션에 `완전성: X/10`을 포함하세요. 기준: 10 = 완전한 구현 (모든 엣지 케이스, 전체 커버리지), 7 = 기본 경로는 커버하지만 일부 엣지 생략, 3 = 상당한 작업을 미루는 지름길. 두 옵션 모두 8+ 이면 더 높은 것을 선택하고, 하나가 ≤5이면 표시하세요.
4. **옵션:** 알파벳 옵션: `A) ... B) ... C) ...` — 옵션이 노력을 수반할 때 두 스케일 모두 표시: `(human: ~X / CC: ~Y)`

사용자가 20분 동안 이 창을 보지 않았고 코드를 열어두지 않았다고 가정하세요. 소스를 읽어야 자신의 설명을 이해할 수 있다면, 너무 복잡한 것입니다.

스킬별 지침이 이 기본 형식 위에 추가 형식 규칙을 더할 수 있습니다.

## 완전성 원칙 — Boil the Lake

AI는 완전성을 거의 무료로 만듭니다. 항상 지름길보다 완전한 옵션을 추천하세요 — CC+gstack으로 차이는 몇 분입니다. "lake" (100% 커버리지, 모든 엣지 케이스)는 끓일 수 있고, "ocean" (전체 재작성, 다분기 마이그레이션)은 끓일 수 없습니다. Lake는 끓이고, ocean은 표시하세요.

**노력 참조** — 항상 두 스케일 모두 표시:

| Task type | Human team | CC+gstack | Compression |
|-----------|-----------|-----------|-------------|
| Boilerplate | 2 days | 15 min | ~100x |
| Tests | 1 day | 15 min | ~50x |
| Feature | 1 week | 30 min | ~30x |
| Bug fix | 4 hours | 15 min | ~20x |

각 옵션에 `완전성: X/10`을 포함하세요 (10=모든 엣지 케이스, 7=기본 경로, 3=지름길).

## Contributor Mode

`_CONTRIB`가 `true`인 경우: **contributor mode**입니다. 주요 워크플로우 단계가 끝날 때마다 gstack 경험을 0-10으로 평가하세요. 10이 아니고 실행 가능한 버그나 개선 사항이 있다면 — 필드 리포트를 작성하세요.

**작성 대상:** 입력이 합리적이었지만 gstack이 실패한 툴링 버그만. **건너뛰기:** 사용자 앱 버그, 네트워크 오류, 사용자 사이트의 인증 실패.

**작성 방법:** `~/.gstack/contributor-logs/{slug}.md`에 작성:
```
# {Title}
**What I tried:** {action} | **What happened:** {result} | **Rating:** {0-10}
## Repro
1. {step}
## What would make this a 10
{one sentence}
**Date:** {YYYY-MM-DD} | **Version:** {version} | **Skill:** /{skill}
```
Slug: 소문자 하이픈, 최대 60자. 이미 존재하면 건너뛰기. 세션당 최대 3개. 인라인으로 작성하고, 멈추지 마세요.

## 완료 상태 프로토콜

스킬 워크플로우 완료 시, 다음 중 하나로 상태를 보고하세요:
- **DONE** — 모든 단계가 성공적으로 완료되었습니다. 각 주장에 대한 증거를 제공합니다.
- **DONE_WITH_CONCERNS** — 완료되었지만, 사용자가 알아야 할 이슈가 있습니다. 각 우려 사항을 나열합니다.
- **BLOCKED** — 진행할 수 없습니다. 차단 요인과 시도한 내용을 명시합니다.
- **NEEDS_CONTEXT** — 계속하려면 누락된 정보가 필요합니다. 정확히 무엇이 필요한지 명시합니다.

### 에스컬레이션

작업을 멈추고 "이건 너무 어렵습니다" 또는 "이 결과에 확신이 없습니다"라고 말해도 괜찮습니다.

잘못된 작업은 작업하지 않는 것보다 나쁩니다. 에스컬레이션해도 불이익은 없습니다.
- 작업을 3번 시도했는데 성공하지 못했다면, 멈추고 에스컬레이션하세요.
- 보안에 민감한 변경이 확실하지 않다면, 멈추고 에스컬레이션하세요.
- 작업 범위가 검증할 수 있는 범위를 넘는다면, 멈추고 에스컬레이션하세요.

에스컬레이션 형식:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```

## Telemetry (텔레메트리 — 마지막에 실행)

스킬 워크플로우가 완료된 후 (성공, 오류, 또는 중단), 텔레메트리 이벤트를 기록합니다.
이 파일의 YAML frontmatter에서 `name:` 필드로 스킬 이름을 결정합니다.
워크플로우 결과에서 결과를 결정합니다 (정상 완료 시 success, 실패 시 error,
사용자가 중단한 경우 abort).

**PLAN MODE 예외 — 항상 실행:** 이 명령은 `~/.gstack/analytics/`
(사용자 설정 디렉토리, 프로젝트 파일이 아님)에 텔레메트리를 기록합니다.
스킬 preamble이 이미 같은 디렉토리에 기록합니다 — 동일한 패턴입니다.
이 명령을 건너뛰면 세션 지속 시간 및 결과 데이터가 손실됩니다.

다음 bash를 실행하세요:

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
~/.claude/skills/gstack/bin/gstack-telemetry-log \
  --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \
  --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
```

`SKILL_NAME`은 frontmatter의 실제 스킬 이름으로, `OUTCOME`은
success/error/abort로, `USED_BROWSE`는 `$B` 사용 여부에 따라 true/false로 교체하세요.
결과를 판단할 수 없으면 "unknown"을 사용하세요. 백그라운드에서 실행되며
사용자를 차단하지 않습니다.

## Plan Status Footer (플랜 상태 푸터)

plan mode에서 ExitPlanMode를 호출하기 전에:

1. 플랜 파일에 `## GSTACK REVIEW REPORT` 섹션이 이미 있는지 확인하세요.
2. 있다면 — 건너뛰세요 (리뷰 스킬이 이미 더 풍부한 리포트를 작성했습니다).
3. 없다면 — 다음 명령을 실행하세요:

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-review-read
\`\`\`

그런 다음 플랜 파일 끝에 `## GSTACK REVIEW REPORT` 섹션을 작성하세요:

- 출력에 리뷰 항목이 포함되어 있으면 (`---CONFIG---` 앞의 JSONL 줄): 리뷰 스킬이 사용하는 것과 동일한 형식으로 실행 횟수/상태/발견 사항이 포함된 표준 리포트 테이블을 작성하세요.
- 출력이 `NO_REVIEWS`이거나 비어 있으면: 다음 플레이스홀더 테이블을 작성하세요:

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

**PLAN MODE 예외 — 항상 실행:** 이것은 플랜 파일에 기록하며, plan mode에서 편집이 허용된 유일한 파일입니다. 플랜 파일 리뷰 리포트는 플랜의 실시간 상태의 일부입니다.

## 기본 브랜치 감지

데이터 수집 전에 저장소의 기본 브랜치 이름을 감지하세요:
`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`

실패하면 `main`으로 폴백하세요. 아래 지침에서 `origin/<default>`라고 되어 있는 곳에 감지된 이름을 사용하세요.

---

# /retro — 주간 엔지니어링 회고

commit 히스토리, 작업 패턴, 코드 품질 지표를 분석하는 포괄적인 엔지니어링 회고를 생성합니다. 팀 인식: 명령을 실행하는 사용자를 식별한 다음, 모든 기여자를 개인별 칭찬 및 성장 기회와 함께 분석합니다. Claude Code를 생산성 배수로 활용하는 시니어 IC/CTO 수준의 빌더를 위해 설계되었습니다.

## 사용자 호출
사용자가 `/retro`를 입력하면 이 스킬을 실행합니다.

## 인자
- `/retro` — 기본값: 최근 7일
- `/retro 24h` — 최근 24시간
- `/retro 14d` — 최근 14일
- `/retro 30d` — 최근 30일
- `/retro compare` — 현재 기간과 이전 동일 기간 비교
- `/retro compare 14d` — 명시적 기간 지정 비교
- `/retro global` — 모든 AI 코딩 도구에 걸친 크로스 프로젝트 회고 (기본 7일)
- `/retro global 14d` — 명시적 기간 지정 크로스 프로젝트 회고

## 지침

인자를 파싱하여 시간 윈도우를 결정합니다. 인자가 없으면 기본 7일입니다. 모든 시간은 사용자의 **로컬 타임존**으로 표시합니다 (시스템 기본값 사용 — `TZ`를 설정하지 마세요).

**자정 정렬 윈도우:** 일(`d`) 및 주(`w`) 단위의 경우, 상대 문자열이 아닌 로컬 자정의 절대 시작 날짜를 계산합니다. 예를 들어, 오늘이 2026-03-18이고 윈도우가 7일이면: 시작 날짜는 2026-03-11입니다. git log 쿼리에 `--since="2026-03-11T00:00:00"`을 사용하세요 — 명시적 `T00:00:00` 접미사가 git이 자정부터 시작하도록 보장합니다. 이것 없이 `--since="2026-03-11"`을 오후 11시에 실행하면 오후 11시를 의미하며, 자정이 아닙니다. 주 단위의 경우 7을 곱하여 일수를 계산합니다 (예: `2w` = 14일 전). 시간(`h`) 단위의 경우, 하루 미만 윈도우에는 자정 정렬이 적용되지 않으므로 `--since="N hours ago"`를 사용하세요.

**인자 유효성 검사:** 인자가 숫자 뒤에 `d`, `h`, 또는 `w`가 오는 패턴, `compare`라는 단어 (선택적으로 윈도우가 뒤따름), 또는 `global`이라는 단어 (선택적으로 윈도우가 뒤따름)와 일치하지 않으면, 다음 사용법을 표시하고 중단하세요:
```
Usage: /retro [window | compare | global]
  /retro              — last 7 days (default)
  /retro 24h          — last 24 hours
  /retro 14d          — last 14 days
  /retro 30d          — last 30 days
  /retro compare      — compare this period vs prior period
  /retro compare 14d  — compare with explicit window
  /retro global       — cross-project retro across all AI tools (7d default)
  /retro global 14d   — cross-project retro with explicit window
```

**첫 번째 인자가 `global`인 경우:** 일반 저장소 범위 회고 (Step 1-14)를 건너뛰세요. 대신 이 문서 끝의 **Global Retrospective** 플로우를 따르세요. 선택적 두 번째 인자는 시간 윈도우입니다 (기본 7d). 이 모드는 git 저장소 안에 있을 필요가 없습니다.

### Step 1: 원시 데이터 수집

먼저, origin을 fetch하고 현재 사용자를 식별합니다:
```bash
git fetch origin <default> --quiet
# Identify who is running the retro
git config user.name
git config user.email
```

`git config user.name`이 반환하는 이름이 **"당신"**입니다 — 이 회고를 읽는 사람. 다른 모든 author는 팀원입니다. 이를 사용하여 내러티브를 구성하세요: "당신의" commit vs 팀원 기여.

다음 git 명령을 모두 병렬로 실행하세요 (서로 독립적입니다):

```bash
# 1. All commits in window with timestamps, subject, hash, AUTHOR, files changed, insertions, deletions
git log origin/<default> --since="<window>" --format="%H|%aN|%ae|%ai|%s" --shortstat

# 2. Per-commit test vs total LOC breakdown with author
#    Each commit block starts with COMMIT:<hash>|<author>, followed by numstat lines.
#    Separate test files (matching test/|spec/|__tests__/) from production files.
git log origin/<default> --since="<window>" --format="COMMIT:%H|%aN" --numstat

# 3. Commit timestamps for session detection and hourly distribution (with author)
git log origin/<default> --since="<window>" --format="%at|%aN|%ai|%s" | sort -n

# 4. Files most frequently changed (hotspot analysis)
git log origin/<default> --since="<window>" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn

# 5. PR numbers from commit messages (extract #NNN patterns)
git log origin/<default> --since="<window>" --format="%s" | grep -oE '#[0-9]+' | sed 's/^#//' | sort -n | uniq | sed 's/^/#/'

# 6. Per-author file hotspots (who touches what)
git log origin/<default> --since="<window>" --format="AUTHOR:%aN" --name-only

# 7. Per-author commit counts (quick summary)
git shortlog origin/<default> --since="<window>" -sn --no-merges

# 8. Greptile triage history (if available)
cat ~/.gstack/greptile-history.md 2>/dev/null || true

# 9. TODOS.md backlog (if available)
cat TODOS.md 2>/dev/null || true

# 10. Test file count
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' 2>/dev/null | grep -v node_modules | wc -l

# 11. Regression test commits in window
git log origin/<default> --since="<window>" --oneline --grep="test(qa):" --grep="test(design):" --grep="test: coverage"

# 12. gstack skill usage telemetry (if available)
cat ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true

# 12. Test files changed in window
git log origin/<default> --since="<window>" --format="" --name-only | grep -E '\.(test|spec)\.' | sort -u | wc -l
```

### Step 2: 지표 계산

다음 지표를 요약 테이블로 계산하고 제시하세요:

| Metric | Value |
|--------|-------|
| Commits to main | N |
| Contributors | N |
| PRs merged | N |
| Total insertions | N |
| Total deletions | N |
| Net LOC added | N |
| Test LOC (insertions) | N |
| Test LOC ratio | N% |
| Version range | vX.Y.Z.W → vX.Y.Z.W |
| Active days | N |
| Detected sessions | N |
| Avg LOC/session-hour | N |
| Greptile signal | N% (Y catches, Z FPs) |
| Test Health | N total tests · M added this period · K regression tests |

그런 다음 바로 아래에 **author별 리더보드**를 표시하세요:

```
Contributor         Commits   +/-          Top area
You (garry)              32   +2400/-300   browse/
alice                    12   +800/-150    app/services/
bob                       3   +120/-40     tests/
```

commit 수 내림차순으로 정렬합니다. 현재 사용자 (`git config user.name`에서)는 항상 맨 위에 "You (name)"으로 표시됩니다.

**Greptile signal (히스토리가 있는 경우):** `~/.gstack/greptile-history.md` (Step 1, 명령 8에서 가져옴)를 읽습니다. 날짜별로 회고 시간 윈도우 내의 항목을 필터링합니다. 유형별로 카운트: `fix`, `fp`, `already-fixed`. 시그널 비율 계산: `(fix + already-fixed) / (fix + already-fixed + fp)`. 윈도우 내에 항목이 없거나 파일이 존재하지 않으면 Greptile 지표 행을 건너뛰세요. 파싱 불가능한 줄은 조용히 건너뛰세요.

**Backlog Health (TODOS.md가 있는 경우):** `TODOS.md` (Step 1, 명령 9에서 가져옴)를 읽습니다. 계산:
- 전체 열린 TODO 수 (`## Completed` 섹션의 항목 제외)
- P0/P1 카운트 (중요/긴급 항목)
- P2 카운트 (중요 항목)
- 이 기간에 완료된 항목 (Completed 섹션에서 회고 윈도우 내 날짜가 있는 항목)
- 이 기간에 추가된 항목 (윈도우 내에서 TODOS.md를 수정한 commit과 교차 참조)

지표 테이블에 포함:
```
| Backlog Health | N open (X P0/P1, Y P2) · Z completed this period |
```

TODOS.md가 없으면 Backlog Health 행을 건너뛰세요.

**Skill Usage (분석 데이터가 있는 경우):** `~/.gstack/analytics/skill-usage.jsonl`이 존재하면 읽습니다. `ts` 필드로 회고 시간 윈도우 내의 항목을 필터링합니다. 스킬 활성화 (`event` 필드 없음)와 hook 실행 (`event: "hook_fire"`)을 분리합니다. 스킬 이름별로 집계합니다. 다음과 같이 제시:

```
| Skill Usage | /ship(12) /qa(8) /review(5) · 3 safety hook fires |
```

JSONL 파일이 없거나 윈도우 내 항목이 없으면 Skill Usage 행을 건너뛰세요.

**Eureka Moments (기록된 경우):** `~/.gstack/analytics/eureka.jsonl`이 존재하면 읽습니다. `ts` 필드로 회고 시간 윈도우 내의 항목을 필터링합니다. 각 eureka moment에 대해 이를 표시한 스킬, 브랜치, 인사이트의 한 줄 요약을 보여줍니다. 다음과 같이 제시:

```
| Eureka Moments | 2 this period |
```

moment가 있으면 나열합니다:
```
  EUREKA /office-hours (branch: garrytan/auth-rethink): "Session tokens don't need server storage — browser crypto API makes client-side JWT validation viable"
  EUREKA /plan-eng-review (branch: garrytan/cache-layer): "Redis isn't needed here — Bun's built-in LRU cache handles this workload"
```

JSONL 파일이 없거나 윈도우 내 항목이 없으면 Eureka Moments 행을 건너뛰세요.

### Step 3: Commit 시간 분포

로컬 시간 기준 시간별 히스토그램을 막대 차트로 표시합니다:

```
Hour  Commits  ████████████████
 00:    4      ████
 07:    5      █████
 ...
```

다음을 식별하고 강조하세요:
- 피크 시간대
- 비활성 구간
- 패턴이 이중봉(아침/저녁)인지 연속적인지
- 야간 코딩 클러스터 (오후 10시 이후)

### Step 4: 작업 세션 감지

연속 commit 간 **45분 간격** 기준으로 세션을 감지합니다. 각 세션에 대해 보고:
- 시작/종료 시간 (Pacific)
- Commit 수
- 지속 시간 (분)

세션 분류:
- **딥 세션** (50분 이상)
- **미디엄 세션** (20-50분)
- **마이크로 세션** (20분 미만, 보통 단일 commit 후 바로 끝남)

계산:
- 총 활성 코딩 시간 (세션 지속 시간 합계)
- 평균 세션 길이
- 활성 시간당 LOC

### Step 5: Commit 유형 분류

conventional commit 접두사(feat/fix/refactor/test/chore/docs)별로 분류합니다. 백분율 막대로 표시:

```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
refactor:  2  ( 4%)  ██
```

fix 비율이 50%를 초과하면 경고 — "빠르게 출시하고 빠르게 고치는" 패턴으로, 리뷰 공백을 나타낼 수 있습니다.

### Step 6: 핫스팟 분석

가장 많이 변경된 상위 10개 파일을 표시합니다. 표시할 것:
- 5회 이상 변경된 파일 (churn 핫스팟)
- 핫스팟 목록에서 테스트 파일 vs 프로덕션 파일
- VERSION/CHANGELOG 빈도 (버전 관리 규율 지표)

### Step 7: PR 크기 분포

commit diff에서 PR 크기를 추정하고 버킷으로 분류합니다:
- **Small** (<100 LOC)
- **Medium** (100-500 LOC)
- **Large** (500-1500 LOC)
- **XL** (1500+ LOC)

### Step 8: 집중도 점수 + 이번 주의 출시물

**집중도 점수:** 가장 많이 변경된 단일 최상위 디렉토리(예: `app/services/`, `app/views/`)를 건드리는 commit의 백분율을 계산합니다. 높은 점수 = 깊은 집중 작업. 낮은 점수 = 분산된 컨텍스트 스위칭. 다음과 같이 보고: "집중도 점수: 62% (app/services/)"

**이번 주의 출시물:** 윈도우에서 가장 LOC가 높은 단일 PR을 자동 식별합니다. 강조:
- PR 번호 및 제목
- 변경된 LOC
- 중요한 이유 (commit 메시지 및 변경된 파일에서 추론)

### Step 9: 팀원 분석

각 기여자 (현재 사용자 포함)에 대해 계산:

1. **Commit 및 LOC** — 총 commit 수, 삽입, 삭제, 순 LOC
2. **집중 영역** — 가장 많이 건드린 디렉토리/파일 (상위 3개)
3. **Commit 유형 비율** — 개인별 feat/fix/refactor/test 분류
4. **세션 패턴** — 코딩 시간대 (피크 시간), 세션 수
5. **테스트 규율** — 개인별 test LOC 비율
6. **가장 큰 출시물** — 윈도우 내 가장 영향력 있는 commit 또는 PR

**현재 사용자 ("당신"):** 이 섹션이 가장 깊이 다룹니다. 솔로 회고의 모든 세부 사항 — 세션 분석, 시간 패턴, 집중도 점수를 포함합니다. 1인칭으로 구성: "당신의 피크 시간...", "당신의 가장 큰 출시물..."

**각 팀원:** 그들이 무엇을 작업했고 어떤 패턴인지 2-3문장으로 작성합니다. 그런 다음:

- **칭찬** (구체적인 것 1-2개): 실제 commit에 근거하세요. "잘했어요"가 아니라 — 정확히 무엇이 좋았는지 말하세요. 예시: "3개의 집중 세션에서 전체 auth 미들웨어 재작성을 45% 테스트 커버리지로 출시", "모든 PR이 200 LOC 미만 — 규율 있는 분해."
- **성장 기회** (구체적인 것 1개): 비판이 아닌 레벨업 제안으로 구성하세요. 실제 데이터에 근거하세요. 예시: "이번 주 테스트 비율이 12%였습니다 — 더 복잡해지기 전에 payment 모듈에 테스트 커버리지를 투자하면 좋겠습니다", "같은 파일에 5개의 fix commit은 원래 PR에서 리뷰 패스가 필요했을 수 있음을 시사합니다."

**기여자가 한 명뿐인 경우 (솔로 저장소):** 팀 분석을 건너뛰고 이전처럼 진행하세요 — 회고는 개인적인 것입니다.

**Co-Authored-By 트레일러가 있는 경우:** commit 메시지에서 `Co-Authored-By:` 줄을 파싱합니다. 해당 author를 주요 author와 함께 commit에 크레딧합니다. AI 공동 저자 (예: `noreply@anthropic.com`)는 기록하되 팀원에 포함하지 마세요 — 대신 "AI 지원 commit"을 별도 지표로 추적하세요.

### Step 10: 주간 트렌드 (윈도우 >= 14일인 경우)

시간 윈도우가 14일 이상인 경우, 주간 버킷으로 나누어 트렌드를 표시합니다:
- 주당 commit 수 (전체 및 author별)
- 주당 LOC
- 주당 테스트 비율
- 주당 fix 비율
- 주당 세션 수

### Step 11: 연속 기록 추적

오늘부터 거슬러 올라가며 origin/<default>에 최소 1개 commit이 있는 연속 일수를 셉니다. 팀 연속 기록과 개인 연속 기록 모두 추적:

```bash
# Team streak: all unique commit dates (local time) — no hard cutoff
git log origin/<default> --format="%ad" --date=format:"%Y-%m-%d" | sort -u

# Personal streak: only the current user's commits
git log origin/<default> --author="<user_name>" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

오늘부터 역산 — 최소 한 개의 commit이 있는 연속 일수는? 전체 히스토리를 쿼리하므로 어떤 길이의 연속 기록도 정확하게 보고됩니다. 둘 다 표시:
- "팀 출시 연속 기록: 47일 연속"
- "당신의 출시 연속 기록: 32일 연속"

### Step 12: 히스토리 로드 및 비교

새 스냅샷을 저장하기 전에, 이전 회고 히스토리를 확인합니다:

```bash
ls -t .context/retros/*.json 2>/dev/null
```

**이전 회고가 존재하는 경우:** Read 도구로 가장 최근 것을 로드합니다. 주요 지표의 델타를 계산하고 **이전 회고 대비 트렌드** 섹션을 포함합니다:
```
                    Last        Now         Delta
Test ratio:         22%    →    41%         ↑19pp
Sessions:           10     →    14          ↑4
LOC/hour:           200    →    350         ↑75%
Fix ratio:          54%    →    30%         ↓24pp (improving)
Commits:            32     →    47          ↑47%
Deep sessions:      3      →    5           ↑2
```

**이전 회고가 없는 경우:** 비교 섹션을 건너뛰고 다음을 추가: "첫 번째 회고가 기록되었습니다 — 다음 주에 다시 실행하면 트렌드를 볼 수 있습니다."

### Step 13: 회고 히스토리 저장

모든 지표(연속 기록 포함)를 계산하고 비교를 위한 이전 히스토리를 로드한 후, JSON 스냅샷을 저장합니다:

```bash
mkdir -p .context/retros
```

오늘의 다음 시퀀스 번호를 결정합니다 (실제 날짜로 `$(date +%Y-%m-%d)`를 대체):
```bash
# Count existing retros for today to get next sequence number
today=$(date +%Y-%m-%d)
existing=$(ls .context/retros/${today}-*.json 2>/dev/null | wc -l | tr -d ' ')
next=$((existing + 1))
# Save as .context/retros/${today}-${next}.json
```

Write 도구를 사용하여 다음 스키마로 JSON 파일을 저장합니다:
```json
{
  "date": "2026-03-08",
  "window": "7d",
  "metrics": {
    "commits": 47,
    "contributors": 3,
    "prs_merged": 12,
    "insertions": 3200,
    "deletions": 800,
    "net_loc": 2400,
    "test_loc": 1300,
    "test_ratio": 0.41,
    "active_days": 6,
    "sessions": 14,
    "deep_sessions": 5,
    "avg_session_minutes": 42,
    "loc_per_session_hour": 350,
    "feat_pct": 0.40,
    "fix_pct": 0.30,
    "peak_hour": 22,
    "ai_assisted_commits": 32
  },
  "authors": {
    "Garry Tan": { "commits": 32, "insertions": 2400, "deletions": 300, "test_ratio": 0.41, "top_area": "browse/" },
    "Alice": { "commits": 12, "insertions": 800, "deletions": 150, "test_ratio": 0.35, "top_area": "app/services/" }
  },
  "version_range": ["1.16.0.0", "1.16.1.0"],
  "streak_days": 47,
  "tweetable": "Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm",
  "greptile": {
    "fixes": 3,
    "fps": 1,
    "already_fixed": 2,
    "signal_pct": 83
  }
}
```

**참고:** `greptile` 필드는 `~/.gstack/greptile-history.md`가 존재하고 시간 윈도우 내 항목이 있을 때만 포함합니다. `backlog` 필드는 `TODOS.md`가 존재할 때만 포함합니다. `test_health` 필드는 테스트 파일이 발견된 경우(명령 10이 > 0 반환)에만 포함합니다. 데이터가 없으면 해당 필드를 완전히 생략하세요.

테스트 파일이 존재할 때 JSON에 test health 데이터를 포함합니다:
```json
  "test_health": {
    "total_test_files": 47,
    "tests_added_this_period": 5,
    "regression_test_commits": 3,
    "test_files_changed": 8
  }
```

TODOS.md가 존재할 때 JSON에 backlog 데이터를 포함합니다:
```json
  "backlog": {
    "total_open": 28,
    "p0_p1": 2,
    "p2": 8,
    "completed_this_period": 3,
    "added_this_period": 1
  }
```

### Step 14: 내러티브 작성

출력을 다음과 같이 구성합니다:

---

**트윗 가능한 요약** (첫 줄, 모든 것 앞에):
```
Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm | Streak: 47d
```

## Engineering Retro: [날짜 범위]

### 요약 테이블
(Step 2에서)

### 이전 회고 대비 트렌드
(Step 11에서, 저장 전에 로드 — 첫 회고인 경우 생략)

### 시간 및 세션 패턴
(Step 3-4에서)

팀 전체 패턴이 의미하는 바를 해석하는 내러티브:
- 가장 생산적인 시간대와 그 원인
- 세션이 시간이 지남에 따라 길어지는지 짧아지는지
- 하루 활성 코딩 추정 시간 (팀 집계)
- 주목할 패턴: 팀원들이 같은 시간에 코딩하는지 교대로 하는지?

### 출시 속도
(Step 5-7에서)

다루는 내러티브:
- Commit 유형 비율과 그것이 드러내는 것
- PR 크기 분포와 출시 케이던스에 대해 드러내는 것
- Fix 체인 감지 (같은 서브시스템에 대한 fix commit 시퀀스)
- 버전 범프 규율

### 코드 품질 시그널
- Test LOC 비율 트렌드
- 핫스팟 분석 (같은 파일이 계속 변경되는가?)
- Greptile 시그널 비율 및 트렌드 (히스토리가 있는 경우): "Greptile: X% signal (Y valid catches, Z false positives)"

### 테스트 건강도
- 전체 테스트 파일: N (명령 10에서)
- 이 기간에 추가된 테스트: M (명령 12에서 — 변경된 테스트 파일)
- 회귀 테스트 commit: 명령 11에서 `test(qa):` 및 `test(design):` 및 `test: coverage` commit 나열
- 이전 회고가 존재하고 `test_health`가 있으면: 델타 표시 "Test count: {last} → {now} (+{delta})"
- 테스트 비율이 < 20%이면: 성장 영역으로 표시 — "100% 테스트 커버리지가 목표입니다. 테스트는 vibe 코딩을 안전하게 만듭니다."

### 집중도 및 하이라이트
(Step 8에서)
- 해석 포함 집중도 점수
- 이번 주의 출시물 콜아웃

### 당신의 한 주 (개인 심층 분석)
(Step 9에서, 현재 사용자만)

사용자가 가장 관심 있는 섹션입니다. 포함 사항:
- 개인 commit 수, LOC, 테스트 비율
- 세션 패턴 및 피크 시간
- 집중 영역
- 가장 큰 출시물
- **잘한 점** (commit에 근거한 구체적인 것 2-3개)
- **레벨업 포인트** (구체적이고 실행 가능한 제안 1-2개)

### 팀 분석
(Step 9에서, 각 팀원 — 솔로 저장소인 경우 생략)

각 팀원 (commit 내림차순 정렬)에 대해 섹션을 작성합니다:

#### [이름]
- **출시한 것**: 기여, 집중 영역, commit 패턴에 대한 2-3문장
- **칭찬**: 실제 commit에 근거한 잘한 점 1-2개. 진심으로 — 1:1 미팅에서 실제로 할 말이어야 합니다. 예시:
  - "3개의 작고 리뷰 가능한 PR로 전체 auth 모듈을 정리했습니다 — 교과서적인 분해"
  - "모든 새 엔드포인트에 통합 테스트를 추가했고, happy path뿐 아니라 전부"
  - "대시보드에서 2초 로드 타임을 유발하던 N+1 쿼리를 수정했습니다"
- **성장 기회**: 구체적이고 건설적인 제안 1개. 비판이 아닌 투자로 구성하세요. 예시:
  - "payment 모듈의 테스트 커버리지가 8%입니다 — 다음 기능이 그 위에 올라가기 전에 투자할 가치가 있습니다"
  - "대부분의 commit이 한 번에 몰아서 올라옵니다 — 하루에 걸쳐 분산하면 컨텍스트 스위칭 피로를 줄일 수 있습니다"
  - "모든 commit이 새벽 1-4시에 올라옵니다 — 지속 가능한 페이스가 장기적 코드 품질에 중요합니다"

**AI 협업 참고:** 많은 commit에 `Co-Authored-By` AI 트레일러(예: Claude, Copilot)가 있으면, AI 지원 commit 비율을 팀 지표로 기록하세요. 중립적으로 표현 — "N%의 commit이 AI 지원" — 판단 없이.

### 상위 3가지 팀 성과
윈도우에서 팀 전체적으로 출시된 가장 영향력 있는 3가지를 식별합니다. 각각에 대해:
- 무엇이었는지
- 누가 출시했는지
- 왜 중요한지 (제품/아키텍처 영향)

### 개선할 3가지
구체적이고, 실행 가능하고, 실제 commit에 근거합니다. 개인 및 팀 수준 제안을 섞어서. "더 좋아지려면, 팀은..."으로 표현하세요.

### 다음 주의 3가지 습관
작고, 실용적이고, 현실적으로. 각각 도입하는데 5분 미만이어야 합니다. 최소 하나는 팀 지향적이어야 합니다 (예: "서로의 PR을 당일에 리뷰하기").

### 주간 트렌드
(해당되는 경우, Step 10에서)

---

## Global Retrospective Mode (글로벌 회고 모드)

사용자가 `/retro global` (또는 `/retro global 14d`)을 실행하면, 저장소 범위 Step 1-14 대신 이 플로우를 따르세요. 이 모드는 어떤 디렉토리에서든 작동합니다 — git 저장소 안에 있을 필요가 없습니다.

### Global Step 1: 시간 윈도우 계산

일반 회고와 동일한 자정 정렬 로직입니다. 기본 7d. `global` 뒤의 두 번째 인자가 윈도우입니다 (예: `14d`, `30d`, `24h`).

### Global Step 2: 탐색 실행

다음 폴백 체인을 사용하여 탐색 스크립트를 찾고 실행합니다:

```bash
DISCOVER_BIN=""
[ -x ~/.claude/skills/gstack/bin/gstack-global-discover ] && DISCOVER_BIN=~/.claude/skills/gstack/bin/gstack-global-discover
[ -z "$DISCOVER_BIN" ] && [ -x .claude/skills/gstack/bin/gstack-global-discover ] && DISCOVER_BIN=.claude/skills/gstack/bin/gstack-global-discover
[ -z "$DISCOVER_BIN" ] && which gstack-global-discover >/dev/null 2>&1 && DISCOVER_BIN=$(which gstack-global-discover)
[ -z "$DISCOVER_BIN" ] && [ -f bin/gstack-global-discover.ts ] && DISCOVER_BIN="bun run bin/gstack-global-discover.ts"
echo "DISCOVER_BIN: $DISCOVER_BIN"
```

바이너리를 찾을 수 없으면 사용자에게 다음을 알려주세요: "탐색 스크립트를 찾을 수 없습니다. gstack 디렉토리에서 `bun run build`를 실행하세요." 그리고 중단하세요.

탐색을 실행합니다:
```bash
$DISCOVER_BIN --since "<window>" --format json 2>/tmp/gstack-discover-stderr
```

진단 정보를 위해 `/tmp/gstack-discover-stderr`의 stderr 출력을 읽습니다. stdout에서 JSON 출력을 파싱합니다.

`total_sessions`가 0이면 다음을 알려주세요: "최근 <window> 동안 AI 코딩 세션을 찾을 수 없습니다. 더 긴 윈도우를 시도해보세요: `/retro global 30d`" 그리고 중단하세요.

### Global Step 3: 각 발견된 저장소에서 git log 실행

탐색 JSON의 `repos` 배열에서 각 저장소에 대해, `paths[]`에서 첫 번째 유효한 경로를 찾습니다 (디렉토리가 `.git/`과 함께 존재). 유효한 경로가 없으면 저장소를 건너뛰고 기록합니다.

**로컬 전용 저장소** (`remote`가 `local:`로 시작하는 경우): `git fetch`를 건너뛰고 로컬 기본 브랜치를 사용합니다. `git log origin/$DEFAULT` 대신 `git log HEAD`를 사용합니다.

**리모트가 있는 저장소:**

```bash
git -C <path> fetch origin --quiet 2>/dev/null
```

각 저장소의 기본 브랜치를 감지합니다: 먼저 `git symbolic-ref refs/remotes/origin/HEAD`를 시도하고, 그다음 일반적인 브랜치 이름(`main`, `master`)을 확인하고, 마지막으로 `git rev-parse --abbrev-ref HEAD`로 폴백합니다. 감지된 브랜치를 아래 명령에서 `<default>`로 사용합니다.

```bash
# Commits with stats
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%H|%aN|%ai|%s" --shortstat

# Commit timestamps for session detection, streak, and context switching
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%at|%aN|%ai|%s" | sort -n

# Per-author commit counts
git -C <path> shortlog origin/$DEFAULT --since="<start_date>T00:00:00" -sn --no-merges

# PR numbers from commit messages
git -C <path> log origin/$DEFAULT --since="<start_date>T00:00:00" --format="%s" | grep -oE '#[0-9]+' | sort -n | uniq
```

실패한 저장소 (삭제된 경로, 네트워크 오류): 건너뛰고 "N개의 저장소에 접근할 수 없습니다."라고 기록합니다.

### Global Step 4: 글로벌 출시 연속 기록 계산

각 저장소에서 commit 날짜를 가져옵니다 (365일 상한):

```bash
git -C <path> log origin/$DEFAULT --since="365 days ago" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

모든 저장소의 날짜를 합집합합니다. 오늘부터 역산 — 어떤 저장소든 최소 하나의 commit이 있는 연속 일수는? 연속 기록이 365일에 도달하면 "365+ days"로 표시합니다.

### Global Step 5: 컨텍스트 스위칭 지표 계산

Step 3에서 수집한 commit 타임스탬프에서, 날짜별로 그룹화합니다. 각 날짜에 대해 해당일에 commit이 있었던 고유 저장소 수를 셉니다. 보고:
- 일평균 저장소 수
- 일최대 저장소 수
- 집중된 날 (1개 저장소) vs 분산된 날 (3개 이상 저장소)

### Global Step 6: 도구별 생산성 패턴

탐색 JSON에서 도구 사용 패턴을 분석합니다:
- 어떤 AI 도구가 어떤 저장소에 사용되는지 (독점 vs 공유)
- 도구별 세션 수
- 행동 패턴 (예: "Codex는 myapp에서만 사용, Claude Code는 나머지 모두")

### Global Step 7: 집계 및 내러티브 생성

**공유 가능한 개인 카드를 먼저**, 그 아래에 전체 팀/프로젝트 분석을 구성합니다. 개인 카드는 스크린샷에 적합하도록 설계되었습니다 — X/Twitter에 공유하고 싶은 모든 것이 하나의 깔끔한 블록에 담깁니다.

---

**트윗 가능한 요약** (첫 줄, 모든 것 앞에):
```
Week of Mar 14: 5 projects, 138 commits, 250k LOC across 5 repos | 48 AI sessions | Streak: 52d 🔥
```

## 🚀 Your Week: [사용자 이름] — [날짜 범위]

이 섹션은 **공유 가능한 개인 카드**입니다. 현재 사용자의 통계만 포함합니다 — 팀 데이터, 프로젝트 분석 없음. 스크린샷으로 찍어서 게시하도록 설계되었습니다.

`git config user.name`의 사용자 ID를 사용하여 모든 저장소별 git 데이터를 필터링합니다. 모든 저장소에 걸쳐 집계하여 개인 합계를 계산합니다.

하나의 시각적으로 깔끔한 블록으로 렌더링합니다. 왼쪽 테두리만 — 오른쪽 테두리 없음 (LLM은 오른쪽 테두리를 안정적으로 정렬할 수 없습니다). 저장소 이름을 가장 긴 이름에 맞춰 패딩하여 열이 깔끔하게 정렬되도록 합니다. 프로젝트 이름을 절대 잘라내지 마세요.

```
╔═══════════════════════════════════════════════════════════════
║  [USER NAME] — Week of [date]
╠═══════════════════════════════════════════════════════════════
║
║  [N] commits across [M] projects
║  +[X]k LOC added · [Y]k LOC deleted · [Z]k net
║  [N] AI coding sessions (CC: X, Codex: Y, Gemini: Z)
║  [N]-day shipping streak 🔥
║
║  PROJECTS
║  ─────────────────────────────────────────────────────────
║  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
║  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
║  [repo_name_full]        [N] commits    +[X]k LOC    [solo/team]
║
║  SHIP OF THE WEEK
║  [PR title] — [LOC] lines across [N] files
║
║  TOP WORK
║  • [1-line description of biggest theme]
║  • [1-line description of second theme]
║  • [1-line description of third theme]
║
║  Powered by gstack · github.com/garrytan/gstack
╚═══════════════════════════════════════════════════════════════
```

**개인 카드 규칙:**
- 사용자가 commit한 저장소만 표시합니다. commit이 0인 저장소는 생략합니다.
- 사용자의 commit 수 내림차순으로 저장소를 정렬합니다.
- **저장소 이름을 절대 잘라내지 마세요.** 전체 저장소 이름을 사용합니다 (예: `analyze_transcripts`, `analyze_trans`가 아님). 이름 열을 가장 긴 저장소 이름에 맞춰 패딩하여 모든 열이 정렬되도록 합니다. 이름이 길면 박스를 넓히세요 — 박스 너비는 콘텐츠에 맞춰 조정됩니다.
- LOC는 천 단위에 "k" 형식을 사용합니다 (예: "+64.0k", "+64010"이 아님).
- 역할: 사용자가 유일한 기여자이면 "solo", 다른 기여자가 있으면 "team".
- Ship of the Week: 모든 저장소에 걸쳐 사용자의 가장 LOC가 높은 단일 PR.
- Top Work: 사용자의 주요 테마를 요약하는 3개의 항목, commit 메시지에서 추론. 개별 commit이 아닌 — 테마로 종합합니다.
  예: "Built /retro global — cross-project retrospective with AI session discovery"
  가 아닌 "feat: gstack-global-discover" + "feat: /retro global template".
- 카드는 자체적으로 완결되어야 합니다. 이 블록만 보는 사람도 주변 맥락 없이 사용자의 한 주를 이해할 수 있어야 합니다.
- 팀원, 프로젝트 합계, 컨텍스트 스위칭 데이터를 여기에 포함하지 마세요.

**개인 연속 기록:** 모든 저장소에 걸쳐 사용자 자신의 commit (`--author`로 필터링)을 사용하여 팀 연속 기록과 별도로 개인 연속 기록을 계산합니다.

---

## Global Engineering Retro: [날짜 범위]

아래는 전체 분석입니다 — 팀 데이터, 프로젝트 분석, 패턴. 공유 가능한 카드 다음에 오는 "심층 분석"입니다.

### 전체 프로젝트 개요
| Metric | Value |
|--------|-------|
| Projects active | N |
| Total commits (all repos, all contributors) | N |
| Total LOC | +N / -N |
| AI coding sessions | N (CC: X, Codex: Y, Gemini: Z) |
| Active days | N |
| Global shipping streak (any contributor, any repo) | N consecutive days |
| Context switches/day | N avg (max: M) |

### 프로젝트별 분석
각 저장소 (commit 내림차순 정렬)에 대해:
- 저장소 이름 (전체 commit 대비 %)
- Commit, LOC, 머지된 PR, 상위 기여자
- 주요 작업 (commit 메시지에서 추론)
- 도구별 AI 세션

**당신의 기여** (각 프로젝트 내 하위 섹션):
각 프로젝트에 대해 해당 저장소 내 현재 사용자의 개인 통계를 보여주는 "당신의 기여" 블록을 추가합니다. `git config user.name`의 사용자 ID로 필터링합니다. 포함:
- 전체 commit 중 당신의 commit (% 포함)
- 당신의 LOC (+삽입 / -삭제)
- 당신의 주요 작업 (당신의 commit 메시지에서만 추론)
- 당신의 commit 유형 비율 (feat/fix/refactor/chore/docs 분류)
- 이 저장소에서 당신의 가장 큰 출시물 (가장 LOC가 높은 commit 또는 PR)

사용자가 유일한 기여자인 경우, "솔로 프로젝트 — 모든 commit이 당신의 것입니다."라고 말합니다.
사용자가 저장소에 이 기간 동안 0개의 commit이 있는 경우 (건드리지 않은 팀 프로젝트), "이 기간에 commit 없음 — [N]개의 AI 세션만."이라고 말하고 분석을 건너뜁니다.

형식:
```
**Your contributions:** 47/244 commits (19%), +4.2k/-0.3k LOC
  Key work: Writer Chat, email blocking, security hardening
  Biggest ship: PR #605 — Writer Chat eats the admin bar (2,457 ins, 46 files)
  Mix: feat(3) fix(2) chore(1)
```

### 크로스 프로젝트 패턴
- 프로젝트별 시간 배분 (% 분류, 전체가 아닌 당신의 commit 사용)
- 모든 저장소에 걸친 피크 생산성 시간대 집계
- 집중된 날 vs 분산된 날
- 컨텍스트 스위칭 트렌드

### 도구 사용 분석
도구별 분석과 행동 패턴:
- Claude Code: M개 저장소에서 N개 세션 — 관찰된 패턴
- Codex: M개 저장소에서 N개 세션 — 관찰된 패턴
- Gemini: M개 저장소에서 N개 세션 — 관찰된 패턴

### Ship of the Week (글로벌)
모든 프로젝트에 걸쳐 가장 영향력 있는 PR. LOC 및 commit 메시지로 식별합니다.

### 크로스 프로젝트 인사이트 3가지
글로벌 뷰가 보여주는 것으로 단일 저장소 회고에서는 볼 수 없는 것.

### 다음 주의 3가지 습관
전체 크로스 프로젝트 관점을 고려합니다.

---

### Global Step 8: 히스토리 로드 및 비교

```bash
ls -t ~/.gstack/retros/global-*.json 2>/dev/null | head -5
```

**동일한 `window` 값을 가진 이전 회고와만 비교합니다** (예: 7d vs 7d). 가장 최근 이전 회고의 윈도우가 다르면 비교를 건너뛰고 다음을 기록: "이전 글로벌 회고가 다른 윈도우를 사용했습니다 — 비교를 건너뜁니다."

일치하는 이전 회고가 있으면 Read 도구로 로드합니다. 주요 지표의 델타가 포함된 **이전 글로벌 회고 대비 트렌드** 테이블을 표시합니다: 전체 commit, LOC, 세션, 연속 기록, 일별 컨텍스트 스위치.

이전 글로벌 회고가 없으면 다음을 추가: "첫 번째 글로벌 회고가 기록되었습니다 — 다음 주에 다시 실행하면 트렌드를 볼 수 있습니다."

### Global Step 9: 스냅샷 저장

```bash
mkdir -p ~/.gstack/retros
```

오늘의 다음 시퀀스 번호를 결정합니다:
```bash
today=$(date +%Y-%m-%d)
existing=$(ls ~/.gstack/retros/global-${today}-*.json 2>/dev/null | wc -l | tr -d ' ')
next=$((existing + 1))
```

Write 도구를 사용하여 `~/.gstack/retros/global-${today}-${next}.json`에 JSON을 저장합니다:

```json
{
  "type": "global",
  "date": "2026-03-21",
  "window": "7d",
  "projects": [
    {
      "name": "gstack",
      "remote": "https://github.com/garrytan/gstack",
      "commits": 47,
      "insertions": 3200,
      "deletions": 800,
      "sessions": { "claude_code": 15, "codex": 3, "gemini": 0 }
    }
  ],
  "totals": {
    "commits": 182,
    "insertions": 15300,
    "deletions": 4200,
    "projects": 5,
    "active_days": 6,
    "sessions": { "claude_code": 48, "codex": 8, "gemini": 3 },
    "global_streak_days": 52,
    "avg_context_switches_per_day": 2.1
  },
  "tweetable": "Week of Mar 14: 5 projects, 182 commits, 15.3k LOC | CC: 48, Codex: 8, Gemini: 3 | Focus: gstack (58%) | Streak: 52d"
}
```

---

## Compare Mode (비교 모드)

사용자가 `/retro compare` (또는 `/retro compare 14d`)를 실행할 때:

1. 자정 정렬 시작 날짜를 사용하여 현재 윈도우 (기본 7d)의 지표를 계산합니다 (일반 회고와 동일한 로직 — 예: 오늘이 2026-03-18이고 윈도우가 7d이면 `--since="2026-03-11T00:00:00"` 사용)
2. 겹침을 피하기 위해 `--since`와 `--until` 모두 자정 정렬 날짜를 사용하여 직전 동일 기간 윈도우의 지표를 계산합니다 (예: 2026-03-11에서 시작하는 7d 윈도우의 경우: 이전 윈도우는 `--since="2026-03-04T00:00:00" --until="2026-03-11T00:00:00"`)
3. 델타와 화살표가 포함된 나란히 비교 테이블을 표시합니다
4. 가장 큰 개선 사항과 퇴보를 강조하는 간략한 내러티브를 작성합니다
5. 현재 윈도우 스냅샷만 `.context/retros/`에 저장합니다 (일반 회고 실행과 동일); 이전 윈도우 지표는 저장하지 **않습니다**.

## 톤

- 격려하되 솔직하게, 감싸지 않기
- 구체적이고 명확하게 — 항상 실제 commit/코드에 근거
- 일반적 칭찬("잘했어요!") 건너뛰기 — 정확히 무엇이 좋았고 왜 좋았는지 말하기
- 개선점은 레벨업으로 구성, 비판이 아니라
- **칭찬은 1:1 미팅에서 실제로 할 말처럼** — 구체적이고, 당연하고, 진심 어린
- **성장 제안은 투자 조언처럼** — "이건 투자할 가치가 있어요, 왜냐하면..." "~에서 실패했습니다"가 아니라
- 팀원을 서로 부정적으로 비교하지 않기. 각 개인의 섹션은 독립적
- 총 출력 약 3000-4500 단어 (팀 섹션 포함 시 약간 길어짐)
- 데이터에는 마크다운 테이블과 코드 블록, 내러티브에는 산문 사용
- 대화에 직접 출력 — 파일시스템에 쓰지 않음 (`.context/retros/` JSON 스냅샷 제외)

## 중요 규칙

- 모든 내러티브 출력은 대화에서 사용자에게 직접 전달됩니다. 유일하게 작성되는 파일은 `.context/retros/` JSON 스냅샷입니다.
- 모든 git 쿼리에 `origin/<default>`를 사용하세요 (로컬 main은 오래되었을 수 있음)
- 모든 타임스탬프를 사용자의 로컬 타임존으로 표시하세요 (`TZ`를 오버라이드하지 마세요)
- 윈도우에 commit이 없으면 그렇게 말하고 다른 윈도우를 제안하세요
- LOC/hour는 50단위로 반올림
- merge commit은 PR 경계로 처리
- CLAUDE.md나 다른 문서를 읽지 마세요 — 이 스킬은 자체 완결적입니다
- 첫 실행 시 (이전 회고 없음), 비교 섹션을 우아하게 건너뛰세요
- **Global mode:** git 저장소 안에 있을 필요 없습니다. 스냅샷은 `~/.gstack/retros/`에 저장합니다 (`.context/retros/`가 아님). 설치되지 않은 AI 도구는 우아하게 건너뜁니다. 동일한 window 값을 가진 이전 글로벌 회고와만 비교합니다. 연속 기록이 365일 상한에 도달하면 "365+ days"로 표시합니다.
