# Rico Governor Control Plane

- 날짜: 2026-04-14
- 상태: 구현 가능
- 목적: `Governor`를 단순 라우터가 아니라 정책·예외 제어면으로 고정한다

## 목표

`Governor`는 아래 네 가지를 맡는다.

- 포트폴리오 라우팅
- 슬롯 관리
- 우선순위 조정
- 승인 / 예외 관리

반대로, 프로젝트 세부 실행은 `Captain`에게 남긴다.

## 핵심 원칙

- `#total`에서는 `Governor`만 말한다
- 프로젝트 채널에서는 `Captain`이 말한다
- `Governor`는 task graph를 직접 만들지 않는다
- `Governor`는 specialist 판단을 뒤집지 않는다
- `Governor`는 프로젝트 간 충돌과 정책 위반만 다룬다

## Governor가 관리하는 상태

프로젝트별:

- `priority`
- `paused`
- `queued_at`
- `active`
- `current_goal_id`
- `last_goal_state`

포트폴리오 전체:

- `active_slots`
- `max_active_projects`
- `approval_backlog`
- `blocked_projects`

## 명령 모델

### 총괄 채널 명령

초기 명령 세트:

- `프로젝트명: 목표`
- `상태`
- `일시정지 프로젝트명`
- `재개 프로젝트명`
- `우선순위 프로젝트명 3`
- `대기열`
- `승인 대기`

예시:

- `sherpalabs: 랜딩과 ai-employee 동선 연결해`
- `일시정지 mypetroutine`
- `우선순위 sherpalabs 5`

### Governor 응답 형식

#### 라우팅

- 프로젝트
- 상태
- 배정 요약

#### 상태

- 활성 프로젝트
- 대기 프로젝트
- 승인 대기
- 차단 프로젝트

#### 정책 변경

- 대상 프로젝트
- 반영된 설정
- 영향

## 슬롯 규칙

초기 정책:

- 동시에 `running` 가능한 프로젝트는 2개
- 프로젝트당 write execution lane은 1개
- paused 프로젝트는 queue에만 남고 실행되지 않는다

### arbitration 규칙

정렬 기준:

1. 높은 `priority`
2. 더 이른 `queued_at`
3. 같은 경우 프로젝트 id 안정 정렬

### preemption

V1.5에서는 강제 preemption을 하지 않는다.

즉:

- 이미 시작한 프로젝트를 Governor가 중간에 끊지 않는다
- 새 priority는 다음 slot allocation부터 반영한다

## pause / resume

### pause

의미:

- 새 Goal intake는 막지 않되, 실행 슬롯을 배정하지 않는다

### resume

의미:

- 다음 arbitration부터 다시 슬롯 후보가 된다

## 승인 대기

Governor는 `awaiting_human_approval` Goal을 총괄 채널에서 묶어 보여준다.

표시 항목:

- 프로젝트
- 액션 타입
- 이유
- 현재 변경 파일 요약
- 남은 조치

## 차단 / 예외

Governor가 개입하는 상황:

- slot limit 초과
- paused project 실행 요청
- protected action 도달
- 프로젝트 간 priority conflict
- stale goal 또는 broken state 복구 필요

Governor가 개입하지 않는 상황:

- 카피의 좋고 나쁨
- QA 실패 자체의 판정
- 디자인/프론트엔드/백엔드의 전문 판단

## Slack UX

### 총괄 채널에서 보여줄 것

- 라우팅
- 상태
- 승인 요청
- 정책 변경 결과
- 최종 마감

### 총괄 채널에서 숨길 것

- specialist 세부 판단
- 프로젝트 세부 diff
- QA 상세 로그

이 정보는 프로젝트 채널이나 artifact에 남겨야 한다.

## 내부 API

필수 API:

- `registerProject`
- `markQueued`
- `startProject`
- `finishProject`
- `pauseProject`
- `resumeProject`
- `reprioritizeProject`
- `snapshot`
- `chooseNextProject`
- `listActive`
- `listQueued`
- `listAwaitingApproval`

현재 구현에서 부족한 것은 `pause/resume/reprioritize`를 실제 Slack 명령과 연결하는 부분이다.

## 감사 로그

Governor 관련 정책 변경은 모두 기록한다.

필수 이벤트:

- project_paused
- project_resumed
- project_reprioritized
- slot_denied
- approval_requested
- approval_resolved
- stale_state_repaired

저장 위치:

- `state_transitions`
- 또는 별도 `governor_events` 테이블 추가 권장

## 구현 우선순위

1. 총괄 채널 명령 파서
2. pause/resume/reprioritize 실제 연결
3. queue/status 메시지
4. approval backlog 요약
5. stale state repair 명령

## 비목표

- 자동 조직 설계
- 복잡한 프로젝트 포트폴리오 대시보드
- 프로젝트별 미세 task scheduling

## 판단

`Governor`가 진짜 제어면이 되려면, “말투”보다 “정책 명령과 slot arbitration”이 먼저 있어야 한다. 총괄 채널은 대화형 PM 방이 아니라, 운영 제어판이어야 한다.
