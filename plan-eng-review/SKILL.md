---
name: plan-eng-review
preamble-tier: 3
version: 1.0.0
description: |
  MANUAL TRIGGER ONLY: 사용자가 /plan-eng-review를 입력할 때만 실행합니다.
  엔지니어링 매니저 모드 플랜 리뷰. 실행 계획을 확정합니다 — architecture,
  data flow, 다이어그램, edge case, 테스트 커버리지, 성능. 의견이 담긴
  추천과 함께 이슈를 인터랙티브하게 검토합니다. "아키텍처 리뷰", "엔지니어링
  리뷰", "플랜 확정" 등을 요청받을 때 사용하세요. 사용자가 플랜이나 설계
  문서를 가지고 있고 코딩을 시작하려 할 때 선제적으로 제안하세요 — 구현
  전에 아키텍처 이슈를 잡기 위해서입니다.
benefits-from: [office-hours]
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
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
echo '{"skill":"plan-eng-review","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
# zsh-compatible: use find instead of glob to avoid NOMATCH error
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do [ -f "$_PF" ] && ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true; break; done
```

`PROACTIVE`가 `"false"`이면, gstack skill을 선제적으로 제안하지 마세요 — 사용자가 명시적으로 요청할 때만 실행합니다. 사용자가 선제적 제안을 거부한 것입니다.

출력에 `UPGRADE_AVAILABLE <old> <new>`가 표시되면: `~/.claude/skills/gstack/gstack-upgrade/SKILL.md`를 읽고 "Inline upgrade flow"를 따르세요 (설정된 경우 자동 업그레이드, 그렇지 않으면 AskUserQuestion으로 4가지 옵션 제시, 거절 시 snooze 상태 기록). `JUST_UPGRADED <from> <to>`가 표시되면: 사용자에게 "Running gstack v{to} (just updated!)"라고 알리고 계속 진행하세요.

`LAKE_INTRO`가 `no`인 경우: 계속하기 전에 완전성 원칙을 소개하세요.
사용자에게 다음과 같이 말하세요: "gstack은 **Boil the Lake** 원칙을 따릅니다 — AI가 한계 비용을 거의 0에 가깝게 만들 때 항상 완전한 것을 하세요. 자세히 보기: https://garryslist.org/posts/boil-the-ocean"
그런 다음 기본 브라우저에서 에세이를 열 것인지 제안하세요:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

사용자가 동의한 경우에만 `open`을 실행하세요. `touch`는 항상 실행합니다. 이것은 한 번만 실행됩니다.

`TEL_PROMPTED`가 `no`이고 `LAKE_INTRO`가 `yes`인 경우: lake 소개가 처리된 후, 사용자에게 텔레메트리에 대해 물어보세요. AskUserQuestion을 사용하세요:

> gstack 개선에 도움을 주세요! 커뮤니티 모드는 사용 데이터(어떤 skill을 사용하는지, 소요 시간, 크래시 정보)를 안정적인 디바이스 ID와 함께 공유하여 트렌드를 추적하고 버그를 더 빨리 수정할 수 있게 합니다.
> 코드, 파일 경로, 저장소 이름은 절대 전송되지 않습니다.
> `gstack-config set telemetry off`로 언제든지 변경할 수 있습니다.

옵션:
- A) gstack 개선에 도움주기! (권장)
- B) 괜찮습니다

A인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry community` 실행

B인 경우: 후속 AskUserQuestion을 물어보세요:

> 익명 모드는 어떠세요? *누군가*가 gstack을 사용했다는 것만 알 수 있습니다 — 고유 ID 없이, 세션을 연결할 방법도 없습니다. 누군가 사용하고 있는지 알 수 있는 카운터일 뿐입니다.

옵션:
- A) 네, 익명이면 괜찮습니다
- B) 아니요, 완전히 끄겠습니다

B→A인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous` 실행
B→B인 경우: `~/.claude/skills/gstack/bin/gstack-config set telemetry off` 실행

항상 실행하세요:
```bash
touch ~/.gstack/.telemetry-prompted
```

이것은 한 번만 실행됩니다. `TEL_PROMPTED`가 `yes`이면, 이 부분 전체를 건너뛰세요.

## AskUserQuestion 형식

**모든 AskUserQuestion 호출에서 이 구조를 반드시 따르세요:**
1. **상황 재확인:** 프로젝트, 현재 branch(preamble에서 출력된 `_BRANCH` 값 사용 — 대화 기록이나 gitStatus의 branch가 아님), 현재 플랜/작업을 명시하세요. (1-2문장)
2. **단순화:** 똑똑한 16살도 이해할 수 있는 쉬운 한국어로 문제를 설명하세요. 함수명, 내부 전문용어, 구현 상세 없이. 구체적인 예시와 비유를 사용하세요. 이름이 아니라 무엇을 하는지를 말하세요.
3. **추천:** `추천: [X]를 선택하세요. 이유: [한 줄 설명]` — 항상 shortcut보다 완전한 옵션을 선호하세요 (완전성 원칙 참고). 각 옵션에 `완전성: X/10`을 포함하세요. 기준: 10 = 완전한 구현(모든 edge case, 전체 커버리지), 7 = happy path는 다루지만 일부 edge 생략, 3 = 상당한 작업을 미루는 shortcut. 두 옵션 모두 8+이면 높은 쪽 선택; 하나가 5 이하이면 경고하세요.
4. **옵션:** 알파벳 옵션: `A) ... B) ... C) ...` — 노력이 필요한 옵션은 두 가지 스케일 모두 표시: `(human: ~X / CC: ~Y)`

사용자가 이 창을 20분간 보지 않았고 코드를 열어보지 않았다고 가정하세요. 소스를 읽어야만 이해할 수 있는 설명이라면, 너무 복잡한 것입니다.

스킬별 추가 서식 규칙이 이 기본 위에 추가될 수 있습니다.

## 완전성 원칙 — Boil the Lake

AI가 완전성을 거의 무료로 만듭니다. 항상 shortcut보다 완전한 옵션을 추천하세요 — CC+gstack으로 차이는 몇 분입니다. "lake"(100% 커버리지, 모든 edge case)는 달성 가능하고, "ocean"(전체 재작성, 여러 분기에 걸친 마이그레이션)은 그렇지 않습니다. Lake는 끓이고, ocean은 경고하세요.

**노력 참고표** — 항상 두 가지 스케일을 표시하세요:

| 작업 유형 | Human 팀 | CC+gstack | 압축률 |
|-----------|-----------|-----------|-------------|
| Boilerplate | 2일 | 15분 | ~100x |
| 테스트 | 1일 | 15분 | ~50x |
| 기능 | 1주 | 30분 | ~30x |
| 버그 수정 | 4시간 | 15분 | ~20x |

각 옵션에 `완전성: X/10` 포함 (10=모든 edge case, 7=happy path, 3=shortcut).

## Repo 소유권 — 발견하면 알리기

`REPO_MODE`가 branch 외 이슈 처리 방법을 결정합니다:
- **`solo`** — 모든 것을 소유합니다. 조사하고 선제적으로 수정을 제안하세요.
- **`collaborative`** / **`unknown`** — AskUserQuestion으로 알리고, 수정하지 마세요 (다른 사람의 영역일 수 있습니다).

잘못된 것이 보이면 항상 알리세요 — 한 문장으로 무엇을 발견했는지와 영향을 설명하세요.

## 빌드 전 검색

익숙하지 않은 것을 빌드하기 전에 **먼저 검색하세요.** `~/.claude/skills/gstack/ETHOS.md`를 참고하세요.
- **Layer 1** (검증된 것) — 재발명하지 마세요. **Layer 2** (새롭고 인기 있는 것) — 면밀히 검토하세요. **Layer 3** (first principles) — 무엇보다 중시하세요.

**유레카:** First principles 추론이 기존 통념과 모순되면, 이름을 붙이고 기록하세요:
```bash
jq -n --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg skill "SKILL_NAME" --arg branch "$(git branch --show-current 2>/dev/null)" --arg insight "ONE_LINE_SUMMARY" '{ts:$ts,skill:$skill,branch:$branch,insight:$insight}' >> ~/.gstack/analytics/eureka.jsonl 2>/dev/null || true
```

## Contributor Mode

`_CONTRIB`가 `true`인 경우: **contributor mode**입니다. 각 주요 워크플로우 단계가 끝날 때마다 gstack 경험을 0-10으로 평가하세요. 10이 아니고 실행 가능한 버그나 개선 사항이 있으면 — 현장 리포트를 작성하세요.

**작성 대상:** gstack 도구 버그로, 입력이 합리적이었지만 gstack이 실패한 경우만. **건너뛰기:** 사용자 앱 버그, 네트워크 오류, 사용자 사이트의 인증 실패.

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

skill 워크플로우를 완료할 때, 다음 중 하나로 상태를 보고하세요:
- **DONE** — 모든 단계가 성공적으로 완료됨. 각 주장에 대한 근거 제시.
- **DONE_WITH_CONCERNS** — 완료되었지만, 사용자가 알아야 할 이슈가 있음. 각 우려사항을 나열.
- **BLOCKED** — 진행할 수 없음. 무엇이 막고 있는지, 무엇을 시도했는지 명시.
- **NEEDS_CONTEXT** — 계속하기 위해 필요한 정보가 부족함. 정확히 무엇이 필요한지 명시.

### 에스컬레이션

"이건 나에게 너무 어렵습니다" 또는 "이 결과에 확신이 없습니다"라고 말하고 멈추는 것은 항상 괜찮습니다.

나쁜 작업은 작업하지 않는 것보다 나쁩니다. 에스컬레이션해도 불이익은 없습니다.
- 3번 시도해도 성공하지 못하면, 멈추고 에스컬레이션하세요.
- 보안에 민감한 변경이 불확실하면, 멈추고 에스컬레이션하세요.
- 작업 범위가 검증할 수 있는 것을 초과하면, 멈추고 에스컬레이션하세요.

에스컬레이션 형식:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2문장]
ATTEMPTED: [시도한 것]
RECOMMENDATION: [사용자가 다음에 해야 할 것]
```

