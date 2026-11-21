// 장비 화면: 장착 중인 장비와 보유 장비 목록. 장비를 교체한다.
//   ◀▶ 무기/방어구 탭, ▲▼ 선택, 확인: 장착 (직접 눌러도 됨: 한 번 누르면 선택, 선택된 장비를 다시 누르면 장착)
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const TABS = [{ type: 'weapon', label: '무기' }, { type: 'armor', label: '방어구' }];
  let root = null;
  let tab = 0;
  let selected = 0;
  let list = [];
  let rows = [];
  let compare = null;

  const gearOf = (type) => GameState.get('gear').list.filter((g) => ItemData[g.id].type === type);
  const equippedUid = (type) => GameState.get('equipment')[type];

  const statOf = (inst) => (ItemData[inst.id].type === 'weapon' ? Stats.weaponAtk(inst) : Stats.armorDef(inst));
  const statName = (type) => (type === 'weapon' ? '공격' : '방어');

  function iconCanvas(def) {
    const c = el('canvas', 'bag-icon');
    c.width = 16;
    c.height = 16;
    c.getContext('2d').drawImage(Sprites.items[def.icon], 0, 0);
    return c;
  }

  function gradeText(inst) {
    return '★'.repeat(inst.grade) + (ItemData[inst.id].weapon ? `  숙련 Lv.${inst.level}` : '');
  }

  function showCompare() {
    compare.replaceChildren();
    const inst = list[selected];
    if (!inst) {
      compare.append(el('p', 'bag-empty', '이 종류의 장비가 없어요.'));
      return;
    }
    const type = ItemData[inst.id].type;
    const cur = GameState.get('gear').list.find((g) => g.uid === equippedUid(type));
    const now = statOf(inst);
    compare.append(el('h3', '', ItemData[inst.id].name), el('p', '', ItemData[inst.id].desc));
    const diff = cur ? now - statOf(cur) : now;
    const arrow = Math.abs(diff) < 0.05 ? '' : diff > 0 ? `  ▲ ${diff.toFixed(1)}` : `  ▼ ${Math.abs(diff).toFixed(1)}`;
    compare.append(el('p', 'bag-stat', `${statName(type)} +${now.toFixed(1)}${cur && cur.uid !== inst.uid ? arrow : ''}`));
    if (inst.uid === equippedUid(type)) compare.append(el('p', 'bag-action', '장착 중이에요.'));
    else {
      compare.append(el('p', 'bag-action', '확인 버튼이나 아래 버튼으로 장착해요.'));
      const b = el('button', 'bag-open', '장착');
      b.type = 'button';
      b.addEventListener('click', () => Events.emit('equip:request', { uid: inst.uid }));
      compare.append(b);
    }
  }

  function select(i) {
    if (!list.length) { showCompare(); return; }
    selected = (i + list.length) % list.length;
    rows.forEach((r, n) => r.classList.toggle('is-selected', n === selected));
    if (rows[selected]) rows[selected].scrollIntoView({ block: 'nearest' });
    showCompare();
  }

  function build() {
    if (!root) return;
    root.replaceChildren();
    rows = [];
    const type = TABS[tab].type;

    // 장착 중 요약
    const summary = el('div', 'eq-summary');
    for (const t of TABS) {
      const cur = GameState.get('gear').list.find((g) => g.uid === equippedUid(t.type));
      const box = el('div', 'eq-slot');
      box.append(el('span', 'eq-slot-label', t.label), el('b', '', cur ? ItemData[cur.id].name : '없음'));
      if (cur) box.append(el('span', 'eq-slot-sub', gradeText(cur)));
      summary.append(box);
    }

    // 탭
    const tabs = el('div', 'eq-tabs');
    TABS.forEach((t, i) => {
      const b = el('button', 'eq-tab' + (i === tab ? ' is-on' : ''), t.label);
      b.type = 'button';
      b.addEventListener('click', () => { tab = i; selected = 0; build(); });
      tabs.append(b);
    });

    list = gearOf(type);
    const ul = el('ul', 'bag-list');
    list.forEach((inst, idx) => {
      const def = ItemData[inst.id];
      const li = el('li', 'bag-row');
      li.addEventListener('click', () => (idx === selected ? confirm() : select(idx)));
      const text = el('div', 'bag-name', def.name);
      text.append(el('span', 'bag-type', gradeText(inst)));
      const right = el('div', 'bag-count', `+${statOf(inst).toFixed(1)}`);
      if (inst.uid === equippedUid(type)) right.append(el('span', 'bag-eq', '장착 중'));
      li.append(iconCanvas(def), text, right);
      ul.append(li);
      rows.push(li);
    });
    compare = el('div', 'bag-detail');
    root.append(summary, tabs, ul, compare);
    selected = Math.min(selected, Math.max(0, list.length - 1));
    select(selected);
  }

  function confirm() {
    const inst = list[selected];
    if (inst) Events.emit('equip:request', { uid: inst.uid });
  }

  Screens.register('equip', {
    title: '장비',
    render(body) { root = body; tab = 0; selected = 0; build(); },
    onClose() { root = null; },
    onNav(dir) {
      if (dir === 'left' || dir === 'right') { tab = (tab + (dir === 'right' ? 1 : TABS.length - 1)) % TABS.length; selected = 0; build(); }
      else if (dir === 'up') select(selected - 1);
      else if (dir === 'down') select(selected + 1);
    },
    onConfirm: confirm,
  });

  const refresh = () => { if (Screens.current === 'equip') build(); };
  Events.on('equipment:changed', refresh);
  Events.on('state:gear', refresh);
})();
