# 프로젝트 초기 분석 리뷰

> 생성일: 2026-04-02

## 1. 아키텍처 요약

gstack은 **두 개의 독립적인 시스템이 하나의 레포에 공존하는 구조**입니다.

| 계층 | 명칭 | 설명 |
|------|------|------|
| **상위 레포** | gstack (Garry's Stack) | Claude Code skills + headless browser. MIT 라이선스 오픈소스. |
| **플러그인** | bams-plugin | 조직도 기반 멀티에이전트 파이프라인. gstack 위에 올라가는 확장 레이어. |

### 디렉터리 구조

```
my_claude/                          # gstack fork root
├── CLAUDE.md                       # 프로젝트 지침서 (gstack 원본)
├── package.json                    # v0.11.17.0, bun runtime
├── setup                           # 설치 스크립트
├── .claude-plugin/marketplace.json # 플러그인 마켓플레이스 메타
│
└── plugins/bams-plugin/            # ===== 핵심 확장 레이어 =====
    ├── .claude-plugin/plugin.json  # v1.3.0, 5부서 20에이전트
    ├── agents/                     # 20개 에이전트 정의 (Markdown)
    ├── commands/bams/              # 26개 슬래시 커맨드
    ├── skills/                     # gstack 스킬 포크 + 커스텀 스킬
    ├── references/                 # 조직도 SOP, 이벤트 스키마
    ├── hooks/                      # 파이프라인 이벤트 방출
    ├── tools/bams-viz/             # 시각화 서버 (Node.js)
    ├── templates/                  # 추적 문서 템플릿
    ├── styles/default.md           # 출력 스타일 (한국어)
    ├── lib/worktree.ts             # Git worktree 관리자
    └── bin/                        # CLI 유틸리티
```

### 모듈 관계

```
[사용자] --slash command--> [commands/bams/*.md]
                                  |
                                  v
                        [agents/*.md] (20개)
                           |        |
              Task tool    |        |  에이전트 간 협업
                           v        v
                    [skills/]  [tools/bams-viz/]
                       |              |
                       v              v
                  [Playwright]   [NDJSON events]
```

### 아키텍처 패턴

- **Prompt-as-Code**: 에이전트와 커맨드가 Markdown 파일로 정의됨
- **Event Sourcing (경량)**: NDJSON 이벤트를 `.crew/artifacts/pipeline/`에 기록
- **Template-Driven Generation**: `.tmpl` -> `SKILL.md` 생성 파이프라인
- **Client-Server Browser**: CLI가 persistent Playwright 서버에 HTTP로 명령 전달
- **Git Worktree Isolation**: 테스트 실행 시 격리된 worktree 생성

## 2. 외부 서비스 연동

| 서비스 | 연동 방식 |
|--------|-----------|
| Langfuse | MCP Server (모니터링/관측) |
| Playwright/Chromium | npm dependency |
| SEC EDGAR | Python 스크립트 (HTTP) |
| Google Cloud Storage | Python 스크립트 |
| GitHub CLI (gh) | 다수 커맨드/스킬에서 사용 |
| Anthropic API | devDependency (테스트/eval 전용) |

DB나 메시지 큐 연동 없음. 상태 관리는 전부 **파일 시스템 기반**.

## 3. 배포 환경 점검

| 영역 | 상태 | 등급 |
|------|------|------|
| 빌드 자동화 | setup + package.json 완비 | 양호 |
| CI/CD 파이프라인 | 워크플로우 파일 누락 (문서-코드 불일치) | 위험 |
| 컨테이너화 | 해당 없음 (바이너리 배포 구조) | N/A |
| 환경 변수 문서화 | .env.example 없음 | 미흡 |
| 테스트 자동화 | 스크립트 구비, CI 연결 없음 | 부분 |

### 주요 환경 변수

- `ANTHROPIC_API_KEY` — test:evals 실행 필수
- `EVALS_ALL`, `EVALS_TIER`, `EVALS_CONCURRENCY` — 테스트 동작 제어

## 4. 권장사항

| 우선순위 | 항목 |
|----------|------|
| P0 | Python 스크립트에 requirements.txt 추가 |
| P0 | .env.example 파일 생성 |
| P1 | 업스트림 gstack sync 전략 문서화 |
| P1 | bams-viz 서버를 Bun으로 통합 |
| P2 | jojikdo.json 분할 또는 lazy loading |
| P2 | CI 파이프라인 구축 (GitHub Actions) |
| P3 | browse/dist/ git 추적 제거 |
