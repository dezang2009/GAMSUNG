// 가방 화면: 보유 아이템 목록과 상세. 조작은 하단 컨트롤(방향/확인/뒤로)로만 한다.
//   ▲▼ 또는 직접 눌러 아이템 선택, 확인(또는 상세의 열기 버튼): 꾸러미 열기 (다른 아이템의 사용/장착은 추후)
(() => {
  const bagBtn = document.querySelector('.dock-btn[data-menu="bag"]');
  let root = null;
  let selected = 0;
  let result = null;   // 방금 꾸러미를 열어 얻은 목록 (보여 주는 중이면 값이 있다)
  let rows = [];
  let detail = null;

  const items = () => GameState.get('inventory').items;

  function iconCanvas(def) {
    const c = document.createElement('canvas');
    c.className = 'bag-icon';
    c.width = 16;
    c.height = 16;
    const g = c.getContext('2d');
    g.drawImage(Sprites.items[def.icon], 0, 0); // 아이콘이 16x16(외곽선 포함)이라 잘리지 않게 0,0 에 그린다
    return c;
  }

  function showDetail() {
    detail.replaceChildren();
    if (result) {
      detail.className = 'bag-detail bag-result';
      const h = document.createElement('h3');
      h.textContent = ItemData[result.id].name + '을(를) 열었어요!';
      const ul = document.createElement('ul');
      for (const g of result.gained) {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = ItemData[g.id].name;
        const n = document.createElement('b');
        n.textContent = '×' + g.count;
        li.append(name, n);
        ul.appendChild(li);
      }
      detail.append(h, ul);
      return;
    }
    detail.className = 'bag-detail';
    const it = items()[selected];
    if (!it) return;
    const def = ItemData[it.id];
    const h = document.createElement('h3');
    h.textContent = def.name;
    const p = document.createElement('p');
    p.textContent = def.desc;
    detail.append(h, p);
    if (def.type === 'package') {
      const a = document.createElement('p');
      a.className = 'bag-action';
      a.textContent = '확인 버튼이나 아래 버튼으로 열어 볼 수 있어요.';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'bag-open';
      open.textContent = '열기';
      open.addEventListener('click', () => Events.emit('inventory:use', { id: it.id }));
      detail.append(a, open);
    }
  }

  function select(i) {
    if (!items().length) return;
    selected = (i + items().length) % items().length;
    rows.forEach((el, n) => el.classList.toggle('is-selected', n === selected));
    if (rows[selected]) rows[selected].scrollIntoView({ block: 'nearest' });
    showDetail();
  }

  function build() {
    if (!root) return;
    root.replaceChildren();
    rows = [];
    const list = items();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'bag-empty';
      empty.textContent = '가방이 비어 있어요.';
      root.appendChild(empty);
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'bag-list';
    for (const it of list) {
      const def = ItemData[it.id];
      const li = document.createElement('li');
      li.className = 'bag-row';
      const idx = rows.length;
      li.addEventListener('click', () => { if (result) { result = null; } select(idx); }); // 눌러서 선택
      const text = document.createElement('div');
      text.className = 'bag-name';
      text.textContent = def.name;
      const type = document.createElement('span');
      type.className = 'bag-type';
      type.textContent = ItemTypes[def.type].label;
      text.appendChild(type);
      const count = document.createElement('div');
      count.className = 'bag-count';
      count.textContent = '×' + it.count;
      li.append(iconCanvas(def), text, count);
      ul.appendChild(li);
      rows.push(li);
    }
    detail = document.createElement('div');
    root.append(ul, detail);
    selected = Math.min(selected, list.length - 1);
    select(selected);
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
    onConfirm() {
      if (result) { result = null; showDetail(); return; }
      const it = items()[selected];
      if (!it) return;
      if (ItemData[it.id].type === 'package') Events.emit('inventory:use', { id: it.id });
      else Events.emit('toast', { text: '아직 사용할 수 없어요. (준비 중)' });
    },
  });

  Events.on('inventory:changed', () => {
    if (Screens.current === 'bag') build();
    else bagBtn.classList.add('has-new');   // 새 아이템이 있으면 가방 버튼에 점을 띄운다
  });

  Events.on('inventory:opened', ({ id, gained }) => {
    result = { id, gained };
    if (Screens.current === 'bag' && detail) showDetail();
  });

  Screens.onChange((id) => { if (id === 'bag') bagBtn.classList.remove('has-new'); });
})();
