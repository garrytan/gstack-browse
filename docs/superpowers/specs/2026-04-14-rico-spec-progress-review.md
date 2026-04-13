# Rico 스펙 진도 점검

- 날짜: 2026-04-14
- 상태: 하드닝 구현 반영 후 재점검
- 기준 문서: `2026-04-12-rico-multi-agent-slack-design.md`

## 요약

`rico`는 이미 단일 Slack 앱 위에서 `Governor + Captain + specialist` 구조를 실제로 굴릴 수 있는 수준까지 올라왔다. 다만 초기 스펙의 철학을 “작동하는 런타임”으로 번역하는 과정에서, 일부는 구현 완료, 일부는 부분 구현, 일부는 아직 설계가 더 필요한 상태다.

현재 판단은 아래와 같다.

- 운영 모델 뼈대: 완료
- specialist 실행 런타임: 대부분 완료
- 포트폴리오 제어면: 대부분 완료
- 상태머신과 증적 모델: 대부분 완료
- 역할별 정책 강제: 대부분 완료

## 완료된 항목

### 단일 Slack 앱 + 내부 역할 분리

- `Governor`는 `#total` 같은 총괄 채널에서만 보이고, 프로젝트 채널에서는 `Captain`이 전면에 나온다.
- specialist는 별도 bot identity 없이 내부 역할 프로필로 분리된다.
- 역할별 playbook, project memory, run memory, OpenClaw context가 prompt 조립에 들어간다.

### 외부 상태 저장소

아래 엔터티는 SQLite에 존재한다.

- `Project`
- `Initiative`
- `Goal`
- `Run`
- `Task`
- `Artifact`
- `Approval`
- `StateTransition`
- `project_memory`
- `run_memory`
- `role_playbooks`

즉, Slack thread를 유일한 정본으로 쓰지 않는다는 초기 원칙은 이미 지켜지고 있다.

### Initiative 분해와 승인 게이트

- 큰 요청은 `Initiative -> multiple Goals`로 분해할 수 있다.
- `deploy`, `external_message`, `spend`, `delete_data`는 승인 게이트로 올라간다.
- 승인 버튼과 stale callback 방어도 있다.

### FE / BE write-mode

- `frontend`, `backend`는 실제 repo write-mode가 가능하다.
- 현재는 bounded patch 수준의 실행기이며, 결과는 `changedFiles`, `verificationNotes`, Slack 요약으로 남는다.

### Customer Voice V1.5

- 프로젝트별 프로필, persona, simulation policy, test credential refs가 저장된다.
- Slack에서 `고객관점 ...` 명령으로 설정을 바꿀 수 있다.
- browser simulation evidence를 specialist 컨텍스트로 주입할 수 있다.

## 현재는 대부분 완료된 항목

### Governor control plane

현재 구현:

- 최대 동시 실행 프로젝트 수 제한
- start/finish 게이트
- pause/resume/reprioritize용 내부 API 골격

현재 상태:

- `상태`, `대기열`, `승인 대기`, `일시정지`, `재개`, `우선순위`, `배포 완료`, `보관`, `복구` 명령이 실제로 동작한다
- Governor는 `#total`에서만 말하고, 프로젝트 채널 실행은 Captain으로 넘긴다

남은 점:

- manual reroute / force take-over 같은 강한 운영 명령은 아직 없다
- 별도 감사 이벤트 스트림은 아직 없다

### 상태머신

현재 구현:

- `planned`
- `in_progress`
- `awaiting_qa`
- `approved`
- `awaiting_human_approval`
- `qa_failed`
- `blocked`
- `rejected`
- `released`
- `archived`

남은 점:

- `triaged`는 아직 독립 운영 상태로 쓰지 않는다

### Task lifecycle

현재 구현:

- Captain plan을 바탕으로 `Task` row는 생성된다
- task graph와 dependsOn은 저장된다

현재 상태:

- task별 `planned/ready/running/succeeded/blocked` 전이를 기록한다
- `attempt_count`, `started_at`, `finished_at`가 실제로 채워진다

남은 점:

- `skipped` / `cancelled` 같은 더 세분화된 task 종료 상태는 아직 없다
- retry/replan 이력은 goal/run 중심이고 task history는 아직 얇다

### Specialist visibility policy

현재 구현:

- 메시지 템플릿은 구조화됐다
- `Governor`, `Captain`, specialist가 구분된다

현재 상태:

- analyze-only 정보성 specialist는 Captain 요약으로 흡수된다
- write/blocking/approval/evidence-heavy specialist만 개별 메시지를 남긴다

남은 점:

- 매우 긴 multi-goal initiative에서는 여전히 thread 양이 많아질 수 있다

### Role enforcement

현재 구현:

- role playbook에 `charter`, `checklist`, `skillPack`, `allowedTools`, `disallowedTools`, `artifactTemplate`가 저장된다
- executor prompt에 이 정보가 들어간다

현재 상태:

- planner/designer/frontend/backend/qa/customer-voice의 write scope를 runtime에서 검사한다
- artifact template이 실제 결과 artifact title에 반영된다
- write-mode인데 코드 변경이 없으면 artifact-only write가 결과에 명시된다

남은 점:

- allowed/disallowed tools는 아직 capability gate보다 prompt/contract 중심이다
- role별 OS-level sandbox 격리는 없다

## 아직 미완료인 설계 축

### QA evidence contract

QA는 근거 없는 blocking은 막지만, 증거를 더 구조화된 artifact schema로 강제하는 수준까지는 아직 아니다.

부족한 것:

- 검증 명령 로그
- 실패 재현 절차
- 스크린샷/브라우저 증적
- QA artifact 스키마

### Governor audit model

현재는 정책 변경과 복구를 `state_transitions`와 Slack 메시지로 추적한다.

남은 점:

- `governor_events` 같은 별도 감사 로그가 필요한지
- 운영 분석용으로 pause/resume/reprioritize/repair를 더 구조화할지

## 우선순위 높은 후속 설계

핵심 follow-up spec 세 개는 구현까지 반영됐다.

다음 라운드에서 의미가 큰 문서는 아래 둘이다.

1. `qa-evidence-schema`
2. `governor-audit-events`

## 판단

지금 `rico`는 follow-up spec 세 개를 런타임 규칙으로 대부분 옮긴 상태다. 다음 단계는 철학보다 운영 증적과 감사성, 특히 QA evidence와 Governor audit을 더 엄밀하게 잠그는 작업이다.
