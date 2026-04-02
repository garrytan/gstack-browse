---
description: 프로젝트 초기화 — .crew/ 워크스페이스 + 배포 환경 셋업
argument-hint: [프로젝트 설명]
---

# Bams Init

Bams 오케스트레이터로서 프로젝트의 `.crew/` 워크스페이스를 초기화하고 배포 환경을 점검합니다.

## Step 0: 코드 최신화

Bash로 `git rev-parse --is-inside-work-tree 2>/dev/null`를 실행하여 git 저장소인지 확인합니다.

**git 저장소인 경우**: Bash로 `git branch --show-current`를 실행하여 현재 브랜치를 확인한 뒤, `git pull origin {현재 브랜치}`를 실행하여 원격 저장소의 최신 코드를 가져옵니다. 충돌이 발생하면 사용자에게 알리고 중단합니다.

**git 저장소가 아닌 경우**: 이 단계를 스킵합니다.

## Step 1: 기존 상태 확인

Glob 도구로 `.crew/` 디렉토리가 이미 존재하는지 확인합니다.

**`.crew/`가 존재하지 않으면** -> Step 2로 진행 (신규 초기화).

**`.crew/`가 이미 존재하면** -> **AskUserQuestion**으로 선택을 요청:

Question: "이미 워크스페이스가 존재합니다. 어떻게 할까요?"
Header: "Init Mode"
Options:
- **유지** - "기존 상태를 그대로 유지하고 종료"
- **부분 재초기화** - "코드베이스 재스캔, config/컨벤션 업데이트 (board, history, artifacts 보존)"
- **전체 재초기화** - "모든 상태를 초기화 (board, history 포함)"

**유지** 선택 시: 여기서 중단.
**부분 재초기화** 선택 시: Step 2~4 실행 후 Step 5(디렉토리 생성) 스킵, Step 6(분석)~Step 8(config) 실행, board/history 보존.
**전체 재초기화** 선택 시: 모든 Step을 처음부터 실행.

## Step 2: 언어 선택

**AskUserQuestion** 도구를 사용하여 프로그래밍 언어를 물어봅니다. **multiSelect** 질문입니다.

Question: "이 프로젝트에서 사용할 프로그래밍 언어를 선택하세요."
Header: "Languages"
Options (multiSelect: true):
- **TypeScript** - "TypeScript / JavaScript (ts, tsx, js, jsx)"
- **Python** - "Python (py, pyi)"
- **Go** - "Go (go)"
- **Rust** - "Rust (rs)"
- **Java** - "Java (java)"
- **Kotlin** - "Kotlin (kt, kts)"
- **Swift** - "Swift (swift)"

## Step 3: 프로젝트 컨텍스트 수집

사용자의 프로젝트 설명: $ARGUMENTS

기존 코드베이스를 분석하여 컨텍스트를 감지합니다:
1. `CLAUDE.md`가 있으면 읽어서 프로젝트 지침 확인
2. Glob으로 `package.json`, `go.mod`, `requirements.txt`, `pyproject.toml`, `Cargo.toml` 등 확인
3. 발견된 설정 파일을 읽어 프로젝트명과 프레임워크 추출
4. 기존 테스트 디렉토리 확인 (`**/*test*/**`, `**/*spec*/**`)

## Step 4: Git 저장소 확인

Bash로 `git rev-parse --git-dir 2>/dev/null` 실행.

**git 저장소가 아닌 경우:**
1. Bash로 `git init` 실행
2. `.gitignore`가 없으면 언어 기반으로 생성

**git 저장소인 경우** -> 다음 Step으로 진행.

## Step 5: 디렉토리 구조 생성

Bash `mkdir -p`로 다음 디렉토리를 생성합니다:

```
.crew/
.crew/sprints/
.crew/artifacts/prd/
.crew/artifacts/design/
.crew/artifacts/review/
.crew/artifacts/test/
.crew/artifacts/pipeline/
```

## Step 6-7: 코드베이스 분석 + 배포 환경 점검 (병렬 실행)

**코드가 존재하는 경우에만 실행.** 소스 파일이 없으면 Step 6 스킵.

**두 에이전트를 동시에 실행합니다:**

**Step 6 — product-strategy 에이전트 (opus):**
서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:product-strategy"**, model: **"opus"**):

> **프로젝트 초기 분석 모드**로 이 프로젝트의 전체 구조를 분석합니다.
>
> 수행 작업:
> 1. Glob으로 전체 디렉토리 구조 매핑 (node_modules, .git, vendor, dist 제외)
> 2. 엔트리포인트 식별 (main, index, app 파일)
> 3. 주요 파일(최대 20개) 읽어서 모듈, 패키지, 상호 관계 매핑
> 4. 외부 서비스 연동 식별 (DB, API, 메시지 큐)
> 5. 코딩 컨벤션, 테스트 패턴, CI/CD 설정 감지
>
> 반환: 아키텍처 요약, 모듈 맵, 컨벤션 목록, 권장사항

**Step 7 — platform-devops 에이전트 (sonnet):**
서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:platform-devops"**, model: **"sonnet"**):

> **배포 환경 점검 모드**로 현재 프로젝트의 인프라/배포 상태를 확인합니다.
>
> 수행 작업:
> 1. Dockerfile, docker-compose.yml 존재 여부 확인
> 2. CI/CD 설정 확인 (.github/workflows/, Jenkinsfile, .gitlab-ci.yml)
> 3. 환경 설정 파일 확인 (.env.example, config/)
> 4. 빌드 스크립트 확인 (Makefile, package.json scripts)
>
> 반환: 배포 준비 상태 요약, 누락 항목, 권장사항

**두 결과를 모두 수집한 후** 다음 단계로 진행합니다.
결과를 `.crew/artifacts/review/init-review.md`에 저장합니다.

## Step 8: config.md 생성

`.crew/config.md` 작성 (Step 6, 7 결과를 기반으로 프로젝트 개요, 아키텍처 요약, 컨벤션, 배포 상태 포함).

## Step 9: board.md 생성

`.crew/board.md` 작성:

```markdown
# 태스크 보드

> Last updated: [현재 ISO timestamp]

## Backlog

## In Progress

## In Review

## Done
```

## Step 10: gotchas.md 생성

`.crew/gotchas.md` 없으면 생성:

```markdown
# Gotchas

> 프로젝트 실행 중 발견한 주의사항을 기록합니다.
```

## Step 11: CLAUDE.md 업데이트

CLAUDE.md가 있으면 Bams 플러그인 섹션을 추가. 없으면 기본 CLAUDE.md를 생성하고 Bams 커맨드 목록을 포함합니다.

## Step 12: 결과 보고

```
프로젝트 초기화 완료
════════════════════
프로젝트: [이름]
언어: [선택한 언어]
Git: [초기화/기존]
배포 환경: [준비됨/미설정]
코드베이스 분석: [완료/스킵]

다음: /bams:plan <feature> | /bams:status | /bams:sprint plan
```