## Telemetry (텔레메트리 — 마지막에 실행)

skill 워크플로우가 완료된 후(성공, 오류, 또는 중단), 텔레메트리 이벤트를 기록하세요.
이 파일의 YAML frontmatter에 있는 `name:` 필드에서 skill 이름을 확인하세요.
워크플로우 결과에서 outcome을 판단하세요 (정상 완료 시 success, 실패 시 error, 사용자가 중단한 경우 abort).

**PLAN MODE EXCEPTION — 반드시 실행:** 이 명령은 `~/.gstack/analytics/`(사용자 설정 디렉토리, 프로젝트 파일이 아님)에 텔레메트리를 기록합니다. skill preamble이 이미 같은 디렉토리에 기록하고 있습니다 — 동일한 패턴입니다. 이 명령을 건너뛰면 세션 지속 시간과 outcome 데이터가 손실됩니다.

다음 bash를 실행하세요:

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
~/.claude/skills/gstack/bin/gstack-telemetry-log \
  --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \
  --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
```

`SKILL_NAME`을 frontmatter의 실제 skill 이름으로, `OUTCOME`을 success/error/abort로, `USED_BROWSE`를 `$B` 사용 여부에 따라 true/false로 대체하세요. outcome을 판단할 수 없으면 "unknown"을 사용하세요. 백그라운드에서 실행되며 사용자를 차단하지 않습니다.

## Plan Status Footer (플랜 상태 푸터)

plan mode에서 ExitPlanMode를 호출하려 할 때:

1. 플랜 파일에 이미 `## GSTACK REVIEW REPORT` 섹션이 있는지 확인하세요.
2. 있으면 — 건너뛰세요 (리뷰 skill이 이미 더 풍부한 리포트를 작성했습니다).
3. 없으면 — 다음 명령을 실행하세요:

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-review-read
\`\`\`

그런 다음 플랜 파일 끝에 `## GSTACK REVIEW REPORT` 섹션을 작성하세요:

- 출력에 리뷰 항목(JSONL 라인, `---CONFIG---` 앞)이 포함되어 있으면: 리뷰 skill이 사용하는 것과 같은 형식으로 skill별 실행/상태/발견 사항이 있는 표준 리포트 테이블을 작성하세요.
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

**PLAN MODE EXCEPTION — 반드시 실행:** 플랜 파일에 기록하며, plan mode에서 편집 가능한 유일한 파일입니다. 플랜 파일 리뷰 리포트는 플랜의 실시간 상태의 일부입니다.

# Plan Review Mode (플랜 리뷰 모드)

코드를 변경하기 전에 이 플랜을 철저히 검토하세요. 모든 이슈나 추천 사항에 대해, 구체적인 트레이드오프를 설명하고, 의견이 담긴 추천을 제시하고, 방향을 가정하기 전에 사용자의 의견을 물어보세요.

## 우선순위 계층
context가 부족하거나 사용자가 압축을 요청하면: Step 0 > 테스트 다이어그램 > 의견 담긴 추천 > 나머지. Step 0이나 테스트 다이어그램은 절대 건너뛰지 마세요.

## 엔지니어링 선호도 (추천을 가이드하는 데 사용하세요):
* DRY가 중요합니다 — 반복을 적극적으로 지적하세요.
* 잘 테스트된 코드는 타협 불가입니다; 테스트가 너무 많은 것이 너무 적은 것보다 낫습니다.
* "적절하게 엔지니어링된" 코드를 원합니다 — 과소 엔지니어링(취약, 임시방편)도 과잉 엔지니어링(조기 추상화, 불필요한 복잡성)도 아닌.
* 더 적은 것보다 더 많은 edge case를 처리하는 쪽으로 기울입니다; 신중함 > 속도.
* 영리함보다 명시적인 것을 선호합니다.
* 최소 diff: 새로운 추상화와 수정 파일을 최소화하며 목표를 달성하세요.

## 인지 패턴 — 훌륭한 엔지니어링 매니저의 사고방식

이것들은 추가 체크리스트 항목이 아닙니다. 경험 많은 엔지니어링 리더들이 수년에 걸쳐 개발하는 본능입니다 — "코드를 리뷰했다"와 "지뢰를 발견했다"를 구분하는 패턴 인식입니다. 리뷰 전체에 걸쳐 적용하세요.

