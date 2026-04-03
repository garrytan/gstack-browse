# 마무리 표준 프로토콜

모든 pipeline 스킬의 마무리 단계에서 공통으로 수행하는 절차입니다.
각 스킬은 이 프로토콜을 참조하고, 스킬별 Learnings 카테고리만 기술합니다.

## Step 1: Pipeline Learnings 기록

`.crew/config.md`의 `## Pipeline Learnings` 섹션을 업데이트합니다 (없으면 추가).

**기록 규칙** (references/pipeline-learnings-taxonomy.md 참조):
- `- [YYYY-MM-DD] category: 내용` 형식
- 이전과 중복되는 내용은 추가하지 않음 (같은 카테고리+대상의 이전 항목은 교체)
- 최대 30개 항목 유지
- 제거 우선순위: 표시 없는 정보성 항목 → `⚠` 항목 → `🔴` 항목 (🔴은 제거 대상에서 제외)

## Step 2: Gotchas 승격 검사

**gotchas-spec.md의 자동 승격 규칙에 따라 검사**합니다. 스킬별 인라인 규칙 기술 금지.

승격 조건 요약:
- 같은 영역/파일에 **3회 이상** Learnings 이슈 → 자동 제안
- hotfix 근본 원인이 **패턴 실수** → 자동 제안
- 보안 감사에서 **Critical** 발견 → 자동 제안 (사용자 확인 필요)
- 사용자가 "기억해" / "gotcha" 언급 → 즉시 추가

**중요: Critical 포함 모든 승격은 AskUserQuestion으로 사용자 확인을 받습니다.**
(SECURITY-1 수정: 무확인 자동 추가 금지)

승인 시:
1. `.crew/gotchas.md`에 항목 추가 (없으면 templates/gotchas.md 기반 생성)
2. `.crew/gotchas.md`에서 상위 5개를 추출

## Step 3: CLAUDE.md Gotchas 동기화

**CLAUDE.md 수정 전 반드시 사용자 확인**:
1. 현재 `## Gotchas` 섹션과 새 상위 5개의 diff를 표시
2. AskUserQuestion — "CLAUDE.md의 Gotchas 섹션을 업데이트할까요?"
3. 승인 시에만 Edit으로 반영

(SECURITY-3 수정: 지속적 컨텍스트 오염 방지)

## Step 4: 진행 추적 파일 완료 처리

- `status: completed`, `completed_at: [ISO timestamp]` 기록
- 모든 Step 상태 최종 확인
- Execution Log 하단에 산출물 경로 정리
- `.crew/artifacts/pipeline/[slug].lock` 파일 제거

## Step 4.5: Viz 이벤트 마무리

lock 파일 제거 직전에 `pipeline_end` 이벤트를 기록합니다:

```bash
bash hooks/bams-viz-emit.sh pipeline_end "{slug}" "{status}" {total_steps} {completed_steps} {failed_steps} {skipped_steps}
```

`{slug}-events.jsonl` 파일은 삭제하지 않습니다 (tracking 파일과 동일 생명주기).

## Step 4.7: 비용 요약 조회

Control Plane 서버가 실행 중이면 파이프라인의 비용 사용량을 조회하여 완료 요약에 포함합니다:

```bash
# Control Plane 서버 실행 중 확인
if curl -s http://localhost:3099/health > /dev/null 2>&1; then
  COST_JSON=$(curl -s "http://localhost:3099/api/costs?pipeline={slug}" 2>/dev/null || echo "{}")
  echo "[비용] $COST_JSON"
fi
```

조회 결과가 있으면 완료 요약 출력 시 다음 항목을 추가합니다:
```
비용: {total_cents}¢  ({total_tokens} tokens)
  에이전트별: {agent} {cents}¢  ...
```

서버가 미실행 중이거나 조회 실패 시 이 단계를 스킵합니다.

## Step 5: 완료 요약 출력

통일된 형식:
```
[파이프라인명] 완료
══════════════════
  [각 Step 상태 — ✓/⊘/✗]

기록: .crew/artifacts/pipeline/[파일명]
이벤트: .crew/artifacts/pipeline/[slug]-events.jsonl

다음: [추천 명령어]
시각화: /bams:viz [slug]
```
