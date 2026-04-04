---
description: 파이프라인 회고 + 에이전트 평가 + 개선 — 평가부서/총괄팀 주도
argument-hint: "[all | {slug} | 빈값=최근5개]"
---

# Bams: Retro

파이프라인 이력 기반 에이전트 회고·평가·개선을 독립 실행합니다. 5개 Phase, 평가부서(product-analytics) + 총괄팀(pipeline-orchestrator) 주도.

```
retro.md → pipeline-orchestrator
             → [Phase 1] executive-reporter (이벤트 파싱) → product-analytics (지표 산출)
             → [Phase 2] 각 부서장 병렬 (KPT 제출) → pipeline-orchestrator (종합)
             → [Phase 3] product-analytics + performance-evaluation + business-kpi (병렬) + 각 부서장 (정성)
             → [Phase 4] 각 부서장 (개선안) → pipeline-orchestrator (승인) → hr-agent (파일 수정)
             → [Phase 5] executive-reporter (종합 보고서)
```

입력: $ARGUMENTS

## 인수 파싱

$ARGUMENTS 값에 따라 TARGET_SCOPE를 결정합니다:

1. 비어있음 → `TARGET_SCOPE = "recent5"` (최근 5개 파이프라인)
2. "all" → `TARGET_SCOPE = "all"` (전체 이력)
3. "--since {N}d" 형식 → `TARGET_SCOPE = "since_{N}d"` (최근 N일)
4. 그 외 문자열 → `TARGET_SCOPE = "slug:{값}"` (특정 slug)

## 사전 조건

**Step 1**: Glob으로 `.crew/config.md` 존재 확인. 없으면:
- 출력: "프로젝트가 초기화되지 않았습니다. `/bams:init`을 실행하세요."
- 중단.

**Step 2**: Bash로 `~/.bams/artifacts/pipeline/` JSONL 파일 수 확인.

```bash
ls ~/.bams/artifacts/pipeline/*.jsonl 2>/dev/null | wc -l
```

0개이면 출력: "파이프라인 이벤트 기록이 없습니다. `/bams:dev` 또는 `/bams:feature`를 먼저 실행하세요." 후 중단.

**Step 3**: TARGET_SCOPE가 특정 slug인 경우, 해당 slug JSONL 파일 존재 확인. 없으면 사용 가능한 slug 목록 출력 후 재입력 요청:

```bash
ls ~/.bams/artifacts/pipeline/*.jsonl 2>/dev/null | xargs -n1 basename | sed 's/\.jsonl$//'
```

## 공통 규칙 로드

이 파이프라인의 공통 규칙을 Read합니다:
`plugins/bams-plugin/commands/bams/retro/_common.md`

## Slug 결정

CLAUDE.md 파이프라인 네이밍 규칙(`{command}_{한글요약}`)을 따릅니다.
TARGET_SCOPE를 한글로 매핑하고, 같은 scope 중복 실행 시 순번(`_1`, `_2`, ...)을 자동 부여합니다:

```bash
case "{TARGET_SCOPE}" in
  all) SCOPE_KR="전체회고" ;;
  recent5) SCOPE_KR="최근5회고" ;;
  since_*) SCOPE_KR="최근${TARGET_SCOPE#since_}회고" ;;
  slug:*) SCOPE_KR="${TARGET_SCOPE#slug:}회고" ;;
esac
BASE="retro_${SCOPE_KR}"
EXISTING=$(ls -d .crew/artifacts/retro/${BASE}* 2>/dev/null | wc -l | tr -d ' ')
SLUG="${BASE}_$((EXISTING + 1))"
echo "[retro] slug: $SLUG"
```

예: `retro_전체회고_1`, `retro_전체회고_2` (같은 scope 두 번째 실행)
## bams-server 기동

공통 규칙(_common.md)의 bams-server 기동 절차를 따릅니다.

## Pipeline Start 이벤트

```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1)
[ -n "$_EMIT" ] && bash "$_EMIT" pipeline_start "{slug}" "retro" "{TARGET_SCOPE}"
```

## Phase 라우팅

pipeline-orchestrator에게 Phase 순서대로 위임합니다. 각 Phase 파일을 Read하여 지시를 따릅니다:

| Phase | 파일 | 설명 |
|-------|------|------|
| Phase 1 | `plugins/bams-plugin/commands/bams/retro/phase-1-data.md` | 데이터 수집 |
| Phase 2 | `plugins/bams-plugin/commands/bams/retro/phase-2-retro.md` | KPT 회고 |
| Phase 3 | `plugins/bams-plugin/commands/bams/retro/phase-3-eval.md` | 에이전트 평가 |
| Phase 4 | `plugins/bams-plugin/commands/bams/retro/phase-4-improve.md` | 개선 실행 |
| Phase 5 | `plugins/bams-plugin/commands/bams/retro/phase-5-report.md` | 보고 |

Phase 1부터 순서대로 진행합니다. 각 Phase 완료 시 게이트 조건을 확인한 후 다음 Phase로 전환합니다.
