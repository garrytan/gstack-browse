# 기술 설계: bams-viz Next.js 재구축

> 작성일: 2026-04-02

## 프론트엔드 설계

### 디렉토리 구조
```
plugins/bams-plugin/tools/bams-viz/
├── package.json          # next, react, swr, mermaid, zustand
├── next.config.ts        # 포트 3333
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx    # AppShell + ThemeProvider
│   │   ├── page.tsx      # / → /dag 리다이렉트
│   │   ├── globals.css   # CSS 변수 (light/dark)
│   │   ├── dag/page.tsx
│   │   ├── gantt/page.tsx
│   │   ├── org/page.tsx
│   │   ├── agents/page.tsx
│   │   ├── timeline/page.tsx
│   │   ├── logs/page.tsx
│   │   ├── traces/page.tsx       # 신규
│   │   ├── metaverse/page.tsx    # 신규
│   │   └── api/                  # Route Handlers
│   ├── components/
│   │   ├── shell/ (AppShell, TabNav, ThemeToggle, StatusBar)
│   │   ├── dag/ (DagView, DagMermaid)
│   │   ├── gantt/ (GanttView, GanttMermaid)
│   │   ├── org/ (OrgView, OrgMermaid)
│   │   ├── agents/ (AgentsView, AgentCard)
│   │   ├── timeline/ (TimelineView, TimelineEvent)
│   │   ├── logs/ (LogsView, LogEntry, LogFilter)
│   │   ├── traces/ (TracesView, TraceList, TraceDetail, SpanTree)
│   │   ├── metaverse/ (MetaverseView, AgentMap, AgentNode)
│   │   └── ui/ (Badge, Spinner, EmptyState)
│   ├── hooks/ (usePolling, useVizData, useTheme, useMermaid)
│   ├── lib/ (api.ts, types.ts, utils.ts)
│   └── store/ (vizStore.ts)
```

### 기술 스택
- SWR (1초 폴링 + 캐시)
- Tailwind CSS + CSS Variables (기존 테마 유지)
- Mermaid (클라이언트 dynamic import)
- SVG (메타버스 2D 맵)

## 백엔드 설계

### API Routes
```
GET /api/pipelines              - 파이프라인 목록
GET /api/events/[slug]          - 파이프라인 이벤트
GET /api/events/poll?since=     - 1초 폴링 (신규)
GET /api/mermaid/[slug]         - Mermaid 데이터
GET /api/org                    - 조직도
GET /api/agents?date=           - 에이전트 데이터
GET /api/agents/dates           - 날짜 목록
GET /api/traces                 - Trace 목록 (신규)
GET /api/traces/[traceId]       - Trace 상세 (신규)
GET /api/stats/agents           - 에이전트 통계 (신규)
```

### EventStore (싱글턴)
- JSONL 파일 초기 파싱 → 인메모리 캐시
- chokidar 파일 워치 → 증분 업데이트
- instrumentation.ts에서 초기화

### 이벤트 스키마 확장 (하위 호환)
- agent_start 추가: trace_id, input, department, skill_name
- agent_end 추가: output_summary, token_usage, status

## 태스크 목록

| ID | 태스크 | 담당 | 의존성 | 배치 |
|----|--------|------|--------|------|
| T-1 | Next.js 프로젝트 초기화 + 기반 구조 | FE+BE | 없음 | 1 |
| T-2 | lib/ TS 전환 + EventStore 구현 | BE | T-1 | 1 |
| T-3 | API Route Handler 마이그레이션 | BE | T-2 | 2 |
| T-4 | AppShell + TabNav + 기존 탭 마이그레이션 | FE | T-1 | 2 |
| T-5 | Timeline/Logs 탭 재구현 (FR-4) | FE | T-4 | 3 |
| T-6 | Traces 탭 + Trace API (FR-2) | FE+BE | T-3, T-4 | 3 |
| T-7 | Metaverse 탭 (FR-3) | FE | T-4 | 3 |
| T-8 | hooks 스키마 확장 | BE | T-3 | 3 |
