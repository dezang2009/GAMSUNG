// 타일 기반 탐험 맵: 지형 생성, 장애물 배치, 바닥 렌더링, 충돌 판정
const World = (() => {
  const TILE = 16;
  const COLS = 60;
  const ROWS = 60;
  const SPAWN = { tx: 30, ty: 54 };

  const GRASS = 0;
  const PATH = 1;
  const TALL = 2; // 걸을 수 있는 풀숲

  const GRASS_C = [[108, 186, 76], [100, 178, 70], [122, 200, 90], [86, 160, 62]];
  const TALL_C = [[78, 150, 56], [70, 140, 50]];
  const TALL_BLADE = [104, 180, 74];
  const PATH_C = [[218, 188, 126], [208, 176, 114], [226, 202, 146], [190, 156, 100]];
  const FLOWER_COLORS = ['#fff6e0', '#ffd84a', '#ff8fb1', '#b3a6ff'];

  const kind = new Uint8Array(COLS * ROWS);
  const solid = new Uint8Array(COLS * ROWS);
  const objects = [];
  const flowers = [];
  let ground = null;

  const idx = (tx, ty) => ty * COLS + tx;
  const inMap = (tx, ty) => tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;

  // 같은 시드면 항상 같은 맵이 나오는 난수기 (mulberry32)
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260);

  function hash(x, y, s) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function nearSpawn(tx, ty) {
    return Math.hypot(tx - SPAWN.tx, ty - SPAWN.ty) <= 4;
  }

  function canPlace(tx, ty) {
    return inMap(tx, ty) && kind[idx(tx, ty)] !== PATH && !solid[idx(tx, ty)] && !nearSpawn(tx, ty);
  }

  function addObject(img, x, y, shadow, tx, ty) {
    solid[idx(tx, ty)] = 1;
    objects.push({ img, x, y, w: img.width, h: img.height, baseY: (ty + 1) * TILE, shadow });
  }

  function placeTree(tx, ty) {
    const img = Sprites.trees[Math.floor(rand() * Sprites.trees.length)];
    const cx = tx * TILE + TILE / 2;
    const by = (ty + 1) * TILE;
    addObject(img, cx - img.width / 2, by - 26, { cx, cy: by - 2, rx: 7, ry: 3 }, tx, ty);
  }

  function placeRock(tx, ty) {
    const img = Sprites.rocks[Math.floor(rand() * Sprites.rocks.length)];
    const cx = tx * TILE + TILE / 2;
    const by = (ty + 1) * TILE;
    addObject(img, tx * TILE, by - 12, { cx, cy: by - 2, rx: 6, ry: 2.5 }, tx, ty);
  }

  function placeBush(tx, ty) {
    const img = Sprites.bushes[Math.floor(rand() * Sprites.bushes.length)];
    const cx = tx * TILE + TILE / 2;
    const by = (ty + 1) * TILE;
    addObject(img, tx * TILE, by - 13, { cx, cy: by - 2, rx: 6, ry: 2.5 }, tx, ty);
  }

  // 길: 웨이포인트를 이어 폭 2타일로 파낸다 (중간점을 살짝 흔들어 자연스럽게)
  function setPath(x, y) {
    if (x > 1 && y > 1 && x < COLS - 2 && y < ROWS - 2) kind[idx(x, y)] = PATH;
  }
  function carve(ax, ay, bx, by) {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(ax + ((bx - ax) * i) / steps);
      const y = Math.round(ay + ((by - ay) * i) / steps);
      setPath(x, y); setPath(x + 1, y); setPath(x, y + 1); setPath(x + 1, y + 1);
    }
  }

  function generatePath() {
    const pts = [[30, 55], [30, 44], [15, 39], [15, 24], [30, 16], [45, 24], [45, 40], [30, 44]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const mx = Math.round((ax + bx) / 2 + rand() * 6 - 3);
      const my = Math.round((ay + by) / 2 + rand() * 6 - 3);
      carve(ax, ay, mx, my);
      carve(mx, my, bx, by);
    }
  }

  function generateObstacles() {
    // 맵 가장자리는 나무 벽
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const edge = tx < 2 || ty < 2 || tx >= COLS - 2 || ty >= ROWS - 2;
        if (edge && !solid[idx(tx, ty)]) placeTree(tx, ty);
      }
    }

    // 숲 덩어리
    for (let b = 0; b < 8; b++) {
      const cx = 5 + rand() * (COLS - 10);
      const cy = 5 + rand() * (ROWS - 10);
      const r = 3 + rand() * 3;
      for (let ty = Math.floor(cy - r - 1); ty <= cy + r + 1; ty++) {
        for (let tx = Math.floor(cx - r - 1); tx <= cx + r + 1; tx++) {
          if (Math.hypot(tx - cx, ty - cy) < r * (0.75 + rand() * 0.35) && canPlace(tx, ty) && rand() < 0.75) {
            placeTree(tx, ty);
          }
        }
      }
    }

    // 바위 무리
    for (let c = 0; c < 10; c++) {
      const cx = 3 + Math.floor(rand() * (COLS - 6));
      const cy = 3 + Math.floor(rand() * (ROWS - 6));
      const count = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const tx = cx + Math.floor(rand() * 3) - 1;
        const ty = cy + Math.floor(rand() * 3) - 1;
        if (canPlace(tx, ty)) placeRock(tx, ty);
      }
    }

    // 덤불
    for (let i = 0; i < 90; i++) {
      const tx = 2 + Math.floor(rand() * (COLS - 4));
      const ty = 2 + Math.floor(rand() * (ROWS - 4));
      if (canPlace(tx, ty) && kind[idx(tx, ty)] === GRASS) placeBush(tx, ty);
    }
  }

  function generateTallGrass() {
    for (let b = 0; b < 16; b++) {
      const cx = 3 + rand() * (COLS - 6);
      const cy = 3 + rand() * (ROWS - 6);
      const r = 2 + rand() * 2;
      for (let ty = Math.floor(cy - r); ty <= cy + r; ty++) {
        for (let tx = Math.floor(cx - r); tx <= cx + r; tx++) {
          if (!inMap(tx, ty) || solid[idx(tx, ty)] || kind[idx(tx, ty)] !== GRASS) continue;
          if (Math.hypot(tx - cx, ty - cy) < r && rand() < 0.85) kind[idx(tx, ty)] = TALL;
        }
      }
    }
  }

  function generateFlowers() {
    for (let i = 0; i < 160; i++) {
      const tx = Math.floor(rand() * COLS);
      const ty = Math.floor(rand() * ROWS);
      if (!inMap(tx, ty) || solid[idx(tx, ty)] || kind[idx(tx, ty)] !== GRASS) continue;
      flowers.push({
        x: tx * TILE + 3 + Math.floor(rand() * 10),
        y: ty * TILE + 3 + Math.floor(rand() * 10),
        c: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)],
      });
    }
  }

  // 길 타일 가장자리는 풀과 섞이도록 픽셀을 일부 풀색으로 바꾼다
  function edgeOfPath(tx, ty, lx, ly) {
    const isPath = (x, y) => !inMap(x, y) || kind[idx(x, y)] === PATH;
    return (lx < 2 && !isPath(tx - 1, ty)) || (lx > 13 && !isPath(tx + 1, ty)) ||
           (ly < 2 && !isPath(tx, ty - 1)) || (ly > 13 && !isPath(tx, ty + 1));
  }

  function renderGround() {
    const W = COLS * TILE, H = ROWS * TILE;
    const cvs = document.createElement('canvas');
    cvs.width = W;
    cvs.height = H;
    const g = cvs.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const tx = px >> 4, ty = py >> 4, lx = px & 15, ly = py & 15;
        let k = kind[idx(tx, ty)];
        if (k === PATH && edgeOfPath(tx, ty, lx, ly) && hash(px, py, 9) < 0.5) k = GRASS;

        let c;
        if (k === PATH) {
          const n = hash(px >> 1, py >> 1, 4);
          c = n < 0.55 ? PATH_C[0] : n < 0.8 ? PATH_C[1] : n < 0.92 ? PATH_C[2] : PATH_C[3];
        } else if (k === TALL) {
          c = hash(px >> 1, py >> 1, 6) < 0.6 ? TALL_C[0] : TALL_C[1];
          if (hash(px, py, 7) > 0.93) c = TALL_BLADE;
        } else {
          const n = hash(px >> 1, py >> 1, 3);
          c = n < 0.55 ? GRASS_C[0] : n < 0.8 ? GRASS_C[1] : n < 0.93 ? GRASS_C[2] : GRASS_C[3];
        }

        const i = (py * W + px) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);

    // 꽃
    for (const f of flowers) {
      g.fillStyle = f.c;
      g.fillRect(f.x - 1, f.y, 1, 1);
      g.fillRect(f.x + 1, f.y, 1, 1);
      g.fillRect(f.x, f.y - 1, 1, 1);
      g.fillRect(f.x, f.y + 1, 1, 1);
      g.fillStyle = '#f5b93a';
      g.fillRect(f.x, f.y, 1, 1);
    }

    // 오브젝트 그림자
    g.fillStyle = 'rgba(20, 52, 24, 0.3)';
    for (const o of objects) {
      const s = o.shadow;
      g.beginPath();
      g.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2);
      g.fill();
    }

    ground = cvs;
  }

  function generate() {
    generatePath();
    generateObstacles();
    generateTallGrass();
    generateFlowers();
    objects.sort((a, b) => a.baseY - b.baseY);
    renderGround();
  }

  // 사각형 영역(픽셀 단위, x1/y1 제외)이 막혀 있는지 검사
  function blocked(x0, y0, x1, y1) {
    const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor((x1 - 1e-6) / TILE);
    const ty0 = Math.floor(y0 / TILE), ty1 = Math.floor((y1 - 1e-6) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!inMap(tx, ty) || solid[idx(tx, ty)]) return true;
      }
    }
    return false;
  }

  generate();

  return {
    TILE,
    COLS,
    ROWS,
    SPAWN,
    objects,
    blocked,
    get ground() { return ground; },
  };
})();
