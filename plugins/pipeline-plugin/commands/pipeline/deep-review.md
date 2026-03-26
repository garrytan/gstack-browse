---
description: 다관점 심층 코드 리뷰 — Crew 5관점 + gstack 구조적 + Codex 세컨드 오피니언
argument-hint: [파일/디렉토리/pr]
---

# Pipeline: Deep Review

3개 리뷰 시스템을 실행하여 코드를 다각도로 검증합니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

차이점:
- config.md 없어도 계속 진행 가능.
- 리뷰 대상: 인자 → `git diff` → `git diff --cached` → `git diff main...HEAD` 순. 모두 없으면 AskUserQuestion.
- 이전 리뷰(24시간 이내, 이후 변경 없음) 있으면 변경분만 리뷰. 미해결 이슈도 추적.
- Gotchas 영역은 리뷰 시 중점 확인 대상으로 전달.

진행 추적 파일: `templates/deep-review-report.md` 기반으로 생성.

## Step 1: Crew 5관점 병렬 리뷰

config.md의 컨벤션 + 관련 gotchas + 이전 미해결 이슈를 리뷰 에이전트에 전달.

`/crew:review` 스킬 실행.
5개 에이전트: 정확성, 보안, 성능, 코드 품질, 테스트.

## Step 2+3: gstack 구조적 + Codex (선택)

Step 1 완료 후 한 번의 AskUserQuestion으로 결정:
- **둘 다 (Recommended)** — gstack `/review` + `/codex review` 실행
- **gstack만** — `/review` 실행
- **건너뛰기**

(GSTACK_NOT_AVAILABLE 시 해당 옵션 비활성. Codex CLI 미설치 시 해당 옵션 비활성.)

## 종합 리포트

1. 중복 제거 (같은 파일/라인의 동일 이슈 병합)
2. 이전 미해결 이슈 재검증 — `resolved` / `persists`
3. 고유 발견 분류
4. 심각도 정렬 (Critical → Major → Minor)

## 마무리

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `review:` — 여러 리뷰에서 동시 발견된 반복 패턴
2. `convention:` — 리뷰에서 확인된 프로젝트 컨벤션
3. `security:` — 보안 리뷰에서 발견된 주의 영역
