// 필드 몬스터: 출현 / 소멸 / 행동(대기·배회·추적·복귀) / 충돌
const Monsters = (() => {
  const HALF_W = 4;          // 몬스터 발 판정 박스
  const FEET_H = 3;
  const R_PLAYER = 10;       // 플레이어와 유지할 최소 간격
  const R_MONSTER = 9;       // 몬스터끼리 유지할 최소 간격
  const STOP_DIST = 13;      // 추적 중 이 거리 안이면 멈춘다
  const FADE_TIME = 0.8;

  const entities = [];
  let region = null;
  let rules = null;
  let respawnTimer = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function defsFor() {
    return MonsterData.filter((d) => d.regions.includes(region.id));
  }

  function countOf(id) {
    let n = 0;
    for (const m of entities) if (m.def.id === id) n++;
    return n;
  }

  // 출현 확률(spawnChance)에 따라 몬스터 종류를 뽑는다. 최대 수에 찬 종류는 제외
  function rollDef() {
    const c = defsFor().filter((d) => countOf(d.id) < d.maxCount);
    const total = c.reduce((sum, d) => sum + d.spawnChance, 0);
    if (!total) return null;
    let r = Math.random() * total;
    for (const d of c) {
      r -= d.spawnChance;
      if (r <= 0) return d;
    }
    return c[c.length - 1];
  }

  const inRect = (x, y, rect, margin) =>
    x > rect.x - margin && x < rect.x + rect.w + margin &&
    y > rect.y - margin && y < rect.y + rect.h + margin;

  // 화면 밖이고 플레이어와 충분히 떨어졌으며 장애물이 없는 자리를 찾는다
  function findSpawnPoint(player, rect) {
    for (let i = 0; i < 60; i++) {
      const tx = 3 + Math.floor(Math.random() * (World.COLS - 6));
      const ty = 3 + Math.floor(Math.random() * (World.ROWS - 6));
      const x = tx * World.TILE + 8, y = ty * World.TILE + 12;
      if (World.blocked(x - HALF_W - 3, y - FEET_H - 3, x + HALF_W + 3, y + 4)) continue;
      if (inRect(x, y, rect, 32)) continue;
      if (dist(x, y, player.x, player.y) < rules.minSpawnDist) continue;
      if (entities.some((m) => dist(x, y, m.x, m.y) < 24)) continue;
      return { x, y };
    }
    return null;
  }

  function spawnOne(player, rect) {
    if (entities.length >= rules.target) return false;
    const def = rollDef();
    if (!def) return false;
    const pt = findSpawnPoint(player, rect);
    if (!pt) return false;
    const life = def.lifetime || rules.lifetime;
    entities.push({
      def, x: pt.x, y: pt.y, home: { x: pt.x, y: pt.y },
      state: 'idle', timer: rnd(0.5, 2.5), tx: 0, ty: 0, wanderT: 0,
      dir: Math.random() < 0.5 ? 1 : -1, animT: Math.random() * 3, frame: 0, moving: false,
      life: rnd(life[0], life[1]), fading: false, fade: 1, alert: 0, dead: false,
    });
    return true;
  }

  function tryMove(m, nx, ny, player) {
    if (World.blocked(nx - HALF_W, ny - FEET_H, nx + HALF_W, ny + 1)) return false;
    const dOld = dist(m.x, m.y, player.x, player.y);
    const dNew = dist(nx, ny, player.x, player.y);
    if (dNew < R_PLAYER && dNew < dOld) return false;
    for (const o of entities) {
      if (o === m) continue;
      const a = dist(m.x, m.y, o.x, o.y), b = dist(nx, ny, o.x, o.y);
      if (b < R_MONSTER && b < a) return false;
    }
    m.x = nx;
    m.y = ny;
    return true;
  }

  // 목표 지점으로 이동. 축을 나눠 이동하므로 장애물에 닿아도 벽을 따라 미끄러진다
  function moveToward(m, tx, ty, speed, dt, player) {
    const dx = tx - m.x, dy = ty - m.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return false;
    const vx = (dx / d) * speed * dt, vy = (dy / d) * speed * dt;
    let moved = false;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)) / 0.5));
    for (let i = 0; i < steps; i++) {
      if (tryMove(m, m.x + vx / steps, m.y, player)) moved = true;
      if (tryMove(m, m.x, m.y + vy / steps, player)) moved = true;
    }
    if (Math.abs(dx) > 0.5) m.dir = dx > 0 ? 1 : -1;
    return moved;
  }

  function pickWander(m) {
    const radius = m.def.wanderRadius || 40;
    const a = Math.random() * Math.PI * 2;
    const r = rnd(12, radius);
    const tx = m.home.x + Math.cos(a) * r, ty = m.home.y + Math.sin(a) * r;
    if (World.blocked(tx - HALF_W, ty - FEET_H, tx + HALF_W, ty + 1)) return false;
    m.tx = tx;
    m.ty = ty;
    m.wanderT = 3;
    m.state = 'wander';
    return true;
  }

  function updateMonster(m, dt, player, rect) {
    const def = m.def;
    m.alert = Math.max(0, m.alert - dt);
    m.animT += dt;

    if (m.fading) {
      m.fade -= dt / FADE_TIME;
      if (m.fade <= 0) m.dead = true;
      return;
    }

    const d = dist(m.x, m.y, player.x, player.y);

    // 감지 / 추적 해제
    if (m.state !== 'chase' && d < def.detectRange) {
      m.state = 'chase';
      m.alert = 0.8;
    } else if (m.state === 'chase' && d > def.detectRange * 1.5) {
      m.state = 'return';
    }

    let moved = false;
    if (m.state === 'chase') {
      if (d > STOP_DIST) moved = moveToward(m, player.x, player.y, def.moveSpeed, dt, player);
      else if (Math.abs(player.x - m.x) > 0.5) m.dir = player.x > m.x ? 1 : -1;
    } else if (m.state === 'return') {
      if (dist(m.x, m.y, m.home.x, m.home.y) < 3) {
        m.state = 'idle';
        m.timer = rnd(1, 2);
      } else {
        moved = moveToward(m, m.home.x, m.home.y, def.moveSpeed * 0.7, dt, player);
      }
    } else if (m.state === 'wander') {
      m.wanderT -= dt;
      if (m.wanderT <= 0 || dist(m.x, m.y, m.tx, m.ty) < 2) {
        m.state = 'idle';
        m.timer = rnd(1, 3);
      } else {
        moved = moveToward(m, m.tx, m.ty, def.moveSpeed * 0.45, dt, player);
      }
    } else {
      m.timer -= dt;
      if (m.timer <= 0 && !pickWander(m)) m.timer = rnd(1, 2);
    }

    m.moving = moved;
    m.frame = Math.floor(m.animT * (moved ? 6 : 2)) % 2;

    // 수명이 다하면 사라진다: 화면 밖이면 바로, 화면 안이면 서서히 투명해진다
    m.life -= dt;
    if (m.life <= 0 && m.state !== 'chase') {
      if (inRect(m.x, m.y, rect, 24)) m.fading = true;
      else m.dead = true;
    }
  }

  function update(dt, player, rect) {
    if (!rules) return; // 몬스터가 없는 장소(마을)
    // 비어 있으면 일정 시간 뒤에 새 몬스터 출현
    if (entities.length >= rules.target) {
      respawnTimer = rnd(rules.respawn[0], rules.respawn[1]);
    } else {
      respawnTimer -= dt;
      if (respawnTimer <= 0) {
        respawnTimer = spawnOne(player, rect) ? rnd(rules.respawn[0], rules.respawn[1]) : 1.5;
      }
    }
    for (const m of entities) updateMonster(m, dt, player, rect);
    for (let i = entities.length - 1; i >= 0; i--) if (entities[i].dead) entities.splice(i, 1);
  }

  // 플레이어가 몬스터 쪽으로 파고드는 이동인지 확인
  function blocksPlayer(nx, ny, px, py) {
    for (const m of entities) {
      if (m.fading) continue;
      const dNew = dist(nx, ny, m.x, m.y);
      if (dNew < R_PLAYER && dNew < dist(px, py, m.x, m.y)) return true;
    }
    return false;
  }

  function init(reg, player, rect) {
    region = reg;
    rules = reg.monsters;
    entities.length = 0;
    respawnTimer = rnd(rules.respawn[0], rules.respawn[1]);
    for (let i = 0; i < rules.target; i++) spawnOne(player, rect);
  }

  function clear() {
    entities.length = 0;
    rules = null;
  }

  return { entities, init, clear, update, blocksPlayer, rollDef };
})();
