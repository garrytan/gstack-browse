---
description: 주간 루틴 — 스프린트 마무리 + 회고 + 다음 스프린트 계획
argument-hint:
---

# Pipeline: Weekly

매주 금요일(또는 스프린트 종료 시) 실행하는 주간 루틴입니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

추가 항목:
- **`.crew/sprints/`** — 활성 스프린트 정보.
- **`.crew/artifacts/pipeline/`** — 이전 `weekly-*.md`의 `started_at` 이후 실행된 **모든 타입** 파이프라인 기록 (feature, hotfix, deep-review, security, performance).
  - 각 파일의 **프론트매터 + Execution Log 마지막 줄만** 추출 (전체 파일 읽지 않음).
- **config.md의 `## Pipeline Learnings`** 에서 `trend:`, `⚠ vulnerable:`, `🔴` 항목을 추출 → Step 3(회고), Step 4(다음 스프린트) 의사결정에 활용.

진행 추적 파일: `templates/weekly-tracking.md` 기반으로 생성.

## Step 1: 스프린트 현황 확인

활성 스프린트 없으면 `skipped` → Step 3으로.

board.md에서 태스크 현황 파악 + 이번 주 파이프라인 기록과 태스크 매핑.
`/crew:sprint status` 실행.

## Step 2: 스프린트 종료

AskUserQuestion — "현재 스프린트를 종료할까요?"
- **종료 (Recommended)** — `/crew:sprint close` 실행
- **계속 진행**

## Step 3: 엔지니어링 회고 (gstack)

**GSTACK_NOT_AVAILABLE 시**: `skipped`.

AskUserQuestion — "회고를 진행할까요?"
- **진행 (Recommended)** — `/retro` 실행. 이전 weekly 회고 결과 있으면 트렌드 비교 전달.
- **건너뛰기**

## Step 4: 다음 스프린트 계획

백로그 비어있으면 `/crew:plan` 제안.
있으면 AskUserQuestion — "다음 스프린트를 계획할까요?"
- **계획 (Recommended)** — `/crew:sprint plan` 실행
- **나중에**

## 마무리

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `weekly:` — 이번 주 생산성 요약 (feature N개, hotfix N개, 완료율)
2. `retro:` — 회고 핵심 인사이트
3. `trend:` — 반복 이슈 트렌드

### Gotchas 정리 (주간 전용)

weekly는 gotchas의 **정기 정리** 담당:
1. 6개월간 관련 이슈 없는 항목 → "강등 후보" 제안.
2. 이번 주 해결된 이슈와 gotchas 매칭 → `resolved` 처리 제안.
3. gotchas 총 50개 초과 시 → 아카이브 프로세스 제안.
4. 90일 이상 경과한 `completed` pipeline 추적 파일 → 아카이브 제안.
