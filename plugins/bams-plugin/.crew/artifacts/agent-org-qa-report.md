# BAMS Plugin Agent 조직도 QA 리포트

**작성일**: 2026-04-02
**대상**: bams-plugin v1.3.0
**범위**: plugin.json, agents/ (20개), commands/bams/README.md, references/jojikdo.json

---

## 1. 전체 조직도 현황

### 1.1 구조 요약

```
bams-plugin (v1.3.0)
├── 총괄팀 (Executive) — 4 에이전트
│   ├── pipeline-orchestrator    [opus]   — 파이프라인 생명주기 총괄
│   ├── cross-department-coordinator [opus] — 부서간 협업 조율
│   ├── executive-reporter       [sonnet] — 경영진 보고/대시보드
│   └── resource-optimizer       [sonnet] — 모델 선택/병렬화/비용 최적화
│
├── 기획부서 (Planning) — 4 에이전트
│   ├── product-strategy         [opus]   — 제품 비전/로드맵
│   ├── business-analysis        [opus]   — 요구사항/기능 명세
│   ├── ux-research              [sonnet] — 사용자 조사/사용성 리뷰
│   └── project-governance       [opus]   — 일정/리스크/거버넌스
│
├── 개발부서 (Engineering) — 4 에이전트
│   ├── frontend-engineering     [opus]   — UI 컴포넌트/클라이언트 플로우
│   ├── backend-engineering      [opus]   — API/도메인 로직/데이터 정합성
│   ├── platform-devops          [sonnet] — 인프라/CI·CD/관측성
│   └── data-integration         [sonnet] — 이벤트 트래킹/외부 시스템 연동
│
├── 평가부서 (Evaluation) — 4 에이전트
│   ├── product-analytics        [sonnet] — KPI/퍼널/릴리즈 영향 분석
│   ├── experimentation          [sonnet] — A/B 테스트 설계/해석
│   ├── performance-evaluation   [sonnet] — 성능 벤치마크/부하 검증
│   └── business-kpi             [sonnet] — 매출·비용 영향/경영 보고
│
└── QA부서 (Quality Control) — 4 에이전트
    ├── qa-strategy              [sonnet] — 테스트 전략/리스크 평가
    ├── automation-qa            [sonnet] — E2E/API 테스트 자동화
    ├── defect-triage            [sonnet] — 결함 분류/재현/라우팅
    └── release-quality-gate     [sonnet] — 출시 GO/NO-GO 판단
```

### 1.2 모델 배분 요약

| 모델 | 에이전트 수 | 비율 | 대상 |
|------|------------|------|------|
| opus | 7 | 35% | 총괄 오케스트레이터(2), 기획 코어(3), 개발 코어(2) |
| sonnet | 13 | 65% | 총괄 리포팅/최적화(2), 기획 UX(1), 개발 인프라/데이터(2), 평가 전체(4), QA 전체(4) |

### 1.3 코드 수정 권한 (disallowedTools)

| 구분 | Write/Edit 가능 | Write/Edit 불가 |
|------|----------------|-----------------|
| 총괄팀 | - | 4 (전체) |
| 기획부서 | - | 4 (전체) |
| 개발부서 | **frontend, backend, platform-devops, data-integration** (4) | - |
| 평가부서 | - | 4 (전체) |
| QA부서 | **automation-qa** (1) | 3 |
| **합계** | **5** | **15** |

---

## 2. QA 발견 사항

### 2.1 CRITICAL — 에이전트 수 불일치

| 출처 | 표기 | 실제 |
|------|------|------|
| plugin.json:3 | "5부서 20에이전트" | **O** (정확) |
| README.md:2 | "16개 에이전트" | **X** (총괄팀 4개 누락, 20개가 정확) |
| README.md:43 | "## 전체 에이전트 (16개)" | **X** (총괄팀 미포함) |
| README.md:70 | "항상 사용 가능 (16개 에이전트)" | **X** |
| cross-department-coordinator.md:10 | "4부서 16에이전트" | **X** (총괄팀 포함 시 5팀 20에이전트) |
| executive-reporter.md:10 | "4부서 16에이전트" | **X** |

