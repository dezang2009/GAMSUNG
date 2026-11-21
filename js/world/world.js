// 타일 기반 월드: 마을/탐험 필드 지형 생성, 장애물 배치, 바닥 렌더링, 충돌 판정
// region.type 이 'village' 면 손으로 배치한 마을(region.village), 그 외에는 무작위 탐험 필드(region.gen)를 만든다
const World = (() => {
  const TILE = 16;
  let COLS = 0;
  let ROWS = 0;
  let SPAWN = { tx: 0, ty: 0 };
  let cfg = null; // 지역 데이터의 gen 설정

  const GRASS = 0;
  const PATH = 1;
  const TALL = 2; // 걸을 수 있는 풀숲
  const PLAZA = 3; // 마을 광장 (돌바닥)

  const GRASS_C = [[108, 186, 76], [100, 178, 70], [122, 200, 90], [86, 160, 62]];
  const TALL_C = [[78, 150, 56], [70, 140, 50]];
  const TALL_BLADE = [104, 180, 74];
  const PATH_RIM = [176, 140, 88];
  const PATH_C = [[218, 188, 126], [208, 176, 114], [226, 202, 146], [190, 156, 100]];
  const PLAZA_C = [[226, 218, 202], [216, 208, 192]];
  const PLAZA_GROUT = [196, 187, 170];
  const PLAZA_RIM = [170, 160, 142];
  const FLOWER_COLORS = ['#fff6e0', '#ffd84a', '#ff8fb1', '#b3a6ff'];

  let kind = null;
  let solid = null;
  const objects = [];
  const flowers = [];
  let ground = null;
  let grassC = GRASS_C;   // 지역별 잔디 색상표
  let reserved = null;    // 마을: 길/건물/소품 자리라 나무를 심지 않는 타일
  const triggers = [];    // 밟으면 이벤트가 발생하는 영역(마을 게이트 등)
  const doors = [];       // 들어갈 수 있는 건물의 문 앞 자리 [{ id, enter, name, x, y }]

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
  let rand = Math.random;

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
    return inMap(tx, ty) && kind[idx(tx, ty)] !== PATH && kind[idx(tx, ty)] !== PLAZA &&
           !solid[idx(tx, ty)] && !nearSpawn(tx, ty) && !(reserved && reserved[idx(tx, ty)]);
  }

  // extra: { fw, fh } 발판 크기(타일), { solidTiles } 막힐 타일 목록, { label } 이름표
  function addObject(img, x, y, shadow, tx, ty, extra) {
    const e = extra || {};
    const fh = e.fh || 1;
    let tiles = e.solidTiles;
    if (!tiles) {
      tiles = [];
      for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < (e.fw || 1); dx++) tiles.push([dx, dy]);
    }
    for (const [dx, dy] of tiles) if (inMap(tx + dx, ty + dy)) solid[idx(tx + dx, ty + dy)] = 1;
    objects.push({ img, x, y, w: img.width, h: img.height, baseY: (ty + fh) * TILE, shadow, label: e.label || null });
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
    const pts = cfg.path;
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
    for (let b = 0; b < cfg.forests; b++) {
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
    for (let c = 0; c < cfg.rockClusters; c++) {
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
    for (let i = 0; i < cfg.bushes; i++) {
      const tx = 2 + Math.floor(rand() * (COLS - 4));
      const ty = 2 + Math.floor(rand() * (ROWS - 4));
      if (canPlace(tx, ty) && kind[idx(tx, ty)] === GRASS) placeBush(tx, ty);
    }
  }

  function generateTallGrass() {
    for (let b = 0; b < cfg.tallGrass; b++) {
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
    for (let i = 0; i < cfg.flowers; i++) {
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

  // ---------- 마을 ----------
  function fillRect(r, k) {
    const [x, y, w, h] = r;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (!inMap(tx, ty)) continue;
        kind[idx(tx, ty)] = k;
        reserved[idx(tx, ty)] = 1;
      }
    }
  }

  function reserveRect(x, y, w, h) {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) if (inMap(tx, ty)) reserved[idx(tx, ty)] = 1;
  }

  function placeBuilding(b) {
    const img = Sprites.buildings[b.sprite];
    const by = (b.ty + 2) * TILE;
    const x = b.tx * TILE - 1, y = by - 57;
    addObject(img, x, y, { cx: (b.tx + 1.5) * TILE, cy: by - 2, rx: 26, ry: 4 }, b.tx, b.ty, {
      fw: 3, fh: 2, label: { text: b.name, cx: x + img.width / 2, y: y + 8 },
    });
    reserveRect(b.tx - 1, b.ty - 2, 5, 5);
    if (b.enter) doors.push({ id: b.enter, name: b.name, x: (b.tx + 1.5) * TILE, y: (b.ty + 2) * TILE + 6 });
  }

  function placeProp(p) {
    if (p.type === 'fountain') {
      const img = Sprites.props.fountain, by = (p.ty + 2) * TILE;
      addObject(img, p.tx * TILE - 1, by - 33, { cx: (p.tx + 1) * TILE, cy: by - 3, rx: 14, ry: 3 }, p.tx, p.ty, { fw: 2, fh: 2 });
    } else if (p.type === 'lamp') {
      const img = Sprites.props.lamp, by = (p.ty + 1) * TILE;
      addObject(img, p.tx * TILE + 4, by - 23, { cx: p.tx * TILE + 8, cy: by - 2, rx: 4, ry: 1.5 }, p.tx, p.ty);
    } else if (p.type === 'gate') {
      const img = Sprites.props.gate, by = (p.ty + 1) * TILE;
      addObject(img, p.tx * TILE - 1, by - 49, { cx: (p.tx + 2) * TILE, cy: by - 2, rx: 30, ry: 3 }, p.tx, p.ty, {
        solidTiles: [[0, 0], [3, 0]], label: p.name ? { text: p.name, cx: (p.tx + 2) * TILE, y: by - 49 } : null,
      });
      reserveRect(p.tx - 1, p.ty - 2, 6, 4);
    }
  }

  function generateVillage(v) {
    reserved = new Uint8Array(COLS * ROWS);
    for (const r of v.roads) fillRect(r, PATH);
    if (v.plaza) fillRect(v.plaza, PLAZA);
    for (const b of v.buildings) placeBuilding(b);
    for (const p of v.props) placeProp(p);
    for (const n of v.npcs) {            // NPC 는 서 있는 타일을 막는다
      solid[idx(n.tx, n.ty)] = 1;
      reserveRect(n.tx - 1, n.ty - 1, 3, 3);
    }
    for (const t of v.triggers || []) triggers.push(t);

    // 가장자리 나무 담
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const edge = tx < 2 || ty < 2 || tx >= COLS - 2 || ty >= ROWS - 2;
        if (edge && !solid[idx(tx, ty)] && !reserved[idx(tx, ty)]) placeTree(tx, ty);
      }
    }
    // 흩어진 나무와 덤불
    for (let i = 0, n = 0; i < 400 && n < v.trees; i++) {
      const tx = 2 + Math.floor(rand() * (COLS - 4)), ty = 2 + Math.floor(rand() * (ROWS - 4));
      if (canPlace(tx, ty)) { placeTree(tx, ty); n++; }
    }
    for (let i = 0, n = 0; i < 400 && n < v.bushes; i++) {
      const tx = 2 + Math.floor(rand() * (COLS - 4)), ty = 2 + Math.floor(rand() * (ROWS - 4));
      if (canPlace(tx, ty)) { placeBush(tx, ty); n++; }
    }
  }

  // 발 위치(px)가 들어 있는 트리거 id (없으면 null)
  function triggerAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (const t of triggers) {
      if (tx >= t.tx && tx < t.tx + t.w && ty >= t.ty && ty < t.ty + t.h) return t;
    }
    return null;
  }

  // 길 타일 가장자리는 풀과 섞이도록 픽셀을 일부 풀색으로 바꾼다
  function edgeOfPath(tx, ty, lx, ly) {
    const isPath = (x, y) => !inMap(x, y) || kind[idx(x, y)] === PATH || kind[idx(x, y)] === PLAZA;
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
        let rim = false;
        if (k === PATH && edgeOfPath(tx, ty, lx, ly)) {
          if (hash(px, py, 9) < 0.5) k = GRASS;
          else rim = true;
        }

        let c;
        if (k === PLAZA) {
          const edge = (lx === 0 && kind[idx(Math.max(tx - 1, 0), ty)] !== PLAZA) || (lx === 15 && kind[idx(Math.min(tx + 1, COLS - 1), ty)] !== PLAZA) ||
                       (ly === 0 && kind[idx(tx, Math.max(ty - 1, 0))] !== PLAZA) || (ly === 15 && kind[idx(tx, Math.min(ty + 1, ROWS - 1))] !== PLAZA);
          c = edge ? PLAZA_RIM : (px & 7) === 0 || (py & 7) === 0 ? PLAZA_GROUT : PLAZA_C[((px >> 3) + (py >> 3)) & 1];
        } else if (k === PATH) {
          const n = hash(px >> 1, py >> 1, 4);
          c = rim && n < 0.75 ? PATH_RIM : n < 0.55 ? PATH_C[0] : n < 0.8 ? PATH_C[1] : n < 0.92 ? PATH_C[2] : PATH_C[3];
        } else if (k === TALL) {
          c = hash(px >> 1, py >> 1, 6) < 0.6 ? TALL_C[0] : TALL_C[1];
          if (hash(px, py, 7) > 0.93) c = TALL_BLADE;
        } else {
          const n = hash(px >> 1, py >> 1, 3);
          c = n < 0.55 ? grassC[0] : n < 0.8 ? grassC[1] : n < 0.93 ? grassC[2] : grassC[3];
        }

        const i = (py * W + px) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);

    // 풀 다발: 단조로운 바닥에 질감을 더한다
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (kind[idx(tx, ty)] !== GRASS || solid[idx(tx, ty)] || hash(tx, ty, 31) > 0.35) continue;
        const x = tx * TILE + 3 + Math.floor(hash(tx, ty, 32) * 9);
        const y = ty * TILE + 4 + Math.floor(hash(tx, ty, 33) * 8);
        g.fillStyle = '#4c9a38';
        g.fillRect(x, y, 1, 3);
        g.fillRect(x + 2, y - 1, 1, 4);
        g.fillRect(x + 4, y + 1, 1, 2);
        g.fillStyle = '#8fd96a';
        g.fillRect(x, y - 1, 1, 1);
        g.fillRect(x + 2, y - 2, 1, 1);
      }
    }

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

  // 지역 데이터(Regions)로 맵을 새로 만든다
  function load(region) {
    const village = region.type === 'village';
    cfg = village ? region.village : region.gen;
    grassC = (region.palette && region.palette.grass) || GRASS_C;
    triggers.length = 0;
    doors.length = 0;
    COLS = region.cols;
    ROWS = region.rows;
    SPAWN = region.spawn;
    kind = new Uint8Array(COLS * ROWS);
    solid = new Uint8Array(COLS * ROWS);
    reserved = new Uint8Array(COLS * ROWS);
    // 탐험 필드: 중간보스 자리 주변에는 나무/바위를 심지 않는다
    if (!village && region.monsters && region.monsters.boss) {
      const bs = region.monsters.boss;
      reserveRect(bs.tx - 3, bs.ty - 3, 7, 6);
    }
    objects.length = 0;
    flowers.length = 0;
    rand = mulberry32(cfg.seed);
    if (village) {
      generateVillage(cfg);
    } else {
      generatePath();
      generateObstacles();
      generateTallGrass();
    }
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

  return {
    TILE,
    get COLS() { return COLS; },
    get ROWS() { return ROWS; },
    get SPAWN() { return SPAWN; },
    objects,
    load,
    blocked,
    triggerAt,
    doors,
    get ground() { return ground; },
  };
})();
