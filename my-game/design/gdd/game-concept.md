# Game Concept: 용병단 연대기 (가제)

*Created: 2026-11-13*
*Status: Draft*

---

## Elevator Pitch

> 용병을 모아 키우고, 룬 조각을 용병들에게 나눠 주는 퍼즐 턴제 전투로 끝없는
> 탑에 도전하는 모바일 수집형 RPG. 용병은 승급할 때마다 그림과 전투 연출이
> 실제로 바뀐다.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | 수집형 RPG + 퍼즐형 턴제 전투 |
| **Platform** | 모바일 (iOS / Android) |
| **Target Audience** | 성취형·수집형 플레이어 (아래 Target Player Profile 참고) |
| **Player Count** | 1인용 |
| **Session Length** | 30~60분, 짧게 끊어 하는 5분 단위 플레이 가능 |
| **Monetization** | 미정 (취미 프로젝트. 영입은 플레이로 얻는 게임 내 재화로 한다) |
| **Estimated Scope** | Large (18~24개월, 1인) |
| **Comparable Titles** | 폭렬격전(Dokkan Battle) — 콘텐츠 구조의 참고. 판매·이용자 수치는 조사하지 않음 |

---

## Core Fantasy

초라했던 내 용병단이 눈에 보이게 전설이 되어 간다. 무쇠 갑옷을 입은 신참이
내 손으로 키운 끝에 금빛 영웅이 되고, 그 변화가 그림과 전투 연출로 화면에
그대로 드러난다.

---

## Unique Hook

수집형 RPG인데, 성장 단계마다 캐릭터의 그림과 전투 연출이 실제로 달라진다.
성장은 숫자가 아니라 눈으로 확인하는 것이며, 이 규칙은 전투(필살기 연출),
도감(단계별 그림), 아트 방향(실루엣 규칙)에 모두 적용된다.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 3 | 고품질 용병 일러스트, 승급할수록 화려해지는 필살기 연출 |
| **Fantasy** (make-believe, role-playing) | 2 | 용병단장이 되어 무명 용병단을 전설로 키운다 |
| **Narrative** (drama, story arc) | 6 | 용병별 짧고 굵은 설정. 긴 스토리 연출은 없음 |
| **Challenge** (obstacle course, mastery) | 1 | 끝없는 탑, 조합과 퍼즐 판단으로 넘는 벽 |
| **Fellowship** (social connection) | N/A | 1인용, 온라인 기능 없음 |
| **Discovery** (exploration, secrets) | 5 | 새 용병, 새 승급 단계의 그림, 용병 간 상성 발견 |
| **Expression** (self-expression, creativity) | 4 | 나만의 파티 편성, 누구를 먼저 키울지의 선택 |
| **Submission** (relaxation, comfort zone) | 7 | 요일 재료 던전의 가벼운 반복 플레이 |

### Key Dynamics (Emergent player behaviors)

- 플레이어는 탑에서 막힌 층을 넘기 위해 용병 조합을 바꿔 가며 실험한다.
- 플레이어는 다음에 승급시킬 용병을 정하고, 그 재료가 나오는 콘텐츠를 골라 돈다.
- 플레이어는 승급 후의 그림과 연출이 궁금해서 아직 안 키운 용병에 손을 댄다.

### Core Mechanics (Systems we build)

1. **퍼즐 턴제 전투** — 매 턴 판에 놓인 룬 조각을 골라 용병에게 나눠 주고, 조각이 모이면 필살기가 발동한다.
2. **용병 성장** — 레벨업 → 승급(그림·연출 변화, 3단계) → 잠재력 해방.
3. **영입** — 게임 내 재화로 하는 무작위 영입, 그리고 콘텐츠 클리어 보상으로 얻는 확정 용병.
4. **파티 편성** — 역할과 속성 상성을 고려한 조합.
5. **콘텐츠 모드** — 이야기 원정, 요일 재료 던전, 탑. 모드마다 주는 성장 재료가 다르다.

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | 어떤 용병을 키우고 어떤 조합으로 도전할지 직접 정한다 | Core |
| **Competence** (mastery, skill growth) | 막혔던 층을 조합과 육성으로 넘고, 성장이 화면에 보인다 | Core |
| **Relatedness** (connection, belonging) | 다른 플레이어 대신 내가 키운 용병들에 대한 애착 | Minimal |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** (goal completion, collection, progression) — How: 도감 완성, 용병 최종 승급, 탑 최고 층 기록
- [x] **Explorers** (discovery, understanding systems, finding secrets) — How: 용병 간 상성과 조합 연구 (부 대상)
- [ ] **Socializers** (relationships, cooperation, community) — How: 해당 없음
- [ ] **Killers/Competitors** (domination, PvP, leaderboards) — How: 해당 없음

