---
description: 배포 — 출시 검증 + Land & Deploy
argument-hint:
---

# Bams: Deploy

배포 워크플로우를 실행합니다. 출시 준비 검증 후 배포를 진행합니다.

## Pre-flight

bams-plugin 스킬 로딩:

```bash
_DEPLOY_SKILL=$(find ~/.claude/plugins/cache -path "*/bams-plugin/*/skills/land-and-deploy/SKILL.md" 2>/dev/null | head -1)
```

스킬 파일이 없으면 에러 메시지 후 중단.

## Step 1-2: 배포 전 검증 + 인프라 점검 (병렬 실행)

**두 에이전트를 동시에 실행합니다:**

**Step 1 — release-quality-gate 에이전트:**
배포 전 체크리스트를 확인합니다.
- PR 머지 완료 여부
- CI 파이프라인 통과 여부
- 모든 검증 단계 통과 여부

**Step 2 — platform-devops 에이전트:**
배포 대상 환경을 점검합니다.
- 배포 대상 환경 상태
- 롤백 계획 확인
- 모니터링 준비 상태

**두 결과를 모두 수집한 후**, 어느 하나라도 FAIL이면 배포를 중단합니다.

## Step 3: 배포 실행

`_DEPLOY_SKILL`의 지시에 따라 Land & Deploy를 실행합니다.

## Step 4: 배포 후 확인

- 배포 상태 모니터링
- 헬스체크 결과 확인
- 이상 징후 시 롤백 옵션 제공
