// 마을 NPC: 정해진 자리에 서서 숨 쉬듯 움직이고, 플레이어가 가까이 오면 그쪽을 바라본다.
// 상호작용(대화/상점 등)은 아직 구현하지 않으며, 추후 role 에 따라 이벤트로 연결한다.
const Npcs = (() => {
  const LOOK_RANGE = 44;   // 이 거리 안에서 플레이어를 바라본다
  const entities = [];

  function init(region) {
    entities.length = 0;
    if (!region.village) return;
    for (const n of region.village.npcs) {
      entities.push({
        id: n.id, name: n.name, role: n.role, lines: n.lines || ['안녕하세요!'], set: Sprites.npcs[n.look],
        x: n.tx * World.TILE + World.TILE / 2, y: n.ty * World.TILE + 13,
        dir: 'down', phase: Math.random() * 4,
      });
    }
  }

  function update(dt, player) {
    for (const n of entities) {
      n.phase += dt;
      const dx = player.x - n.x, dy = player.y - n.y;
      if (Math.hypot(dx, dy) < LOOK_RANGE) {
        n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      } else {
        n.dir = 'down';
      }
    }
  }

  function clear() {
    entities.length = 0;
  }

  return { entities, init, update, clear };
})();
