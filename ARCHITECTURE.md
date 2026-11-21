# 구조 안내

HTML/CSS/JavaScript만 사용한다. 빌드 도구 없이 `index.html`의 `<script>` 순서대로 로드한다.
단일 파일 배포본(`dist/play.html`)은 같은 스크립트를 한 파일로 합친 것이다.

## 폴더

| 폴더 | 역할 |
| --- | --- |
| `js/core/` | `Events`(이벤트 버스), `GameState`(상태 저장소), `Game`(시스템 등록소) |
| `js/data/` | 데이터만 둔다: 장소(`regions.js`), 몬스터(`monster-data.js`) |
| `js/gfx/` | 코드로 그리는 픽셀 스프라이트 (`sprites.js`, `village-sprites.js`) |
| `js/world/` | 월드 구현: 지형/충돌(`world.js`), 몬스터 출현(`monsters.js`), 마을 NPC(`npcs.js`) |
| `js/systems/` | 게임 시스템. 지금은 12개 모두 등록만 된 뼈대 (아래 표) |
| `js/ui/` | 화면: 조이스틱(`input.js`), 메뉴 화면 전환(`screens.js`), HUD(`hud.js`), 탐험 화면(`explore-screen.js`) |
| `js/main.js` | 게임 루프(이동, 카메라, 렌더링)와 장소 이동 |

## 화면 구성

- 위쪽 54%: 필드(캔버스 + 상단 HUD). 마을과 탐험 필드가 같은 캔버스를 쓰며, `region.type`으로 구분한다.
- 아래쪽 46%: 메인 메뉴(2행 3열) + 조이스틱 패드.
- 메뉴 화면: 필드 위에 덮이는 오버레이. 열려 있는 동안 월드는 멈추고 상태는 그대로 유지된다.

## 의존 규칙 (시스템이 서로 얽히지 않게)

1. 시스템은 `Events`, `GameState`, `data`만 참조한다. **다른 시스템을 직접 부르지 않는다.**
2. 시스템끼리의 협력은 이벤트로만 한다. 예: 전투 종료 → `battle:end` → 인벤토리/캐릭터가 각자 처리.
3. 화면(ui)은 이벤트를 듣고 `GameState`를 읽어 그린다. 화면이 시스템 내부를 바꾸지 않는다.
4. 장소 이동은 `Events.emit('location:request', { id })` 로 요청한다.

## 시스템

| 시스템 | 파일 | 상태 |
| --- | --- | --- |
| World | `systems/world.js` → `world/world.js`, `world/npcs.js` | 구현됨 (마을/필드 맵) |
| Exploration | `systems/exploration.js` → `world/monsters.js` | 몬스터 출현 구현됨. 채집/보물/던전은 추후 |
| Battle, Character, Companion, Inventory, Equipment, Economy, Shop, Crafting, Collection, Quest | `systems/<이름>.js` | 뼈대만 있음 |

## 확장 방법

- **새 탐험 지역**: `data/regions.js` 에 항목 추가 (`gen`, `monsters` 규칙). 몬스터는 `data/monster-data.js`.
- **새 몬스터/등급**: `MonsterData` 항목 추가, 등급은 `MonsterRarities`에 추가 (엘리트/보스 확장 지점).
- **새 건물/NPC**: `regions.js` 마을 블록의 `buildings`/`npcs` 추가, 스프라이트는 `gfx/village-sprites.js`.
- **새 메뉴 화면 기능**: `Screens.register('bag', { render(body) { ... } })` 로 임시 화면을 교체.
- **새 시스템 기능**: 해당 `systems/*.js` 의 `init(ctx)` 에서 `ctx.Events`로 연결.
