// World 시스템 — 마을과 탐험 지역의 맵. 구현은 js/world/world.js (지형·충돌), js/world/npcs.js (NPC).
// 장소 이동은 'location:request' { id } 이벤트로 요청하고, 이동이 끝나면 GameState.location 이 바뀐다.
Game.register('world', {
  api: World,
  init() {},
});