Quantic Foundry 모델로는 "완성"과 "힘" 동기가 강한 층이 주 대상이다.
이야기 몰입, 다른 사람과의 경쟁·협동, 직접 조작 액션을 원하는 플레이어에게는
맞지 않는다.

### Flow State Design

- **Onboarding curve**: 첫 10분 안에 전투 한 판, 첫 영입, 첫 레벨업을 겪고, 첫 30분 안에 첫 승급으로 그림이 바뀌는 순간을 본다.
- **Difficulty scaling**: 탑은 층이 오를수록 수치뿐 아니라 요구하는 조합이 달라진다. 재료 던전은 난이도 단계를 직접 고른다.
- **Feedback clarity**: 승급 시 그림과 연출 변화, 탑 최고 층 기록, 도감 진행률.
- **Recovery from failure**: 패배해도 잃는 것이 없고 바로 재도전한다. 패배 화면에서 편성 화면으로 바로 갈 수 있다.

---

## Core Loop

### Moment-to-Moment (30 seconds)

매 턴 판에 놓인 룬 조각 중에서 골라 용병들에게 나눠 준다. 조각을 많이 모은
용병은 필살기를 쓰고, 승급한 용병일수록 연출이 화려하다. "누구에게 몰아줄까"
라는 짧은 판단과 필살기 연출이 한 턴의 보상이다.

### Short-Term (5-15 minutes)

한 스테이지는 3~5번의 전투로 이루어진다. 끝나면 재료를 받고, 그 재료로 용병
한 명이 한 단계 강해지며, 그 차이가 다음 판에서 바로 보인다. "한 판만 더"가
여기서 생긴다.

### Session-Level (30-120 minutes)

오늘 열린 재료 던전을 돌고, 영입을 하고, 탑의 다음 층에 도전한다. 탑에서
막히면 "누구를 키워야 하나"라는 다음 목표가 생기고, 이것이 자연스러운 종료
지점이자 다음 접속의 이유가 된다.

### Long-Term Progression

영입 → 레벨업 → 승급 → 잠재력 해방 → 탑의 더 높은 층. 탑은 끝이 없고, 용병
도감을 최종 승급까지 완성하는 것이 장기 목표다.

### Retention Hooks

- **Curiosity**: 아직 못 본 용병, 아직 못 본 승급 단계의 그림과 연출
- **Investment**: 시간을 들여 키운 용병단과 채워 가는 도감
- **Social**: 없음 (1인용)
- **Mastery**: 탑 최고 층 갱신, 낮은 전력으로 깨는 조합 연구

---

## Game Pillars

### Pillar 1: 눈에 보이는 성장

모든 성장 단계는 화면에서 무언가를 바꾼다.

*Design test*: 숫자만 오르는 강화와 외형이나 연출이 바뀌는 강화 중에서는 바뀌는 쪽을 고른다.

### Pillar 2: 모든 용병이 주인공

용병마다 고품질 그림, 고유한 설정, 뚜렷한 역할이 있다.

*Design test*: 얕은 용병 20명과 깊은 용병 5명 중에서는 5명을 고른다.

### Pillar 3: 조합이 실력

벽은 수치만이 아니라 파티 편성과 퍼즐 판단으로 넘는다.

*Design test*: 반복 플레이로만 깨지는 층과 조합을 바꾸면 깨지는 층 중에서는 조합 쪽을 고른다.

### Pillar 4: 오늘도 할 일이 있다

콘텐츠마다 서로 다른 성장 재료를 주어, 매일 할 이유가 다르다.

*Design test*: 기존과 같은 보상을 주는 새 모드와 새 성장 축을 여는 모드 중에서는 새 축을 고른다.

기둥 2(적고 깊게)와 기둥 4(다양하게), 기둥 1(육성으로 강해짐)과 기둥 3(실력으로
넘음)은 서로 당기는 관계이며, 이 긴장이 설계 결정의 기준이 된다.