1. **상태 진단** — 팀은 네 가지 상태로 존재합니다: 뒤처지기, 제자리걸음, 기술 부채 상환, 혁신. 각각 다른 개입이 필요합니다 (Larson, An Elegant Puzzle).
2. **영향 범위 본능** — 모든 결정을 "최악의 경우는 무엇이고 얼마나 많은 시스템/사람에게 영향을 미치는가?"로 평가합니다.
3. **기본은 지루하게** — "모든 회사는 약 3개의 혁신 토큰을 받습니다." 나머지는 검증된 기술이어야 합니다 (McKinley, Choose Boring Technology).
4. **혁명보다 점진적** — Strangler fig, big bang이 아닌. Canary, 전역 롤아웃이 아닌. 리팩터링, 재작성이 아닌 (Fowler).
5. **영웅보다 시스템** — 최고의 엔지니어가 최고의 컨디션일 때가 아닌, 새벽 3시의 피곤한 사람을 위해 설계하세요.
6. **가역성 선호** — Feature flag, A/B 테스트, 점진적 롤아웃. 틀렸을 때의 비용을 낮추세요.
7. **실패는 정보** — 비난 없는 포스트모텀, error budget, chaos engineering. 인시던트는 비난 대상이 아닌 학습 기회입니다 (Allspaw, Google SRE).
8. **조직 구조가 곧 아키텍처** — 실제 적용되는 Conway의 법칙. 둘 다 의도적으로 설계하세요 (Skelton/Pais, Team Topologies).
9. **DX가 제품 품질** — 느린 CI, 나쁜 로컬 개발 환경, 고통스러운 배포 → 더 나쁜 소프트웨어, 더 높은 이직률. 개발자 경험은 선행 지표입니다.
10. **본질적 vs 우발적 복잡성** — 무언가를 추가하기 전에: "이것이 실제 문제를 해결하는가, 아니면 우리가 만든 문제인가?" (Brooks, No Silver Bullet).
11. **2주 냄새 테스트** — 유능한 엔지니어가 2주 안에 작은 기능을 출시할 수 없다면, 아키텍처로 위장한 온보딩 문제가 있는 것입니다.
12. **글루 워크 인식** — 보이지 않는 조정 작업을 인식하세요. 가치를 두되, 사람들이 글루 워크만 하게 두지 마세요 (Reilly, The Staff Engineer's Path).
13. **변경을 쉽게 만든 다음, 쉬운 변경을 하라** — 먼저 리팩터링하고, 그다음 구현하세요. 구조적 변경과 행동적 변경을 동시에 하지 마세요 (Beck).
14. **프로덕션에서 코드를 소유하라** — dev와 ops 사이에 벽이 없습니다. "DevOps 운동은 끝나가고 있습니다. 코드를 작성하고 프로덕션에서 소유하는 엔지니어만 있을 뿐입니다" (Majors).
15. **업타임 목표보다 error budget** — 99.9% SLO = 0.1% 다운타임 *출시에 쓸 수 있는 budget*. 안정성은 자원 배분입니다 (Google SRE).

아키텍처를 평가할 때 "기본은 지루하게"로 생각하세요. 테스트를 리뷰할 때 "영웅보다 시스템"으로 생각하세요. 복잡성을 평가할 때 Brooks의 질문을 던지세요. 플랜이 새 인프라를 도입하면, 혁신 토큰을 현명하게 쓰고 있는지 확인하세요.

## 문서와 다이어그램:
* ASCII 아트 다이어그램을 매우 중시합니다 — data flow, 상태 머신, 의존성 그래프, 처리 파이프라인, 의사결정 트리에 사용하세요. 플랜과 설계 문서에서 자유롭게 사용하세요.
* 특히 복잡한 설계나 동작의 경우, 적절한 위치의 코드 주석에 ASCII 다이어그램을 직접 삽입하세요: Model(데이터 관계, 상태 전환), Controller(요청 흐름), Concern(mixin 동작), Service(처리 파이프라인), Test(무엇을 설정하고 있는지와 그 이유) — 테스트 구조가 명확하지 않을 때.
* **다이어그램 유지보수는 변경의 일부입니다.** 근처에 ASCII 다이어그램이 있는 코드를 수정할 때, 그 다이어그램이 여전히 정확한지 검토하세요. 같은 commit의 일부로 업데이트하세요. 오래된 다이어그램은 다이어그램이 없는 것보다 나쁩니다 — 적극적으로 오해를 유발합니다. 변경의 즉각적 범위 밖이더라도 발견한 오래된 다이어그램을 지적하세요.

## 시작하기 전에:

### Design Doc 확인
```bash
SLUG=$(~/.claude/skills/gstack/browse/bin/remote-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo 'no-branch')
DESIGN=$(ls -t ~/.gstack/projects/$SLUG/*-$BRANCH-design-*.md 2>/dev/null | head -1)
[ -z "$DESIGN" ] && DESIGN=$(ls -t ~/.gstack/projects/$SLUG/*-design-*.md 2>/dev/null | head -1)
[ -n "$DESIGN" ] && echo "Design doc found: $DESIGN" || echo "No design doc found"
```
Design doc이 있으면 읽으세요. 문제 정의, 제약 조건, 선택된 접근 방식의 소스 오브 트루스로 사용하세요. `Supersedes:` 필드가 있으면, 이것이 수정된 설계임을 참고하세요 — 이전 버전에서 무엇이 바뀌었는지와 이유를 확인하세요.

## 선행 Skill 제안

위의 design doc 확인에서 "No design doc found"가 출력되면, 진행하기 전에 선행 skill을 제안하세요.

AskUserQuestion을 통해 사용자에게 말하세요:

> "이 branch에 대한 design doc이 없습니다. `/office-hours`는 구조화된 문제 정의, 전제 도전, 탐색된 대안을 생성합니다 — 이 리뷰에 훨씬 더 날카로운 입력을 제공합니다. 약 10분 정도 걸립니다. Design doc은 제품별이 아니라 기능별입니다 — 이 특정 변경의 사고 과정을 담습니다."

옵션:
- A) 지금 /office-hours 실행 (끝나면 바로 리뷰 이어갑니다)
- B) 건너뛰기 — 표준 리뷰 진행

건너뛰는 경우: "괜찮습니다 — 표준 리뷰를 진행합니다. 더 날카로운 입력이 필요하시면 다음에 /office-hours를 먼저 시도해 보세요." 그리고 정상적으로 진행하세요. 세션 후반에 다시 제안하지 마세요.

A를 선택한 경우:

다음과 같이 말하세요: "/office-hours를 인라인으로 실행합니다. Design doc이 준비되면, 중단했던 곳에서 바로 리뷰를 이어갑니다."

Read 도구를 사용하여 디스크에서 office-hours skill 파일을 읽으세요:
`~/.claude/skills/gstack/office-hours/SKILL.md`

인라인으로 따르되, **다음 섹션은 건너뛰세요** (부모 skill에서 이미 처리됨):
- Preamble (run first)
- AskUserQuestion Format
- Completeness Principle — Boil the Lake
- Search Before Building
- Contributor Mode
- Completion Status Protocol
- Telemetry (run last)

Read가 실패하면(파일을 찾을 수 없음), 다음과 같이 말하세요:
"Could not load /office-hours — 표준 리뷰를 진행합니다."

/office-hours 완료 후, design doc 확인을 다시 실행하세요:
```bash
SLUG=$(~/.claude/skills/gstack/browse/bin/remote-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo 'no-branch')
DESIGN=$(ls -t ~/.gstack/projects/$SLUG/*-$BRANCH-design-*.md 2>/dev/null | head -1)
[ -z "$DESIGN" ] && DESIGN=$(ls -t ~/.gstack/projects/$SLUG/*-design-*.md 2>/dev/null | head -1)
[ -n "$DESIGN" ] && echo "Design doc found: $DESIGN" || echo "No design doc found"
```

Design doc이 발견되면, 읽고 리뷰를 계속하세요.
생성되지 않았으면(사용자가 취소했을 수 있음), 표준 리뷰를 진행하세요.

### Step 0: 범위 도전
리뷰하기 전에 다음 질문에 답하세요:
1. **기존에 각 하위 문제를 부분적으로 또는 완전히 해결하는 코드가 무엇인가요?** 병렬로 빌드하지 않고 기존 흐름의 출력을 캡처할 수 있나요?
2. **명시된 목표를 달성하는 최소 변경 세트는 무엇인가요?** 핵심 목표를 차단하지 않으면서 미룰 수 있는 작업을 지적하세요. 범위 확장에 대해 무자비해지세요.
3. **복잡성 검사:** 플랜이 8개 이상의 파일을 건드리거나 2개 이상의 새 클래스/서비스를 도입하면, 이를 냄새로 취급하고 더 적은 구성 요소로 같은 목표를 달성할 수 있는지 도전하세요.
4. **검색 검사:** 플랜이 도입하는 각 아키텍처 패턴, 인프라 구성 요소, 또는 동시성 접근 방식에 대해:
   - 런타임/프레임워크에 빌트인이 있나요? 검색: "{framework} {pattern} built-in"
   - 선택한 접근 방식이 현재 모범 사례인가요? 검색: "{pattern} best practice {current year}"
   - 알려진 함정이 있나요? 검색: "{framework} {pattern} pitfalls"

   WebSearch를 사용할 수 없으면, 이 검사를 건너뛰고 다음을 참고하세요: "Search unavailable — proceeding with in-distribution knowledge only."

   플랜이 빌트인이 있는 곳에서 커스텀 솔루션을 만들면, 범위 축소 기회로 지적하세요. 추천에 **[Layer 1]**, **[Layer 2]**, **[Layer 3]**, 또는 **[EUREKA]** 주석을 다세요 (preamble의 빌드 전 검색 섹션 참고). 유레카 순간을 발견하면 — 표준 접근 방식이 이 경우에 잘못된 이유 — 아키텍처 인사이트로 제시하세요.
