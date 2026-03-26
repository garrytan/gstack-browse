# Pipeline Step 상태 정의

진행 추적 파일의 Step 상태값 정의입니다.

## 상태값

| 상태 | 의미 | 마무리 표시 |
|------|------|-------------|
| `pending` | 아직 시작하지 않음 | ○ |
| `in_progress` | 현재 실행 중 | ◐ |
| `done` | 성공적으로 완료 | ✓ |
| `fail` | 실행했으나 실패 | ✗ |
| `skipped` | 조건 미충족으로 건너뜀 | ⊘ |
| `skipped (GSTACK_NOT_AVAILABLE)` | gstack 필요 단계, 미설치 | ⚠ |
| `skipped (사용자 선택)` | 사용자가 건너뛰기 선택 | ⊘ |
| `skipped (이미 존재)` | 이전 결과 재사용 | ↺ |
| `skipped (최근 실행)` | 최근 실행 결과 유효 | ↺ |

## Pipeline 상태값

| 상태 | 의미 |
|------|------|
| `in_progress` | 파이프라인 실행 중 |
| `completed` | 모든 단계 완료 |
| `paused_at_step_N` | 사용자가 N단계에서 중단 |
| `failed_at_step_N` | N단계에서 실패 후 중단 |

## 재개 규칙

`status: in_progress` 또는 `paused_at_step_N`인 파이프라인 발견 시:
1. 마지막 `done`인 Step의 다음 Step부터 재개
2. `fail`인 Step은 재시도 여부를 물어봄
3. `skipped`인 Step은 건너뜀 유지 (사용자가 요청하면 재실행)
