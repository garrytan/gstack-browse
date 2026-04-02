# 프로젝트 설정

> Last updated: 2026-04-02

## 프로젝트 개요

| 항목 | 값 |
|------|-----|
| 프로젝트명 | gstack (Garry's Stack) + bams-plugin |
| 버전 | v0.11.17.0 |
| 언어 | TypeScript, JSON, Markdown |
| 런타임 | Bun >= 1.0.0 |
| 패키지 매니저 | Bun |
| 라이선스 | MIT |

## 아키텍처

- **상위 레포**: gstack — Claude Code skills + headless browser (Playwright)
- **플러그인**: bams-plugin — 5부서 20에이전트 멀티에이전트 파이프라인
- **상태 관리**: 파일 시스템 기반 (Markdown, NDJSON)
- **DB/MQ**: 없음

## 주요 커맨드

```bash
bun install          # 의존성 설치
bun test             # 무료 테스트 (<2s)
bun run test:evals   # 유료 eval (~$4/run)
bun run build        # SKILL.md 생성 + 바이너리 컴파일
bun run gen:skill-docs  # SKILL.md 재생성
```

## 컨벤션

- SKILL.md는 `.tmpl` 템플릿에서 생성 — 직접 편집 금지
- 커밋은 단일 논리적 변경 단위로 bisect
- `browse/dist/` 바이너리 절대 커밋하지 않음
- `git add .` 사용 금지 — 파일명 명시
- 에이전트 정의: Markdown + YAML frontmatter

## 배포 상태

- CI/CD: 워크플로우 파일 미존재 (문서-코드 불일치)
- 컨테이너: 해당 없음 (Bun 네이티브 바이너리 배포)
- 환경 변수: .env.example 없음 (암묵적 사용)

## 외부 서비스

- Langfuse (MCP 모니터링)
- Playwright/Chromium (브라우저 자동화)
- SEC EDGAR / GCS (Python 스크립트)
- GitHub CLI (PR/이슈 관리)
- Anthropic API (테스트 전용)