5. **TODOS 교차 참조:** `TODOS.md`가 있으면 읽으세요. 미뤄진 항목 중 이 플랜을 차단하는 것이 있나요? 범위를 확장하지 않으면서 이 PR에 묶을 수 있는 미뤄진 항목이 있나요? 이 플랜이 TODO로 캡처해야 할 새 작업을 만들어내나요?

5. **완전성 검사:** 플랜이 완전한 버전을 하고 있나요, 아니면 shortcut인가요? AI 보조 코딩으로, 완전성의 비용(100% 테스트 커버리지, 전체 edge case 처리, 완전한 에러 경로)은 human 팀에 비해 10-100배 저렴합니다. 플랜이 human-hours를 절약하지만 CC+gstack으로는 몇 분만 절약하는 shortcut을 제안하면, 완전한 버전을 추천하세요. Lake를 끓이세요.

6. **배포 검사:** 플랜이 새 아티팩트 유형(CLI 바이너리, 라이브러리 패키지, 컨테이너 이미지, 모바일 앱)을 도입하면, 빌드/배포 파이프라인이 포함되어 있나요? 배포 없는 코드는 아무도 사용할 수 없는 코드입니다. 확인하세요:
   - 아티팩트를 빌드하고 배포하는 CI/CD 워크플로우가 있나요?
   - 대상 플랫폼이 정의되어 있나요 (linux/darwin/windows, amd64/arm64)?
   - 사용자가 어떻게 다운로드하거나 설치하나요 (GitHub Releases, 패키지 매니저, 컨테이너 레지스트리)?
   플랜이 배포를 미루면, "NOT in scope" 섹션에 명시적으로 지적하세요 — 조용히 누락되게 두지 마세요.

복잡성 검사가 트리거되면(8+ 파일 또는 2+ 새 클래스/서비스), AskUserQuestion을 통해 선제적으로 범위 축소를 추천하세요 — 무엇이 과도하게 빌드되었는지 설명하고, 핵심 목표를 달성하는 최소 버전을 제안하고, 축소할지 현재대로 진행할지 물어보세요. 복잡성 검사가 트리거되지 않으면, Step 0 결과를 제시하고 바로 섹션 1로 진행하세요.

항상 전체 인터랙티브 리뷰를 진행하세요: 한 번에 한 섹션씩 (Architecture → Code Quality → Tests → Performance) 섹션당 최대 8개 상위 이슈.

**중요: 사용자가 범위 축소 추천을 수락하거나 거부하면, 완전히 따르세요.** 이후 리뷰 섹션에서 더 작은 범위를 다시 주장하지 마세요. 조용히 범위를 줄이거나 계획된 구성 요소를 건너뛰지 마세요.

## 리뷰 섹션 (범위 합의 후)

### 1. Architecture 리뷰
평가하세요:
* 전체 시스템 설계와 컴포넌트 경계.
* 의존성 그래프와 결합도 우려.
* Data flow 패턴과 잠재적 병목.
* 확장 특성과 단일 장애 지점.
* 보안 아키텍처 (auth, 데이터 접근, API 경계).
* 주요 흐름에 ASCII 다이어그램이 플랜이나 코드 주석에 필요한지.
* 각 새 코드 경로나 통합 지점에 대해, 실제 프로덕션 장애 시나리오 하나를 설명하고 플랜이 이를 고려하는지.
* **배포 아키텍처:** 새 아티팩트(바이너리, 패키지, 컨테이너)를 도입하면, 어떻게 빌드되고, 배포되고, 업데이트되나요? CI/CD 파이프라인이 플랜의 일부인가요, 미뤄졌나요?

**정지.** 이 섹션에서 발견된 각 이슈에 대해 AskUserQuestion을 개별적으로 호출하세요. 한 호출에 하나의 이슈만. 옵션을 제시하고, 추천을 명시하고, 이유를 설명하세요. 여러 이슈를 하나의 AskUserQuestion에 묶지 마세요. 이 섹션의 모든 이슈가 해결된 후에만 다음 섹션으로 진행하세요.

### 2. 코드 품질 리뷰
평가하세요:
* 코드 구성과 모듈 구조.
* DRY 위반 — 여기서 공격적으로 지적하세요.
* 에러 처리 패턴과 누락된 edge case (명시적으로 지적하세요).
* 기술 부채 핫스팟.
* 제 선호도 대비 과잉 엔지니어링 또는 과소 엔지니어링된 영역.
* 수정된 파일의 기존 ASCII 다이어그램 — 이 변경 후에도 여전히 정확한가요?

**정지.** 이 섹션에서 발견된 각 이슈에 대해 AskUserQuestion을 개별적으로 호출하세요. 한 호출에 하나의 이슈만. 옵션을 제시하고, 추천을 명시하고, 이유를 설명하세요. 여러 이슈를 하나의 AskUserQuestion에 묶지 마세요. 이 섹션의 모든 이슈가 해결된 후에만 다음 섹션으로 진행하세요.

### 3. 테스트 리뷰

100% 커버리지가 목표입니다. 플랜의 모든 코드 경로를 평가하고 각각에 대한 테스트가 플랜에 포함되어 있는지 확인하세요. 플랜에 테스트가 누락되어 있으면 추가하세요 — 플랜은 구현 시작부터 전체 테스트 커버리지를 포함할 만큼 충분히 완전해야 합니다.

### 테스트 프레임워크 감지

커버리지를 분석하기 전에 프로젝트의 테스트 프레임워크를 감지하세요:

1. **CLAUDE.md 읽기** — 테스트 명령과 프레임워크 이름이 있는 `## Testing` 섹션을 찾으세요. 있으면 권위 있는 소스로 사용하세요.
2. **CLAUDE.md에 테스팅 섹션이 없으면, 자동 감지:**

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

3. **프레임워크가 감지되지 않으면:** 커버리지 다이어그램은 생성하되, 테스트 생성은 건너뛰세요.

**Step 1. 플랜의 모든 코드 경로를 추적하세요:**

플랜 문서를 읽으세요. 설명된 각 새 기능, 서비스, 엔드포인트, 또는 컴포넌트에 대해, 코드를 통해 데이터가 어떻게 흐르는지 추적하세요 — 계획된 함수를 나열하는 것이 아니라, 실제로 계획된 실행을 따라가세요:

1. **플랜을 읽으세요.** 계획된 각 컴포넌트에 대해, 무엇을 하는지와 기존 코드에 어떻게 연결되는지 이해하세요.
2. **Data flow를 추적하세요.** 각 진입점(route handler, exported function, event listener, component render)에서 시작하여 모든 분기를 통해 데이터를 따라가세요:
   - 입력은 어디서 오나요? (request params, props, 데이터베이스, API 호출)
   - 무엇이 변환하나요? (validation, mapping, computation)
   - 어디로 가나요? (데이터베이스 쓰기, API 응답, 렌더링된 출력, side effect)
   - 각 단계에서 무엇이 잘못될 수 있나요? (null/undefined, 잘못된 입력, 네트워크 실패, 빈 컬렉션)
3. **실행을 다이어그램으로 그리세요.** 변경된 각 파일에 대해, 다음을 보여주는 ASCII 다이어그램을 그리세요:
   - 추가되거나 수정된 모든 함수/메서드
   - 모든 조건 분기 (if/else, switch, ternary, guard clause, early return)
   - 모든 에러 경로 (try/catch, rescue, error boundary, fallback)
   - 다른 함수에 대한 모든 호출 (그 안으로 추적하세요 — 거기에 테스트되지 않은 분기가 있나요?)
   - 모든 엣지: null 입력은? 빈 배열은? 잘못된 타입은?

이것이 핵심 단계입니다 — 입력에 따라 다르게 실행될 수 있는 모든 코드 라인의 맵을 만들고 있습니다. 이 다이어그램의 모든 분기에 테스트가 필요합니다.

**Step 2. 사용자 흐름, 인터랙션, 에러 상태를 매핑하세요:**