**원인**: README.md와 일부 에이전트 파일이 총괄팀(4)을 에이전트 수에 포함하지 않은 구버전 표기를 유지 중.

**권고**: plugin.json이 "5부서 20에이전트"로 정확하므로, README.md와 에이전트 파일의 수치를 일괄 수정 필요.

---

### 2.2 HIGH — 협업 에이전트 이름 형식 불일치

에이전트 파일 내 `협업 에이전트` 섹션에서 다른 에이전트를 참조할 때 **3가지 서로 다른 네이밍 컨벤션**이 혼용되고 있습니다.

| 형식 | 예시 | 사용 위치 |
|------|------|-----------|
| **snake_case + _agent 접미사** | `project_governance_agent`, `release_quality_gate_agent` | pipeline-orchestrator, cross-department-coordinator, executive-reporter, resource-optimizer |
| **snake_case (접미사 없음)** | `backend_engineering`, `ux_research`, `qa_strategy` | frontend-engineering, backend-engineering, platform-devops, data-integration, automation-qa |
| **kebab-case (실제 name)** | `release-quality-gate`, `pipeline-orchestrator` | (실제 frontmatter name 필드) |

**실제 agent name 필드 (frontmatter)**: 모두 `kebab-case`

**영향**: jojikdo.json은 `snake_case + _agent`를 사용하므로, jojikdo.json과 agent 파일 사이에 이름 매핑 불일치가 존재. Agent 간 호출 시 이름 참조가 모호해질 수 있음.

**권고**: 하나의 컨벤션으로 통일 필요. frontmatter name과 동일하게 `kebab-case`를 표준으로 하거나, jojikdo.json의 `snake_case_agent` 형식으로 통일.

---

### 2.3 MEDIUM — 협업 섹션 구조 불일치

각 부서별로 협업 관련 섹션의 이름과 위치가 다릅니다:

| 부서 | 섹션 이름 | 위치 |
|------|-----------|------|
| 총괄팀 | `## 협업 에이전트` | 최하단 독립 섹션 |
| 기획부서 | **없음** | 협업 에이전트 참조가 본문에 산재 |
| 개발부서 | `### 협업 원칙` | `## 행동 규칙` 하위 |
| 평가부서 | `### 협업 규칙` | `## 행동 규칙` 하위 |
| QA부서 | `### 다른 Agent 협업 시` | `## 행동 규칙` 하위 |

**권고**: 모든 에이전트에 `## 협업 에이전트` (또는 통일된 이름의) 독립 섹션을 두어 참조 일관성 확보.

---

### 2.4 MEDIUM — README.md에 총괄팀 섹션 누락

README.md의 "## 전체 에이전트 (16개)" 아래에 기획/개발/평가/QA 4부서만 나열되어 있고, **총괄팀 4에이전트가 누락**되어 있습니다.

- pipeline-orchestrator
- cross-department-coordinator
- executive-reporter
- resource-optimizer

**권고**: README.md에 `### 총괄팀` 섹션을 추가하고, 총 에이전트 수를 20개로 수정.

---

### 2.5 LOW — 에이전트 frontmatter description 형식 불일치

| 형식 | 에이전트 수 | 예시 |
|------|------------|------|
| 따옴표 없음 | 16 | `description: 파이프라인 오케스트레이터 에이전트 — ...` |
| 쌍따옴표 있음 | 4 | `description: "프론트엔드 엔지니어링 에이전트 - ..."` |

**따옴표 있는 에이전트**: frontend-engineering, backend-engineering, platform-devops, data-integration

또한 이 4개 에이전트는 구분자로 `-`(하이픈)을 사용하고, 나머지 16개는 `—`(em dash)을 사용합니다.

**권고**: YAML 파싱에는 영향 없으나, 일관성을 위해 통일 권장.

---

### 2.6 LOW — 기획부서 에이전트에 도구 사용 섹션 내 Agent 도구 누락

| 에이전트 | 도구 사용 섹션에 Agent 도구 기재 |
|----------|-------------------------------|
| product-strategy | X (Agent 미기재) |
| business-analysis | X (Agent 미기재) |
| ux-research | X (Agent 미기재) |
| project-governance | X (Agent 미기재) |

