// 여관 화면: 골드를 내고 쉬면 HP/MP 가 모두 회복된다. 건물(여관)에 들어가면 열린다.
// 조작: ▲▼ 선택 + 확인 (직접 눌러도 됨: 한 번 누르면 선택, 선택된 항목을 다시 누르면 실행)
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  let root = null;
  let selected = 0;
  let rows = [];

  const OPTIONS = [
    { id: 'rest', title: '휴식하기', desc: () => `${Services.innCost}골드를 내고 HP와 MP를 모두 회복해요.` },
    { id: 'leave', title: '나가기', desc: () => '여관에서 나가요.' },
  ];

  function select(i) {
    selected = (i + rows.length) % rows.length;
    rows.forEach((r, n) => r.classList.toggle('is-selected', n === selected));
  }

  function build() {
    if (!root) return;
    root.replaceChildren();
    rows = [];
    const p = GameState.get('player');

    // 여관 주인과 현재 상태
    const head = el('div', 'inn-head');
    const face = el('canvas', 'inn-face');
    const img = Sprites.npcs.innkeeper.down[2];
    face.width = img.width;
    face.height = img.height;
    face.getContext('2d').drawImage(img, 0, 0);
    const text = el('div');
    text.append(
      el('b', '', '여관 주인 하나'),
      el('p', 'ch-note', '어서 오세요. 푹 쉬고 가세요.'),
    );
    head.append(face, text);

    const status = el('div', 'ch-section');
    status.append(
      el('div', 'ch-row'), el('div', 'ch-row'), el('div', 'ch-row'),
    );
    const set = (i, k, v) => { status.children[i].append(el('span', '', k), el('b', '', v)); };
    set(0, 'HP', `${p.hp} / ${p.maxHp}`);
    set(1, 'MP', `${p.mp} / ${p.maxMp}`);
    set(2, '보유 골드', `${GameState.get('wallet').gold.toLocaleString('ko-KR')} G`);

    const ul = el('ul', 'region-list');
    OPTIONS.forEach((opt, idx) => {
      const li = el('li');
      const box = el('div', 'region-card sys-row');
      const body = el('div');
      body.append(el('h3', '', opt.title), el('p', '', opt.desc()));
      box.append(body);
      box.addEventListener('click', () => (idx === selected ? confirm() : select(idx)));
      li.append(box);
      ul.append(li);
      rows.push(box);
    });
    root.append(head, status, ul);
    select(selected);
  }

  function confirm() {
    if (OPTIONS[selected].id === 'leave') { Screens.close(); return; }
    Events.emit('inn:rest');
  }

  Screens.register('inn', {
    title: '여관',
    render(body) { root = body; selected = 0; build(); },
    onClose() { root = null; },
    onNav(dir) {
      if (dir === 'up') select(selected - 1);
      else if (dir === 'down') select(selected + 1);
    },
    onConfirm: confirm,
  });

  Events.on('inn:rested', () => { Events.emit('toast', { text: '푹 쉬었어요! HP와 MP가 모두 회복됐어요.' }); if (Screens.current === 'inn') build(); });
  Events.on('inn:failed', ({ reason }) => Events.emit('toast', { text: reason === 'full' ? '이미 몸이 가뿐해요. 쉴 필요가 없어요.' : '골드가 부족해요.' }));
  Events.on('state:wallet', () => { if (Screens.current === 'inn') build(); });
  Events.on('building:enter', ({ id }) => { if (id === 'inn') Screens.open('inn'); });
})();
