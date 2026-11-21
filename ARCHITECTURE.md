# 구조 안내

HTML/CSS/JavaScript만 사용한다. 빌드 도구 없이 `index.html`의 `<script>` 순서대로 로드한다.
단일 파일 배포본(`dist/play.html`)은 같은 스크립트를 한 파일로 합친 것이다.

## 폴더

| 폴더 | 역할 |
| --- | --- |
| `js/core/` | `Events`(이벤트 버스), `GameState`(상태 저장소), `Game`(시스템 등록소) |
| `js/data/` | 데이터만 둔다: 장소(`regions.js`), 몬스터(`monster-data.js`), 몬스터 기획 목록(`monster-roster.js`) |
| `js/gfx/` | 코드로 그리는 픽셀 스프라이트: 인물/기본(`sprites.js`), 건물·NPC·동료(`village-sprites.js`), 필드 몬스터(`monster-sprites.js`) |
| `js/world/` | 월드 구현: 지형/충돌(`world.js`), 몬스터 출현(`monsters.js`), 마을 NPC(`npcs.js`) |
| `js/systems/` | 게임 시스템. 지금은 12개 모두 등록만 된 뼈대 (아래 표) |
| `js/ui/` | 화면: 조이스틱(`input.js`), 하단 컨트롤(`controls.js`), 메뉴 화면 전환(`screens.js`), 대화창(`dialog.js`), HUD(`hud.js`), 탐험 화면(`explore-screen.js`) |
| `js/main.js` | 게임 루프(이동, 카메라, 렌더링)와 장소 이동 |

## 화면 구성

- 위쪽 54%: 필드(캔버스 + 상단 HUD). 마을과 탐험 필드가 같은 캔버스를 쓰며, `region.type`으로 구분한다.
- 아래쪽 46%: 메인 메뉴(2행 3열) + 패드(왼쪽 고정 조이스틱, 오른쪽 대화 버튼 — 대상 옆에서만 표시).
- 메뉴 화면: 필드 위에 덮이는 오버레이. 열려 있는 동안 월드는 멈추고 상태는 그대로 유지된다.

## 의존 규칙 (시스템이 서로 얽히지 않게)

1. 시스템은 `Events`, `GameState`, `data`만 참조한다. **다른 시스템을 직접 부르지 않는다.**
2. 시스템끼리의 협력은 이벤트로만 한다. 예: 전투 종료 → `battle:end` → 인벤토리/캐릭터가 각자 처리.
3. 화면(ui)은 이벤트를 듣고 `GameState`를 읽어 그린다. 화면이 시스템 내부를 바꾸지 않는다.
4. 장소 이동은 `Events.emit('location:request', { id })` 로 요청한다.
5. **하단만으로 모든 조작이 가능**해야 한다(위쪽 화면 직접 터치도 허용). 하단 컨트롤(`ui/controls.js`)은 모드에 따라 바뀐다 — 필드: 조이스틱 + 대화, 메뉴 화면: 방향 + 확인/뒤로, 대화: 다음/닫기, 전투: 방향 + 확인/뒤로 + 전투 명령. 새 화면은 `Screens.register(id, { onNav, onConfirm, onBack })` 로 이 버튼들에 반응한다.
6. 상호작용: `main.js` 가 가까운 대상을 찾아 `interact:target` 을 보내면 대화 버튼이 나타나고, 버튼을 누르면 `npc:interact { npc }` 가 발생한다. 지금은 `ui/dialog.js` 가 임시 대사를 보여 주며, 추후 Shop/Crafting/Quest 가 같은 이벤트를 듣고 `npc.role` 에 따라 처리한다.

## 시스템

