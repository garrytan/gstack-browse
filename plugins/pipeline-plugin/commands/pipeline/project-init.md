---
description: 신규 프로젝트 초기화 — Crew + gstack 통합 셋업
argument-hint: [프로젝트 설명]
---

# Pipeline: Project Init

Crew 멀티에이전트 환경과 gstack 도구를 한번에 초기화합니다.

## Pre-flight

### 1. Git 저장소 확인

`git rev-parse --is-inside-work-tree` 확인.
git 저장소이면 `git branch --show-current` → `git pull origin {브랜치}`.
pull 실패 시: merge conflict / 인증 실패 / 네트워크 오류를 구분하여 안내.

### 2. gstack 스킬 가용성 확인

**`references/preflight-protocol.md`의 "gstack 스킬 가용성 확인" 섹션 참조.** Glob으로 확인합니다.

### 3. 기존 .crew 컨텍스트 확인

`.crew/` 존재 시:
- config.md, board.md 읽기
- `.crew/artifacts/pipeline/project-init-*.md` 확인 → 이전 초기화 재개 여부

진행 추적 파일: `templates/project-init-tracking.md` 기반으로 생성.

## Step 1: Crew 워크스페이스 초기화

config.md 이미 존재 시:
- AskUserQuestion — "건너뛸까요?"
  - **건너뛰기 (Recommended)**
  - **재초기화**

없거나 재초기화 선택: `/crew:init` 실행.

## Step 2: 디자인 시스템 설정 (gstack)

**GSTACK_NOT_AVAILABLE 시**: `skipped (GSTACK_NOT_AVAILABLE)`.
`DESIGN.md` 이미 존재 시: `skipped (이미 존재)`.

없으면 AskUserQuestion — "디자인 시스템을 설정하시겠습니까?"
- **설정하기 (Recommended)** — `/design-consultation` 실행
- **건너뛰기**

## Step 3: 배포 환경 설정 (gstack)

**GSTACK_NOT_AVAILABLE 시**: `skipped (GSTACK_NOT_AVAILABLE)`.
CLAUDE.md에 배포 설정 존재 시: `skipped (이미 존재)`.

없으면 AskUserQuestion — "배포 환경을 설정하시겠습니까?"
- **나중에 (Recommended)**
- **설정하기** — `/setup-deploy` 실행

## 마무리

### 초기 파일 생성

`.crew/gotchas.md` 없으면 `templates/gotchas.md` 기반으로 생성.

`CLAUDE.md`에 `## Gotchas` 섹션 없으면 추가:
```markdown
## Gotchas
<!-- 자동 관리: pipeline이 .crew/gotchas.md에서 상위 5개를 동기화합니다 -->
(아직 없음 — pipeline 실행 시 자동으로 채워집니다)
```

`.crew/config.md`에 `## Pipeline Learnings` 섹션 없으면 추가:
```markdown
## Pipeline Learnings
> 이 섹션은 pipeline 실행 시 자동으로 업데이트됩니다.
> 최대 30개 항목 유지. 형식: `- [날짜] category: 내용`

- [날짜] init: 프로젝트 초기화 완료 (gstack: ✓/✗, design: ✓/✗, deploy: ✓/✗)
```

진행 추적 파일 `status: completed` 기록. lock 파일 제거.

```
프로젝트 초기화 완료
════════════════════
  Step 1: Crew 워크스페이스   ✓/⊘
  Step 2: 디자인 시스템       ✓/⊘/⚠
  Step 3: 배포 설정           ✓/⊘/⚠

기록: .crew/artifacts/pipeline/project-init-[timestamp].md

다음: /pipeline:feature <기능> | /crew:sprint plan | /crew:status
```