반면, 개발/QA 부서 에이전트들은 `Agent: [호출 대상 목록]`을 명시합니다.

기획부서 에이전트들이 `disallowedTools: Write, Edit`만 설정하고 Agent 도구는 사용 가능한 상태인데, 도구 사용 섹션에 기재가 없어 협업 호출 패턴이 불명확합니다.

---

### 2.7 INFO — 부서별 스킬 허브 커맨드와 에이전트 매핑 검증

README.md의 부서별 스킬 허브 매핑과 실제 에이전트 파일이 일치하는지 검증:

| 커맨드 | 부서 | README 에이전트 | 에이전트 파일 존재 | 결과 |
|--------|------|----------------|-------------------|------|
| `/bams:planning` | 기획 | product-strategy, business-analysis, ux-research, project-governance | O, O, O, O | **PASS** |
| `/bams:engineering` | 개발 | frontend-engineering, backend-engineering, platform-devops, data-integration | O, O, O, O | **PASS** |
| `/bams:evaluation` | 평가 | product-analytics, experimentation, performance-evaluation, business-kpi | O, O, O, O | **PASS** |
| `/bams:qc` | QA | qa-strategy, automation-qa, defect-triage, release-quality-gate | O, O, O, O | **PASS** |

---

### 2.8 INFO — plugin.json agents 배열 vs 실제 파일 매핑 검증

plugin.json에 등록된 20개 에이전트 경로와 실제 파일 존재 여부:

| # | plugin.json 경로 | 파일 존재 | 결과 |
|---|-----------------|----------|------|
| 1 | ./agents/pipeline-orchestrator.md | O | PASS |
| 2 | ./agents/cross-department-coordinator.md | O | PASS |
| 3 | ./agents/executive-reporter.md | O | PASS |
| 4 | ./agents/resource-optimizer.md | O | PASS |
| 5 | ./agents/automation-qa.md | O | PASS |
| 6 | ./agents/backend-engineering.md | O | PASS |
| 7 | ./agents/business-analysis.md | O | PASS |
| 8 | ./agents/business-kpi.md | O | PASS |
| 9 | ./agents/data-integration.md | O | PASS |
| 10 | ./agents/defect-triage.md | O | PASS |
| 11 | ./agents/experimentation.md | O | PASS |
| 12 | ./agents/frontend-engineering.md | O | PASS |
| 13 | ./agents/performance-evaluation.md | O | PASS |
| 14 | ./agents/platform-devops.md | O | PASS |
| 15 | ./agents/product-analytics.md | O | PASS |
| 16 | ./agents/product-strategy.md | O | PASS |
| 17 | ./agents/project-governance.md | O | PASS |
| 18 | ./agents/qa-strategy.md | O | PASS |
| 19 | ./agents/release-quality-gate.md | O | PASS |
| 20 | ./agents/ux-research.md | O | PASS |

**모든 에이전트 파일 존재 확인: 20/20 PASS**

---

## 3. 에이전트 간 협업 관계 매트릭스

### 3.1 에이전트별 호출 관계 (→ = 호출/참조)

```
pipeline-orchestrator → cross-department-coordinator, resource-optimizer,
                        executive-reporter, project-governance,
                        release-quality-gate

cross-department-coordinator → pipeline-orchestrator, resource-optimizer,
                               project-governance, product-strategy,
                               (모든 16개 에이전트)

executive-reporter → pipeline-orchestrator, project-governance,
                     product-analytics, business-kpi,
                     performance-evaluation

resource-optimizer → pipeline-orchestrator, cross-department-coordinator,
                     executive-reporter, performance-evaluation

frontend-engineering → backend-engineering, ux-research, qa-strategy,
                       performance-evaluation, business-analysis

backend-engineering → frontend-engineering, business-analysis, qa-strategy,
                      product-analytics, performance-evaluation

platform-devops → backend-engineering, frontend-engineering,
                  release-quality-gate, automation-qa,
                  performance-evaluation, defect-triage

data-integration → product-analytics, experimentation, qa-strategy,
                   platform-devops

product-analytics → product-strategy, business-kpi, ux-research,
                    business-analysis, release-quality-gate

experimentation → product-strategy, frontend-engineering,
                  backend-engineering, data-integration,
                  automation-qa, product-analytics,
                  release-quality-gate

performance-evaluation → platform-devops, backend-engineering,
                         frontend-engineering, product-analytics

business-kpi → product-strategy, platform-devops,
               product-analytics, release-quality-gate

qa-strategy → business-analysis, project-governance,
              frontend-engineering, backend-engineering,
              platform-devops, defect-triage

automation-qa → qa-strategy, platform-devops,
                frontend-engineering, backend-engineering,
                data-integration

defect-triage → frontend-engineering, backend-engineering,
                platform-devops, data-integration,
                release-quality-gate, automation-qa

release-quality-gate → qa-strategy, automation-qa, defect-triage,
                       performance-evaluation, platform-devops,
                       backend-engineering, product-analytics
```

