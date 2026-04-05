# 방구석 사진관 — Design System

> **Aesthetic: Refined Morning Glass (정제된 아침햇살과 유리)**
> 따뜻한 자연광이 들어오는 실사 배경 위에, 투명한 얼음과 유리 같은 UI 요소를 중첩 배치.
> 평범한 컨버팅 툴을 넘어 오프라인 프리미엄 스튜디오의 경험을 제공.

---

## Color

### Background
| Token | Hex/RGBA | Usage |
|-------|----------|-------|
| `--bg-warm` | `#FAF9F6` | 메인 배경 (솔리드 폴백용) |
| `--bg-cream` | `rgba(255, 255, 255, 0.3)` | 서브 카드 배경 (초고투명) |
| `--bg-section` | `rgba(255, 255, 255, 0.45)` | 메인 카드/영역 배경 (고투명 글래스) |
| `--bg-glow` | `rgba(215, 191, 166, 0.3)` | 햇살 글로우 포커스 |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-dark` | `#12100E` | 제목 (극강의 대비) |
| `--text-body` | `#2B2622` | 본문 |
| `--text-muted` | `#544D46` | 보조/캡션 |
| `--text-white` | `#FFFFFF` | 버튼 위 텍스트/반전색 |

### Accent
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#CFA67E` | 세련된 오크/코랄 (프리미엄 무드) |
| `--accent-hover` | `#AB8866` | 호버 상태 |
| `--accent-soft` | `rgba(215, 191, 166, 0.25)` | 뱃지/아이콘 백그라운드 |

---

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| 로고/헤드라인 | Gowun Batang (Serif) | 700 | 42px (desktop) / 32px (mobile) |
| 섭타이틀 | Gowun Batang (Serif) | 600 | 17px |
| 본문/UI | Pretendard | 400-500 | 16px / line-height 1.8 |
| 버튼/라벨 | Pretendard | 500-600 | 14px-17px |

> **리스크 테이킹 (과감한 적용):** AI 서비스의 정형화된 고딕을 탈피하고, 가장 중요한 메시지(로고, 슬로건 등)에 세리프 폰트를 강하게 도입하여 매거진 화보같은 무드를 연출함.

---

## Shape & Shadow & Blur

### Shape
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 12px | 버튼, 입력, 체크리스트 |
| `--radius-md` | 20px | 카드 내부, 트러스트 뱃지 |
| `--radius-lg` | 32px | 메인 카드, 업로드 영역 |
| `--radius-full` | 9999px | 뱃지, 탭 셀렉터 |

### Shadow & Filter
| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-soft` | `0 8px 32px rgba(120, 112, 104, 0.08)` | 공통 UI 그림자 (플로팅) |
| `--shadow-card` | `0 12px 48px rgba(120, 112, 104, 0.14)` | 카드 호버시 강한 그림자 |
| `backdrop-filter` | `blur(16px)` ~ `blur(8px)` | 메인 카드(.card), 뱃지 |

---

## Component Inventory

| Component | 설명 |
|-----------|------|
| `body::before/after` | 실사 배경 이미지 + 전체 화면 소프트 블러 오버레이 |
| `header` | 하이콘트라스트 세리프 텍스트 록업 |
| `card` | 32px 둥근 모서리 + rgba 0.45 반투명도 + 16px 블러 처리된 유리판 |
| `trust-badge` | 고도의 투명함(0.3)을 가져, 뒤 배경 이미지가 아른거리도록 설계됨 |
| `btn-cta` | 가장 무겁고 단단한 블랙(#12100E)을 사용하여 시각적 중심을 잡아줌 |

---

## Don'ts

- ❌ 이모지를 과도하게 사용하지 않음 (신뢰감을 위해 최소화)
- ❌ 강한 비비드 컬러(원색 파랑/초록)를 메인으로 쓰지 않음 (파스텔 톤 억제)
- ❌ 다크 모드 사용하지 않음 (기본 배경 사진 자체가 아침 채광 컨셉)
- ❌ **불투명 흰색 배경 사용하지 않음!** 항상 `rgba(255,255,255, 0.X)` 와 `blur`를 병행할 것.
