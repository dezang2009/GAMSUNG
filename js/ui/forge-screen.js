// 대장간 화면. 건물에 들어가면 위쪽은 목록(강화: 장비/재료 선택, 제작: 레시피 선택), 아래쪽은 진행 장면(모루, 별, 확률)으로 바뀐다.
//   ▲ 로 맨 위에 올라가면 '강화 / 제작' 탭, ◀▶ 로 열/탭 전환, ▲▼ 선택, 확인(강화/제작), 뒤로(나가기). 목록과 탭은 직접 눌러도 된다.
//   규칙(확률, 재료·골드 소모, 장비 생성)은 systems/crafting.js 가 처리한다
//   ('forge:enhance' -> 'forge:result', 'forge:craft' -> 'forge:crafted').
const ForgeUI = (() => {
  const $ = (id) => document.getElementById(id);
  const root = $('forge');
  const dock = $('dock');
  const panel = $('forge-panel');
  const colGear = $('fp-gear');
  const colMat = $('fp-mats');
  const lists = root.querySelector('.fg-lists');
  const tabsEl = $('fg-tabs');
  const msg = $('fg-msg');
  const stage = panel.querySelector('.fg-stage');
  let sc = 3;            // 강화 장면 스프라이트 배율 (아래 패널 높이에 맞춘다)

  const SMITH_LINES = {
    hello: '어서 와! 강화할 장비와 재료를 골라 봐.',
    craftHello: '어떤 무기를 만들어 볼까? 재료와 골드만 있으면 상점 것보다 높은 등급으로 만들어 주지.',
    noGear: '강화할 장비가 없네. 장비부터 구해 와.',
    noMat: '강화재료가 없잖아. 몬스터가 가끔 떨어뜨리니 구해 와!',
    max: '이 장비는 이미 최고 등급이야.',
    go: '좋아, 간다!',
    lackItems: '재료가 모자라. 몬스터 소재를 더 모아 와!',
    lackGold: '제작비가 모자라. 골드를 더 모아 와!',
  };

  let active = false;
  let busy = false;
  let mode = 'enhance';   // 'enhance' | 'craft'
  let tabFocus = false;   // 탭에 커서가 있는지
  let focus = 0;          // 강화: 0 장비 열 / 1 재료 열
  let gi = 0;             // 선택한 장비 / 재료 / 레시피 번호
  let mi = 0;
  let ri = 0;
  let timers = [];

  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const held = (id) => (GameState.get('inventory').items.find((it) => it.id === id) || { count: 0 }).count;

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

  const canCraft = (r) => GameState.get('wallet').gold >= r.gold && r.needs.every((x) => held(x.id) >= x.count);

  function icon(def, cls) {
    const c = el('canvas', cls);
    c.width = 16;
    c.height = 16;
    c.getContext('2d').drawImage(Sprites.items[def.icon], 0, 0);
    return c;
  }

  function drawCanvas(canvas, img, scale) {
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.style.width = img.width * scale + 'px';
    canvas.style.height = img.height * scale + 'px';
  }

  const setMsg = (text) => { msg.textContent = text; };

  // 무기 한 줄 설명: 공격력(해당 등급)과 배울 수 있는 기술
  function weaponLine(def, grade) {
    const w = def.weapon;
    const atk = (w.atk * Progression.gradeMult(grade)).toFixed(1);
    return `공격 +${atk} · 기술: ${w.skills.map((u) => `${SkillData[u.skill].name}(Lv.${u.level})`).join(', ')}`;
  }

  // ---------- 탭 ----------
  function renderTabs() {
    tabsEl.replaceChildren();
    for (const [m, label] of [['enhance', '강화'], ['craft', '제작']]) {
      const b = el('button', 'sh-tab' + (mode === m ? ' is-on' : '') + (tabFocus && mode === m ? ' is-focus' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { if (busy) return; setMode(m); tabFocus = false; render(); Events.emit('ui:changed'); });
      tabsEl.append(b);
    }
  }

  function setMode(m) {
    if (mode === m) return;
    mode = m;
    setMsg(m === 'craft' ? SMITH_LINES.craftHello : (gearList().length ? SMITH_LINES.hello : SMITH_LINES.noGear));
  }

  // ---------- 위: 목록 ----------
  function renderEnhanceList() {
    const gears = gearList();
    const mats = matList();
    gi = Math.min(gi, Math.max(0, gears.length - 1));
    mi = Math.min(mi, Math.max(0, mats.length - 1));
    lists.classList.remove('craft');

    colGear.replaceChildren(el('h4', '', '장비 선택'));
    if (!gears.length) colGear.append(el('p', 'fp-empty', '장비가 없어요'));
    gears.forEach((inst, i) => {
      const def = ItemData[inst.id];
      const row = el('button', 'fp-row fp-gear-row' + (!tabFocus && focus === 0 && i === gi ? ' is-focus' : '') + (i === gi ? ' is-picked' : ''));
      row.type = 'button';
      const text = el('span', 'fp-text');
      text.append(
        el('span', 'fp-name', def.name),
        el('span', 'fp-sub', '★' + inst.grade + (def.weapon ? ` · 숙련 Lv.${inst.level}` : '') + (isEquipped(inst) ? ' · 장착 중' : '')),
      );
      row.append(icon(def, 'fp-icon'), text);
      row.addEventListener('click', () => { if (busy) return; tabFocus = false; focus = 0; gi = i; render(); Events.emit('ui:changed'); });
      colGear.append(row);
    });

    colMat.replaceChildren(el('h4', '', '재료 선택'));
    if (!mats.length) colMat.append(el('p', 'fp-empty', '강화재료가 없어요'));
    mats.forEach((it, i) => {
      const def = ItemData[it.id];
      const row = el('button', 'fp-row' + (!tabFocus && focus === 1 && i === mi ? ' is-focus' : '') + (i === mi ? ' is-picked' : ''));
      row.type = 'button';
      const bonus = def.forge.chanceBonus ? ` · +${Math.round(def.forge.chanceBonus * 100)}%` : '';
      row.append(el('span', 'fp-name', def.name), el('span', 'fp-sub', `×${it.count}${bonus}`));
      row.addEventListener('click', () => { if (busy) return; tabFocus = false; focus = 1; mi = i; render(); Events.emit('ui:changed'); });
      colMat.append(row);
    });
    const f = (focus === 0 ? colGear : colMat).querySelector('.is-focus');
    if (f) f.scrollIntoView({ block: 'nearest' });
  }

  function renderCraftList() {
    lists.classList.add('craft');
    ri = Math.min(ri, ForgeRecipes.length - 1);
    colGear.replaceChildren(el('h4', '', '제작할 장비 선택'));
    ForgeRecipes.forEach((r, i) => {
      const def = ItemData[r.result];
      const ok = canCraft(r);
      const row = el('div', 'fp-row fp-gear-row fp-recipe' + (!tabFocus && i === ri ? ' is-focus is-picked' : ''));
      const text = el('span', 'fp-text');
      text.append(el('span', 'fp-name', def.name), el('span', 'fp-sub', `★${r.grade} · ${ok ? '제작 가능' : '재료 부족'}`));
      const head = el('div', 'fp-recipe-head');
      head.append(icon(def, 'fp-icon'), text);
      row.append(head);
      if (i === ri) {                                  // 설명은 선택한 카드 아래에만
        const d = el('div', 'bag-desc');
        d.append(el('p', '', def.desc), el('p', 'bag-stat', weaponLine(def, r.grade)));
        const need = el('div', 'fp-needs');
        for (const x of r.needs) {
          const have = held(x.id);
          need.append(el('span', 'fp-need' + (have >= x.count ? ' ok' : ' lack'), `${ItemData[x.id].name} ${have}/${x.count}`));
        }
        const gold = GameState.get('wallet').gold;
        need.append(el('span', 'fp-need' + (gold >= r.gold ? ' ok' : ' lack'), `${r.gold}골드 (보유 ${gold})`));
        d.append(need);
        row.append(d);
      }
      row.addEventListener('click', () => { if (busy) return; tabFocus = false; if (i === ri) confirm(); else { ri = i; render(); Events.emit('ui:changed'); } });
      colGear.append(row);
    });
    const f = colGear.querySelector('.is-focus');
    if (f) f.scrollIntoView({ block: 'nearest' });
  }

  // ---------- 아래: 진행 장면 ----------
  function renderScene() {
    const stars = $('fg-stars');
    const info = $('fg-info');
    stars.replaceChildren();
    info.replaceChildren();
    const gearCanvas = $('fg-gear');

    if (mode === 'craft') {
      const r = ForgeRecipes[ri];
      const def = ItemData[r.result];
      gearCanvas.style.visibility = 'visible';
      drawCanvas(gearCanvas, Sprites.items[def.icon], sc);
      for (let i = 1; i <= Forge.maxGrade; i++) stars.append(el('span', 'fg-star' + (i <= r.grade ? ' on' : ''), '★'));
      info.append(
        el('b', '', def.name),
        el('span', 'fg-chance', `시작 등급 ★${r.grade}`),
        el('span', 'fg-mat', canCraft(r) ? '제작할 수 있어요' : '재료나 골드가 부족해요'),
      );
      return;
    }

    const inst = gearList()[gi];
    const mat = matList()[mi];
    if (!inst) {
      gearCanvas.style.visibility = 'hidden';
      info.append(el('b', '', '장비를 골라 주세요'));
      return;
    }
    const def = ItemData[inst.id];
    gearCanvas.style.visibility = 'visible';
    drawCanvas(gearCanvas, Sprites.items[def.icon], sc);
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
    renderTabs();
    if (mode === 'craft') renderCraftList(); else renderEnhanceList();
    renderScene();
  }

  // ---------- 강화 / 제작 ----------
  function strike(then) {
    busy = true;
    Events.emit('ui:changed');
    setMsg(SMITH_LINES.go);
    stage.classList.remove('strike');
    void stage.offsetWidth;
    stage.classList.add('strike');                       // 망치질 연출 (3번)
    later(then, 1100);
  }

  function enhance() {
    const inst = gearList()[gi];
    const mat = matList()[mi];
    if (!inst) { setMsg(SMITH_LINES.noGear); return; }
    if (inst.grade >= Forge.maxGrade) { setMsg(SMITH_LINES.max); return; }
    if (!mat) { setMsg(SMITH_LINES.noMat); return; }
    strike(() => Events.emit('forge:enhance', { uid: inst.uid, materialId: mat.id }));
  }

  function craft() {
    const r = ForgeRecipes[ri];
    if (GameState.get('wallet').gold < r.gold) { setMsg(SMITH_LINES.lackGold); return; }
    if (!canCraft(r)) { setMsg(SMITH_LINES.lackItems); return; }
    strike(() => Events.emit('forge:craft', { recipe: r.id }));
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

  const unbusy = () => later(() => { busy = false; Events.emit('ui:changed'); }, 1500);

  Events.on('forge:result', (r) => {
    if (!active) return;
    fx(r.success ? 'ok' : 'fail');
    setMsg(r.success ? `강화 성공! ★${r.to} 등급이 되었어!` : '아쉽게도 실패했어... 재료만 사라졌네. 다시 해 볼래?');
    render();
    unbusy();
  });

  Events.on('forge:crafted', ({ recipe }) => {
    if (!active) return;
    const r = ForgeRecipes.find((x) => x.id === recipe);
    fx('ok');
    setMsg(`${ItemData[r.result].name} 제작 완료! ★${r.grade} 등급이야. 장비 탭에서 장착해 봐.`);
    render();
    unbusy();
  });

  Events.on('forge:craft-failed', ({ reason }) => {
    if (!active) return;
    setMsg(reason === 'gold' ? SMITH_LINES.lackGold : SMITH_LINES.lackItems);
    busy = false;
    Events.emit('ui:changed');
  });

  // ---------- 열기 / 닫기 ----------
  function open() {
    if (active) return;
    active = true;
    busy = false;
    mode = 'enhance';
    tabFocus = false;
    focus = 0;
    gi = 0;
    mi = 0;
    ri = 0;
    $('fg-fx').replaceChildren();
    root.hidden = false;
    root.classList.remove('intro');
    void root.offsetWidth;
    root.classList.add('intro');
    dock.dataset.mode = 'forge';
    panel.hidden = false;
    sc = panel.clientHeight >= 140 ? 3 : 2;   // 낮은 화면에서는 작게
    drawCanvas($('fg-smith'), Sprites.npcs.smith.down[2], sc);
    drawCanvas($('fg-anvil'), Sprites.props.anvil, sc);
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
    if (tabFocus) {
      if (dir === 'left') setMode('enhance');
      else if (dir === 'right') setMode('craft');
      else if (dir === 'down') tabFocus = false;
      render();
      Events.emit('ui:changed');
      return;
    }
    if (mode === 'craft') {
      if (dir === 'up') { if (ri === 0) tabFocus = true; else ri -= 1; }
      else if (dir === 'down') ri = Math.min(ForgeRecipes.length - 1, ri + 1);
    } else if (dir === 'left') focus = 0;
    else if (dir === 'right') focus = 1;
    else {
      const n = (focus === 0 ? gearList() : matList()).length;
      const cur = focus === 0 ? gi : mi;
      if (dir === 'up' && cur === 0) tabFocus = true;
      else if (n) {
        const d = dir === 'up' ? -1 : 1;
        if (focus === 0) gi = Math.max(0, Math.min(n - 1, gi + d)); else mi = Math.max(0, Math.min(n - 1, mi + d));
      }
    }
    render();
    Events.emit('ui:changed');
  }

  function confirm() {
    if (busy) return;
    if (tabFocus) { tabFocus = false; render(); Events.emit('ui:changed'); return; }
    if (mode === 'craft') craft(); else enhance();
  }

  Events.on('building:enter', ({ id }) => { if (id === 'forge') open(); });
  Events.on('game:quit', close);
  Events.on('inventory:changed', () => { if (active && !busy) render(); });
  Events.on('state:wallet', () => { if (active && !busy) render(); });

  return {
    get active() { return active; },
    confirmLabel: () => (busy ? '...' : tabFocus ? '선택' : mode === 'craft' ? '제작' : '강화'),
    canBack: () => active && !busy,
    nav,
    confirm,
    back: close,
    close,
  };
})();