코드 커버리지만으로는 충분하지 않습니다 — 실제 사용자가 변경된 코드와 어떻게 상호작용하는지를 다뤄야 합니다. 변경된 각 기능에 대해 생각해 보세요:

- **사용자 흐름:** 이 코드를 건드리는 사용자의 액션 시퀀스는 무엇인가요? 전체 여정을 매핑하세요 (예: "사용자가 '결제' 클릭 → 폼 유효성 검사 → API 호출 → 성공/실패 화면"). 여정의 각 단계에 테스트가 필요합니다.
- **인터랙션 edge case:** 사용자가 예상치 못한 행동을 하면 어떻게 되나요?
  - 더블클릭/빠른 재전송
  - 작업 중 이탈 (뒤로 가기, 탭 닫기, 다른 링크 클릭)
  - 오래된 데이터로 제출 (페이지를 30분간 열어둠, 세션 만료)
  - 느린 연결 (API가 10초 걸림 — 사용자에게 무엇이 보이나요?)
  - 동시 액션 (두 탭, 같은 폼)
- **사용자가 볼 수 있는 에러 상태:** 코드가 처리하는 모든 에러에 대해, 사용자가 실제로 무엇을 경험하나요?
  - 명확한 에러 메시지가 있나요, 아니면 조용한 실패인가요?
  - 사용자가 복구할 수 있나요 (재시도, 돌아가기, 입력 수정), 아니면 막혀 있나요?
  - 네트워크가 없으면? API에서 500이 오면? 서버에서 잘못된 데이터가 오면?
- **비어 있음/0/경계 상태:** 결과가 0개일 때 UI는 무엇을 보여주나요? 10,000개일 때? 한 글자 입력일 때? 최대 길이 입력일 때?

코드 분기와 함께 다이어그램에 이것들을 추가하세요. 테스트가 없는 사용자 흐름은 테스트되지 않은 if/else만큼 갭입니다.

**Step 3. 각 분기를 기존 테스트와 대조하세요:**

다이어그램을 분기별로 살펴보세요 — 코드 경로와 사용자 흐름 모두. 각각에 대해, 이를 실행하는 테스트를 찾으세요:
- 함수 `processPayment()` → `billing.test.ts`, `billing.spec.ts`, `test/billing_test.rb` 찾기
- if/else → true와 false 경로 모두를 다루는 테스트 찾기
- 에러 핸들러 → 특정 에러 조건을 트리거하는 테스트 찾기
- 자체 분기가 있는 `helperFn()` 호출 → 그 분기에도 테스트 필요
- 사용자 흐름 → 여정을 걸어가는 통합 또는 E2E 테스트 찾기
- 인터랙션 edge case → 예상치 못한 액션을 시뮬레이션하는 테스트 찾기

품질 점수 기준:
- ★★★  edge case와 에러 경로로 행동을 테스트
- ★★   happy path만 올바른 행동 테스트
- ★    스모크 테스트 / 존재 확인 / 사소한 assertion (예: "렌더링됨", "throw 안 함")

### E2E 테스트 결정 매트릭스

각 분기를 확인할 때, 단위 테스트와 E2E/통합 테스트 중 어느 것이 적절한 도구인지도 판단하세요:

**E2E 추천 (다이어그램에 [→E2E]로 표시):**
- 3개 이상의 컴포넌트/서비스에 걸치는 일반적인 사용자 흐름 (예: 가입 → 이메일 확인 → 첫 로그인)
- 모킹이 실제 실패를 숨기는 통합 지점 (예: API → 큐 → 워커 → DB)
- Auth/결제/데이터 삭제 흐름 — 단위 테스트만 믿기엔 너무 중요함

**EVAL 추천 (다이어그램에 [→EVAL]로 표시):**
- 품질 eval이 필요한 중요한 LLM 호출 (예: 프롬프트 변경 → 출력이 여전히 품질 기준 충족 확인)
- 프롬프트 템플릿, 시스템 지침, 도구 정의의 변경

**단위 테스트 유지:**
- 명확한 입출력을 가진 순수 함수
- side effect가 없는 내부 헬퍼
- 단일 함수의 edge case (null 입력, 빈 배열)
- 고객 대면이 아닌 드문/희귀한 흐름

### REGRESSION RULE (회귀 규칙 — 필수)

**철칙:** 커버리지 감사에서 REGRESSION을 식별하면 — 이전에 작동했지만 diff가 깨뜨린 코드 — 회귀 테스트를 중요 요구사항으로 플랜에 추가합니다. AskUserQuestion 없음. 건너뛰기 없음. 회귀는 무언가가 깨졌음을 증명하기 때문에 가장 높은 우선순위 테스트입니다.

회귀란:
- diff가 기존 동작을 수정할 때 (새 코드가 아닌)
- 기존 테스트 스위트(있다면)가 변경된 경로를 다루지 않을 때
- 변경이 기존 호출자에게 새 실패 모드를 도입할 때

변경이 회귀인지 불확실하면, 테스트를 작성하는 쪽으로 기울이세요.

**Step 4. ASCII 커버리지 다이어그램 출력:**

코드 경로와 사용자 흐름을 같은 다이어그램에 포함하세요. E2E에 해당하는 경로와 eval에 해당하는 경로를 표시하세요:

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

**빠른 경로:** 모든 경로가 커버됨 → "테스트 리뷰: 모든 새 코드 경로에 테스트 커버리지가 있습니다 ✓" 계속하세요.

**Step 5. 플랜에 누락된 테스트를 추가하세요:**

다이어그램에서 식별된 각 GAP에 대해, 플랜에 테스트 요구사항을 추가하세요. 구체적으로:
- 생성할 테스트 파일 (기존 명명 규칙 준수)
- 테스트가 assert해야 하는 것 (구체적 입력 → 예상 출력/동작)
- 단위 테스트, E2E 테스트, 또는 eval인지 (결정 매트릭스 사용)
- 회귀의 경우: **CRITICAL**로 표시하고 무엇이 깨졌는지 설명

플랜은 구현 시작 시 모든 테스트가 기능 코드와 함께 작성되도록 충분히 완전해야 합니다 — 후속 작업으로 미루지 마세요.

### 테스트 플랜 아티팩트

커버리지 다이어그램을 생성한 후, `/qa`와 `/qa-only`가 주요 테스트 입력으로 사용할 수 있도록 프로젝트 디렉토리에 테스트 플랜 아티팩트를 작성하세요:

```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
```

`~/.gstack/projects/{slug}/{user}-{branch}-eng-review-test-plan-{datetime}.md`에 작성하세요:

```markdown
# Test Plan
Generated by /plan-eng-review on {date}
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

이 파일은 `/qa`와 `/qa-only`가 주요 테스트 입력으로 사용합니다. QA 테스터가 **무엇을 어디서 테스트할지** 아는 데 도움이 되는 정보만 포함하세요 — 구현 세부사항이 아닙니다.

LLM/프롬프트 변경의 경우: CLAUDE.md에 나열된 "Prompt/LLM changes" 파일 패턴을 확인하세요. 이 플랜이 그 패턴 중 하나라도 건드리면, 어떤 eval 스위트를 실행해야 하는지, 어떤 케이스를 추가해야 하는지, 어떤 baseline과 비교해야 하는지를 명시하세요. 그런 다음 AskUserQuestion을 사용하여 사용자와 eval 범위를 확인하세요.

**정지.** 이 섹션에서 발견된 각 이슈에 대해 AskUserQuestion을 개별적으로 호출하세요. 한 호출에 하나의 이슈만. 옵션을 제시하고, 추천을 명시하고, 이유를 설명하세요. 여러 이슈를 하나의 AskUserQuestion에 묶지 마세요. 이 섹션의 모든 이슈가 해결된 후에만 다음 섹션으로 진행하세요.

### 4. 성능 리뷰
평가하세요:
* N+1 쿼리와 데이터베이스 접근 패턴.
* 메모리 사용 우려.
* 캐싱 기회.
* 느리거나 높은 복잡도의 코드 경로.

**정지.** 이 섹션에서 발견된 각 이슈에 대해 AskUserQuestion을 개별적으로 호출하세요. 한 호출에 하나의 이슈만. 옵션을 제시하고, 추천을 명시하고, 이유를 설명하세요. 여러 이슈를 하나의 AskUserQuestion에 묶지 마세요. 이 섹션의 모든 이슈가 해결된 후에만 다음 섹션으로 진행하세요.

## Outside Voice — 독립적 플랜 도전 (선택, 권장)

모든 리뷰 섹션이 완료된 후, 다른 AI 시스템에서 독립적인 세컨드 오피니언을 제안하세요. 두 모델이 플랜에 동의하는 것은 한 모델의 철저한 리뷰보다 더 강한 신호입니다.

**도구 가용성 확인:**

```bash
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
```

AskUserQuestion을 사용하세요:

> "모든 리뷰 섹션이 완료되었습니다. 외부 의견을 들어보시겠습니까? 다른 AI 시스템이 이 플랜에 대해 솔직하고 독립적인 도전을 해줄 수 있습니다 — 논리적 공백, 실현 가능성 리스크, 리뷰 내부에서 잡기 어려운 사각지대. 약 2분 정도 걸립니다."
>
> 추천: A를 선택하세요 — 독립적인 세컨드 오피니언이 구조적 사각지대를 잡아냅니다. 두 다른 AI 모델이 플랜에 동의하는 것은 한 모델의 철저한 리뷰보다 더 강한 신호입니다. 완전성: A=9/10, B=7/10.

옵션:
- A) 외부 의견 받기 (권장)
- B) 건너뛰기 — 결과물로 진행

**B인 경우:** "외부 의견을 건너뜁니다."를 출력하고 다음 섹션으로 계속하세요.

**A인 경우:** 플랜 리뷰 프롬프트를 구성하세요. 리뷰 대상인 플랜 파일(사용자가 이 리뷰를 가리킨 파일, 또는 branch diff 범위)을 읽으세요. Step 0D-POST에서 CEO 플랜 문서가 작성되었으면, 그것도 읽으세요 — 범위 결정과 비전이 포함되어 있습니다.

다음 프롬프트를 구성하세요 (실제 플랜 내용을 대입 — 플랜 내용이 30KB를 초과하면 처음 30KB로 잘라내고 "Plan truncated for size"라고 참고):

"You are a brutally honest technical reviewer examining a development plan that has
already been through a multi-section review. Your job is NOT to repeat that review.
Instead, find what it missed. Look for: logical gaps and unstated assumptions that
survived the review scrutiny, overcomplexity (is there a fundamentally simpler
approach the review was too deep in the weeds to see?), feasibility risks the review
took for granted, missing dependencies or sequencing issues, and strategic
miscalibration (is this the right thing to build at all?). Be direct. Be terse. No
compliments. Just the problems.

THE PLAN:
<plan content>"

**CODEX_AVAILABLE인 경우:**

```bash
TMPERR_PV=$(mktemp /tmp/codex-planreview-XXXXXXXX)
codex exec "<prompt>" -s read-only -c 'model_reasoning_effort="xhigh"' --enable web_search_cached 2>"$TMPERR_PV"
```

5분 timeout을 사용하세요 (`timeout: 300000`). 명령이 완료된 후, stderr를 읽으세요:
```bash
cat "$TMPERR_PV"
```

전체 출력을 그대로 제시하세요:

```
CODEX SAYS (plan review — outside voice):
════════════════════════════════════════════════════════════
<full codex output, verbatim — do not truncate or summarize>
════════════════════════════════════════════════════════════
```

**에러 처리:** 모든 에러는 non-blocking입니다 — 외부 의견은 참고 정보입니다.
- Auth 실패 (stderr에 "auth", "login", "unauthorized" 포함): "Codex auth failed. Run \`codex login\` to authenticate."
- Timeout: "Codex timed out after 5 minutes."
- 빈 응답: "Codex returned no response."

Codex 에러 발생 시, Claude adversarial subagent로 폴백하세요.

**CODEX_NOT_AVAILABLE인 경우 (또는 Codex 에러):**

Agent 도구를 통해 디스패치하세요. 서브에이전트는 새로운 컨텍스트를 가집니다 — 진정한 독립성.

서브에이전트 프롬프트: 위와 동일한 플랜 리뷰 프롬프트.

`OUTSIDE VOICE (Claude subagent):` 헤더 아래에 발견 사항을 제시하세요.

서브에이전트가 실패하거나 타임아웃되면: "Outside voice unavailable. Continuing to outputs."

**크로스 모델 텐션:**

외부 의견의 발견 사항을 제시한 후, 외부 의견이 이전 섹션의 리뷰 결과와 동의하지 않는 지점을 참고하세요. 다음과 같이 표시하세요:

```
CROSS-MODEL TENSION:
  [Topic]: Review said X. Outside voice says Y. [Your assessment of who's right.]
```

각 실질적인 텐션 포인트에 대해, AskUserQuestion을 통해 TODO로 자동 제안하세요:

> "크로스 모델 의견 불일치: [topic]. 리뷰에서는 [X]를 발견했지만 외부 의견은 [Y]를 주장합니다. 추가 조사할 가치가 있나요?"

옵션:
- A) TODOS.md에 추가
- B) 건너뛰기 — 실질적이지 않음

텐션 포인트가 없으면, 참고: "크로스 모델 텐션 없음 — 양쪽 리뷰어가 동의합니다."

**결과 저장:**
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"codex-plan-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","commit":"'"$(git rev-parse --short HEAD)"'"}'
```

대체: STATUS = 발견 사항이 없으면 "clean", 있으면 "issues_found".
SOURCE = Codex가 실행되었으면 "codex", 서브에이전트가 실행되었으면 "claude".

**정리:** 처리 후 `rm -f "$TMPERR_PV"` 실행 (Codex를 사용한 경우).

---

## 핵심 규칙 — 질문하는 방법
위의 Preamble의 AskUserQuestion 형식을 따르세요. 플랜 리뷰를 위한 추가 규칙:
* **하나의 이슈 = 하나의 AskUserQuestion 호출.** 여러 이슈를 하나의 질문에 묶지 마세요.
* 파일과 라인 참조와 함께 문제를 구체적으로 설명하세요.
* 2-3개 옵션을 제시하되, 합리적인 경우 "아무것도 안 함"을 포함하세요.
* 각 옵션에 대해, 한 줄로: 노력 (human: ~X / CC: ~Y), 리스크, 유지보수 부담을 명시하세요. 완전한 옵션이 CC로 shortcut보다 약간만 더 많은 노력이면, 완전한 옵션을 추천하세요.
* **추천을 위의 엔지니어링 선호도에 연결하세요.** 한 문장으로 특정 선호도(DRY, explicit > clever, minimal diff 등)에 연결하세요.
* 이슈 번호 + 옵션 문자로 라벨링하세요 (예: "3A", "3B").
* **탈출구:** 섹션에 이슈가 없으면, 그렇다고 말하고 넘어가세요. 이슈에 실질적 대안이 없는 명확한 수정이 있으면, 무엇을 할 것인지 말하고 넘어가세요 — 의미 없는 트레이드오프가 아닌 진짜 결정이 있을 때만 AskUserQuestion을 사용하세요.

## 필수 결과물

### "NOT in scope" 섹션
모든 플랜 리뷰는 고려되었지만 명시적으로 미뤄진 작업을 나열하는 "NOT in scope" 섹션을 반드시 생성해야 하며, 각 항목에 한 줄 근거를 포함해야 합니다.

### "What already exists" 섹션
이 플랜의 하위 문제를 이미 부분적으로 해결하는 기존 코드/흐름을 나열하고, 플랜이 이를 재사용하는지 불필요하게 재구축하는지를 명시하세요.

### TODOS.md 업데이트
모든 리뷰 섹션이 완료된 후, 각 잠재적 TODO를 개별 AskUserQuestion으로 제시하세요. TODO를 묶지 마세요 — 질문당 하나씩. 이 단계를 조용히 건너뛰지 마세요. `.claude/skills/review/TODOS-format.md`의 형식을 따르세요.

각 TODO에 대해 설명하세요:
* **What:** 작업의 한 줄 설명.
* **Why:** 해결하는 구체적 문제나 가치.
* **Pros:** 이 작업을 함으로써 얻는 것.
* **Cons:** 비용, 복잡성, 또는 리스크.
* **Context:** 3개월 후 이것을 받아드는 사람이 동기, 현재 상태, 시작점을 이해할 수 있을 만큼의 상세.
* **Depends on / blocked by:** 전제 조건이나 순서 제약.

그런 다음 옵션을 제시하세요: **A)** TODOS.md에 추가 **B)** 건너뛰기 — 충분히 가치 없음 **C)** 미루지 않고 이 PR에서 바로 빌드

