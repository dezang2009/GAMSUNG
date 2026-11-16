# OFF THE RECORD

> 당신이 살아가는 동안, 세상도 살아간다.

텍스트 기반 인생 시뮬레이션. 지금은 **PHASE 1** (캐릭터 · 하루 24시간 · 생활 상태 · 기본 경제 · 저장).

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm test           # 시스템 단위 테스트 (Vitest + fake-indexeddb)
npm run test:e2e   # 빌드 후 완료 기준 10가지 화면 테스트 (Playwright, Pixel 7·360px)
npm run build      # dist/ 정적 파일
```

## 구조

```
src/
  data/        world.js (지역·학력·배경·일자리·능력치)  activities.js (활동 정의)
  systems/     CharacterSystem  TimeSystem  LifeSystem  EconomySystem  ActivitySystem  SaveSystem
  engine/      GameEngine — 시스템을 이어 주는 유일한 곳, 'change' 이벤트로 화면에 알림
  ui/          UIController(화면 전환·시트·알림·화면 모드)  screens/  components.js(24시간 띠·그래프)
  styles/      tokens.css(밝게·어둡게)  app.css
```

- 각 시스템은 **자기 상태 조각만** 다뤄요: `character` · `time` · `life` · `economy`. 서로 직접 부르지 않고, 엔진이 순서대로 맡겨요.
- 활동 하나: 검사(ActivitySystem.check) → 계획(plan) → 돈(Economy) → 시간 흐름 + 저절로 생기는 변화(Time × Life) → 효과(Life) → 성장(Character) → 기록.
- 하루 마치기: 결근 확인 → 자정 결산(하루 생활비) → 잠(Life.sleep) → 다음 날 → 아침 보고서·일지.
- 저장: IndexedDB `off-the-record/saves` 의 `main` (직전 저장본 `main-prev`). `{ version, savedAt, data }`. 설정(화면 모드·기상 시각)은 localStorage.
- 저장 구조를 바꿀 땐 `SAVE_VERSION` 을 올리고 `MIGRATIONS[이전 버전]` 에 변환 함수를 더해요.

## 글꼴

Pretendard (SIL OFL 1.1), 고운바탕 Gowun Batang (SIL OFL 1.1) — npm 패키지로 함께 번들돼요.
