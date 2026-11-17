// ABYSS — 화면 표시와 입력 처리
(function () {
  const A = window.ABYSS, D = A.data, R = D.rules, G = A.game;
  const $ = (id) => document.getElementById(id);
  let sel = null;      // 선택한 칸 {x, y}
  let plan = null;     // 선택한 칸까지의 경로

  function show(screen) {
    $('screen-title').hidden = screen !== 'title';
    $('screen-game').hidden = screen !== 'game';
    $('menu').hidden = true;
    if (screen === 'title') renderTitle(); else { sel = null; plan = null; render(); }
  }

  function renderTitle() {
    const has = G.hasSave() && G.load();
    $('btn-continue').hidden = !has;
    $('btn-new').className = has ? 'btn' : 'btn primary';
    $('title-save').textContent = has
      ? G.area.name + ' · 제' + G.state.expedition + '차 탐사 · 탐사율 ' + G.progress().pct + '%'
      : '저장된 탐사 기록 없음';
  }

  function render() {
    const S = G.state;
    $('zone-name').textContent = G.zone.name + ' (' + G.zone.depth + ')';
    $('area-name').textContent = G.area.name;
    $('g-exp').textContent = '제' + S.expedition + '차';
    $('g-energy').textContent = S.energy + ' / ' + R.maxEnergy;
    const eb = $('bar-energy');
    eb.style.width = (S.energy / R.maxEnergy) * 100 + '%';
    eb.className = S.energy <= R.maxEnergy * 0.25 ? 'low' : '';
    const cargo = G.bagTotal(S.cargo);
    $('g-cargo').textContent = cargo + ' / ' + R.cargoCapacity;
    $('bar-cargo').style.width = (cargo / R.cargoCapacity) * 100 + '%';
    renderMap(); renderTile(); renderLog(); renderRes(); renderArea();
  }

  function renderMap() {
    const S = G.state, m = S.map, el = $('map');
    el.style.gridTemplateColumns = 'repeat(' + m.width + ', 1fr)';
    const onPath = {};
    if (plan) plan.steps.forEach((p) => { onPath[p.x + ',' + p.y] = true; });
    let html = '';
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const t = m.tiles[y * m.width + x];
      let cls = 'tile v' + t.vis, inner = '';
      if (t.vis > 0) {
        cls += ' ' + t.terrain;
        if (D.terrain[t.terrain].passable) inner += '<span class="elev">' + t.elev + '</span>';
        if (t.vis === 2) {
          if (t.passage) inner += '<span class="mark">▼</span>';
          else if (t.res) inner += '<span class="res ' + t.res + '">' + D.resources[t.res].sym + '</span>';
          if (t.hazard) inner += '<span class="hz">!</span>';
        } else if (D.terrain[t.terrain].passable) inner += '<span class="unk">·</span>';
      }
      if (G.isBase(x, y)) cls += ' base';
      if (S.player.x === x && S.player.y === y) cls += ' player';
      if (onPath[x + ',' + y]) cls += ' path';
      if (sel && sel.x === x && sel.y === y) cls += ' sel';
      html += '<div class="' + cls + '" data-x="' + x + '" data-y="' + y + '">' + inner + '</div>';
    }
    el.innerHTML = html;
  }

  function renderTile() {
    const S = G.state;
    const pos = sel || S.player, t = G.tile(pos.x, pos.y), here = pos.x === S.player.x && pos.y === S.player.y;
    let html = '<div class="tile-head"><span>' + (here ? '현재 위치' : '선택한 칸') + ' (' + pos.x + ',' + pos.y + ')</span>';
    if (t.vis === 0) {
      html += '<span class="dim">미발견</span></div><p class="dim small">아직 확인되지 않은 영역. 인접한 칸까지 이동하면 지형이 드러난다.</p>';
    } else {
      const ter = D.terrain[t.terrain];
      html += '<span>' + (G.isBase(pos.x, pos.y) ? '베이스 캠프 · ' : '') + ter.name + '</span></div><dl class="kv">';
      html += '<dt>지형</dt><dd>' + ter.desc + '</dd>';
      if (ter.passable) html += '<dt>고도</dt><dd>' + t.elev + ' · 기본 진입 전력 ' + ter.cost + '</dd>';
      if (t.vis < 2) {
        if (ter.passable) html += '<dt>조사</dt><dd class="dim">미조사 — 자원·위험 여부 불명</dd>';
      } else {
        html += '<dt>자원</dt><dd>' + (t.res ? '<span class="gain">' + D.resources[t.res].name + '</span> · 매장량 ' + t.amount : '없음') + '</dd>';
        if (t.hazard) html += '<dt>위험</dt><dd class="warn">' + D.hazards[t.hazard].name + ' — ' + D.hazards[t.hazard].desc + '</dd>';
        if (t.passage) html += '<dt>통로</dt><dd class="find">' + D.passages[t.passage].name + ' — ' + D.passages[t.passage].desc + '</dd>';
      }
      if (plan) {
        const left = S.energy - plan.cost;
        html += '<dt>경로</dt><dd>' + plan.steps.length + '칸 · 예상 전력 <b>' + plan.cost + '</b> (도착 후 ' +
          '<span class="' + (left <= 0 ? 'danger-t' : '') + '">' + left + '</span>)</dd>';
      } else if (!here && ter.passable) html += '<dt>경로</dt><dd class="dim">발견된 칸으로 이어지는 길이 없다</dd>';
      html += '</dl>';
    }
    $('tile-info').innerHTML = html;

    const mv = $('act-move');
    mv.disabled = !plan || plan.cost > S.energy;
    mv.textContent = plan ? '이동 (전력 ' + plan.cost + ')' : '이동';
    const block = G.mineBlock();
    $('act-mine').disabled = !!block;
    $('act-mine').textContent = '채굴 (전력 ' + R.mineCost + ')';
    $('act-scan').disabled = !G.canScan();
    $('act-scan').textContent = '정밀 스캔 (전력 ' + R.scanCost + ')';
    const ret = $('act-return');
    ret.textContent = G.atBase() ? '귀환·보급' : '긴급 회수';
    ret.className = G.atBase() ? 'btn' : 'btn danger';
    $('act-hint').textContent = G.atBase()
      ? '귀환하면 적재물을 반입하고 전력을 보급한 뒤 다음 탐사를 시작한다.'
      : '긴급 회수: 즉시 베이스로 복귀하지만 적재물의 ' + R.emergencyCargoLoss * 100 + '%를 잃는다. 전력이 0이 되면 자동 발동.';
  }

  function renderLog() {
    $('tab-log').innerHTML = G.state.log.map((l) =>
      '<div class="log-row ' + l.kind + '"><span class="n">#' + l.n + '</span>' + l.text + '</div>').join('');
  }

  function renderRes() {
    const S = G.state;
    let html = '<table><tr><th>자원</th><th>용도</th><th class="num">적재</th><th class="num">보유</th></tr>';
    Object.keys(D.resources).forEach((k) => {
      const r = D.resources[k];
      html += '<tr><td>' + r.sym + ' ' + r.name + '</td><td class="dim">' + r.use + '</td><td class="num">' +
        S.cargo[k] + '</td><td class="num"><b>' + S.storage[k] + '</b></td></tr>';
    });
    $('tab-res').innerHTML = html + '</table><p class="dim small" style="margin-top:8px">적재물은 베이스로 귀환해야 보유량에 반영된다.</p>';
  }

  function renderArea() {
    const S = G.state, p = G.progress();
    let html = '<p class="small dim">' + G.area.desc + '</p>';
    html += '<h3>탐사 현황</h3><dl class="kv"><dt>탐사율</dt><dd>' + p.pct + '% (' + p.seen + ' / ' + p.total + '칸)</dd>';
    html += '<dt>확인된 위험</dt><dd>' + p.hazards + '곳</dd>';
    html += '<dt>발견한 통로</dt><dd>' + (p.passages.length ? p.passages.map((id) => D.passages[id].name).join(', ') : '없음') +
      ' (' + p.passages.length + ' / ' + G.area.passages.length + ')</dd></dl>';
    html += '<h3>확인된 매장량</h3>';
    const keys = Object.keys(p.deposits);
    html += keys.length ? '<dl class="kv">' + keys.map((k) => '<dt>' + D.resources[k].name + '</dt><dd>' + p.deposits[k] + '</dd>').join('') + '</dl>'
      : '<p class="dim small">아직 확인된 광맥이 없다.</p>';
    html += '<h3>탐사 기록</h3>';
    html += S.history.length ? '<table><tr><th>차수</th><th>결과</th><th class="num">이동</th><th class="num">전력</th><th class="num">발견</th><th class="num">반입</th></tr>' +
      S.history.map((h) => '<tr><td>' + h.n + '</td><td class="' + (h.result === '긴급 회수' ? 'warn' : '') + '">' + h.result +
        '</td><td class="num">' + h.steps + '</td><td class="num">' + h.energy + '</td><td class="num">' + h.finds + '</td><td class="num">' + h.hauled + '</td></tr>').join('') + '</table>'
      : '<p class="dim small">완료된 탐사가 없다.</p>';
    $('tab-area').innerHTML = html;
  }

  function select(x, y) {
    const S = G.state;
    if (sel && sel.x === x && sel.y === y && plan && plan.cost <= S.energy) return doMove();
    sel = (x === S.player.x && y === S.player.y) ? null : { x, y };
    plan = sel ? G.path(x, y) : null;
    render();
  }

  function doMove() {
    if (!sel || !plan) return;
    G.moveTo(sel.x, sel.y);
    sel = null; plan = null;
    render();
  }

  function act(fn) { fn(); sel = null; plan = null; render(); }

  // 입력
  $('map').addEventListener('click', (e) => {
    const el = e.target.closest('.tile');
    if (el) select(+el.dataset.x, +el.dataset.y);
  });
  $('act-move').addEventListener('click', doMove);
  $('act-mine').addEventListener('click', () => act(G.mine));
  $('act-scan').addEventListener('click', () => act(G.scan));
  $('act-return').addEventListener('click', () => {
    if (G.atBase()) return act(G.returnToBase);
    if (confirm('긴급 회수를 요청할까요? 적재물의 일부를 잃습니다.')) act(() => G.emergency('수동 요청'));
  });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    ['log', 'res', 'area'].forEach((id) => { $('tab-' + id).hidden = id !== tab.dataset.tab; });
  }));
  $('btn-menu').addEventListener('click', () => { $('menu').hidden = false; });
  $('menu-close').addEventListener('click', () => { $('menu').hidden = true; });
  $('menu-title').addEventListener('click', () => show('title'));
  $('menu-reset').addEventListener('click', () => {
    if (confirm('모든 탐사 기록을 삭제하고 새로 시작할까요?')) { G.newGame(); show('game'); }
  });
  $('btn-continue').addEventListener('click', () => { if (G.load()) show('game'); });
  $('btn-new').addEventListener('click', () => {
    if (G.hasSave() && !confirm('기존 탐사 기록이 삭제됩니다. 새로 시작할까요?')) return;
    G.newGame(); show('game');
  });

  // Android 뒤로가기: 메뉴 닫기 → 메인 화면 → 앱 종료(false 반환)
  A.onBack = function () {
    if (!$('menu').hidden) { $('menu').hidden = true; return true; }
    if (!$('screen-game').hidden) { show('title'); return true; }
    return false;
  };

  show('title');
})();
