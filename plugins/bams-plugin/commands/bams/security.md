---
description: 보안 감사 — 시크릿 체크 + OWASP/STRIDE 심층 스캔
argument-hint: [--comprehensive]
---

# Bams: Security

출시 품질 검증 + CSO 스킬을 조합한 보안 감사입니다.

## Pre-flight

**`references/preflight-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

추가 항목:
- `--comprehensive` 플래그 확인 → 심층 모드 / 일일 모드 결정.
- **변경 기반 스킵 판단**: 이전 `security-*.md`(`status: completed`) 존재 시, `git diff --name-only {이전 감사 커밋}..HEAD`로 보안 관련 파일 변경 여부를 확인합니다.
  - 보안 관련 파일 패턴: `*auth*`, `*crypto*`, `*secret*`, `*token*`, `*.env*`, `*password*`, `*permission*`, `*middleware*`, `package.json`, `package-lock.json`, `requirements.txt`, `go.sum`, `Gemfile.lock` 등 의존성 파일
  - **변경 없으면**: "이전 감사 이후 보안 관련 파일 변경 없음. 스킵합니다." 후 종료 (7일 경과 여부 무관)
  - **변경 있으면**: 변경된 파일 목록을 감사 에이전트에 전달하여 **해당 파일 중심으로** 감사 수행
- Gotchas 중 보안 관련 항목의 해결 여부를 감사 시 검증.

스킬 로딩:

```bash
_CSO_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/cso/SKILL.md" 2>/dev/null | head -1)
```

진행 추적 파일: `templates/security-audit.md` 기반으로 생성.

### Viz 이벤트: pipeline_start

진행 추적 파일 및 lock 파일 생성 직후, Bash로 다음을 실행합니다:

```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_start "{slug}" "security" "/bams:security" "{arguments}"
```

## Step 1: 빠른 보안 체크

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 1 "빠른 보안 체크" "Phase 1: 보안 감사"
```

`bams-plugin:release-quality-gate` 에이전트로 보안 체크를 수행합니다.
체크 항목: 하드코딩 API 키, .env 커밋, 내부 URL 노출, 보안 린트.

Step 1 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 1 "done" {duration_ms}
```

## Step 2: OWASP+STRIDE 감사 (bams cso 스킬)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 2 "OWASP+STRIDE 감사" "Phase 1: 보안 감사"
```

**스킬 미설치 시**: "Step 1 결과만 제공합니다." 후 `skipped`.

이전 감사 결과 있으면 "이전 대비 변화" 관점으로 분석하도록 지시.
`_CSO_SKILL` 실행.

Step 2 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 2 "{status}" {duration_ms}
```

## Step 3: 심층 스캔 (--comprehensive만)

Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_start "{slug}" 3 "심층 스캔" "Phase 2: 심층 감사"
```

일일 모드 또는 스킬 미설치 시 `skipped`.
`_CSO_SKILL --comprehensive` 실행.

Step 3 완료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh step_end "{slug}" 3 "{status}" {duration_ms}
```

## 마무리

### Viz 이벤트: pipeline_end

파이프라인 종료 시, Bash로 다음을 실행합니다:
```bash
bash /Users/bamjung/Documents/ezar/claude/my_claude/plugins/bams-plugin/hooks/bams-viz-emit.sh pipeline_end "{slug}" "{status}" {total} {completed} {failed} {skipped}
```
(`{status}`는 `completed` / `paused` / `failed` 중 하나, `{total}`은 3)

**`references/completion-protocol.md` 참조.** 표준 프로토콜을 따릅니다.

이 파이프라인의 Learnings 카테고리:
1. `security:` — 감사 등급 + 주요 발견 요약
2. `vulnerable:` — 새로 발견된 취약 영역
3. `dependency:` — 취약 의존성 경고 (CVE)

추가: 이전 보안 gotchas 중 해결된 것은 `.crew/gotchas.md`에서 `resolved` 처리 제안.
