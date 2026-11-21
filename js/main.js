// 게임 루프: 플레이어 이동/충돌, 카메라, 렌더링
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const SPEED = 46;                  // 최대 이동 속도 (논리 픽셀/초)
  const HALF_W = 3;                  // 발 판정 박스 반너비
  const HEIGHT_FEET = 3;             // 발 판정 박스 높이
  const BG = '#1c2b1f';
  const MAP_W = World.COLS * World.TILE;
  const MAP_H = World.ROWS * World.TILE;

  const view = { w: 0, h: 0, zoom: 1 };
  const cam = { x: 0, y: 0 };
  const player = {
    x: World.SPAWN.tx * World.TILE + World.TILE / 2,
    y: World.SPAWN.ty * World.TILE + 12,   // 발 위치(스프라이트 하단)
    vx: 0, vy: 0,
    dir: 'down',
    walkT: 0,
    frame: 2,                              // 0,1: 걷기 / 2: 정지
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // 화면 크기에 맞춰 정수 배율로 확대하고, 논리 해상도를 다시 계산
  function fit() {
    const cw = window.innerWidth, ch = window.innerHeight;
    view.zoom = Math.max(1, Math.min(Math.floor(cw / 160), Math.floor(ch / 200)));
    view.w = Math.floor(cw / view.zoom);
    view.h = Math.floor(ch / view.zoom);
    canvas.width = view.w;
    canvas.height = view.h;
    canvas.style.width = view.w * view.zoom + 'px';
    canvas.style.height = view.h * view.zoom + 'px';
    ctx.imageSmoothingEnabled = false;
    Object.assign(cam, cameraTarget());
  }

  // 플레이어를 중심에 두되, 맵 밖은 보이지 않도록 제한
  function cameraTarget() {
    const tx = player.x - view.w / 2;
    const ty = player.y - 8 - view.h / 2;
    return {
      x: MAP_W <= view.w ? (MAP_W - view.w) / 2 : clamp(tx, 0, MAP_W - view.w),
      y: MAP_H <= view.h ? (MAP_H - view.h) / 2 : clamp(ty, 0, MAP_H - view.h),
    };
  }

  function updateCamera(dt) {
    const t = cameraTarget();
    const k = 1 - Math.exp(-dt * 9);
    cam.x += (t.x - cam.x) * k;
    cam.y += (t.y - cam.y) * k;
  }

  // 한 축으로 이동. 1px 이하 단위로 나눠 전진하며, 막히면 그 축 속도만 0으로 만든다
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

  function drawPlayer(ox, oy) {
    const img = Sprites.player[player.dir][player.frame];
    ctx.drawImage(img, Math.round(player.x) - 7 - ox, Math.round(player.y) - 17 - oy);
  }

  function render() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, view.w, view.h);

    const ox = Math.round(cam.x), oy = Math.round(cam.y);
    if (World.ground) ctx.drawImage(World.ground, -ox, -oy);

    // 오브젝트는 기준선(baseY) 순서로 그리고, 플레이어와 깊이 순서를 맞춘다
    let playerDrawn = false;
    for (const o of World.objects) {
      if (!playerDrawn && o.baseY > player.y) {
        drawPlayer(ox, oy);
        playerDrawn = true;
      }
      const sx = Math.round(o.x - ox), sy = Math.round(o.y - oy);
      if (sx > view.w || sy > view.h || sx + o.w < 0 || sy + o.h < 0) continue;
      ctx.drawImage(o.img, sx, sy);
    }
    if (!playerDrawn) drawPlayer(ox, oy);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    updateCamera(dt);
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', fit);
  fit();
  requestAnimationFrame(frame);

  // 테스트용 참조
  window.__game = { player, cam, view, World };
})();
