// 게임 루프: 탐험지 선택/입장, 플레이어 이동/충돌, 카메라, 렌더링
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hudName = document.getElementById('hud-name');

  const SPEED = 46;                  // 최대 이동 속도 (논리 픽셀/초)
  const HALF_W = 3;                  // 발 판정 박스 반너비
  const HEIGHT_FEET = 3;             // 발 판정 박스 높이
  const BG = '#1c2b1f';

  const view = { w: 0, h: 0, zoom: 1, sx: 1, sy: 1 }; // sx, sy: 논리 픽셀 -> 실제 기기 픽셀 배율
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
      if (World.blocked(nx - HALF_W, ny - HEIGHT_FEET, nx + HALF_W, ny + 1)) {
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

    // 플레이어는 카메라와 같은 원본 좌표 차이로 그려 화면 위치가 흔들리지 않는다
    const img = Sprites.player[player.dir][player.frame];
    const psx = snapX(player.x - 7 - cam.x);
    const psy = snapY(player.y - 17 - cam.y);

    // 오브젝트는 기준선(baseY) 순서로 그리고, 플레이어와 깊이 순서를 맞춘다
    let playerDrawn = false;
    for (const o of World.objects) {
      if (!playerDrawn && o.baseY > player.y) {
        ctx.drawImage(img, psx, psy);
        playerDrawn = true;
      }
      const sx = o.x - ox, sy = o.y - oy;
      if (sx > view.w || sy > view.h || sx + o.w < 0 || sy + o.h < 0) continue;
      ctx.drawImage(o.img, sx, sy);
    }
    if (!playerDrawn) ctx.drawImage(img, psx, psy);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    updateCamera();
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
    last = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function exitRegion() {
    running = false;
    cancelAnimationFrame(rafId);
    Input.reset();
    document.body.dataset.screen = 'menu';
  }

  // ---------- 선택 화면 ----------
  function makeThumb(region) {
    const c = document.createElement('canvas');
    c.className = 'thumb';
    c.width = 48;
    c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = region.color;
    g.fillRect(0, 0, 48, 48);
    if (!region.locked && region.thumb) {
      region.thumb.forEach((key, i) => {
        const s = Sprites[key][0];
        g.drawImage(s, 3 + i * 22, 48 - s.height - 2 - (i % 2) * 2);
      });
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
  window.__game = { player, cam, view, World, enterRegion, exitRegion };
})();
