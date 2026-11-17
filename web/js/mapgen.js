// ABYSS — 탐사 지역 지도 생성 (seed 기반, 결정적)
(function () {
  const A = window.ABYSS;

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function build(area, seed) {
    const W = area.width, H = area.height, rand = rng(seed);
    const idx = (x, y) => y * W + x;
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

    // 1) 암벽/공간: 셀룰러 오토마타
    let solid = [];
    for (let i = 0; i < W * H; i++) solid.push(rand() < 0.4);
    for (let pass = 0; pass < 3; pass++) {
      const next = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!inside(x + dx, y + dy) || solid[idx(x + dx, y + dy)]) n++;
        }
        next[idx(x, y)] = n >= 5;
      }
      solid = next;
    }

    // 2) 베이스 캠프: 상단 중앙, 주변을 비운다
    const base = { x: Math.floor(W / 2), y: 0 };
    for (let dy = 0; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) solid[idx(base.x + dx, base.y + dy)] = false;

    // 3) 고도: 부드러운 잡음 + 아래로 갈수록 낮아짐
    const raw = [];
    for (let i = 0; i < W * H; i++) raw.push(rand());
    const elev = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inside(x + dx, y + dy)) { sum += raw[idx(x + dx, y + dy)]; c++; }
      }
      const slope = 1 - y / (H - 1);
      elev[idx(x, y)] = Math.max(0, Math.min(9, Math.round((sum / c) * 6 + slope * 4 - 1)));
    }

    // 4) 타일 구성
    const tiles = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      let terrain;
      if (solid[i]) terrain = rand() < 0.12 ? 'chasm' : 'wall';
      else {
        const r = rand();
        terrain = elev[i] <= 2 && r < 0.45 ? 'water' : r < 0.22 ? 'rubble' : 'floor';
      }
      tiles.push({ terrain, elev: elev[i], res: null, amount: 0, hazard: null, passage: null, vis: 0 });
    }
    tiles[idx(base.x, base.y)].terrain = 'floor';

    // 5) 베이스에서 도달 가능한 칸과 거리 계산
    const dist = new Array(W * H).fill(-1);
    const queue = [base];
    dist[idx(base.x, base.y)] = 0;
    while (queue.length) {
      const p = queue.shift();
      for (const [dx, dy] of DIRS4) {
        const nx = p.x + dx, ny = p.y + dy;
        if (!inside(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (dist[ni] >= 0 || !A.data.terrain[tiles[ni].terrain].passable) continue;
        dist[ni] = dist[idx(p.x, p.y)] + 1;
        queue.push({ x: nx, y: ny });
      }
    }
    const reach = [];
    for (let i = 0; i < W * H; i++) {
      if (dist[i] < 0 && A.data.terrain[tiles[i].terrain].passable) tiles[i].terrain = 'wall';
      if (dist[i] > 1) reach.push(i);
    }

    // 6) 통로·자원·위험 배치
    const free = reach.slice();
    const take = (filter) => {
      const pool = free.filter(filter);
      if (!pool.length) return -1;
      const pick = pool[Math.floor(rand() * pool.length)];
      free.splice(free.indexOf(pick), 1);
      return pick;
    };
    const far = reach.map((i) => dist[i]).sort((a, b) => b - a)[Math.floor(reach.length * 0.25)] || 0;
    area.passages.forEach((id) => {
      const i = take((t) => dist[t] >= far);
      if (i >= 0) { tiles[i].passage = id; tiles[i].terrain = 'floor'; }
    });
    // 귀한 자원일수록 베이스에서 먼 곳에 배치
    const minDist = { iron: 2, copper: 4, crystal: 7, rare: 9, unknown: 10 };
    const amount = { iron: [4, 8], copper: [3, 6], crystal: [2, 4], rare: [2, 3], unknown: [1, 2] };
    Object.keys(area.deposits).forEach((res) => {
      for (let n = 0; n < area.deposits[res]; n++) {
        let i = take((t) => dist[t] >= minDist[res]);
        if (i < 0) i = take(() => true);
        if (i < 0) return;
        const [lo, hi] = amount[res];
        tiles[i].res = res;
        tiles[i].amount = lo + Math.floor(rand() * (hi - lo + 1));
      }
    });
    Object.keys(area.hazards).forEach((hz) => {
      for (let n = 0; n < area.hazards[hz]; n++) {
        const i = take((t) => dist[t] >= 3);
        if (i >= 0) tiles[i].hazard = hz;
      }
    });

    return { width: W, height: H, base, tiles, reachable: reach.length + 1 + countNear(dist) };
  }

  function countNear(dist) { return dist.filter((d) => d === 1).length; }

  // 탐사 가능한 공간이 너무 좁으면 seed 를 바꿔 다시 생성
  ABYSS.mapgen = {
    generate(area) {
      let best = null;
      for (let k = 0; k < 40; k++) {
        const map = build(area, area.seed + k * 7919);
        if (!best || map.reachable > best.reachable) best = map;
        if (map.reachable >= area.width * area.height * 0.5) break;
      }
      return best;
    },
  };
})();