### 3.2 가장 많이 참조되는 에이전트 (피참조 횟수)

| 에이전트 | 피참조 횟수 | 역할 |
|----------|-----------|------|
| performance-evaluation | 7 | 성능 판단의 허브 |
| backend-engineering | 7 | 서버 로직의 중심 |
| product-analytics | 6 | 데이터 분석의 허브 |
| frontend-engineering | 6 | UI 구현의 중심 |
| platform-devops | 6 | 인프라/배포의 허브 |
| release-quality-gate | 6 | 출시 최종 관문 |
| qa-strategy | 5 | 테스트 전략의 허브 |
| pipeline-orchestrator | 3 | 파이프라인 총괄 |

---

## 4. 발견 사항 요약 및 우선순위

| # | 심각도 | 항목 | 상세 |
|---|--------|------|------|
| 1 | **CRITICAL** | 에이전트 수 불일치 | README, 에이전트 파일에서 "16개"로 표기 (실제 20개) |
| 2 | **HIGH** | 협업 에이전트 이름 형식 | snake_case_agent / snake_case / kebab-case 혼용 |
| 3 | **MEDIUM** | 협업 섹션 구조 불일치 | 부서별로 섹션 이름·위치가 모두 다름 |
| 4 | **MEDIUM** | README 총괄팀 섹션 누락 | 총괄팀 4에이전트가 README 에이전트 목록에 없음 |
| 5 | **LOW** | frontmatter description 형식 | 따옴표/구분자 불일치 (개발부서 4개) |
| 6 | **LOW** | 기획부서 Agent 도구 미기재 | 협업 호출 패턴이 도구 섹션에 반영 안 됨 |

### PASS 항목

| # | 검증 항목 | 결과 |
|---|----------|------|
| 1 | plugin.json agents 배열 ↔ 실제 파일 존재 | **20/20 PASS** |
| 2 | 부서별 스킬 허브 ↔ 에이전트 매핑 | **4/4 PASS** |
| 3 | 각 에이전트 frontmatter name 고유성 | **20/20 PASS** (중복 없음) |
| 4 | 에이전트별 역할/전문영역/행동규칙/출력형식/도구사용 섹션 존재 | **20/20 PASS** |
| 5 | disallowedTools 설정 의도 (구현 에이전트만 Write/Edit 허용) | **적절** |
| 6 | 모델 배분 (의사결정=opus, 분석/리포팅=sonnet) | **합리적** |

---

## 5. 개선 권고

### 5.1 즉시 수정 (CRITICAL/HIGH)

1. **README.md 에이전트 수 수정**: "16개" → "20개", 총괄팀 섹션 추가
2. **에이전트 내 이름 참조 통일**: 모든 협업 에이전트 참조를 frontmatter name과 동일한 `kebab-case`로 통일하거나, jojikdo.json과 일치하는 `snake_case_agent`로 통일

### 5.2 개선 권장 (MEDIUM)

3. **협업 섹션 구조 표준화**: 모든 에이전트에 동일한 이름(`## 협업 에이전트`)의 독립 섹션 추가
4. **cross-department-coordinator, executive-reporter 본문의 에이전트 수 수정**

### 5.3 선택적 개선 (LOW)

5. **frontmatter description 형식 통일**: 따옴표·구분자 통일
6. **기획부서 에이전트 도구 섹션에 Agent 도구 기재 추가**
