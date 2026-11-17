// ABYSS — 게임 상태와 탐사 규칙 (화면 코드와 분리)
(function () {
  const A = window.ABYSS, D = A.data, R = D.rules;
  const SAVE_KEY = 'abyss.save.v1';
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let S = null; // 현재 게임 상태

  const emptyBag = () => Object.keys(D.resources).reduce((o, k) => (o[k] = 0, o), {});
  const bagTotal = (bag) => Object.values(bag).reduce((a, b) => a + b, 0);

  function findArea(id) {
    for (const z of D.zones) for (const a of z.areas) if (a.id === id) return { zone: z, area: a };
    return null;
  }

  const G = {
    get state() { return S; },
    get zone() { return findArea(S.areaId).zone; },
    get area() { return findArea(S.areaId).area; },
    bagTotal,

    hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
    save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } },
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (!s || !s.map || !findArea(s.areaId)) return false;
        S = s;
        return true;
      } catch (e) { return false; }
    },

    newGame() {
      const area = D.zones[0].areas[0];
      const map = A.mapgen.generate(area);
      S = {
        areaId: area.id, map,
        player: { x: map.base.x, y: map.base.y },
        energy: R.maxEnergy,
        cargo: emptyBag(), storage: emptyBag(),
        expedition: 1, trip: { steps: 0, energy: 0, finds: 0 },
        history: [], log: [],
      };
      G.log('베이스 캠프 설치 완료. ' + area.name + ' 탐사를 시작한다.', 'sys');
      reveal(map.base.x, map.base.y);
      G.save();
    },

    log(text, kind) {
      S.log.unshift({ n: S.expedition, text, kind: kind || 'info' });
      if (S.log.length > 80) S.log.length = 80;
    },

    tile(x, y) {
      const m = S.map;
      return x < 0 || y < 0 || x >= m.width || y >= m.height ? null : m.tiles[y * m.width + x];
    },
    atBase() { return S.player.x === S.map.base.x && S.player.y === S.map.base.y; },
    isBase(x, y) { return x === S.map.base.x && y === S.map.base.y; },

    // 알려진 정보만으로 계산한 진입 비용 (경로 계획용)
    knownCost(from, to) {
      let c = D.terrain[to.terrain].cost + Math.max(0, to.elev - from.elev);
      if (to.vis === 2 && to.hazard === 'gas') c += D.hazards.gas.extraCost;
      return c;
    },

    // 발견된 칸만 이용하는 최소 전력 경로. 없으면 null
    path(tx, ty) {
      const m = S.map, W = m.width, start = S.player.y * W + S.player.x, goal = ty * W + tx;
      const target = G.tile(tx, ty);
      if (!target || target.vis === 0 || !D.terrain[target.terrain].passable || start === goal) return null;
      const cost = new Array(m.tiles.length).fill(Infinity), prev = new Array(m.tiles.length).fill(-1);
      const done = new Array(m.tiles.length).fill(false);
      cost[start] = 0;
      for (;;) {
        let u = -1;
        for (let i = 0; i < cost.length; i++) if (!done[i] && cost[i] < Infinity && (u < 0 || cost[i] < cost[u])) u = i;
        if (u < 0 || u === goal) break;
        done[u] = true;
        const ux = u % W, uy = (u - ux) / W;
        for (const [dx, dy] of DIRS4) {
          const t = G.tile(ux + dx, uy + dy);
          if (!t || t.vis === 0 || !D.terrain[t.terrain].passable) continue;
          const v = (uy + dy) * W + ux + dx, c = cost[u] + G.knownCost(m.tiles[u], t);
          if (c < cost[v]) { cost[v] = c; prev[v] = u; }
        }
      }
      if (cost[goal] === Infinity) return null;
      const steps = [];
      for (let i = goal; i !== start; i = prev[i]) steps.unshift({ x: i % W, y: Math.floor(i / W) });
      return { steps, cost: cost[goal] };
    },

    // 경로를 따라 이동. 붕괴·전력 고갈 시 중단
    moveTo(tx, ty) {
      const p = G.path(tx, ty);
      if (!p) return false;
      if (p.cost > S.energy) { G.log('전력이 부족해 해당 지점까지 이동할 수 없다.', 'warn'); return false; }
      for (const step of p.steps) {
        const from = G.tile(S.player.x, S.player.y), to = G.tile(step.x, step.y);
        let cost = D.terrain[to.terrain].cost + Math.max(0, to.elev - from.elev);
        let stop = false;
        if (to.hazard === 'gas') {
          cost += D.hazards.gas.extraCost;
          if (to.vis < 2) { G.log('가스 누출 지대에 진입했다. 전력 ' + D.hazards.gas.extraCost + ' 추가 소모.', 'warn'); stop = true; }
        }
        if (to.hazard === 'unstable' && Math.random() < D.hazards.unstable.collapseChance) {
          cost += D.hazards.unstable.collapseLoss;
          to.terrain = 'rubble'; to.hazard = null;
          G.log('지반이 붕괴했다! 전력 ' + D.hazards.unstable.collapseLoss + ' 손실. 지형이 잔해로 변했다.', 'warn');
          stop = true;
        }
        spend(cost);
        S.player.x = step.x; S.player.y = step.y;
        S.trip.steps++;
        reveal(step.x, step.y);
        if (S.energy <= 0 && !G.atBase()) { G.emergency('전력 고갈'); break; }
        if (stop) break;
      }
      G.save();
      return true;
    },

    canScan() { return S.energy > R.scanCost; },
    scan() {
      if (!G.canScan()) return false;
      spend(R.scanCost);
      let found = 0;
      for (let dy = -R.scanRadius; dy <= R.scanRadius; dy++) for (let dx = -R.scanRadius; dx <= R.scanRadius; dx++) {
        found += survey(S.player.x + dx, S.player.y + dy, 2);
      }
      G.log('정밀 스캔 완료. ' + (found ? '새로운 정보 ' + found + '건.' : '특이사항 없음.'), 'info');
      G.save();
      return true;
    },

    mineBlock() {
      const t = G.tile(S.player.x, S.player.y);
      if (!t.res || t.amount <= 0) return '이 칸에는 채굴할 자원이 없다';
      if (bagTotal(S.cargo) >= R.cargoCapacity) return '적재함이 가득 찼다';
      if (S.energy <= R.mineCost) return '전력 부족';
      return null;
    },
    mine() {
      if (G.mineBlock()) return false;
      const t = G.tile(S.player.x, S.player.y), res = t.res;
      const [lo, hi] = R.mineYield;
      const got = Math.min(lo + Math.floor(Math.random() * (hi - lo + 1)), t.amount, R.cargoCapacity - bagTotal(S.cargo));
      spend(R.mineCost);
      t.amount -= got;
      S.cargo[res] += got;
      G.log(D.resources[res].name + ' ' + got + ' 채굴. (잔여 매장량 ' + t.amount + ')', 'gain');
      if (t.amount <= 0) { t.res = null; G.log('이 광맥은 고갈되었다.', 'info'); }
      G.save();
      return true;
    },

    // 베이스 복귀: 적재물 반입, 전력 보급, 탐사 기록
    returnToBase() {
      if (!G.atBase()) return false;
      finishTrip('정상 귀환');
      G.save();
      return true;
    },

    // 긴급 회수: 어디서든 가능하지만 적재물 일부를 잃는다
    emergency(reason) {
      if (G.atBase()) return false;
      let lost = 0;
      Object.keys(S.cargo).forEach((k) => {
        const l = Math.ceil(S.cargo[k] * R.emergencyCargoLoss);
        S.cargo[k] -= l; lost += l;
      });
      S.player.x = S.map.base.x; S.player.y = S.map.base.y;
      G.log('긴급 회수 (' + reason + '). 적재물 ' + lost + ' 유실.', 'warn');
      finishTrip('긴급 회수');
      G.save();
      return true;
    },

    progress() {
      const tiles = S.map.tiles;
      const seen = tiles.filter((t) => t.vis > 0).length;
      const deposits = {};
      tiles.forEach((t) => { if (t.vis === 2 && t.res) deposits[t.res] = (deposits[t.res] || 0) + t.amount; });
      const passages = tiles.filter((t) => t.vis === 2 && t.passage).map((t) => t.passage);
      const hazards = tiles.filter((t) => t.vis === 2 && t.hazard).length;
      return { seen, total: tiles.length, pct: Math.round((seen / tiles.length) * 100), deposits, passages, hazards };
    },
  };

  function spend(n) {
    S.energy = Math.max(0, S.energy - n);
    S.trip.energy += n;
  }

  // 칸 정보 공개. level 1 = 지형·고도, 2 = 자원·위험·통로까지. 새 발견 건수를 반환
  function survey(x, y, level) {
    const t = G.tile(x, y);
    if (!t || t.vis >= level) return 0;
    const was = t.vis;
    t.vis = level;
    if (level < 2) return 0;
    let n = 0;
    const at = ' (' + x + ',' + y + ')';
    if (t.res) { G.log('발견: ' + D.resources[t.res].name + ' 광맥' + at + ', 매장량 ' + t.amount, 'find'); n++; }
    if (t.hazard) { G.log('위험 감지: ' + D.hazards[t.hazard].name + at, 'warn'); n++; }
    if (t.passage) { G.log('통로 발견: ' + D.passages[t.passage].name + at, 'find'); n++; }
    S.trip.finds += n;
    return n + (was === 0 ? 0 : 0);
  }

  // 현재 칸은 조사 완료, 주변 8칸은 지형만 확인
  function reveal(x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) survey(x + dx, y + dy, 1);
    survey(x, y, 2);
  }

  function finishTrip(result) {
    const hauled = bagTotal(S.cargo);
    Object.keys(S.cargo).forEach((k) => { S.storage[k] += S.cargo[k]; S.cargo[k] = 0; });
    S.history.unshift({ n: S.expedition, result, steps: S.trip.steps, energy: S.trip.energy, finds: S.trip.finds, hauled });
    if (S.history.length > 30) S.history.length = 30;
    G.log('제' + S.expedition + '차 탐사 종료 — ' + result + '. 반입 ' + hauled + ', 발견 ' + S.trip.finds + '건.', 'sys');
    S.expedition++;
    S.energy = R.maxEnergy;
    S.trip = { steps: 0, energy: 0, finds: 0 };
  }

  A.game = G;
})();
