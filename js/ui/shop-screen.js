// 판매소 화면. 위쪽은 팔 수 있는 아이템 목록, 아래쪽(메뉴 자리)은 판매 장면(상인, 개수, 합계).
//   ▲▼ 아이템 선택, ◀▶ 개수 조절, 확인(판매), 뒤로(나가기). 목록과 개수 버튼은 직접 눌러도 된다.
//   판매 규칙(가격, 골드 지급)은 systems/shop.js 가 처리한다 ('shop:sell' -> 'shop:sold').
const ShopUI = (() => {
  const $ = (id) => document.getElementById(id);
  const root = $('shop');
  const dock = $('dock');
  const panel = $('shop-panel');
  const listEl = $('sh-list');

  let active = false;
  let sel = 0;
  let qty = 1;
  let sc = 3;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // 팔 수 있는 아이템(sell 가격이 있는 것), 종류 순서대로
  function sellables() {
    return GameState.get('inventory').items
      .filter((it) => ItemData[it.id].sell)
      .sort((a, b) => ItemTypes[ItemData[a.id].type].order - ItemTypes[ItemData[b.id].type].order);
  }

  const setMsg = (t) => { $('sh-msg').textContent = t; };

  function drawIcon(canvas, def, scale) {
    const img = Sprites.items[def.icon];
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.style.width = img.width * scale + 'px';
    canvas.style.height = img.height * scale + 'px';
  }

  // ---------- 위: 목록 ----------
  function renderList() {
    const items = sellables();
    sel = Math.min(sel, Math.max(0, items.length - 1));
    listEl.replaceChildren();
    if (!items.length) {
      listEl.append(el('p', 'bag-empty', '팔 수 있는 아이템이 없어요. 몬스터를 사냥해 전리품을 모아 오세요.'));
      return;
    }
    items.forEach((it, i) => {
      const def = ItemData[it.id];
      const li = el('div', 'bag-row' + (i === sel ? ' is-selected' : ''));
      const main = el('div', 'bag-row-main');
      const icon = el('canvas', 'bag-icon');
      icon.width = 16;
      icon.height = 16;
      icon.getContext('2d').drawImage(Sprites.items[def.icon], 0, 0);
      const text = el('div', 'bag-name', def.name);
      text.append(el('span', 'bag-type', `${ItemTypes[def.type].label} · 보유 ${it.count}개`));
      const price = el('div', 'sh-price', def.sell + ' G');
      price.append(el('small', '', '개당'));
      main.append(icon, text, price);
      li.append(main);
      if (i === sel) li.append(el('div', 'bag-desc', '')), li.lastChild.append(el('p', '', def.desc));  // 설명은 선택한 카드 아래에만
      li.addEventListener('click', (e) => { if (e.target.closest('.bag-desc')) return; if (i !== sel) { sel = i; qty = 1; render(); } });
      listEl.append(li);
    });
    const cur = listEl.querySelector('.is-selected');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  // ---------- 아래: 판매 장면 ----------
  function renderScene() {
    const items = sellables();
    const it = items[sel];
    const info = $('sh-info');
    info.replaceChildren();
    const itemCanvas = $('sh-item');
    if (!it) {
      itemCanvas.style.visibility = 'hidden';
      info.append(el('b', '', '팔 물건이 없어요'));
      return;
    }
    const def = ItemData[it.id];
    qty = Math.max(1, Math.min(qty, it.count));
    itemCanvas.style.visibility = 'visible';
    drawIcon(itemCanvas, def, sc);

    const row = el('div', 'sh-qty');
    const minus = el('button', '', '−');
    const plus = el('button', '', '+');
    const all = el('button', '', '전부');
    for (const b of [minus, plus, all]) b.type = 'button';
    minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); renderScene(); });
    plus.addEventListener('click', () => { qty = Math.min(it.count, qty + 1); renderScene(); });
    all.addEventListener('click', () => { qty = it.count; renderScene(); });
    row.append(minus, el('span', '', `${qty}개`), plus, all);
    info.append(el('b', '', def.name), row, el('span', 'sh-total', `합계 ${(def.sell * qty).toLocaleString('ko-KR')} 골드`));
  }

  function render() {
    renderList();
    renderScene();
  }

  // ---------- 판매 ----------
  function sell() {
    const it = sellables()[sel];
    if (!it) { setMsg('팔 물건이 없네요. 사냥해서 전리품을 모아 오세요!'); return; }
    Events.emit('shop:sell', { id: it.id, count: qty });
  }

  Events.on('shop:sold', ({ id, count, amount }) => {
    if (!active) return;
    setMsg(`${ItemData[id].name} ${count}개를 팔아서 ${amount}골드를 받았어요!`);
    const f = $('sh-float');
    f.textContent = `+${amount} G`;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
    qty = 1;
    render();
  });

  // ---------- 열기 / 닫기 ----------
  function open() {
    if (active) return;
    active = true;
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
    setMsg('어서 오세요! 팔고 싶은 전리품을 골라 주세요.');
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
    const items = sellables();
    if (!items.length) return;
    if (dir === 'up' || dir === 'down') {
      sel = (sel + (dir === 'up' ? -1 : 1) + items.length) % items.length;
      qty = 1;
    } else {
      qty = Math.max(1, Math.min(items[sel].count, qty + (dir === 'right' ? 1 : -1)));
    }
    render();
  }

  Events.on('building:enter', ({ id }) => { if (id === 'shop') open(); });
  Events.on('game:quit', close);
  Events.on('inventory:changed', () => { if (active) render(); });

  return {
    get active() { return active; },
    confirmLabel: () => '판매',
    canBack: () => active,
    nav,
    confirm: sell,
    back: close,
  };
})();
