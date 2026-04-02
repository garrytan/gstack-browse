---
description: 성능 측정/최적화 — benchmark 기반 성능 관리
argument-hint: <url> [--baseline | --trend]
---

# Bams: Performance

bams benchmark 스킬을 활용한 성능 측정, 비교, 트렌드 분석입니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

차이점:
- benchmark 스킬 **필수** — 미설치 시 "bams benchmark 스킬이 필요합니다." 후 중단.
- URL 없으면 config.md에서 확인, 없으면 AskUserQuestion.
- 모드: `--baseline` (캡처), `--trend` (트렌드), 없으면 비교 모드.
- Gotchas 중 `perf-regression`, `perf-baseline` 관련 항목을 벤치마크 컨텍스트로 전달.
- 트렌드 모드: `performance-*.md` **최근 20개만** 읽기 (수정 날짜 기준).

스킬 로딩:

```bash
_BENCHMARK_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/benchmark/SKILL.md" 2>/dev/null | head -1)
```

`bams-plugin:performance-evaluation` 에이전트를 분석에 활용합니다.

진행 추적 파일: `templates/performance-tracking.md` 기반으로 생성.

### Viz 이벤트: pipeline_start

진행 추적 파일 및 lock 파일 생성 직후, Bash로 다음을 실행합니다:

```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_start "{slug}" "performance" "/bams:performance" "{arguments}"
```

## 베이스라인 모드 (--baseline)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 1 "베이스라인 측정" "Phase 1: 측정"
```

`_BENCHMARK_SKILL` `--baseline` 모드로 실행.

베이스라인 모드 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 1 "done" {duration_ms}
```

## 비교 모드 (기본)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 2 "비교 측정" "Phase 2: 비교"
```

`performance-*.md` 중 `mode: baseline`, `status: completed` 파일 확인.
없으면 먼저 캡처할지 AskUserQuestion.
있으면 `_BENCHMARK_SKILL` 비교 모드 실행.

비교 모드 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 2 "done" {duration_ms}
```

## 트렌드 모드 (--trend)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 3 "트렌드 분석" "Phase 3: 트렌드"
```

최근 20개 `performance-*.md` 프론트매터에서 수치만 추출하여 시계열 구축.
`_BENCHMARK_SKILL` `--trend` 모드 실행.

트렌드 모드 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 3 "done" {duration_ms}
```

## 마무리

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 3)

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `perf-baseline:` — 베이스라인 수치 (LCP, FCP, CLS, 번들 사이즈)
2. `perf-regression:` — 이전 대비 악화 지표
3. `perf-improvement:` — 최적화 적용 후 개선 수치
