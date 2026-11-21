// 의뢰소 화면: 게시판에 의뢰서가 붙어 있는 형태 (새 의뢰 / 진행 중 / 완료 가능 / 완료). 건물(의뢰소)에 들어가면 열린다.
//   방향 버튼으로 의뢰서를 고르고, 확인: 수락 또는 보상 받기 (직접 눌러도 됨: 한 번 누르면 선택, 선택된 의뢰를 다시 누르면 실행)
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  let root = null;
  let selected = 0;
  let list = [];
  let rows = [];

  const state = () => GameState.get('quests');
  const held = (id) => (GameState.get('inventory').items.find((it) => it.id === id) || { count: 0 }).count;

  function progress(q) {
    if (q.goal.type === 'collect') return Math.min(q.goal.count, held(q.goal.item));
    return Math.min(q.goal.count, (state().active[q.id] || { progress: 0 }).progress);
  }

  // 의뢰의 현재 상태: ready(보상 받기) | active | available | done | locked
  function statusOf(q) {
    const s = state();
    if (s.done.includes(q.id)) return 'done';
    if (s.active[q.id]) return progress(q) >= q.goal.count ? 'ready' : 'active';
    if (q.after && !q.after.every((a) => s.done.includes(a))) return 'locked';
    return 'available';
  }

  const ORDER = { ready: 0, active: 1, available: 2, done: 3 };
  const BADGE = { ready: '완료 가능', active: '진행 중', available: '새 의뢰', done: '완료' };

  function goalText(q) {
    const name = q.goal.type === 'kill' ? (MonsterData.find((m) => m.id === q.goal.target) || {}).name : ItemData[q.goal.item].name;
    return q.goal.type === 'kill' ? `${name} ${q.goal.count}마리 처치` : `${name} ${q.goal.count}개 수집`;
  }

  function rewardText(q) {
    const r = q.reward || {};
    const parts = [];
    if (r.gold) parts.push(`${r.gold}골드`);
    if (r.exp) parts.push(`경험치 ${r.exp}`);
    for (const it of r.items || []) parts.push(`${ItemData[it.id].name} ×${it.count}`);
    return parts.join(' · ');
  }

  function select(i) {
    if (!rows.length) return;
    selected = (i + rows.length) % rows.length;
    rows.forEach((r, n) => r.classList.toggle('is-selected', n === selected));
    renderDetail();
    rows[selected].scrollIntoView({ block: 'nearest' });
  }

  // 설명은 선택한 의뢰 카드 아래에만
  function renderDetail() {
    rows.forEach((r) => { const d = r.querySelector('.bag-desc'); if (d) d.remove(); });
    const q = list[selected];
    if (!q) return;
    const st = statusOf(q);
    const d = el('div', 'bag-desc');
    d.append(el('p', '', q.desc));
    d.append(el('p', 'bag-stat', `목표: ${goalText(q)}${st === 'active' || st === 'ready' ? ` (${progress(q)}/${q.goal.count})` : ''}`));
    d.append(el('p', 'bag-stat', `보상: ${rewardText(q)}`));
    const hint = { available: '확인 버튼으로 의뢰를 수락해요.', ready: '확인 버튼으로 보상을 받아요.', active: '아직 목표를 채우지 못했어요.', done: '이미 끝낸 의뢰예요.' }[st];
    d.append(el('p', 'bag-action', hint));
    rows[selected].append(d);
  }

  function build() {
    if (!root) return;
    root.replaceChildren();
    rows = [];
    list = QuestData.filter((q) => statusOf(q) !== 'locked').sort((a, b) => ORDER[statusOf(a)] - ORDER[statusOf(b)]);
    if (!list.length) { root.append(el('p', 'bag-empty', '지금은 받을 수 있는 의뢰가 없어요.')); return; }
    const board = el('div', 'board');
    const ul = el('ul', 'board-notes');
    list.forEach((q, idx) => {
      const st = statusOf(q);
      const li = el('li', 'note bag-row' + (st === 'done' ? ' is-done' : ''));
      li.append(el('i', 'note-pin'));
      const main = el('div', 'quest-main');
      const text = el('div', 'bag-name', q.name);
      text.append(el('span', 'bag-type', `의뢰인 ${q.giver}`));
      main.append(text, el('span', 'quest-badge is-' + st, BADGE[st]));
      li.append(main);
      li.addEventListener('click', (e) => { if (e.target.closest('.bag-desc')) return; idx === selected ? confirm() : select(idx); });
      ul.append(li);
      rows.push(li);
    });
    board.append(ul);
    root.append(board);
    selected = Math.min(selected, list.length - 1);
    select(selected);
  }

  function confirm() {
    const q = list[selected];
    if (!q) return;
    const st = statusOf(q);
    if (st === 'available') Events.emit('quest:accept', { id: q.id });
    else if (st === 'ready') Events.emit('quest:turnin', { id: q.id });
    else if (st === 'active') Events.emit('toast', { text: `아직 목표를 채우지 못했어요. (${progress(q)}/${q.goal.count})` });
  }

  Screens.register('quests', {
    title: '의뢰소',
    render(body) { root = body; selected = 0; build(); },
    onClose() { root = null; },
    onNav(dir) {   // 의뢰서는 위→아래, 왼쪽→오른쪽 순서로 이어진다
      if (dir === 'up' || dir === 'left') select(selected - 1);
      else select(selected + 1);
    },
    onConfirm: confirm,
  });

  Events.on('quest:changed', () => { if (Screens.current === 'quests') build(); });
  Events.on('building:enter', ({ id }) => { if (id === 'quests') Screens.open('quests'); });
})();
