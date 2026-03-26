---
description: 보안 감사 — Crew 시크릿 체크 + gstack OWASP/STRIDE 심층 스캔
argument-hint: [--comprehensive]
---

# Pipeline: Security

Crew verify + gstack CSO를 조합한 보안 감사입니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

추가 항목:
- `--comprehensive` 플래그 확인 → 심층 모드 / 일일 모드 결정.
- 7일 이내 `security-*.md`(`status: completed`) 있고 보안 관련 파일 변경 없으면 재실행 여부 확인.
- Gotchas 중 보안 관련 항목의 해결 여부를 감사 시 검증.

진행 추적 파일: `templates/security-audit.md` 기반으로 생성.

## Step 1: Crew 빠른 보안 체크

`/crew:verify` 실행.
체크 항목: 하드코딩 API 키, .env 커밋, 내부 URL 노출, 보안 린트.

## Step 2: gstack OWASP+STRIDE 감사

**GSTACK_NOT_AVAILABLE 시**: "Crew verify 결과만 제공합니다." 후 `skipped`.

이전 감사 결과 있으면 "이전 대비 변화" 관점으로 분석하도록 지시.
`/cso` 스킬 실행.

## Step 3: 심층 스캔 (--comprehensive만)

일일 모드 또는 GSTACK_NOT_AVAILABLE 시 `skipped`.
`/cso --comprehensive` 실행.

## 마무리

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `security:` — 감사 등급 + 주요 발견 요약
2. `vulnerable:` — 새로 발견된 취약 영역
3. `dependency:` — 취약 의존성 경고 (CVE)

추가: 이전 보안 gotchas 중 해결된 것은 `.crew/gotchas.md`에서 `resolved` 처리 제안.
