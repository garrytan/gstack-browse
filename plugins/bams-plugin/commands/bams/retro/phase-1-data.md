# Retro: Phase 1 — 데이터 수집

> 이 파일은 `/bams:retro`의 Phase 1을 실행합니다.
> 공통 규칙은 `_common.md`를 참조합니다 (엔트리포인트에서 이미 로드됨).

## 입력 컨텍스트

- slug: {엔트리포인트에서 결정된 slug}
- TARGET_SCOPE: {all | recent5 | since_{N}d | slug:{값}}
- 파이프라인 이벤트: `~/.bams/artifacts/pipeline/*.jsonl`
- 에이전트 로그: `~/.bams/artifacts/agents/*.jsonl`
- 산출물 기본 경로: `.crew/artifacts/retro/{slug}/`

---

## Step 1: 파이프라인 지표 수집

Bash로 step_start를 emit합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_start "{slug}" 1 "파이프라인 지표 수집" "Phase 1: 데이터 수집"
```

**산출물 확인**: `.crew/artifacts/retro/{slug}/phase1-pipeline-metrics.md` 존재 시 건너뜁니다.

pipeline-orchestrator에게 executive-reporter 위임을 지시합니다.

Bash로 agent_start를 emit합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" agent_start "{slug}" "executive-reporter-1-$(date -u +%Y%m%d)" "executive-reporter" "sonnet" "Step 1: 파이프라인 지표 수집 위임"
```

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 데이터 수집 — 파이프라인 지표 집계**
>
> **위임 메시지:**
> ```
> phase: 1
> slug: {slug}
> pipeline_type: retro
> context:
>   scope: {TARGET_SCOPE}
>   events_dir: ~/.bams/artifacts/pipeline/
> ```
>
> **수행할 작업:**
> executive-reporter에게 다음을 위임합니다:
>
> ```
> task_description: "TARGET_SCOPE에 해당하는 JSONL 파일을 파싱하여 파이프라인 수준 지표 집계"
> input_artifacts:
>   - ~/.bams/artifacts/pipeline/*.jsonl (TARGET_SCOPE 필터 적용)
> expected_output:
>   path: .crew/artifacts/retro/{slug}/phase1-pipeline-metrics.md
> quality_criteria:
>   - pipeline_start/pipeline_end 타임스탬프 기반 총 소요 시간 계산
>   - Phase별 소요 시간 (첫 step_start ~ 마지막 step_end)
>   - Step 성공률 (done 상태 / 전체 Step 수)
>   - 재시도 횟수 (동일 Step의 step_start 이벤트 중복 카운트)
>   - 파이프라인별: slug, type, status, 소요시간, step 수/성공/실패
>   - 트렌드: 동일 타입 최근 3회 대비 비교 (20% 이상 변화 시 주석)
  - ★ retro_* 또는 retro-* slug의 JSONL 파일은 분석에서 제외 (자기 참조 방지)
  - retro 파이프라인은 분석 도구이므로 분석 대상이 아님
> ```
>
> **기대 산출물**: `.crew/artifacts/retro/{slug}/phase1-pipeline-metrics.md`

Bash로 agent_end를 emit합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" agent_end "{slug}" "executive-reporter-1-$(date -u +%Y%m%d)" "executive-reporter" "success" {duration_ms} "Step 1 완료: 파이프라인 지표 수집"
```

---

## Step 2: 에이전트 성과 지표 산출

**산출물 확인**: `.crew/artifacts/retro/{slug}/phase1-agent-metrics.md` 존재 시 건너뜁니다.

pipeline-orchestrator에게 product-analytics 위임을 지시합니다.

Bash로 agent_start를 emit합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" agent_start "{slug}" "product-analytics-1-$(date -u +%Y%m%d)" "product-analytics" "sonnet" "Step 2: 에이전트 성과 지표 산출 위임"
```

서브에이전트 실행 (Task tool, subagent_type: **"bams-plugin:pipeline-orchestrator"**, model: **"sonnet"**):

> **Phase 1 데이터 수집 — 에이전트 수준 지표 산출**
>
> **위임 메시지:**
> ```
> phase: 1
> slug: {slug}
> pipeline_type: retro
> context:
>   pipeline_metrics: .crew/artifacts/retro/{slug}/phase1-pipeline-metrics.md
>   agents_dir: ~/.bams/artifacts/agents/
> ```
>
> **수행할 작업:**
> product-analytics에게 다음을 위임합니다:
>
> ```
> task_description: "agent_start/agent_end 이벤트 기반 에이전트 수준 KPI 산출 및 등급 부여"
> input_artifacts:
>   - .crew/artifacts/retro/{slug}/phase1-pipeline-metrics.md
>   - ~/.bams/artifacts/agents/*.jsonl (가용 시)
> expected_output:
>   path: .crew/artifacts/retro/{slug}/phase1-agent-metrics.md
> quality_criteria:
>   - 에이전트별 호출 횟수, 평균/최대/최소 소요 시간(ms)
>   - 에이전트별 성공률(%), 에러율(%), 재시도율(%)
>   - 등급 산출 — 가중치: 성공률 40% + 속도(평균 대비) 30% + 재시도율 30%
>     A(종합 90점+), B(75-89점), C(60-74점), D(60점 미만)
>   - 부서별 집계 테이블
>   - 소속 부서장 매핑 포함
  - ★ retro_* 또는 retro-* slug의 JSONL 파일은 분석에서 제외 (자기 참조 방지)
  - retro 파이프라인은 분석 도구이므로 분석 대상이 아님
> ```
>
> **기대 산출물**: `.crew/artifacts/retro/{slug}/phase1-agent-metrics.md`

Bash로 agent_end를 emit합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" agent_end "{slug}" "product-analytics-1-$(date -u +%Y%m%d)" "product-analytics" "success" {duration_ms} "Step 2 완료: 에이전트 지표 산출"
```

Step 1-2 완료 시, Bash로 step_end를 emit합니다:
```bash
_EMIT=$(find ~/.claude/plugins/cache -name "bams-viz-emit.sh" -path "*/bams-plugin/*" 2>/dev/null | head -1); [ -n "$_EMIT" ] && bash "$_EMIT" step_end "{slug}" 1 "done" {duration_ms}
```

---

## Phase 1 게이트

pipeline-orchestrator가 다음 조건을 확인합니다:

- [ ] `.crew/artifacts/retro/{slug}/phase1-pipeline-metrics.md` 생성 완료
- [ ] `.crew/artifacts/retro/{slug}/phase1-agent-metrics.md` 생성 완료
- [ ] 에이전트별 등급 (A~D) 산출 포함
- [ ] 부서장 매핑 테이블 포함

**결과 처리**:
- **GO**: 두 산출물 모두 존재 → Phase 2 진행
- **CONDITIONAL-GO**: 에이전트 로그 없이 파이프라인 지표만 존재 → "에이전트 로그 없음" 기록 후 진행
- **NO-GO**: phase1-pipeline-metrics.md 미생성 → executive-reporter 재위임
