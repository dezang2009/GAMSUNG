// 게임 루프: 장소 이동(마을/탐험 필드), 플레이어 이동/충돌, 카메라, 렌더링
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const field = document.getElementById('field');

  const SPEED = 46;                  // 최대 이동 속도 (논리 픽셀/초)
  const HALF_W = 3;                  // 발 판정 박스 반너비
  const HEIGHT_FEET = 3;             // 발 판정 박스 높이
  const BG = '#7fbf63';

  const view = { w: 0, h: 0, zoom: 1, sx: 1, sy: 1, dpr: 1 }; // sx, sy: 논리 픽셀 -> 실제 기기 픽셀 배율
  const cam = { x: 0, y: 0 };
  const player = { x: 0, y: 0, vx: 0, vy: 0, dir: 'down', walkT: 0, frame: 2 };

  let running = false;
  let paused = false;     // 메뉴 화면/대화가 열려 있는 동안 월드 갱신을 멈춘다
  const pauseLocks = new Set();
  let target = null;      // 지금 상호작용할 수 있는 NPC
  const INTERACT_RANGE = 28;
  let region = null;      // 지금 있는 장소(마을 또는 탐험 필드)
  let lastTrigger = null; // 직전에 밟고 있던 트리거 (들어올 때 한 번만 발동)
  let rafId = 0;
  let last = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mapW = () => World.COLS * World.TILE;
  const mapH = () => World.ROWS * World.TILE;

  // ---------- 화면 크기 ----------
  // 논리 해상도는 정수 배율로 맞추고, 캔버스 백버퍼는 기기 픽셀 단위로 만든다.
  // 이렇게 하면 이동을 기기 픽셀 단위로 표현할 수 있어 대각선에서도 끊김이 줄어든다.
  function fit() {
    // 탐험 필드 영역을 기준으로 화면 크기를 계산한다 (하단 메뉴 영역은 제외)
    const cw = field.clientWidth, ch = field.clientHeight;
    if (!cw || !ch) return;
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.zoom = Math.max(1, Math.min(Math.floor(cw / 160), Math.floor(ch / 140)));
    view.w = Math.floor(cw / view.zoom);
    view.h = Math.floor(ch / view.zoom);
    const cssW = view.w * view.zoom, cssH = view.h * view.zoom;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    view.sx = canvas.width / view.w;
    view.sy = canvas.height / view.h;
    if (running) updateCamera();
  }

  // ---------- 카메라 ----------
  // 보간 없이 플레이어를 그대로 따라가므로 플레이어의 화면 위치가 항상 일정하다.
  // 맵 경계에서만 카메라가 멈추고 그때는 플레이어가 움직인다.
  function updateCamera() {
    const tx = player.x - view.w / 2;
    const ty = player.y - 8 - view.h / 2;
    cam.x = mapW() <= view.w ? (mapW() - view.w) / 2 : clamp(tx, 0, mapW() - view.w);
    cam.y = mapH() <= view.h ? (mapH() - view.h) / 2 : clamp(ty, 0, mapH() - view.h);
  }

  // ---------- 이동 / 충돌 ----------
  // 한 축으로 이동. 0.5px 이하 단위로 나눠 전진하며, 막히면 그 축 속도만 0으로 만든다
  function moveAxis(axis, delta) {
    if (delta === 0) return;
    const steps = Math.ceil(Math.abs(delta) / 0.5);
    const s = delta / steps;
    for (let i = 0; i < steps; i++) {
      const nx = axis === 'x' ? player.x + s : player.x;
      const ny = axis === 'y' ? player.y + s : player.y;
      if (World.blocked(nx - HALF_W, ny - HEIGHT_FEET, nx + HALF_W, ny + 1) ||
          Monsters.blocksPlayer(nx, ny, player.x, player.y)) {
        if (axis === 'x') player.vx = 0; else player.vy = 0;
        return;
      }
      player.x = nx;
      player.y = ny;
    }
  }

  function update(dt) {
    const inp = Input.get();
    const tvx = inp.active ? inp.x * SPEED : 0;
    const tvy = inp.active ? inp.y * SPEED : 0;

    // 가속/감속을 나눠 부드럽게 움직이고 멈춘다
    const k = 1 - Math.exp(-dt * (inp.active ? 16 : 24));
    player.vx += (tvx - player.vx) * k;
    player.vy += (tvy - player.vy) * k;
    if (Math.abs(player.vx) < 0.01) player.vx = 0;
    if (Math.abs(player.vy) < 0.01) player.vy = 0;

    moveAxis('x', player.vx * dt);
    moveAxis('y', player.vy * dt);

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 4) {
      if (Math.abs(player.vx) > Math.abs(player.vy)) player.dir = player.vx > 0 ? 'right' : 'left';
      else player.dir = player.vy > 0 ? 'down' : 'up';
      player.walkT += dt * speed * 0.1;
      player.frame = Math.floor(player.walkT) % 2;
    } else {
      player.walkT = 0;
      player.frame = 2;
    }
  }

  // ---------- 렌더링 ----------
  const snapX = (v) => Math.round(v * view.sx) / view.sx;
  const snapY = (v) => Math.round(v * view.sy) / view.sy;

  function render() {
    ctx.setTransform(view.sx, 0, 0, view.sy, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, view.w, view.h);

    // 월드는 기기 픽셀 단위로 맞춘 카메라 값 하나로 모두 그린다
    const ox = snapX(cam.x), oy = snapY(cam.y);
    if (World.ground) ctx.drawImage(World.ground, -ox, -oy);

    // 플레이어/몬스터는 카메라와 같은 원본 좌표 차이로 그려 화면 위치가 흔들리지 않는다
    const dyn = [{ y: player.y, draw: drawPlayer }];
    for (const m of Monsters.entities) dyn.push({ y: m.y, draw: () => drawMonster(m) });
    for (const n of Npcs.entities) dyn.push({ y: n.y, draw: () => drawNpc(n) });
    dyn.sort((a, b) => a.y - b.y);

    // 오브젝트(baseY)와 움직이는 개체(발 위치 y)를 깊이 순서대로 섞어 그린다
    let di = 0;
    for (const o of World.objects) {
      while (di < dyn.length && dyn[di].y < o.baseY) dyn[di++].draw();
      const sx = o.x - ox, sy = o.y - oy;
      if (sx > view.w || sy > view.h || sx + o.w < 0 || sy + o.h < 0) continue;
      ctx.drawImage(o.img, sx, sy);
    }
    while (di < dyn.length) dyn[di++].draw();

    drawLabels();
  }

  function drawPlayer() {
    const img = Sprites.player[player.dir][player.frame];
    ctx.drawImage(img, snapX(player.x - 7 - cam.x), snapY(player.y - 17 - cam.y));
  }

  // NPC: 가만히 서서 1px 씩 숨 쉬듯 위아래로 움직인다
  function drawNpc(n) {
    const img = n.set[n.dir][2];
    const bob = Math.floor(n.phase * 1.6) % 2;
    ctx.drawImage(img, snapX(n.x - 7 - cam.x), snapY(n.y - 17 - bob - cam.y));
  }

  function drawMonster(m) {
    const set = Sprites.monsters[m.def.sprite];
    const img = (m.dir < 0 ? set.left : set.right)[m.frame];
    const x = snapX(m.x - img.width / 2 - cam.x);
    const y = snapY(m.y - (img.height - 1) - cam.y);
    const rarity = MonsterRarities[m.def.rarity];

    ctx.globalAlpha = Math.max(0, m.fade);
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;

    if (rarity.sparkle && !m.fading) {
      // 희귀 몬스터 주변에서 반짝이는 빛
      const t = performance.now() / 1000;
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        const px = x + img.width / 2 + Math.cos(a) * (img.width * 0.65);
        const py = y + img.height / 2 + Math.sin(a * 1.3) * (img.height * 0.55);
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6 + i * 2);
        ctx.fillStyle = i === 1 ? '#ffffff' : '#ffd84a';
        ctx.fillRect(snapX(px), snapY(py), 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    if (m.alert > 0) {
      ctx.drawImage(Sprites.alert, snapX(x + img.width - 2), snapY(y - 8));
    }
  }

  // 이름표: 기기 해상도로 그린 깔끔한 알약 모양. 멀어지면 서서히 사라진다
  const LABEL_FULL = 80, LABEL_HIDE = 115;
  const FONT = '"Paperlogy", "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';
  function pill(x, y, w, h) {
    const r = Math.min(h / 2, 5 * view.dpr); // 알약보다 각진 작은 라벨
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // 이름표 목록(몬스터/NPC/건물)을 모아 한 번에 그린다. 멀어지면 서서히 사라진다
  function collectLabels() {
    const out = [];
    const px = player.x, py = player.y;
    for (const m of Monsters.entities) {
      const d = Math.hypot(m.x - px, m.y - py);
      if (d >= LABEL_HIDE) continue;
      const rarity = MonsterRarities[m.def.rarity];
      const img = Sprites.monsters[m.def.sprite].right[0];
      out.push({
        text: (rarity.mark ? rarity.mark + ' ' : '') + m.def.name, color: rarity.pillColor,
        x: m.x, y: m.y - (img.height - 1), alpha: fade(d, LABEL_FULL, LABEL_HIDE) * Math.max(0, m.fade),
      });
    }
    for (const n of Npcs.entities) {
      const d = Math.hypot(n.x - px, n.y - py);
      if (d >= LABEL_HIDE + 20) continue;
      out.push({ text: n.name, color: 'rgba(36, 92, 76, 0.92)', x: n.x, y: n.y - 17, alpha: fade(d, LABEL_FULL + 20, LABEL_HIDE + 20), talk: n === target });
    }
    for (const o of World.objects) {
      if (!o.label) continue;
      const d = Math.hypot(o.label.cx - px, o.baseY - py);
      if (d >= 190) continue;
      out.push({ text: o.label.text, color: 'rgba(54, 48, 40, 0.88)', x: o.label.cx, y: o.label.y, alpha: fade(d, 120, 190) });
    }
    return out;
  }

  const fade = (d, full, hide) => Math.max(0, Math.min(1, (hide - d) / (hide - full)));

  // 대화 가능한 NPC 머리 위의 말풍선 표시 (위아래로 살짝 떠다닌다)
  function drawTalkMark(cx, bottom, d0) {
    const bob = Math.sin(performance.now() / 220) * 2 * d0;
    const w = 24 * d0, h = 16 * d0, x = cx - w / 2, y = bottom - h - bob;
    ctx.fillStyle = '#ffffff';
    pill(x, y, w, h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 3 * d0, y + h - 1);
    ctx.lineTo(cx, y + h + 4 * d0);
    ctx.lineTo(cx + 3 * d0, y + h - 1);
    ctx.fill();
    ctx.fillStyle = '#2f6f5a';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 6 * d0, y + h / 2, 1.8 * d0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLabels() {
    const d0 = view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `700 ${Math.round(10.5 * d0)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of collectLabels()) {
      if (l.alpha <= 0) continue;
      const cx = snapX(l.x - cam.x) * view.sx;
      const bottom = snapY(l.y - cam.y) * view.sy - 3 * d0;
      const h = 16 * d0, w = ctx.measureText(l.text).width + 12 * d0;
      ctx.globalAlpha = l.alpha;
      ctx.fillStyle = l.color;
      pill(cx - w / 2, bottom - h, w, h);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(l.text, cx, bottom - h / 2 + 0.5 * d0);
      if (l.talk) drawTalkMark(cx, bottom - h - 3 * d0, d0);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!running || paused) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    updateCamera();
    Monsters.update(dt, player, { x: cam.x, y: cam.y, w: view.w, h: view.h });
    Npcs.update(dt, player);
    checkTrigger();
    updateTarget();
    render();
    rafId = requestAnimationFrame(frame);
  }

  // 가장 가까운 NPC 가 상호작용 범위 안이면 대상으로 삼고, 바뀔 때만 이벤트를 보낸다
  function setTarget(t) {
    if (target === t) return;
    target = t;
    Events.emit('interact:target', t ? { kind: 'npc', npc: t } : null);
  }

  function updateTarget() {
    let best = null, bestD = INTERACT_RANGE;
    for (const n of Npcs.entities) {
      const d = Math.hypot(n.x - player.x, n.y - player.y);
      if (d < bestD) { best = n; bestD = d; }
    }
    setTarget(best);
  }

  // 트리거 영역(마을 게이트 등)에 새로 들어서면 이벤트를 보낸다
  function checkTrigger() {
    const t = World.triggerAt(player.x, player.y);
    const id = t ? t.id : null;
    if (id !== lastTrigger) {
      lastTrigger = id;
      if (t) Events.emit('trigger', t);
    }
  }

  // ---------- 장소 이동 (마을 <-> 탐험 필드) ----------
  function enterRegion(r) {
    region = r;
    World.load(r);
    player.x = r.spawn.tx * World.TILE + World.TILE / 2;
    player.y = r.spawn.ty * World.TILE + 12;
    player.vx = 0;
    player.vy = 0;
    player.dir = 'down';
    player.walkT = 0;
    player.frame = 2;
    lastTrigger = null;
    setTarget(null);
    Input.reset();
    Screens.close();
    Dialog.close();
    pauseLocks.clear();
    paused = false;

    GameState.patch('location', { id: r.id, name: r.name, type: r.type || 'field' });
    running = true;
    fit();
    updateCamera();
    const rect = { x: cam.x, y: cam.y, w: view.w, h: view.h };
    Npcs.init(r);
    if (r.monsters) Monsters.init(r, player, rect); else Monsters.clear();
    last = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  // 메뉴 화면이나 대화가 열리면 월드(플레이어/몬스터/NPC/카메라)를 그대로 멈추고, 모두 닫히면 이어서 진행한다
  function setPauseLock(name, on) {
    if (on) pauseLocks.add(name); else pauseLocks.delete(name);
    const p = pauseLocks.size > 0;
    if (paused === p) return;
    paused = p;
    cancelAnimationFrame(rafId);
    Input.setEnabled(!p);
    if (p) {
      setTarget(null);
      if (running) render(); // 대화 표시(말풍선)를 지운 모습으로 한 번 다시 그린다
    } else if (running) {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }
  Screens.onChange((id) => {
    if (id && Dialog.isOpen()) Dialog.close();
    setPauseLock('screen', !!id);
  });
  Dialog.onChange((open) => setPauseLock('dialog', open));

  if (document.fonts) document.fonts.load('700 11px Paperlogy'); // 이름표용 폰트 미리 불러오기

  // 다른 화면은 이벤트로만 장소 이동/게이트 진입을 알려 온다
  Events.on('location:request', ({ id }) => {
    const r = Regions.find((x) => x.id === id);
    if (r && !r.locked) enterRegion(r);
  });
  Events.on('trigger', (t) => {
    if (t.action === 'explore') Screens.open('explore');
  });

  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(field);

  // 시작: 마을에서 출발
  Game.init();
  enterRegion(Regions[0]);

  // 테스트용 참조
  window.__game = { player, cam, view, World, Monsters, Npcs, GameState, enterRegion };
})();
