# Rico Workflow State Machine V2

- 날짜: 2026-04-14
- 상태: 구현 가능
- 목적: 초기 스펙의 상태 모델을 실제 운영 규칙으로 잠근다

## 문제

현재 `rico`는 `Goal` 중심 상태 전이는 작동하지만, 아래 세 가지가 아직 약하다.

- `Goal`과 `Run`과 `Task`의 경계
- `QA`와 `배포` 사이의 전이
- 종료 후 `released` / `archived` 같은 운영 상태

이 문서는 세 엔터티의 상태 전이를 명확히 분리한다.

## 엔터티와 책임

### Initiative

의미:

- 하나의 큰 요청을 여러 `Goal`로 나눈 상위 범위

상태:

- `open`
- `in_progress`
- `blocked`
- `completed`
- `archived`

### Goal

의미:

- Captain이 한 번의 실행 레인으로 완주 가능한 단위

상태:

- `intake`
- `triaged`
- `planned`
- `in_progress`
- `awaiting_qa`
- `qa_failed`
- `awaiting_human_approval`
- `approved`
- `released`
- `archived`
- `blocked`
- `rejected`

### Run

의미:

- 특정 Goal에 대한 한 번의 실제 실행 시도

상태:

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

### Task

의미:

- Captain plan의 task graph에 있는 specialist 단위 작업

상태:

- `planned`
- `ready`
- `running`
- `succeeded`
- `failed`
- `blocked`
- `skipped`

## 상태 전이 규칙

### Goal

기본 전이:

- `intake -> triaged`
- `triaged -> planned`
- `planned -> in_progress`
- `in_progress -> awaiting_qa`
- `awaiting_qa -> approved`
- `awaiting_qa -> qa_failed`
- `approved -> awaiting_human_approval`
- `approved -> released`
- `awaiting_human_approval -> approved`
- `awaiting_human_approval -> rejected`
- `released -> archived`

예외 전이:

- `in_progress -> blocked`
- `awaiting_qa -> blocked`
- `blocked -> planned`
- `qa_failed -> planned`
- `rejected -> planned`

금지 전이:

- `planned -> released`
- `in_progress -> released`
- `qa_failed -> released`
- `blocked -> released`

### Run

- `queued -> running`
- `running -> succeeded`
- `running -> failed`
- `queued -> cancelled`

규칙:

- 하나의 Goal에는 여러 Run이 있을 수 있다
- 동시에 `running`인 Run은 Goal당 1개만 허용한다
- Goal 상태는 Run 상태와 같지 않다

### Task

- `planned -> ready`
- `ready -> running`
- `running -> succeeded`
- `running -> failed`
- `running -> blocked`
- `ready -> skipped`
- `blocked -> ready`
- `failed -> ready`

규칙:

- dependsOn이 모두 `succeeded`여야 `ready`
- write-mode task는 동시에 1개만 `running`
- read-only task는 concurrency policy 안에서 병렬 실행 가능

## 책임 분리

### Goal 상태는 누가 움직이는가

- `Governor`
  - `triaged`, `awaiting_human_approval`, 일부 `blocked`
- `Captain`
  - `planned`, `in_progress`, `awaiting_qa`, `approved`
- `QA`
  - `qa_failed`, `approved`
- `Human`
  - `approved`, `rejected`, `released`

### Run 상태는 누가 움직이는가

- queue/job-runner가 `queued -> running`
- dispatcher/executor가 `running -> succeeded|failed`

### Task 상태는 누가 움직이는가

- Captain이 `planned/ready`
- specialist executor가 `running/succeeded/failed/blocked`

## 운영 규칙

### Goal 시작

새 요청이 들어오면:

1. `intake`
2. Governor가 라우팅/기본 정책 확인
3. `triaged`
4. Captain plan 생성
5. `planned`
6. Run 생성 후 `in_progress`

### Specialist 실행 루프

1. task graph 생성
2. 의존성 없는 task를 `ready`
3. 선택된 task를 `running`
4. 결과 반영
5. 다음 task를 `ready`
6. 모든 실행 task가 끝나면 Goal을 `awaiting_qa`

### QA 게이트

QA는 아래 둘 중 하나를 반드시 반환한다.

- `approved`
- `qa_failed`

`info`만 반환하고 Goal을 종료하면 안 된다.

### 승인 게이트

다음 액션은 Goal을 `awaiting_human_approval`로 올린다.

- 배포
- 외부 메시지 발송
- 비용 발생
- 파괴적 삭제

승인 후:

- 여전히 배포 전이면 `approved`
- 실제 배포까지 끝나면 `released`

### 종료

`released` 또는 장기 보관 대상이 아닌 `approved` Goal은 운영 정책에 따라 `archived`로 옮긴다.

초기 정책:

- `released`: 24시간 이후 자동 `archived`
- `approved` but not deployed: 7일 이후 자동 `archived`

## Slack 표시 원칙

Slack에서 Goal 상태는 아래처럼만 보인다.

- `📝 계획`
- `🔄 진행`
- `🧪 QA 대기`
- `🛑 승인 대기`
- `✅ 완료`
- `🚢 배포 완료`
- `⛔ 차단`

내부 상태명 전체를 그대로 노출하지 않는다.

## DB/구현 변경 요구사항

### Goal

- `intake`, `triaged`, `awaiting_qa`, `released`, `archived` 전이를 실제로 사용해야 한다

### Run

- `status`는 `queued/running/succeeded/failed/cancelled`만 허용

### Task

- `state`를 `planned/ready/running/succeeded/failed/blocked/skipped`로 확장
- `attempt_count`, `started_at`, `finished_at` 추가 권장

### StateTransition

모든 Goal 전이는 `state_transitions`에 append-only로 기록한다.

필수 필드:

- actor
- from_state
- to_state
- created_at
- rationale optional

## 구현 우선순위

1. Goal 상태 추가
2. Run 상태 정규화
3. Task 상태 전이 추가
4. QA gate를 `awaiting_qa -> approved|qa_failed`로 강제
5. `released` / `archived` 운영 루프 추가

## 비목표

- BPMN 수준의 범용 워크플로 엔진
- 프로젝트별 커스텀 상태머신
- 무제한 수동 override

## 판단

V2의 핵심은 “결국 끝났는지”를 사람이 추론하지 않게 만드는 것이다. Goal, Run, Task를 분리하고, `QA`와 `배포`를 상태로 구분해야 운영 기록과 Slack UX가 동시에 선명해진다.
