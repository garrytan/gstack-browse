# Retro Best Practices

> 작성일: 2026-04-04
> 기반: /bams:retro 3회 실행 경험 (retro-all-20260404-1, -2, -3)
> 적용 범위: `/bams:retro` 파이프라인 전 Phase

---

## Good Practices — 검증된 패턴

### Phase 1: 데이터 수집

**agent-metrics.md 11컬럼 형식 필수**

Phase 1 Step 2에서 생성하는 `phase1-agent-metrics.md` 테이블은 반드시 11컬럼을 포함해야 한다:

```
| 에이전트 | 부서 | 호출 | 성공률 | 에러율 | 재시도율 | 평균ms | 최대 | 최소 | 종합점수 | 등급 |
```

이 형식이 `retro-to-hr.ts` 파서의 기본 파싱 대상이다. 컬럼 수가 맞지 않으면 파서가 fallback 로직으로 동작하며 부정확한 결과가 생성된다.

**자기 참조 방지 필터 적용**

`~/.bams/artifacts/pipeline/*.jsonl` 전체를 파싱할 때 파일명이 `retro`로 시작하는 항목은 반드시 건너뛴다:

```bash
ls ~/.bams/artifacts/pipeline/*.jsonl | grep -v '^.*\/retro[_-]' 
```

retro 파이프라인 자체 이벤트를 포함하면 pipeline-orchestrator의 등급이 누적 하락한다 (실측: 66.9 → 62.2 → 59.4).

### Phase 4: 개선 실행

**hr-agent 호출 시 viz 이벤트 emit 필수**

hr-agent를 호출하기 전후에 반드시 `agent_start` / `agent_end`를 emit한다.
이렇게 해야 viz HR 탭에서 에이전트 개선 이력이 추적 가능하다.

```bash
# hr-agent 호출 전
bash "$_EMIT" agent_start "{slug}" "hr-agent-4-{timestamp}" "hr-agent" "sonnet" "에이전트 정의 파일 개선"

# hr-agent 호출 후
bash "$_EMIT" agent_end "{slug}" "hr-agent-4-{timestamp}" "hr-agent" "success" {duration_ms} "개선 완료"
```

### Phase 5: 보고

**HR 자동 변환 → 이벤트 파일 정리 순서 준수**

Phase 5에서는 반드시 다음 순서를 지킨다:

1. `retro-to-hr.ts` 실행 → HR JSON 생성
2. HR JSON → bams.db `hr_reports` 테이블 upsert
3. DB 변환 완료 확인
4. 분석 대상 이벤트 JSONL 삭제 (`~/.bams/artifacts/pipeline/{analyzed-slug}-events.jsonl`)
5. retro 자체 이벤트 JSONL 삭제 (`~/.bams/artifacts/pipeline/{retro-slug}-events.jsonl`)

DB 변환 전에 소스 파일을 삭제하면 재실행이 불가능해진다.

### Slug 네이밍

**한글 slug 형식 사용**

retro 파이프라인의 slug는 `retro_{SCOPE_KR}_{N}` 형식을 따른다:

| TARGET_SCOPE | SCOPE_KR | slug 예시 |
|--------------|----------|-----------|
| all | 전체회고 | retro_전체회고_1 |
| recent5 | 최근5회고 | retro_최근5회고_1 |
| since_7d | 최근7일회고 | retro_최근7일회고_1 |
| slug:feature_xxx | feature_xxx회고 | retro_feature_xxx회고_1 |

같은 날 여러 번 실행하면 순번(`_1`, `_2`, ...)이 자동 증가한다.

---

## Bad Practices — 반복 발생 문제

### Phase 1 테이블 등급 컬럼 누락

**문제**: retro-all-20260404-2 실행 시 `phase1-agent-metrics.md` 테이블에서 `등급` 컬럼이 누락됨.

**결과**: `retro-to-hr.ts` 파서가 fallback 모드로 동작. 에이전트 등급이 모두 `unknown`으로 기록됨.

**예방**: executive-reporter 위임 시 quality_criteria에 "11컬럼 포함 필수" 명시 (이 문서 Good Practices 참조).

### retro 이벤트를 분석 대상에 포함

**문제**: `retro-*` 또는 `retro_*` JSONL 파일이 분석 대상에 포함됨.

**결과**: pipeline-orchestrator의 에이전트 호출이 집계되어 등급이 연속 하락:
- retro-all-20260404-1: orchestrator 종합점수 66.9 (등급 C)
- retro-all-20260404-2: orchestrator 종합점수 62.2 (등급 C)
- retro-all-20260404-3: orchestrator 종합점수 59.4 (등급 D)

**원인**: retro 파이프라인은 에이전트 수가 많고 일부 실패/재시도가 발생하므로, 이를 포함하면 orchestrator 지표가 왜곡됨.

**예방**: `_common.md`의 자기 참조 방지 규칙 및 `phase-1-data.md` quality_criteria 필터 준수.

### Phase 5 보고서 형식 불일치

**문제**: retro-1과 retro-2의 최종 보고서에서 파이프라인 수 표기 형식이 달랐음.
- retro-1: `분석 파이프라인: 12개`
- retro-2: `총 파이프라인 수: 12`

**결과**: executive-reporter가 이전 보고서와 비교 시 파싱 실패. 트렌드 분석 불가.

**예방**: Phase 5 보고서 섹션에 표준 형식 명시. `분석 대상: {N}개 파이프라인` 형식 통일.

### 부서 컬럼 누락

**문제**: `phase1-agent-metrics.md`에서 `부서` 컬럼 미포함.

**결과**: `retro-to-hr.ts` 파서가 `department: "unknown"`으로 기록. HR 탭에서 부서별 필터링 불가.

**예방**: 위임 메시지에 "소속 부서장 매핑 포함" quality_criteria 항목 유지.

---

## Phase 1 산출물 표준 형식

### phase1-agent-metrics.md 필수 구조

```markdown
# Phase 1 에이전트 성과 지표

> retro slug: {slug}
> 분석 기간: {TARGET_SCOPE}
> 분석 대상: {N}개 파이프라인 (retro 제외)
> 생성 시각: {YYYY-MM-DD HH:MM}

## 에이전트별 성과 테이블

| 에이전트 | 부서 | 호출 | 성공률 | 에러율 | 재시도율 | 평균ms | 최대 | 최소 | 종합점수 | 등급 |
|---------|------|------|--------|--------|----------|--------|------|------|----------|------|
| pipeline-orchestrator | 총괄 | 24 | 87.5% | 8.3% | 4.2% | 45,200 | 182,000 | 3,100 | 72.1 | C |
| executive-reporter | 경영지원 | 18 | 94.4% | 5.6% | 0% | 28,400 | 95,000 | 4,200 | 88.3 | B |
| ...

## 부서별 집계

| 부서 | 에이전트 수 | 평균 성공률 | 평균 종합점수 | 부서 등급 |
|------|------------|------------|-------------|----------|
| 총괄 | 1 | 87.5% | 72.1 | C |
| 경영지원 | 2 | 94.4% | 88.3 | B |
| ...
```

### 등급 기준

| 등급 | 종합점수 | 의미 |
|------|---------|------|
| A | 90점 이상 | 우수 |
| B | 75~89점 | 양호 |
| C | 60~74점 | 보통 |
| D | 60점 미만 | 개선 필요 |

종합점수 = 성공률 × 0.4 + 속도점수 × 0.3 + (100 - 재시도율) × 0.3
