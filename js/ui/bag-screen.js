// 가방 화면: 보유 아이템(쌓이는 것 + 장비)과 상세. 조작은 하단 컨트롤(방향/확인/뒤로)이나 직접 터치.
//   ▲▼ 또는 직접 눌러 선택, 확인(또는 상세의 버튼): 꾸러미는 열기, 장비는 장착
(() => {
  const bagBtn = document.querySelector('.dock-btn[data-menu="bag"]');
  let root = null;
  let selected = 0;
  let result = null;   // 방금 꾸러미를 열어 얻은 목록 (보여 주는 중이면 값이 있다)
  let rows = [];
  let detail = null;
  let list = [];       // 화면에 그리는 항목: { kind: 'stack' | 'gear', def, it | inst }

  // 쌓이는 아이템과 장비를 종류 순서(꾸러미, 무기, 방어구, 물약)로 합친다
  function collect() {
    const out = [];
    for (const it of GameState.get('inventory').items) out.push({ kind: 'stack', def: ItemData[it.id], it });
    for (const inst of GameState.get('gear').list) out.push({ kind: 'gear', def: ItemData[inst.id], inst });
    return out.sort((a, b) => ItemTypes[a.def.type].order - ItemTypes[b.def.type].order);
  }

  const isEquipped = (inst) => {
    const eq = GameState.get('equipment');
    return eq.weapon === inst.uid || eq.armor === inst.uid;
  };

  function iconCanvas(def) {
    const c = document.createElement('canvas');
    c.className = 'bag-icon';
    c.width = 16;
    c.height = 16;
    c.getContext('2d').drawImage(Sprites.items[def.icon], 0, 0); // 아이콘이 16x16(외곽선 포함)이라 0,0 에 그려야 잘리지 않는다
    return c;
  }

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // 장비 상세: 능력치, 숙련, 기술
  function gearDetail(entry) {
    const { inst, def } = entry;
    const wrap = document.createDocumentFragment();
    wrap.append(el('h3', '', def.name), el('p', '', def.desc));
    const stats = el('p', 'bag-stat');
    if (def.weapon) {
      const cap = Progression.weaponMaxLevel(inst.grade);
      const need = Progression.weaponExpToNext(inst.level);
      stats.textContent = `등급 ${inst.grade} · 숙련 Lv.${inst.level}/${cap} · 공격 +${Stats.weaponAtk(inst).toFixed(1)}`;
      wrap.append(stats);
      wrap.append(el('p', 'bag-stat', inst.level >= cap ? '숙련 한계 (등급을 올리면 더 성장해요)' : `숙련 경험치 ${inst.exp}/${need}`));
      const sk = el('div', 'bag-skills');
      for (const u of def.weapon.skills) {
        const s = SkillData[u.skill];
        const owned = GameState.get('skills').known.includes(u.skill);
        const reached = inst.level >= u.level;
        sk.append(el('span', 'bag-skill' + (owned ? ' is-owned' : reached ? '' : ' is-locked'), `${s.name} · Lv.${u.level}${owned ? ' ✓' : ''}`));
      }
      wrap.append(sk);
    } else {
      stats.textContent = `등급 ${inst.grade} · 방어 +${Stats.armorDef(inst).toFixed(1)}`;
      wrap.append(stats);
    }
    return wrap;
  }

  function showDetail() {
    detail.replaceChildren();
    if (result) {
      detail.className = 'bag-detail bag-result';
      const ul = el('ul');
      for (const g of result.gained) {
        const li = el('li');
        li.append(el('span', '', ItemData[g.id].name), el('b', '', '×' + g.count));
        ul.appendChild(li);
      }
      detail.append(el('h3', '', ItemData[result.id].name + '을(를) 열었어요!'), ul);
      return;
    }
    detail.className = 'bag-detail';
    const entry = list[selected];
    if (!entry) return;
    const { def } = entry;
    if (entry.kind === 'gear') {
      detail.append(gearDetail(entry));
      const equipped = isEquipped(entry.inst);
      detail.append(el('p', 'bag-action', equipped ? '장착 중이에요.' : '확인 버튼이나 아래 버튼으로 장착할 수 있어요.'));
      if (!equipped) {
        const b = el('button', 'bag-open', '장착');
        b.type = 'button';
        b.addEventListener('click', () => Events.emit('equip:request', { uid: entry.inst.uid }));
        detail.append(b);
      }
      return;
    }
    detail.append(el('h3', '', def.name), el('p', '', def.desc));
    if (def.type === 'package') {
      detail.append(el('p', 'bag-action', '확인 버튼이나 아래 버튼으로 열어 볼 수 있어요.'));
      const b = el('button', 'bag-open', '열기');
      b.type = 'button';
      b.addEventListener('click', () => Events.emit('inventory:use', { id: entry.it.id }));
      detail.append(b);
    }
  }

  function select(i) {
    if (!list.length) return;
    selected = (i + list.length) % list.length;
    rows.forEach((r, n) => r.classList.toggle('is-selected', n === selected));
    if (rows[selected]) rows[selected].scrollIntoView({ block: 'nearest' });
    showDetail();
  }

  function build() {
    if (!root) return;
    root.replaceChildren();
    rows = [];
    list = collect();
    if (!list.length) {
      root.appendChild(el('p', 'bag-empty', '가방이 비어 있어요.'));
      return;
    }
    const ul = el('ul', 'bag-list');
    for (const entry of list) {
      const { def } = entry;
      const li = el('li', 'bag-row');
      const idx = rows.length;
      li.addEventListener('click', () => { result = null; select(idx); }); // 눌러서 선택
      const text = el('div', 'bag-name', def.name);
      text.append(el('span', 'bag-type', ItemTypes[def.type].label));
      let right;
      if (entry.kind === 'gear') {
        right = el('div', 'bag-count', def.weapon ? `Lv.${entry.inst.level}` : `★${entry.inst.grade}`);
        if (isEquipped(entry.inst)) right.append(el('span', 'bag-eq', '장착 중'));
      } else {
        right = el('div', 'bag-count', '×' + entry.it.count);
      }
      li.append(iconCanvas(def), text, right);
      ul.appendChild(li);
      rows.push(li);
    }
    detail = el('div');
    root.append(ul, detail);
    selected = Math.min(selected, list.length - 1);
    select(selected);
  }

  function confirm() {
    if (result) { result = null; showDetail(); return; }
    const entry = list[selected];
    if (!entry) return;
    if (entry.kind === 'gear') Events.emit('equip:request', { uid: entry.inst.uid });
    else if (entry.def.type === 'package') Events.emit('inventory:use', { id: entry.it.id });
    else Events.emit('toast', { text: '가방에서는 쓸 수 없어요. 전투 중에 사용해요.' });
  }

  Screens.register('bag', {
    title: '가방',
    render(body) {
      root = body;
      result = null;
      selected = 0;
      build();
    },
    onClose() { root = null; result = null; },
    onNav(dir) {
      if (result) { result = null; showDetail(); }
      if (dir === 'up') select(selected - 1);
      else if (dir === 'down') select(selected + 1);
    },
    onConfirm: confirm,
  });

  const refresh = () => {
    if (Screens.current === 'bag') build();
  };

  Events.on('inventory:changed', () => {
    if (Screens.current === 'bag') build();
    else bagBtn.classList.add('has-new');   // 새 아이템이 있으면 가방 버튼에 점을 띄운다
  });
  Events.on('equipment:changed', refresh);
  Events.on('state:gear', refresh);
  Events.on('state:skills', refresh);

  Events.on('inventory:opened', ({ id, gained }) => {
    result = { id, gained };
    if (Screens.current === 'bag' && detail) showDetail();
  });

  Screens.onChange((id) => { if (id === 'bag') bagBtn.classList.remove('has-new'); });
})();
