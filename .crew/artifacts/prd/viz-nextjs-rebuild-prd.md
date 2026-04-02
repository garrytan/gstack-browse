# PRD: bams-viz Next.js 대시보드 재구축

> 작성일: 2026-04-02 | 프로젝트: gstack bams-plugin v1.3.0

## 목표

bams-viz를 "에이전트 오케스트레이션의 관제탑"으로 진화시켜, 운영자가 전체 에이전트 조직의 실행 상태, 성능 병목, 작업 흐름을 실시간으로 파악하고 의사결정할 수 있게 한다.

## 핵심 기능 (4가지)

### FR-1: Next.js App Router 전환 (Must)
- Node.js 단일 서버 + 단일 HTML → Next.js App Router
- SSE → 1초 폴링으로 전환
- 기존 API 엔드포인트 마이그레이션
- lib/ 모듈 TypeScript 전환

### FR-2: Langfuse 스타일 트레이싱 (Should)
- Trace(파이프라인) → Span(에이전트 호출) 계층
- input/output/label/duration/model/token_usage 추적
- 부서/스킬 컨텍스트 자동 매핑
- 워터폴 차트 + 성능 통계 UI

### FR-3: 메타버스 대시보드 (Could)
- 2D SVG 공간에 에이전트 부서별 배치
- 상태 표시: idle/working/error
- 클릭 시 모달로 상세 확인
- 실시간 애니메이션

### FR-4: Timeline/Logs 명확화 (Must)
- Timeline = 고수준 이벤트 카드 (필터, 날짜 범위)
- Logs = 저수준 NDJSON raw 뷰어 (검색, JSON 트리)
- 상호 점프 기능

## 기술 제약
- Bun >= 1.0.0
- JSONL 파일 기반 (DB 없음)
- 포트 3333 유지
- 하위 호환 (기존 이벤트 스키마)
- 단일 사용자 로컬 도구

## 우선순위: FR-1 → FR-4 → FR-2 → FR-3