**검토 메모 (CD-PILLARS: APPROVE)**: 기둥 4는 네 개 중 가장 평범하다. 수집형
RPG 대부분에 해당하는 원칙이므로 "콘텐츠마다 다른 성장 축"이라는 판단 기준을
엄격히 지켜야 의미가 있다. 이 검토는 디렉터 에이전트 없이 같은 기준으로
세션 안에서 수행했다.

### Anti-Pillars (What This Game Is NOT)

- **NOT 숫자만 오르는 성장**: 기둥 1을 해친다.
- **NOT 색만 바꾼 양산형 용병**: 도감 수를 채우려는 용병은 기둥 2를 해친다.
- **NOT 길고 감성적인 스토리 연출**: 설정은 짧고 굵게 전하고, 그 시간은 기둥 4의 콘텐츠에 쓴다.
- **NOT 실시간 대전이나 온라인 서버**: 첫 게임에서 그 작업량은 기둥 2의 아트 품질을 깎는다.

---

## Visual Identity Anchor

**방향: 성장이 곧 실루엣**

**시각 규칙**: 강해질수록 실루엣이 커지고 화려해진다.

**원칙**

1. **승급은 실루엣을 바꾼다** — 승급 단계마다 갑옷, 무기, 망토 같은 장식이 더해진다.
   *Design test*: 색만 바뀌는 승급 그림과 윤곽이 달라지는 승급 그림 중에서는 윤곽이 달라지는 쪽을 고른다.
2. **날카롭고 각진 선** — 당당하고 힘 있는 영웅 일러스트를 지향한다.
   *Design test*: 둥글고 귀여운 표현과 각지고 힘 있는 표현 중에서는 각진 쪽을 고른다.
3. **금색은 아껴 쓴다** — 빛나는 금색은 최종 승급 단계에만 쓴다.
   *Design test*: 낮은 등급 용병이나 일반 UI에 금색을 쓰자는 제안은 받아들이지 않는다.

**색 철학**: 낮은 등급은 무쇠와 가죽의 탁한 색으로 시작하고, 등급이 오를수록
채도가 높아진다. 색의 화려함이 곧 성장 정도를 뜻한다.

이 방향은 `/art-bible`의 출발점이 된다.

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| 폭렬격전 (Dokkan Battle) | 수집과 성장이 눈에 보이는 재미, 여러 콘텐츠 모드가 각기 다른 재료를 주는 구조, 높은 캐릭터 아트 품질 | 캐릭터와 세계관은 완전히 새로 만든다. 전투는 룬 조각을 용병에게 나눠 주는 고유한 방식. 온라인 운영 없이 1인용 | 제작자가 약 8년간 플레이한 게임으로, 이 구조가 장기 플레이를 지탱할 수 있음을 제작자 본인의 경험이 뒷받침한다 |

**Non-game inspirations**: 아직 없음.

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 미정 (조사하지 않음) |
| **Gaming experience** | 미드코어 |
| **Time availability** | 매일 짧게 여러 번, 가끔 30~60분 |
| **Platform preference** | 모바일 |
| **Current games they play** | 폭렬격전 같은 수집형 RPG |
| **What they're looking for** | 3일 만에 질리지 않고 몇 년씩 할 수 있는, 수집과 성장이 눈에 보이는 게임 |
| **What would turn them away** | 지나치게 감성적인 톤, 숫자만 오르는 성장, 품질 낮은 캐릭터 그림 |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | 미정. `/setup-engine`에서 컨셉과 모바일 플랫폼에 맞춰 정한다 |
| **Key Technical Challenges** | 세이브 데이터의 장기 보존과 버전 이관, 모바일 출시 절차와 다양한 화면 비율, 고해상도 그림의 용량과 메모리 |
| **Art Style** | 2D 일러스트 |
| **Art Pipeline Complexity** | Medium~High (맞춤 2D 일러스트, 용병당 승급 3단계) |
| **Audio Needs** | Moderate |
| **Networking** | None |
| **Content Volume** | 출시 시 용병 16명(그림 48장), 콘텐츠 3종, 탑 50층 이상 |
| **Procedural Systems** | 탑 상위 층의 적 구성 자동 생성 여부는 미정 |

**검토 메모 (TD-FEASIBILITY: CONCERNS)**: 컨셉을 무너뜨릴 고위험 항목은 없다.
혼자 개발할 때 흔히 과소평가하는 항목은 아래 Technical Risks에 적었다. 이
검토는 디렉터 에이전트 없이 같은 기준으로 세션 안에서 수행했다.

---

## Risks and Open Questions

