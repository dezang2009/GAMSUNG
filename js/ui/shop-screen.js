// 상점 화면. 위쪽은 사기/팔기 목록, 아래쪽(메뉴 자리)은 거래 장면(상인, 개수, 합계).
//   ▲▼ 아이템 선택 (맨 위에서 ▲ 를 누르면 사기/팔기 탭), ◀▶ 개수 조절(탭에서는 사기/팔기 전환), 확인(구매/판매), 뒤로(나가기)
//   목록, 탭, 개수 버튼은 직접 눌러도 된다.
//   규칙(가격, 골드, 아이템 지급)은 systems/shop.js 가 처리한다 ('shop:buy' / 'shop:sell').
const ShopUI = (() => {
  const $ = (id) => document.getElementById(id);
  const root = $('shop');
  const dock = $('dock');
  const panel = $('shop-panel');
  const listEl = $('sh-list');
  const tabsEl = $('sh-tabs');

  let active = false;
  let mode = 'buy';       // 'buy' | 'sell'
  let focus = 'list';     // 'tabs' | 'list'
  let sel = 0;
  let qty = 1;
  let sc = 3;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const held = (id) => (GameState.get('inventory').items.find((it) => it.id === id) || { count: 0 }).count;
  const gold = () => GameState.get('wallet').gold;

  // 지금 탭의 목록: { id, price, owned }
  function entries() {
    if (mode === 'buy') return ShopStock.shop.map((x) => ({ id: x.id, price: x.price, owned: held(x.id) }));
    return GameState.get('inventory').items
      .filter((it) => ItemData[it.id].sell)
      .sort((a, b) => ItemTypes[ItemData[a.id].type].order - ItemTypes[ItemData[b.id].type].order)
      .map((it) => ({ id: it.id, price: ItemData[it.id].sell, owned: it.count }));
  }

  const maxQty = (e) => (mode === 'buy' ? 99 : e.owned);
  const setMsg = (t) => { $('sh-msg').textContent = t; };

  function drawIcon(canvas, def, scale) {
    const img = Sprites.items[def.icon];
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.style.width = img.width * scale + 'px';
    canvas.style.height = img.height * scale + 'px';
  }

  // ---------- 위: 탭 + 목록 ----------
  function renderTabs() {
    tabsEl.replaceChildren();
    for (const [m, label] of [['buy', '사기'], ['sell', '팔기']]) {
      const b = el('button', 'sh-tab' + (mode === m ? ' is-on' : '') + (focus === 'tabs' && mode === m ? ' is-focus' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { if (mode !== m) { mode = m; sel = 0; qty = 1; } focus = 'list'; render(); Events.emit('ui:changed'); });
      tabsEl.append(b);
    }
  }

  function renderList() {
    const items = entries();
    sel = Math.min(sel, Math.max(0, items.length - 1));
    listEl.replaceChildren();
    if (!items.length) {
      listEl.append(el('p', 'bag-empty', mode === 'sell' ? '팔 수 있는 아이템이 없어요. 몬스터를 사냥해 전리품을 모아 오세요.' : '진열된 물건이 없어요.'));
      return;
    }
    items.forEach((e, i) => {
      const def = ItemData[e.id];
      const picked = focus === 'list' && i === sel;
      const li = el('div', 'bag-row' + (picked ? ' is-selected' : ''));
      const main = el('div', 'bag-row-main');
      const icon = el('canvas', 'bag-icon');
      icon.width = 16;
      icon.height = 16;
      icon.getContext('2d').drawImage(Sprites.items[def.icon], 0, 0);
      const text = el('div', 'bag-name', def.name);
      text.append(el('span', 'bag-type', `${ItemTypes[def.type].label} · 보유 ${e.owned}개`));
      const poor = mode === 'buy' && gold() < e.price;
      const price = el('div', 'sh-price' + (poor ? ' is-poor' : ''), e.price + ' G');
      price.append(el('small', '', '개당'));
      main.append(icon, text, price);
      li.append(main);
      if (picked) {                                     // 설명은 선택한 카드 아래에만
        const d = el('div', 'bag-desc');
        d.append(el('p', '', def.desc));
        li.append(d);
      }
      li.addEventListener('click', (ev) => {
        if (ev.target.closest('.bag-desc')) return;
        if (i === sel && focus === 'list') return;
        sel = i; qty = 1; focus = 'list'; render(); Events.emit('ui:changed');
      });
      listEl.append(li);
    });
    const cur = listEl.querySelector('.is-selected');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  // ---------- 아래: 거래 장면 ----------
  function renderScene() {
    const items = entries();
    const e = items[sel];
    const info = $('sh-info');
    info.replaceChildren();
    const icon = $('sh-item');
    if (!e) {
      icon.style.visibility = 'hidden';
      info.append(el('b', '', mode === 'sell' ? '팔 물건이 없어요' : '진열된 물건이 없어요'));
      return;
    }
    const def = ItemData[e.id];
    qty = Math.max(1, Math.min(qty, maxQty(e)));
    icon.style.visibility = 'visible';
    drawIcon(icon, def, sc);

    const row = el('div', 'sh-qty');
    const minus = el('button', '', '−');
    const plus = el('button', '', '+');
    const all = el('button', '', mode === 'buy' ? '최대' : '전부');
    for (const b of [minus, plus, all]) b.type = 'button';
    minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); renderScene(); });
    plus.addEventListener('click', () => { qty = Math.min(maxQty(e), qty + 1); renderScene(); });
    all.addEventListener('click', () => {
      qty = mode === 'buy' ? Math.max(1, Math.min(99, Math.floor(gold() / e.price))) : e.owned;
      renderScene();
    });
    row.append(minus, el('span', '', `${qty}개`), plus, all);
    const total = e.price * qty;
    info.append(el('b', '', def.name), row, el('span', 'sh-total', `합계 ${total.toLocaleString('ko-KR')} 골드`));
    if (mode === 'buy') info.append(el('span', 'sh-gold', `보유 ${gold().toLocaleString('ko-KR')} 골드`));
  }

  function render() {
    renderTabs();
    renderList();
    renderScene();
  }

  // ---------- 거래 ----------
  function act() {
    const e = entries()[sel];
    if (!e) { setMsg(mode === 'sell' ? '팔 물건이 없네요. 사냥해서 전리품을 모아 오세요!' : '지금은 진열된 물건이 없어요.'); return; }
    Events.emit(mode === 'buy' ? 'shop:buy' : 'shop:sell', { id: e.id, count: qty });
  }

  function floatText(text, color) {
    const f = $('sh-float');
    f.textContent = text;
    f.style.color = color;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  Events.on('shop:sold', ({ id, count, amount }) => {
    if (!active) return;
    setMsg(`${ItemData[id].name} ${count}개를 팔아서 ${amount}골드를 받았어요!`);
    floatText(`+${amount} G`, '#b8860b');
    qty = 1;
    render();
  });

  Events.on('shop:bought', ({ id, count, amount }) => {
    if (!active) return;
    setMsg(`${ItemData[id].name} ${count}개를 샀어요! (-${amount}골드)`);
    floatText(`-${amount} G`, '#c2493d');
    qty = 1;
    render();
  });

  Events.on('shop:failed', () => { if (active) setMsg('골드가 부족해요.'); });
  Events.on('state:wallet', () => { if (active) render(); });
  Events.on('inventory:changed', () => { if (active) render(); });

  // ---------- 열기 / 닫기 ----------
  function open() {
    if (active) return;
    active = true;
    mode = 'buy';
    focus = 'list';
    sel = 0;
    qty = 1;
    root.hidden = false;
    root.classList.remove('intro');
    void root.offsetWidth;
    root.classList.add('intro');
    dock.dataset.mode = 'shop';
    panel.hidden = false;
    sc = panel.clientHeight >= 140 ? 3 : 2;
    const merchant = Sprites.npcs.merchant.down[2];
    const mc = $('sh-merchant');
    mc.width = merchant.width;
    mc.height = merchant.height;
    mc.getContext('2d').drawImage(merchant, 0, 0);
    mc.style.width = merchant.width * sc + 'px';
    mc.style.height = merchant.height * sc + 'px';
    setMsg('어서 오세요! 사고 싶은 것도, 팔고 싶은 것도 말씀하세요.');
    render();
    Events.emit('shop:opened');
    Events.emit('ui:changed');
  }

  function close() {
    if (!active) return;
    active = false;
    root.hidden = true;
    dock.dataset.mode = '';
    panel.hidden = true;
    Events.emit('shop:closed');
    Events.emit('ui:changed');
  }

  // ---------- 하단 컨트롤에서 부르는 조작 ----------
  function nav(dir) {
    if (focus === 'tabs') {
      if (dir === 'left' || dir === 'right') { mode = dir === 'left' ? 'buy' : 'sell'; sel = 0; qty = 1; }
      else if (dir === 'down') focus = 'list';
      render();
      Events.emit('ui:changed');
      return;
    }
    const items = entries();
    if (dir === 'up') {
      if (sel === 0) { focus = 'tabs'; qty = 1; } else { sel -= 1; qty = 1; }
    } else if (dir === 'down') {
      if (items.length) { sel = Math.min(items.length - 1, sel + 1); qty = 1; }
    } else if (items.length) {
      qty = Math.max(1, Math.min(maxQty(items[sel]), qty + (dir === 'right' ? 1 : -1)));
    }
    render();
    Events.emit('ui:changed');
  }

  function confirm() {
    if (focus === 'tabs') { focus = 'list'; render(); Events.emit('ui:changed'); return; }
    act();
  }

  Events.on('building:enter', ({ id }) => { if (id === 'shop') open(); });
  Events.on('game:quit', close);

  return {
    get active() { return active; },
    confirmLabel: () => (focus === 'tabs' ? '선택' : mode === 'buy' ? '구매' : '판매'),
    canBack: () => active,
    nav,
    confirm,
    back: close,
  };
})();
