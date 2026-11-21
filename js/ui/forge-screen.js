// 대장간 강화 화면. 건물에 들어가면 위쪽은 강화 장면, 아래쪽은 장비 선택 / 재료 선택으로 바뀐다.
//   ◀▶ 장비/재료 열 전환, ▲▼ 선택, 확인(강화), 뒤로(나가기). 목록은 직접 눌러도 된다.
//   강화 규칙(확률, 재료 소모, 등급 상승)은 systems/crafting.js 가 처리한다 ('forge:enhance' -> 'forge:result').
const ForgeUI = (() => {
  const $ = (id) => document.getElementById(id);
  const root = $('forge');
  const dock = $('dock');
  const panel = $('forge-panel');
  const colGear = $('fp-gear');
  const colMat = $('fp-mats');
  const msg = $('fg-msg');
  const stage = root.querySelector('.fg-stage');

  const SMITH_LINES = {
    hello: '어서 와! 강화할 장비와 재료를 골라 봐.',
    noGear: '강화할 장비가 없네. 장비부터 구해 와.',
    noMat: '강화재료가 없잖아. 몬스터가 가끔 떨어뜨리니 구해 와!',
    max: '이 장비는 이미 최고 등급이야.',
    go: '좋아, 간다!',
  };

  let active = false;
  let busy = false;
  let focus = 0;         // 0: 장비 열, 1: 재료 열
  let gi = 0;            // 선택한 장비 / 재료 번호
  let mi = 0;
  let timers = [];

  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // 장비(무기 먼저, 그다음 방어구) / 강화재료 목록
  function gearList() {
    return GameState.get('gear').list.slice().sort((a, b) =>
      ItemTypes[ItemData[a.id].type].order - ItemTypes[ItemData[b.id].type].order);
  }
  const matList = () => GameState.get('inventory').items.filter((it) => ItemData[it.id].forge);

  const isEquipped = (inst) => {
    const eq = GameState.get('equipment');
    return eq.weapon === inst.uid || eq.armor === inst.uid;
  };

  function drawCanvas(canvas, img, scale) {
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.style.width = img.width * scale + 'px';
    canvas.style.height = img.height * scale + 'px';
  }

  function setMsg(text) {
    msg.textContent = text;
  }

  // ---------- 아래: 선택 목록 ----------
  function renderPanel() {
    const gears = gearList();
    const mats = matList();
    gi = Math.min(gi, Math.max(0, gears.length - 1));
    mi = Math.min(mi, Math.max(0, mats.length - 1));

    colGear.replaceChildren(el('h4', '', '장비 선택'));
    if (!gears.length) colGear.append(el('p', 'fp-empty', '장비가 없어요'));
    gears.forEach((inst, i) => {
      const def = ItemData[inst.id];
      const row = el('button', 'fp-row' + (focus === 0 && i === gi ? ' is-focus' : '') + (i === gi ? ' is-picked' : ''));
      row.type = 'button';
      row.append(el('span', 'fp-name', def.name), el('span', 'fp-sub', '★' + inst.grade + (isEquipped(inst) ? ' · 장착' : '')));
      row.addEventListener('click', () => { if (busy) return; focus = 0; gi = i; render(); });
      colGear.append(row);
    });

    colMat.replaceChildren(el('h4', '', '재료 선택'));
    if (!mats.length) colMat.append(el('p', 'fp-empty', '강화재료가 없어요'));
    mats.forEach((it, i) => {
      const def = ItemData[it.id];
      const row = el('button', 'fp-row' + (focus === 1 && i === mi ? ' is-focus' : '') + (i === mi ? ' is-picked' : ''));
      row.type = 'button';
      const bonus = def.forge.chanceBonus ? ` · +${Math.round(def.forge.chanceBonus * 100)}%` : '';
      row.append(el('span', 'fp-name', def.name), el('span', 'fp-sub', `×${it.count}${bonus}`));
      row.addEventListener('click', () => { if (busy) return; focus = 1; mi = i; render(); });
      colMat.append(row);
    });
    const f = (focus === 0 ? colGear : colMat).querySelector('.is-focus');
    if (f) f.scrollIntoView({ block: 'nearest' });
  }

  // ---------- 위: 강화 장면 ----------
  function renderScene() {
    const inst = gearList()[gi];
    const mat = matList()[mi];
    const stars = $('fg-stars');
    const info = $('fg-info');
    stars.replaceChildren();
    info.replaceChildren();

    if (!inst) {
      drawCanvas($('fg-gear'), Sprites.items.gem, 1);
      $('fg-gear').style.visibility = 'hidden';
      info.append(el('b', '', '장비를 골라 주세요'));
      return;
    }
    const def = ItemData[inst.id];
    $('fg-gear').style.visibility = 'visible';
    drawCanvas($('fg-gear'), Sprites.items[def.icon], 5);
    for (let i = 1; i <= Forge.maxGrade; i++) {
      stars.append(el('span', 'fg-star' + (i <= inst.grade ? ' on' : i === inst.grade + 1 ? ' next' : ''), '★'));
    }
    info.append(el('b', '', def.name + (def.weapon ? `  숙련 Lv.${inst.level}` : '')));
    if (inst.grade >= Forge.maxGrade) {
      info.append(el('span', 'fg-chance', '최고 등급'));
    } else {
      const chance = Forge.chance(inst.grade, mat ? ItemData[mat.id] : null);
      info.append(
        el('span', 'fg-chance', `★${inst.grade} → ★${inst.grade + 1}   성공 확률 ${Math.round(chance * 100)}%`),
        el('span', 'fg-mat', mat ? `재료: ${ItemData[mat.id].name}` : '재료를 골라 주세요'),
      );
    }
  }

  function render() {
    renderPanel();
    renderScene();
  }

  // ---------- 강화 ----------
  function enhance() {
    const inst = gearList()[gi];
    const mat = matList()[mi];
    if (!inst) { setMsg(SMITH_LINES.noGear); return; }
    if (inst.grade >= Forge.maxGrade) { setMsg(SMITH_LINES.max); return; }
    if (!mat) { setMsg(SMITH_LINES.noMat); return; }
    busy = true;
    Events.emit('ui:changed');
    setMsg(SMITH_LINES.go);
    stage.classList.remove('strike');
    void stage.offsetWidth;
    stage.classList.add('strike');                       // 망치질 연출 (3번)
    later(() => Events.emit('forge:enhance', { uid: inst.uid, materialId: mat.id }), 1100);
  }

  function fx(kind) {
    const box = $('fg-fx');
    box.replaceChildren();
    box.className = 'fg-fx ' + kind;
    for (let i = 0; i < 10; i++) {
      const p = el('i');
      p.style.setProperty('--a', (i / 10) * 360 + 'deg');
      p.style.setProperty('--d', 50 + (i % 3) * 18 + 'px');
      box.append(p);
    }
  }

  Events.on('forge:result', (r) => {
    if (!active) return;
    fx(r.success ? 'ok' : 'fail');
    setMsg(r.success
      ? `강화 성공! ★${r.to} 등급이 되었어!`
      : '아쉽게도 실패했어... 재료만 사라졌네. 다시 해 볼래?');
    render();
    later(() => { busy = false; Events.emit('ui:changed'); }, 1500);
  });

  // ---------- 열기 / 닫기 ----------
  function open() {
    if (active) return;
    active = true;
    busy = false;
    focus = 0;
    gi = 0;
    mi = 0;
    drawCanvas($('fg-smith'), Sprites.npcs.smith.down[2], 6);
    drawCanvas($('fg-anvil'), Sprites.props.anvil, 5);
    $('fg-fx').replaceChildren();
    root.hidden = false;
    root.classList.remove('intro');
    void root.offsetWidth;
    root.classList.add('intro');
    dock.dataset.mode = 'forge';
    panel.hidden = false;
    setMsg(gearList().length ? SMITH_LINES.hello : SMITH_LINES.noGear);
    render();
    Events.emit('forge:opened');
    Events.emit('ui:changed');
  }

  function close() {
    if (!active) return;
    clearTimers();
    active = false;
    busy = false;
    root.hidden = true;
    dock.dataset.mode = '';
    panel.hidden = true;
    Events.emit('forge:closed');
    Events.emit('ui:changed');
  }

  // ---------- 하단 컨트롤에서 부르는 조작 ----------
  function nav(dir) {
    if (busy) return;
    if (dir === 'left') focus = 0;
    else if (dir === 'right') focus = 1;
    else {
      const n = (focus === 0 ? gearList() : matList()).length;
      if (!n) return;
      const d = dir === 'up' ? -1 : 1;
      if (focus === 0) gi = (gi + d + n) % n; else mi = (mi + d + n) % n;
    }
    render();
  }

  function confirm() {
    if (busy) return;
    enhance();
  }

  Events.on('building:enter', ({ id }) => { if (id === 'forge') open(); });
  Events.on('game:quit', close);
  Events.on('inventory:changed', () => { if (active && !busy) render(); });

  return {
    get active() { return active; },
    confirmLabel: () => (busy ? '...' : '강화'),
    canBack: () => active && !busy,
    nav,
    confirm,
    back: close,
    close,
  };
})();
