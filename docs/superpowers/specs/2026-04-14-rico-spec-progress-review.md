# Rico 스펙 진도 점검

- 날짜: 2026-04-14
- 상태: 후속 설계 문서 작성 완료
- 기준 문서: `2026-04-12-rico-multi-agent-slack-design.md`

## 요약

`rico`는 이미 단일 Slack 앱 위에서 `Governor + Captain + specialist` 구조를 실제로 굴릴 수 있는 수준까지 올라왔다. 다만 초기 스펙의 철학을 “작동하는 런타임”으로 번역하는 과정에서, 일부는 구현 완료, 일부는 부분 구현, 일부는 아직 설계가 더 필요한 상태다.

현재 판단은 아래와 같다.

- 운영 모델 뼈대: 완료
- specialist 실행 런타임: 부분 완료
- 포트폴리오 제어면: 부분 완료
- 상태머신과 증적 모델: 부분 완료
- 역할별 정책 강제: 부분 완료

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

## 부분 완료 항목

### Governor control plane

현재 구현:

- 최대 동시 실행 프로젝트 수 제한
- start/finish 게이트
- pause/resume/reprioritize용 내부 API 골격

부족한 점:

- 실제 `#total` 명령 UX가 아직 약하다
- queued/running arbitration이 정교하지 않다
- 프로젝트 간 충돌 해결 규칙이 표면화되지 않았다
- preemption, manual reroute, slot visibility가 정식 기능이 아니다

### 상태머신

현재 구현:

- `planned`
- `in_progress`
- `approved`
- `awaiting_human_approval`
- `qa_failed`
- `blocked`
- `rejected`

부족한 점:

- `triaged`
- `awaiting_qa`
- `released`
- `archived`

즉, 스펙에 있던 상태 전체를 아직 실제 운영 규칙으로 사용하지는 않는다.

### Task lifecycle

현재 구현:

- Captain plan을 바탕으로 `Task` row는 생성된다
- task graph와 dependsOn은 저장된다

부족한 점:

- task별 `running/succeeded/failed/skipped` 전이가 없다
- retry/replan이 task 수준으로 기록되지 않는다
- 어떤 task가 현재 실행 레인을 점유하는지 명확하지 않다

### Specialist visibility policy

현재 구현:

- 메시지 템플릿은 구조화됐다
- `Governor`, `Captain`, specialist가 구분된다

부족한 점:

- specialist가 언제 개별 메시지를 남기고 언제 Captain이 흡수 요약하는지 규칙이 약하다
- 긴 목표에서는 스레드가 다시 장황해질 수 있다

### Role enforcement

현재 구현:

- role playbook에 `charter`, `checklist`, `skillPack`, `allowedTools`, `disallowedTools`, `artifactTemplate`가 저장된다
- executor prompt에 이 정보가 들어간다

부족한 점:

- 실제 런타임 수준의 하드 enforcement가 아니다
- role별 write scope, tool capability, artifact completeness가 prompt 관습에 더 가깝다

## 아직 미완료인 설계 축

### QA evidence contract

QA는 지금 read/write 혼합 검증을 하지만, “최소 하나 이상의 실제 검증 증거”를 강제하는 체계가 아직 약하다.

부족한 것:

- 검증 명령 로그
- 실패 재현 절차
- 스크린샷/브라우저 증적
- QA artifact 스키마

### Planner / Designer write-mode의 범위

둘 다 write-mode는 가능하지만, “무엇을 쓸 수 있는가”가 아직 불명확하다.

정리되어야 할 것:

- repo code를 써도 되는가
- artifact 문서만 써야 하는가
- Slack 첨부용 문서만 생성해야 하는가

### Release lifecycle

`approved` 이후 `released`, 이후 `archived`까지 가는 운영 규칙이 아직 없다.

즉, “수정 끝남”과 “실제 배포됨”과 “역사 기록으로 닫힘”이 아직 분리되지 않았다.

## 우선순위 높은 후속 설계

다음 세 문서가 현재 가장 중요하다.

1. `workflow-state-machine-v2`
2. `governor-control-plane`
3. `specialist-contracts`

이 세 문서가 잠기면, 이후 구현은 철학 논쟁보다 실행 디테일 정리에 가까워진다.

## 구현 우선순위 제안

### 1단계

- 상태머신 정교화
- task lifecycle 전이
- QA evidence contract

### 2단계

- Governor control plane 명령 체계
- queue arbitration
- slot visibility

### 3단계

- role enforcement 강화
- specialist visibility policy 고정
- planner/designer/customer-voice artifact contract 강화

## 판단

지금 `rico`는 “초기 설계가 맞는지 보여주는 프로토타입” 단계는 이미 넘었다. 하지만 “운영 규칙이 단단히 잠긴 시스템”으로 보려면, 위 follow-up spec 세 개를 구현 규칙으로 바꾸는 마지막 정리가 필요하다.
