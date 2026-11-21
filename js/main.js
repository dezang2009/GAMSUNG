// 게임 루프: 탐험지 선택/입장, 플레이어 이동/충돌, 카메라, 렌더링
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hudName = document.getElementById('hud-name');

  const SPEED = 46;                  // 최대 이동 속도 (논리 픽셀/초)
  const HALF_W = 3;                  // 발 판정 박스 반너비
  const HEIGHT_FEET = 3;             // 발 판정 박스 높이
  const BG = '#1c2b1f';

  const view = { w: 0, h: 0, zoom: 1, sx: 1, sy: 1, dpr: 1 }; // sx, sy: 논리 픽셀 -> 실제 기기 픽셀 배율
  const cam = { x: 0, y: 0 };
  const player = { x: 0, y: 0, vx: 0, vy: 0, dir: 'down', walkT: 0, frame: 2 };

  let running = false;
  let rafId = 0;
  let last = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mapW = () => World.COLS * World.TILE;
  const mapH = () => World.ROWS * World.TILE;

  // ---------- 화면 크기 ----------
  // 논리 해상도는 정수 배율로 맞추고, 캔버스 백버퍼는 기기 픽셀 단위로 만든다.
  // 이렇게 하면 이동을 기기 픽셀 단위로 표현할 수 있어 대각선에서도 끊김이 줄어든다.
  function fit() {
    const cw = window.innerWidth, ch = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.zoom = Math.max(1, Math.min(Math.floor(cw / 160), Math.floor(ch / 200)));
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

    drawMonsterLabels();
  }

  function drawPlayer() {
    const img = Sprites.player[player.dir][player.frame];
    ctx.drawImage(img, snapX(player.x - 7 - cam.x), snapY(player.y - 17 - cam.y));
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
  const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';
  function pill(x, y, w, h) {
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawMonsterLabels() {
    const d0 = view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `700 ${Math.round(11 * d0)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of Monsters.entities) {
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d >= LABEL_HIDE) continue;
      const rarity = MonsterRarities[m.def.rarity];
      const img = Sprites.monsters[m.def.sprite].right[0];
      const cx = snapX(m.x - cam.x) * view.sx;
      const bottom = snapY(m.y - (img.height - 1) - cam.y) * view.sy - 3 * d0;
      const text = (rarity.mark ? rarity.mark + ' ' : '') + m.def.name;
      const h = 18 * d0, w = ctx.measureText(text).width + 16 * d0;
      ctx.globalAlpha = Math.min(1, (LABEL_HIDE - d) / (LABEL_HIDE - LABEL_FULL)) * Math.max(0, m.fade);
      ctx.fillStyle = rarity.pillColor;
      pill(cx - w / 2, bottom - h, w, h);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, cx, bottom - h / 2 + 0.5 * d0);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    updateCamera();
    Monsters.update(dt, player, { x: cam.x, y: cam.y, w: view.w, h: view.h });
    render();
    rafId = requestAnimationFrame(frame);
  }

  // ---------- 탐험지 입장 / 나가기 ----------
  function enterRegion(region) {
    World.load(region);
    player.x = region.spawn.tx * World.TILE + World.TILE / 2;
    player.y = region.spawn.ty * World.TILE + 12;
    player.vx = 0;
    player.vy = 0;
    player.dir = 'down';
    player.walkT = 0;
    player.frame = 2;
    Input.reset();

    hudName.textContent = region.name;
    document.body.dataset.screen = 'play';
    running = true;
    fit();
    updateCamera();
    Monsters.init(region, player, { x: cam.x, y: cam.y, w: view.w, h: view.h });
    last = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function exitRegion() {
    running = false;
    cancelAnimationFrame(rafId);
    Monsters.clear();
    Input.reset();
    document.body.dataset.screen = 'menu';
  }

  // ---------- 선택 화면 ----------
  function resolveSprite(key, i) {
    let o = Sprites;
    for (const part of key.split('.')) o = o[part];
    return o.right ? o.right[i] : o[i];
  }

  // 지역 카드 썸네일: 잔디 바탕에 지역 대표 오브젝트를 배치 (잠긴 지역은 자물쇠)
  function makeThumb(region) {
    const c = document.createElement('canvas');
    c.className = 'thumb';
    c.width = 44;
    c.height = 44;
    const g = c.getContext('2d');
    g.drawImage(Sprites.makeGrassPattern(44, 44), 0, 0);
    if (region.locked) {
      g.fillStyle = '#e6e9f0';
      g.fillRect(0, 0, 44, 44);
      const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      r(15, 12, 14, 4, '#a2a8b5'); r(15, 12, 4, 12, '#a2a8b5'); r(25, 12, 4, 12, '#a2a8b5');
      r(16, 13, 2, 11, '#f6f7fb'); r(26, 13, 2, 11, '#f6f7fb'); r(16, 13, 12, 2, '#f6f7fb');
      r(11, 22, 22, 15, '#a2a8b5'); r(12, 23, 20, 13, '#c9cfdb'); r(12, 33, 20, 3, '#b3bac9');
      r(21, 27, 2, 5, '#8a91a1');
    } else {
      for (const [key, i, x, y] of region.thumb || []) g.drawImage(resolveSprite(key, i), x, y);
    }
    return c;
  }

  function buildMenu() {
    const list = document.getElementById('region-list');
    for (const region of Regions) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'region-card' + (region.locked ? ' locked' : '');
      btn.disabled = !!region.locked;

      const text = document.createElement('div');
      text.innerHTML = '<h2></h2><p></p><span class="badge"></span>';
      text.querySelector('h2').textContent = region.name;
      text.querySelector('p').textContent = region.desc;
      text.querySelector('.badge').textContent = region.locked ? '준비 중' : '입장 가능';

      btn.append(makeThumb(region), text);
      if (!region.locked) btn.addEventListener('click', () => enterRegion(region));
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  document.getElementById('exit-btn').addEventListener('click', exitRegion);
  window.addEventListener('resize', fit);
  buildMenu();

  // 테스트용 참조
  window.__game = { player, cam, view, World, Monsters, enterRegion, exitRegion };
})();
