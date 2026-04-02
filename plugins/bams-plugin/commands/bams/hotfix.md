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
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_start "{slug}" "hotfix" "/bams:hotfix" "{arguments}"
```

## Step 1: 버그 진단 + 수정

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 1 "버그 진단 + 수정" "Phase 1: 진단/수정"
```

**컨텍스트 활용**: config.md의 프로젝트 구조 + 관련 gotchas + 이전 리뷰 이슈를 전달.

`bams-plugin:defect-triage` 에이전트로 결함 분류 및 근본 원인 추적.
3개 Investigator 병렬 분석 → Impact Analysis → Scope Lock → 외과적 수정 → Root Cause Verification → 회귀 테스트 생성.

Step 1 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 1 "done" {duration_ms}
```

## Step 2: QA 검증 (bams browse 스킬, 선택)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 2 "QA 검증" "Phase 2: 검증"
```

**스킬 미설치 시**: `skipped` 기록.

`bams-plugin:automation-qa` 에이전트로 테스트 계획 수립.

AskUserQuestion — "브라우저 QA 테스트를 진행할까요?"
- **건너뛰기 (Recommended)**
- **QA 진행** — URL 입력 후 `_QA_SKILL` 실행

Step 2 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 2 "{status}" {duration_ms}
```

## Step 3-4: CI/CD 프리플라이트 + 출시 준비 검토 (오버랩)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 3 "CI/CD 프리플라이트" "Phase 3: 배포 준비"
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 4 "출시 준비 검토" "Phase 3: 배포 준비"
```

**Step 3 — CI/CD 프리플라이트:**
`/bams:verify` 실행. FAIL 시 자동 수정(최대 2회) / 수동 / 무시.

**Step 4 — 출시 준비 검토 (Step 3 PASS 시):**
**스킬 미설치 시**: "수동 PR 생성" 안내 후 `skipped`.

`bams-plugin:release-quality-gate` 에이전트로 출시 준비 검토.
**최적화**: verify PASS 판정이 나오면 release-quality-gate는 verify 결과를 기다리지 않고 즉시 코드 리뷰 기반 검토를 시작합니다. verify 결과는 RQG에 후속 전달됩니다.

AskUserQuestion — "PR을 생성할까요?"
- **Ship (Recommended)** — `_SHIP_SKILL` 실행
- **나중에** — `status: paused_at_step_4` 기록 후 종료.

Step 3-4 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 3 "{status}" {duration_ms}
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 4 "{status}" {duration_ms}
```

## Step 5: 배포 (bams deploy 스킬, 선택)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 5 "배포" "Phase 4: 배포"
```

`bams-plugin:platform-devops` 에이전트로 배포 환경 점검.

AskUserQuestion — "즉시 배포할까요?"
- **나중에 (Recommended)**
- **배포** — `_DEPLOY_SKILL` 실행

Step 5 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 5 "{status}" {duration_ms}
```

## 마무리

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 5)

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `hotfix:` — 근본 원인 + 영향 범위
2. `vulnerable:` — 같은 영역 반복 버그 시 경고 수준 상향
3. `regression-test:` — 추가된 회귀 테스트 경로

`.crew/board.md` 업데이트: 관련 태스크 있으면 `Done`으로 변경.
