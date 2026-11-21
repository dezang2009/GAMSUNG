// 저장 화면(HUD 의 저장 버튼): 파일 3개 중 하나에 저장하거나 타이틀로 돌아간다.
// 조작: ▲▼ 선택 + 확인 (직접 눌러도 됨: 한 번 누르면 선택, 선택된 항목을 다시 누르면 실행)
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  let rows = [];
  let selected = 0;
  let hintEl = null;
  let armed = null;       // 한 번 더 눌러야 실행되는 항목 ('slot:2' | 'quit')
  let armTimer = 0;

  const items = () => {
    const out = [];
    for (let n = 1; n <= SaveStore.SLOTS; n++) out.push({ kind: 'slot', n });
    out.push({ kind: 'quit' });
    return out;
  };

  function hint(text) {
    if (hintEl) hintEl.textContent = text;
  }

  function select(i) {
    selected = (i + rows.length) % rows.length;
    rows.forEach((r, n) => r.classList.toggle('is-selected', n === selected));
    rows[selected].scrollIntoView({ block: 'nearest' });
  }

  function arm(key, message) {
    armed = key;
    hint(message);
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed = null; hint('저장할 파일을 고르세요.'); }, 3500);
  }

  function confirm() {
    const it = items()[selected];
    if (it.kind === 'quit') {
      if (armed !== 'quit') { arm('quit', '타이틀로 돌아가면 저장하지 않은 진행은 사라져요. 한 번 더 누르면 돌아가요.'); return; }
      Screens.close();
      Events.emit('game:quit');
      return;
    }
    const filledOther = SaveStore.read(it.n) && SaveStore.current !== it.n;
    if (filledOther && armed !== 'slot:' + it.n) { arm('slot:' + it.n, `파일 ${it.n}의 기존 기록을 덮어써요. 한 번 더 누르면 저장해요.`); return; }
    armed = null;
    Events.emit('save:request', { slot: it.n });
  }

  function build(body) {
    body.replaceChildren();
    rows = [];
    hintEl = el('p', 'explore-hint', '저장할 파일을 고르세요.');
    const ul = el('ul', 'region-list');
    items().forEach((it, idx) => {
      const li = el('li');
      const box = el('div', 'region-card sys-row');
      const text = el('div');
      if (it.kind === 'slot') {
        const s = SaveStore.summary(it.n);
        text.append(el('h3', '', `파일 ${it.n}`), el('p', '', s ? `Lv.${s.level} · ${s.place || '모험 중'} · ${s.savedAt} 저장` : '비어 있음'));
        if (SaveStore.current === it.n) text.append(el('span', 'badge', '현재 파일'));
      } else {
        text.append(el('h3', '', '타이틀로 돌아가기'), el('p', '', '메인 화면에서 다른 파일을 고를 수 있어요.'));
      }
      box.append(text);
      box.addEventListener('click', () => (idx === selected ? confirm() : select(idx)));
      li.appendChild(box);
      ul.appendChild(li);
      rows.push(box);
    });
    body.append(hintEl, ul);
    select(selected);
  }

  Screens.register('system', {
    title: '저장',
    render(body) { selected = 0; armed = null; build(body); },
    onNav(dir) {
      if (dir === 'up') select(selected - 1);
      else if (dir === 'down') select(selected + 1);
    },
    onConfirm: confirm,
  });

  Events.on('save:done', () => {
    if (Screens.current === 'system') build(document.getElementById('screen-body'));
  });

  document.getElementById('sys-btn').addEventListener('click', () => {
    if (Screens.current === 'system') Screens.close();
    else if (!BattleUI.active && !ForgeUI.active) Screens.open('system');
  });
})();