### Design Risks

- 룬 조각을 나눠 주는 전투가 수백 판을 반복해도 재미있는지 검증되지 않았다.
- 탑이 조합이 아니라 수치 싸움이 되면 기둥 3이 무너진다.
- 용병 16명으로 조합의 깊이가 충분한지 알 수 없다.

### Technical Risks

- 몇 년씩 하는 게임이므로, 업데이트 뒤 옛 세이브가 깨지지 않도록 처음부터 세이브 버전 관리가 필요하다.
- 스토어 심사, 다양한 화면 비율, 기기별 성능 대응에 예상보다 시간이 든다.
- 그림 수십 장을 휴대폰에서 다루려면 압축과 불러오기 방식을 일찍 정해야 한다.
- 용병과 스테이지 수치를 코드가 아닌 외부 데이터로 두어야 밸런스 조정이 가능하다.

### Market Risks

- 수집형 모바일 RPG 시장의 경쟁 상황은 조사하지 않았다. 취미 프로젝트이므로 현재 판단 기준이 아니다.

### Scope Risks

- 높은 아트 품질과 다양한 콘텐츠를 첫 게임에서 혼자 갖추는 것이 가장 큰 부담이다. 시간이 부족해지면 아트 품질이 먼저 깎여 기둥 2가 무너진다.
- 범위 검토(PR-SCOPE) 결과는 OPTIMISTIC이었다. 권장 조정(출시 용병 24명 → 16명, 용병 개인 의뢰는 출시 후)을 적용했다. 이 검토는 디렉터 에이전트 없이 같은 기준으로 세션 안에서 수행했다.

### Open Questions

- 용병 그림을 누가 그리는가. 아트 방향과 일정 전체가 이 답에 달려 있으며, `/art-bible` 전에 정해야 한다.
- 룬 조각 전투가 재미있는가. MVP 프로토타입으로 답한다.
- 과금 모델을 둘 것인가. 출시가 가까워질 때 정한다.
- 엔진은 무엇으로 할 것인가. `/setup-engine`에서 정한다.

---

## MVP Definition

**Core hypothesis**: 룬 조각을 나눠 주는 퍼즐 전투와 용병이 강해지는 과정이 30분 이상 재미있다.

**Required for MVP**:
1. 퍼즐 턴제 전투 (룬 조각 배분, 필살기)
2. 용병 3명 (임시 그림)
3. 스테이지 5개
4. 레벨업

**Explicitly NOT in MVP** (defer to later):
- 승급과 그림 변화, 영입
- 탑, 요일 재료 던전
- 완성 일러스트와 연출

### Scope Tiers (if budget/time shrinks)

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 용병 3명(임시 그림), 스테이지 5개 | 퍼즐 전투, 레벨업 | 6~8주 |
| **Vertical Slice** | 용병 6명 완성 그림(각 3단계), 이야기 원정 1장 | 전투 + 승급 + 영입 | 3~4개월 |
| **Alpha** | 용병 12명, 콘텐츠 3종(임시 그림 포함) | 모든 기능, 거친 상태 | 8~10개월 |
| **Full Vision** | 용병 16명(그림 48장), 콘텐츠 3종, 탑 50층 이상 | 모든 기능, 다듬은 상태 | 18~24개월 |

**출시 후 업데이트**: 용병 추가(24명까지), 용병 개인 의뢰(특정 용병 확정 획득과 설정 공개).

기간은 모두 1인 개발 기준이다.

---

## Next Steps

- [ ] **핵심 아이디어 프로토타입** (`/prototype`) — 엔진을 정하기 전에 룬 조각 전투가 재미있는지 브라우저에서 확인한다
- [ ] 엔진 선택과 기술 스택 설정 (`/setup-engine`)
- [ ] 비주얼 정체성 문서 (`/art-bible`) — 그림을 누가 그릴지 먼저 정한다
- [ ] 컨셉 완성도 점검 (`/design-review design/gdd/game-concept.md`)
- [ ] 프로토타입이 통과하면 시스템 분해 (`/map-systems`)
- [ ] 시스템별 설계 (`/design-system [system-name]`)
- [ ] 아키텍처 (`/create-architecture`, `/architecture-decision`, `/architecture-review`)
- [ ] 단계 관문 (`/gate-check`)
- [ ] 프리프로덕션에서 버티컬 슬라이스 (`/vertical-slice`)와 플레이테스트 (`/playtest-report`)
