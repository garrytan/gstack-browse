# Rico Specialist Contracts

- 날짜: 2026-04-14
- 상태: 구현 가능
- 목적: specialist의 역할, visibility, artifact, write-mode 범위를 운영 규칙으로 고정한다

## 문제

현재 specialist는 역할 분리와 playbook seed는 있지만, 아래가 아직 약하다.

- 언제 개별 메시지를 남기는가
- 각 역할이 무엇을 반드시 반환해야 하는가
- write-mode에서 무엇을 써도 되는가
- QA와 Customer Voice가 어떤 증거를 남겨야 하는가

이 문서는 역할별 계약을 고정한다.

## 공통 계약

모든 specialist는 아래 구조를 반환해야 한다.

- `summary`
- `impact`
  - `info`
  - `approval_needed`
  - `blocking`
- `executionMode`
  - `analyze`
  - `write`
- `artifacts`
- `rawFindings`
- `changedFiles`
- `verificationNotes`

### 공통 규칙

- `changedFiles`는 실제 수정한 파일만 포함
- `verificationNotes`는 실제 실행한 검증 또는 확인 결과만 포함
- `impact=blocking`이면 차단 근거가 `summary`에 드러나야 함
- `executionMode=write`인데 `changedFiles=[]`면, artifact-only write라는 사실을 명시해야 함

## visibility policy

### 개별 메시지를 남겨야 하는 경우

- `impact=blocking`
- `impact=approval_needed`
- `executionMode=write`
- `verificationNotes`가 릴리즈 판단에 중요
- persona별 fan-out 결과를 보존해야 하는 `customer-voice`

### Captain이 흡수 요약해도 되는 경우

- `impact=info`
- read-only 분석
- 다른 역할 판단의 보조 근거

즉, specialist가 항상 개별 메시지를 남기면 안 된다.

## 역할별 계약

### Planner

목적:

- 범위, 완료 기준, 의존성, 가장 작은 다음 슬라이스 고정

필수 출력:

- `summary`: 한 라운드 범위와 완료 기준
- `artifacts`: `plan-brief.md` optional

write-mode 허용:

- 프로젝트 문서 초안
- brief
- PRD/spec 초안
- Slack 첨부용 계획 문서

write-mode 금지:

- 앱 코드 수정
- DB schema 변경
- 배포

### Designer

목적:

- UX 흐름, 위계, 카피, 사용자 이해 경로 정리

필수 출력:

- `summary`: UX 판단 또는 카피/동선 수정 포인트
- `artifacts`: `ux-review.md` optional

write-mode 허용:

- 카피 문서
- UX review
- 화면/동선 제안 문서
- 제한적 UI copy 수정

write-mode 금지:

- 구조적 백엔드 변경
- 배포

### Frontend

목적:

- 화면, 라우팅, 상태 전이, 사용자 인터랙션 구현 및 점검

필수 출력:

- `summary`
- `changedFiles` when write-mode
- `verificationNotes`

write-mode 허용:

- client-side code
- routing
- UI copy
- component wiring

write-mode 금지:

- deploy
- destructive migration

### Backend

목적:

- API, 데이터 계약, auth, integration, failure mode 구현 및 점검

필수 출력:

- `summary`
- `changedFiles` when write-mode
- `verificationNotes`

write-mode 허용:

- API layer
- service/repository code
- function handler
- server-side validation

write-mode 금지:

- production delete
- customer-facing outbound message

### QA

목적:

- 완료 선언을 검증하고 release gate를 내린다

필수 출력:

- `summary`
- `impact`
- `verificationNotes`
- 적어도 하나의 실제 검증 근거

write-mode 허용:

- QA evidence 문서
- repro steps
- verification log
- browser simulation artifact

기본 정책:

- QA는 기본적으로 제품 코드를 수정하지 않는다
- 예외적으로 자동 수정 권한을 주려면 별도 `qa-fix-mode`를 명시적으로 켜야 한다

차단 규칙:

- 검증 명령 또는 증거 없는 `blocking`은 허용하지 않는다
- 최소 1개 이상의 evidence가 없으면 `info` 또는 `approval_needed`로 강등

### Customer Voice

목적:

- 사용자 가치, 메시지 선명도, JTBD, objection을 기준으로 이견 제기

필수 출력:

- `summary`
- `personaLabel` optional
- `verificationNotes` when simulation is used

write-mode 허용:

- persona brief
- JTBD / objection mapping
- customer review artifact
- browser simulation evidence

기본 정책:

- 직접 제품 코드를 수정하지 않는다
- 다만 copy/doc suggestion artifact는 쓸 수 있다

## Customer Voice Director

`customer-voice`는 단일 specialist가 아니라 `Customer Voice Director`가 제어한다.

Director 책임:

- 이 Goal에 customer-voice가 필요한지 판단
- generic / persona-driven 선택
- single persona / multi persona fan-out 선택
- simulation policy 적용 여부 판단
- credential 필요 여부 확인

### persona fan-out 규칙

아래 중 하나면 multi persona를 고려한다.

- landing / pricing / positioning / onboarding
- 복수 사용자군이 분명한 프로젝트
- 명시적으로 “여러 페르소나” 요청

### simulation 규칙

아래 중 하나면 simulation을 우선 검토한다.

- `체험`
- `실제 사용`
- `시뮬레이션`
- `dogfood`
- CTA / journey / signup flow 검토

## artifact contract

역할별 기본 artifact:

- Planner: `plan-brief.md`
- Designer: `ux-review.md`
- Frontend: `frontend-slice.md`
- Backend: `backend-slice.md`
- QA: `qa-gate.md`
- Customer Voice: `customer-voice.md`

필수 원칙:

- Slack에 붙는 artifact는 Slack에서 바로 열 수 있는 형식이어야 함
- 로컬 경로는 내부 미러일 뿐, 전달 매체가 아님

## runtime enforcement

playbook은 prompt 힌트로만 쓰면 안 된다. 아래를 런타임에서 강제해야 한다.

- role별 `executionMode` 허용 범위
- `changedFiles` 정합성
- `impact=blocking`의 evidence requirement
- artifact template completeness
- disallowed action 차단

## 구현 우선순위

1. specialist visibility gate
2. QA evidence enforcement
3. planner/designer/customer-voice write-mode scope enforcement
4. artifact completeness checks
5. optional `qa-fix-mode` 설계

## 판단

specialist를 “여러 개 있는 답변 봇”으로 만들지 않으려면, 각 역할이 언제 말하고 무엇을 남기며 어디까지 쓸 수 있는지 계약으로 잠가야 한다. 이 문서는 그 최소 경계를 정의한다.
