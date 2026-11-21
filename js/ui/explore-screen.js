// 탐험 화면: 이동할 수 있는 장소(마을/탐험 지역) 목록. 선택하면 'location:request' 이벤트로 이동을 요청한다.
(() => {
  function resolveSprite(key, i) {
    let o = Sprites;
    for (const part of key.split('.')) o = o[part];
    if (o instanceof HTMLCanvasElement) return o;
    return o.right ? o.right[i] : o[i];
  }

  // 카드 썸네일: 잔디 바탕에 장소를 대표하는 그림 (잠긴 지역은 자물쇠)
  function makeThumb(region) {
    const size = region.thumbSize || 44;
    const c = document.createElement('canvas');
    c.className = 'thumb';
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.drawImage(Sprites.makeGrassPattern(size, size), 0, 0);
    if (region.locked) {
      g.fillStyle = '#efe4cc';
      g.fillRect(0, 0, size, size);
      const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      r(15, 12, 14, 4, '#b5a58b'); r(15, 12, 4, 12, '#b5a58b'); r(25, 12, 4, 12, '#b5a58b');
      r(16, 13, 2, 11, '#fff8ec'); r(26, 13, 2, 11, '#fff8ec'); r(16, 13, 12, 2, '#fff8ec');
      r(11, 22, 22, 15, '#b5a58b'); r(12, 23, 20, 13, '#d6c8ad'); r(12, 33, 20, 3, '#c4b596');
      r(21, 27, 2, 5, '#9a8a6d');
    } else {
      for (const [key, i, x, y] of region.thumb || []) g.drawImage(resolveSprite(key, i), x, y);
    }
    return c;
  }

  function card(region, here, onTap) {
    const li = document.createElement('li');
    const box = document.createElement('div'); // 한 번 누르면 선택, 선택된 카드를 다시 누르면 이동
    box.className = 'region-card' + (region.locked ? ' locked' : '') + (here ? ' is-here' : '');
    box.addEventListener('click', onTap);

    const text = document.createElement('div');
    text.innerHTML = '<h3></h3><p></p><span class="badge"></span>';
    text.querySelector('h3').textContent = region.name;
    text.querySelector('p').textContent = region.desc;
    text.querySelector('.badge').textContent =
      region.locked ? '준비 중' : here ? '현재 위치' : region.type === 'village' ? '마을로 이동' : '입장 가능';

    box.append(makeThumb(region), text);
    li.appendChild(box);
    return li;
  }

  let items = [];     // 카드 요소
  let selected = 0;   // 커서 위치

  function select(i) {
    selected = (i + items.length) % items.length;
    items.forEach((el, n) => el.classList.toggle('is-selected', n === selected));
    items[selected].scrollIntoView({ block: 'nearest' });
  }

  Screens.register('explore', {
    title: '탐험',
    render(body) {
      const hint = document.createElement('p');
      hint.className = 'explore-hint';
      hint.textContent = '장소를 눌러 고르고, 한 번 더 누르거나 확인 버튼으로 이동해요.';
      const list = document.createElement('ul');
      list.className = 'region-list';
      const here = GameState.get('location').id;
      items = [];
      Regions.forEach((region) => {
        const idx = items.length;
        const li = card(region, region.id === here, () => (idx === selected ? confirm() : select(idx)));
        list.appendChild(li);
        items.push(li.firstChild);
      });
      body.append(hint, list);
      select(Math.max(0, Regions.findIndex((r) => r.id === here)));
    },
    onNav(dir) {
      if (dir === 'up') select(selected - 1);
      else if (dir === 'down') select(selected + 1);
    },
    onConfirm: confirm,
  });

  function confirm() {
      const region = Regions[selected];
      if (region.locked) return;
      const here = region.id === GameState.get('location').id;
      Screens.close();
      if (!here) Events.emit('location:request', { id: region.id });
  }
})();