| 시스템 | 파일 | 상태 |
| --- | --- | --- |
| World | `systems/world.js` → `world/world.js`, `world/npcs.js` | 구현됨 (마을/필드 맵) |
| Exploration | `systems/exploration.js` → `world/monsters.js` | 몬스터 출현 구현됨. 채집/보물/던전은 추후 |
| Battle | `systems/battle.js` + `ui/battle-screen.js` | 구현됨: 턴제 전투(기술/물약/도망), 승리 보상. 규칙은 시스템, 연출은 UI |
| Character | `systems/character.js` (+ `data/progression.js`, `ui/character-screen.js`) | 구현됨: 경험치/레벨업, 기술 4개 습득·교체 |
| Equipment | `systems/equipment.js` (+ `core/stats.js`) | 구현됨: 장착, 무기 숙련 레벨, 무기별 기술 제안, 등급(대장장이가 올릴 예정) |
| Economy | `systems/economy.js` | 골드 획득만 구현 (가격/상점은 Shop 에서) |
| Shop | `systems/shop.js` + `ui/shop-screen.js` (+ `data/shop.js`) | 구현됨: 상점 사기/팔기. 파는 가격 `data/items.js` 의 `sell`, 사는 가격 `data/shop.js` 의 `ShopStock` |
| Inn | `systems/inn.js` + `ui/inn-screen.js` | 구현됨: 여관(요금 `Services.innCost` 로 HP/MP 전부 회복) |
| Quest | `systems/quest.js` + `ui/quest-screen.js` (+ `data/quests.js`) | 구현됨: 의뢰소(처치/수집 의뢰, 보상). 상태는 `GameState.quests` |
| Crafting | `systems/crafting.js` + `ui/forge-screen.js` (+ `data/forge.js`) | 구현됨: 대장간 강화(등급 ★ 올리기). 확률 = `Forge.successRate[등급]` + 재료 `forge.chanceBonus` |
| Save | `systems/save.js` (+ `core/save-store.js`, `ui/title-screen.js`, `ui/system-screen.js`) | 구현됨: 파일 3개, 10분 자동 저장, 타이틀 화면 |
| Inventory | `systems/inventory.js` (+ `data/items.js`, `ui/bag-screen.js`) | 구현됨: 아이템 보유, 꾸러미 열기 |
| Starter | `systems/starter.js` | 구현됨: NPC `gift` 설정으로 처음 한 번 지급 (촌장 → 초보자 패키지) |
| Companion, Collection | `systems/<이름>.js` | 뼈대만 있음 |

## 확장 방법

- **새 탐험 지역**: `data/regions.js` 에 항목 추가 (`gen`, `monsters` 규칙). 몬스터는 `data/monster-data.js`.
- **새 몬스터/등급**: `MonsterData` 항목 추가, 등급은 `MonsterRarities`에 추가 (엘리트/보스 확장 지점).
- **새 건물/NPC**: `regions.js` 마을 블록의 `buildings`/`npcs` 추가, 스프라이트는 `gfx/village-sprites.js`.
- **저장**: 저장 대상은 `GameState.snapshot()` (player, wallet, inventory, gear, equipment, skills, flags) + 월드 위치/플레이 시간. 월드 정보는 `save:collect` 이벤트로 받아 온다. 새 상태 조각을 저장하려면 `core/state.js` 의 `SAVED` 에 추가한다.
- **건물 입장**: `regions.js` 건물에 `enter: '화면id'` 를 넣으면 문 앞에서 `입장` 버튼이 나오고 `building:enter { id }` 가 발생한다. 대장간(`forge`)이 이 방식이다.
- **드롭 아이템**: 몬스터별 드롭은 `data/drops.js` 의 `DropTables[몬스터 id]` 한 곳에서 정한다. 몬스터 소재는 `data/items.js` 에 `type: 'loot'` 로 추가한다.
- **새 의뢰**: `data/quests.js` 에 항목 추가 (`goal` 처치/수집, `reward`, 선행 의뢰 `after`).
- **건물 기능 연결**: `enter: 'id'` 건물은 `building:enter` 를 듣는 화면(대장간/상점은 전용 화면, 여관/의뢰소는 `Screens`)이 처리한다.
- **강화재료 추가**: `data/items.js` 에 `type: 'material'` + `forge: { rarity, chanceBonus }` 로 추가한다 (희귀할수록 보너스를 크게).
- **승리 보상**: 승리하면 `battle:rewards { exp, gold, weaponExp, steps }` 를 보낸다. Character(경험치·레벨), Equipment(무기 숙련), Economy(골드)가 각자 지급하고 `steps` 에 전투 화면용 메시지를 덧붙인다.
- **기술**: `data/skills.js` 에 기술, `data/items.js` 의 `weapon.skills` 에 "숙련 레벨 N 에서 배움"을 적는다. 4개가 가득 차면 전투 화면이 하나를 잊을지 묻는다(`skill:decide`).
- **전투 시작/종료**: 필드에서 몬스터에게 닿으면 `battle:request` → 시스템이 `battle:start`/`battle:steps`(연출 단계) 를 보내고, UI 가 끝나면 `battle:finish` → `battle:end { outcome, monster }` 로 월드가 결과를 반영한다.
- **새 아이템**: `data/items.js` 에 항목 추가, 아이콘은 `gfx/item-sprites.js`. 획득은 `Events.emit('item:gain', { id, count })`.
- **처음 한 번 주는 선물**: NPC 데이터에 `gift { flag, lines, items, toast }` 를 넣는다.
- **새 메뉴 화면 기능**: `Screens.register('bag', { render(body) { ... } })` 로 임시 화면을 교체.
- **새 시스템 기능**: 해당 `systems/*.js` 의 `init(ctx)` 에서 `ctx.Events`로 연결.