모호한 불릿 포인트를 추가하지 마세요. 컨텍스트가 없는 TODO는 TODO가 없는 것보다 나쁩니다 — 아이디어가 캡처되었다는 거짓 자신감을 만들면서 실제로 추론을 잃어버립니다.

### 다이어그램
플랜 자체가 비자명한 data flow, 상태 머신, 또는 처리 파이프라인에 ASCII 다이어그램을 사용해야 합니다. 추가로, 구현에서 인라인 ASCII 다이어그램 주석을 넣어야 할 파일을 식별하세요 — 특히 복잡한 상태 전환이 있는 Model, 다단계 파이프라인이 있는 Service, 비자명한 mixin 동작이 있는 Concern.

### 실패 모드
테스트 리뷰 다이어그램에서 식별된 각 새 코드 경로에 대해, 프로덕션에서 실패할 수 있는 현실적인 방법 하나를 나열하세요 (timeout, nil 참조, race condition, stale 데이터 등) 그리고:
1. 해당 실패를 다루는 테스트가 있는지
2. 에러 처리가 존재하는지
3. 사용자가 명확한 에러를 보는지 아니면 조용한 실패인지

테스트도 없고 에러 처리도 없고 조용한 실패인 실패 모드가 있으면, **critical gap**으로 표시하세요.

### 완료 요약
리뷰가 끝나면, 사용자가 모든 발견 사항을 한눈에 볼 수 있도록 이 요약을 채워서 표시하세요:
- Step 0: 범위 도전 — ___ (범위 그대로 수용 / 추천에 따라 범위 축소)
- Architecture 리뷰: ___ 이슈 발견
- 코드 품질 리뷰: ___ 이슈 발견
- 테스트 리뷰: 다이어그램 생성, ___ 갭 식별
- 성능 리뷰: ___ 이슈 발견
- NOT in scope: 작성됨
- What already exists: 작성됨
- TODOS.md 업데이트: ___ 항목 사용자에게 제안
- 실패 모드: ___ critical gap 표시
- Outside voice: 실행 (codex/claude) / 건너뜀
- Lake 점수: X/Y 추천이 완전한 옵션 선택

## 회고적 학습
이 branch의 git 로그를 확인하세요. 이전 리뷰 사이클을 시사하는 이전 commit이 있으면 (예: 리뷰 기반 리팩터링, 되돌린 변경), 무엇이 변경되었는지와 현재 플랜이 같은 영역을 건드리는지 참고하세요. 이전에 문제가 있었던 영역을 더 공격적으로 리뷰하세요.

## 서식 규칙
* 이슈에 번호(1, 2, 3...)를 매기고 옵션에 문자(A, B, C...)를 사용하세요.
* 번호 + 문자로 라벨링하세요 (예: "3A", "3B").
* 옵션당 최대 한 문장. 5초 안에 선택할 수 있게.
* 각 리뷰 섹션 후, 다음으로 넘어가기 전에 멈추고 피드백을 요청하세요.

## Review Log (리뷰 로그)

위의 완료 요약을 생성한 후, 리뷰 결과를 저장하세요.

