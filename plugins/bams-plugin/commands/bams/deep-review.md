---
description: 다관점 심층 코드 리뷰 — 5관점 병렬 + 구조적 리뷰 + 세컨드 오피니언
argument-hint: [파일/디렉토리/pr]
---

# Bams: Deep Review

3개 리뷰 시스템을 실행하여 코드를 다각도로 검증합니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

차이점:
- config.md 없어도 계속 진행 가능.
- 리뷰 대상: 인자 → `git diff` → `git diff --cached` → `git diff main...HEAD` 순. 모두 없으면 AskUserQuestion.
- 이전 리뷰(24시간 이내, 이후 변경 없음) 있으면 변경분만 리뷰. 미해결 이슈도 추적.
- Gotchas 영역은 리뷰 시 중점 확인 대상으로 전달.

스킬 로딩:

```bash
_REVIEW_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/review/SKILL.md" 2>/dev/null | head -1)
_CODEX_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/codex/SKILL.md" 2>/dev/null | head -1)
```

진행 추적 파일: `templates/deep-review-report.md` 기반으로 생성.

### Viz 이벤트: pipeline_start

진행 추적 파일 및 lock 파일 생성 직후, Bash로 다음을 실행합니다:

```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_start "{slug}" "deep-review" "/bams:deep-review" "{arguments}"
```

## Step 1-2-3: 리뷰 실행 전략 선택

**AskUserQuestion** — "리뷰 범위를 선택하세요:"
- **풀 리뷰 (Recommended)** — 5관점 병렬 + 구조적 리뷰 + Codex 전부 **동시 실행**
- **5관점만** — 5관점 병렬 리뷰만 실행
- **5관점 + 구조적** — 5관점 + 구조적 리뷰 (Codex 제외)

(스킬 미설치 시 해당 옵션 비활성. Codex CLI 미설치 시 해당 옵션 비활성.)

### 실행

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 1 "5관점 리뷰" "Phase 1: 리뷰"
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 2 "구조적 리뷰" "Phase 1: 리뷰"
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 3 "Codex 세컨드 오피니언" "Phase 1: 리뷰"
```
(선택되지 않은 Step은 즉시 `skipped`로 step_end를 기록합니다)

config.md의 컨벤션 + 관련 gotchas + 이전 미해결 이슈를 리뷰 에이전트에 전달.

**선택에 따라 모든 리뷰를 최대한 병렬로 실행합니다:**

**Step 1 — 5개 qa-strategy 에이전트** (항상 병렬):
1. **정확성** — 로직 오류, 엣지 케이스, 타입 안전성
2. **보안** — 인젝션, 인증/인가, 시크릿 노출
3. **성능** — 불필요한 연산, N+1, 메모리 누수
4. **코드 품질** — 가독성, 중복, 패턴 일관성
5. **테스트** — 커버리지 갭, 테스트 신뢰성

**Step 2 — 구조적 리뷰** (선택 시 Step 1과 **동시 실행**):
`_REVIEW_SKILL` 실행

**Step 3 — Codex 세컨드 오피니언** (선택 시 Step 1과 **동시 실행**):
`_CODEX_SKILL` 실행

**풀 리뷰 선택 시**: Step 1 (5에이전트) + Step 2 + Step 3 = **최대 7개가 동시 실행**됩니다.

각 Step 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 1 "{status}" {duration_ms}
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 2 "{status}" {duration_ms}
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 3 "{status}" {duration_ms}
```

## 종합 리포트

1. 중복 제거 (같은 파일/라인의 동일 이슈 병합)
2. 이전 미해결 이슈 재검증 — `resolved` / `persists`
3. 고유 발견 분류
4. 심각도 정렬 (Critical → Major → Minor)

## 마무리

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 3)

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `review:` — 여러 리뷰에서 동시 발견된 반복 패턴
2. `convention:` — 리뷰에서 확인된 프로젝트 컨벤션
3. `security:` — 보안 리뷰에서 발견된 주의 영역