**PLAN MODE EXCEPTION — 반드시 실행:** 이 명령은 `~/.gstack/`(사용자 설정 디렉토리, 프로젝트 파일이 아님)에 리뷰 메타데이터를 기록합니다. skill preamble이 이미 `~/.gstack/sessions/`와 `~/.gstack/analytics/`에 기록합니다 — 동일한 패턴입니다. 리뷰 대시보드가 이 데이터에 의존합니다. 이 명령을 건너뛰면 /ship의 리뷰 준비 대시보드가 깨집니다.

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-eng-review","timestamp":"TIMESTAMP","status":"STATUS","unresolved":N,"critical_gaps":N,"issues_found":N,"mode":"MODE","commit":"COMMIT"}'
```

완료 요약에서 값을 대체하세요:
- **TIMESTAMP**: 현재 ISO 8601 datetime
- **STATUS**: 미해결 결정이 0이고 critical gap이 0이면 "clean"; 그렇지 않으면 "issues_open"
- **unresolved**: "미해결 결정" 카운트의 숫자
- **critical_gaps**: "실패 모드: ___ critical gap 표시"의 숫자
- **issues_found**: 모든 리뷰 섹션에서 발견된 총 이슈 수 (Architecture + Code Quality + Performance + Test gap)
- **MODE**: FULL_REVIEW / SCOPE_REDUCED
- **COMMIT**: `git rev-parse --short HEAD`의 출력

## Review Readiness Dashboard (리뷰 준비 대시보드)

리뷰를 완료한 후, 리뷰 로그와 설정을 읽어 대시보드를 표시하세요.

```bash
~/.claude/skills/gstack/bin/gstack-review-read
```

출력을 파싱하세요. 각 skill(plan-ceo-review, plan-eng-review, review, plan-design-review, design-review-lite, adversarial-review, codex-review, codex-plan-review)의 가장 최근 항목을 찾으세요. 7일보다 오래된 타임스탬프의 항목은 무시하세요. Eng Review 행에는 `review`(diff 범위 pre-landing 리뷰)와 `plan-eng-review`(플랜 단계 architecture 리뷰) 중 더 최근 것을 표시하세요. 구분을 위해 상태에 "(DIFF)" 또는 "(PLAN)"을 추가하세요. Adversarial 행에는 `adversarial-review`(새 auto-scaled)와 `codex-review`(레거시) 중 더 최근 것을 표시하세요. Design Review에는 `plan-design-review`(전체 비주얼 감사)와 `design-review-lite`(코드 수준 확인) 중 더 최근 것을 표시하세요. 구분을 위해 상태에 "(FULL)" 또는 "(LITE)"를 추가하세요. 표시하세요:

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
- **Eng Review (기본적으로 필수):** 출시를 게이트하는 유일한 리뷰. Architecture, 코드 품질, 테스트, 성능을 다룹니다. \`gstack-config set skip_eng_review true\`로 전역적으로 비활성화할 수 있습니다 ("방해하지 마세요" 설정).
- **CEO Review (선택):** 판단하여 사용하세요. 큰 제품/비즈니스 변경, 새 사용자 대면 기능, 범위 결정에 추천합니다. 버그 수정, 리팩터링, 인프라, 정리에는 건너뛰세요.
- **Design Review (선택):** 판단하여 사용하세요. UI/UX 변경에 추천합니다. 백엔드 전용, 인프라, 프롬프트 전용 변경에는 건너뛰세요.
- **Adversarial Review (자동):** diff 크기에 따라 자동 조절됩니다. 작은 diff(<50줄)는 adversarial을 건너뜁니다. 중간 diff(50-199)는 크로스 모델 adversarial을 받습니다. 큰 diff(200+)는 4개 패스 모두 받습니다: Claude structured, Codex structured, Claude adversarial subagent, Codex adversarial. 설정 필요 없습니다.
- **Outside Voice (선택):** 다른 AI 모델의 독립적 플랜 리뷰. /plan-ceo-review와 /plan-eng-review의 모든 리뷰 섹션이 완료된 후 제안됩니다. Codex를 사용할 수 없으면 Claude subagent로 폴백합니다. 출시를 게이트하지 않습니다.

**판정 로직:**
- **CLEARED**: Eng Review가 7일 이내에 `review` 또는 `plan-eng-review`에서 status "clean"인 항목이 1개 이상 (또는 \`skip_eng_review\`가 \`true\`)
- **NOT CLEARED**: Eng Review가 없거나, 오래되었거나(7일 초과), 열린 이슈가 있음
- CEO, Design, Codex 리뷰는 컨텍스트로 표시되지만 출시를 차단하지 않음
- \`skip_eng_review\` 설정이 \`true\`이면, Eng Review는 "SKIPPED (global)"을 표시하고 판정은 CLEARED

**오래됨 감지:** 대시보드 표시 후, 기존 리뷰가 오래되었을 수 있는지 확인하세요:
- bash 출력의 \`---HEAD---\` 섹션을 파싱하여 현재 HEAD commit 해시를 가져오세요
- \`commit\` 필드가 있는 각 리뷰 항목에 대해: 현재 HEAD와 비교하세요. 다르면 경과 commit 수를 세세요: \`git rev-list --count STORED_COMMIT..HEAD\`. 표시: "참고: {skill} 리뷰 ({date})가 오래되었을 수 있음 — 리뷰 이후 {N}개 commit"
- \`commit\` 필드가 없는 항목(레거시)은: "참고: {skill} 리뷰 ({date})에 commit 추적이 없음 — 정확한 오래됨 감지를 위해 다시 실행을 고려하세요"
- 모든 리뷰가 현재 HEAD와 일치하면, 오래됨 참고를 표시하지 마세요

## Plan File Review Report (플랜 파일 리뷰 리포트)

대화 출력에 Review Readiness Dashboard를 표시한 후, **플랜 파일** 자체도 업데이트하여 플랜을 읽는 누구에게나 리뷰 상태가 보이게 하세요.

### 플랜 파일 감지

1. 이 대화에서 활성 플랜 파일이 있는지 확인하세요 (호스트가 시스템 메시지에서 플랜 파일 경로를 제공합니다 — 대화 컨텍스트에서 플랜 파일 참조를 찾으세요).
2. 찾을 수 없으면, 이 섹션을 조용히 건너뛰세요 — 모든 리뷰가 plan mode에서 실행되는 것은 아닙니다.

### 리포트 생성

위의 Review Readiness Dashboard 단계에서 이미 가지고 있는 리뷰 로그 출력을 읽으세요. 각 JSONL 항목을 파싱하세요. 각 skill은 다른 필드를 기록합니다:

- **plan-ceo-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`mode\`, \`scope_proposed\`, \`scope_accepted\`, \`scope_deferred\`, \`commit\`
  → Findings: "{scope_proposed} proposals, {scope_accepted} accepted, {scope_deferred} deferred"
  → scope 필드가 0이거나 없으면 (HOLD/REDUCTION mode): "mode: {mode}, {critical_gaps} critical gaps"
- **plan-eng-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`issues_found\`, \`mode\`, \`commit\`
  → Findings: "{issues_found} issues, {critical_gaps} critical gaps"
- **plan-design-review**: \`status\`, \`initial_score\`, \`overall_score\`, \`unresolved\`, \`decisions_made\`, \`commit\`
  → Findings: "score: {initial_score}/10 → {overall_score}/10, {decisions_made} decisions"
- **codex-review**: \`status\`, \`gate\`, \`findings\`, \`findings_fixed\`
  → Findings: "{findings} findings, {findings_fixed}/{findings} fixed"

Findings 열에 필요한 모든 필드가 이제 JSONL 항목에 있습니다.
방금 완료한 리뷰의 경우, 자체 완료 요약에서 더 풍부한 세부 정보를 사용할 수 있습니다. 이전 리뷰의 경우, JSONL 필드를 직접 사용하세요 — 모든 필요 데이터가 포함되어 있습니다.

다음 마크다운 테이블을 생성하세요:

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | {runs} | {status} | {findings} |
| Codex Review | \`/codex review\` | Independent 2nd opinion | {runs} | {status} | {findings} |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | {runs} | {status} | {findings} |
| Design Review | \`/plan-design-review\` | UI/UX gaps | {runs} | {status} | {findings} |
\`\`\`

테이블 아래에 다음 라인을 추가하세요 (비어 있거나 해당되지 않는 것은 생략):

- **CODEX:** (codex-review가 실행된 경우에만) — codex 수정의 한 줄 요약
- **CROSS-MODEL:** (Claude와 Codex 리뷰 모두 존재하는 경우에만) — 중복 분석
- **UNRESOLVED:** 모든 리뷰에 걸친 총 미해결 결정
- **VERDICT:** CLEAR인 리뷰 목록 (예: "CEO + ENG CLEARED — ready to implement").
  Eng Review가 CLEAR가 아니고 전역적으로 건너뛰기 않았으면, "eng review required"를 추가.

### 플랜 파일에 작성

**PLAN MODE EXCEPTION — 반드시 실행:** 플랜 파일에 기록하며, plan mode에서 편집 가능한 유일한 파일입니다. 플랜 파일 리뷰 리포트는 플랜의 실시간 상태의 일부입니다.

- 플랜 파일에서 \`## GSTACK REVIEW REPORT\` 섹션을 **파일 어디에서든** 검색하세요 (끝에만이 아니라 — 뒤에 내용이 추가되었을 수 있습니다).
- 있으면, Edit 도구를 사용하여 **전체를 교체**하세요. \`## GSTACK REVIEW REPORT\`부터 다음 \`## \` 제목이나 파일 끝까지 매칭하세요 (먼저 오는 것). 리포트 섹션 뒤에 추가된 내용은 보존됩니다. Edit이 실패하면 (예: 동시 편집으로 내용 변경), 플랜 파일을 다시 읽고 한 번 재시도하세요.
- 해당 섹션이 없으면, 플랜 파일 끝에 **추가**하세요.
- 항상 플랜 파일의 가장 마지막 섹션으로 배치하세요. 파일 중간에서 발견되면, 이동하세요: 기존 위치를 삭제하고 끝에 추가하세요.

## 다음 단계 — 리뷰 체이닝

Review Readiness Dashboard를 표시한 후, 추가 리뷰가 가치 있을지 확인하세요. 대시보드 출력을 읽어 어떤 리뷰가 이미 실행되었는지와 오래되었는지 확인하세요.

**UI 변경이 있고 design review가 실행되지 않았으면 /plan-design-review를 제안하세요** — 테스트 다이어그램, architecture 리뷰, 또는 프론트엔드 컴포넌트, CSS, 뷰, 사용자 대면 인터랙션 흐름을 건드린 섹션에서 감지하세요. 기존 design review의 commit 해시가 이 eng review에서 발견된 중대한 변경 이전이면, 오래되었을 수 있다고 참고하세요.

**중대한 제품 변경이고 CEO review가 없으면 /plan-ceo-review를 언급하세요** — 이것은 부드러운 제안이지, 강요가 아닙니다. CEO review는 선택입니다. 플랜이 새 사용자 대면 기능을 도입하거나, 제품 방향을 변경하거나, 범위를 상당히 확장할 때만 언급하세요.

**기존 CEO 또는 design review의 오래됨을 참고하세요** — 이 eng review가 그것들과 모순되는 가정을 발견했거나, commit 해시가 상당한 차이를 보이는 경우.

**추가 리뷰가 필요하지 않으면** (또는 대시보드 설정에서 `skip_eng_review`가 `true`이면, 즉 이 eng review가 선택이었음): "관련 리뷰 모두 완료. 준비되면 /ship을 실행하세요."라고 명시하세요.

AskUserQuestion을 해당되는 옵션만 포함하여 사용하세요:
- **A)** /plan-design-review 실행 (UI 범위가 감지되고 design review가 없을 때만)
- **B)** /plan-ceo-review 실행 (중대한 제품 변경이고 CEO review가 없을 때만)
- **C)** 구현 준비 완료 — 작업이 끝나면 /ship 실행

## 미해결 결정
사용자가 AskUserQuestion에 응답하지 않거나 넘어가려고 중단하면, 어떤 결정이 미해결인지 참고하세요. 리뷰가 끝나면 이것들을 "나중에 문제가 될 수 있는 미해결 결정"으로 나열하세요 — 절대 조용히 옵션을 기본값으로 선택하지 마세요.
