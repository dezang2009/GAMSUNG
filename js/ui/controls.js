// 하단 컨트롤: 거의 모든 터치가 이 영역에서 일어나도록 모드에 따라 바뀐다.
//   field  : 왼쪽 조이스틱 + (대상 옆에서만) 오른쪽 대화 버튼
//   screen : 왼쪽 방향 버튼 + 오른쪽 확인/뒤로 (메뉴 화면, 목록 선택 등)
//   dialog : 오른쪽 다음(닫기)/뒤로 (NPC 대화)
//   forge  : 대장간. 왼쪽 방향 버튼 + 오른쪽 강화/나가기
//   battle : 왼쪽 방향 버튼 + 오른쪽 확인(다음)/뒤로 (전투 명령 선택)
// 위쪽 화면도 직접 터치할 수 있지만, 모든 조작은 이 하단 컨트롤만으로도 가능하다.
// 확인 버튼은 항상 같은 자리(오른쪽 아래)에 있어 엄지가 움직이지 않는다.
const Controls = (() => {
  const pad = document.getElementById('pad');
  const act = document.getElementById('act-btn');
  const actLabel = act.querySelector('.act-label');
  const back = document.getElementById('back-btn');
  const iconTalk = act.querySelector('.act-icon');
  let target = null;   // 대화할 수 있는 NPC (main.js 가 'interact:target' 으로 알려 준다)

  function mode() {
    if (BattleUI.active) return 'battle';
    if (ForgeUI.active) return 'forge';
    if (Dialog.isOpen()) return 'dialog';
    if (Screens.current) return 'screen';
    return 'field';
  }

  // 현재 상태에 맞게 버튼 구성을 바꾼다
  function refresh() {
    const m = mode();
    pad.dataset.mode = m;
    back.hidden = m === 'field' || (m === 'battle' && !BattleUI.canBack()) || (m === 'forge' && !ForgeUI.canBack());
    back.textContent = m === 'dialog' ? '닫기' : m === 'forge' ? '나가기' : '뒤로';

    let label = null;
    if (m === 'battle') label = BattleUI.confirmLabel();
    else if (m === 'forge') label = ForgeUI.confirmLabel();
    else if (m === 'dialog') label = Dialog.confirmLabel();
    else if (m === 'screen') label = '확인';
    else if (target) label = target.kind === 'building' ? '입장' : '대화';

    const wasHidden = act.hidden;
    act.hidden = !label;
    iconTalk.style.display = label === '대화' ? '' : 'none';   // 말풍선 아이콘은 대화일 때만
    if (label) actLabel.textContent = label;
    if (label && wasHidden) {
      act.classList.remove('pop');
      void act.offsetWidth; // 애니메이션 재시작
      act.classList.add('pop');
    }
  }

  function pressConfirm() {
    if (BattleUI.active) BattleUI.confirm();
    else if (ForgeUI.active) ForgeUI.confirm();
    else if (Dialog.isOpen()) Dialog.next();
    else if (Screens.current) Screens.confirm();
    else if (target && target.kind === 'building') Events.emit('building:enter', { id: target.id });
    else if (target) Events.emit('npc:interact', { npc: target.npc });
  }

  function pressBack() {
    if (BattleUI.active) BattleUI.back();
    else if (ForgeUI.active) ForgeUI.back();
    else if (Dialog.isOpen()) Dialog.close();
    else if (Screens.current) Screens.back();
  }

  act.addEventListener('click', pressConfirm);
  back.addEventListener('click', pressBack);
  pad.querySelectorAll('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      if (BattleUI.active) BattleUI.nav(b.dataset.nav);
      else if (ForgeUI.active) ForgeUI.nav(b.dataset.nav);
      else if (Screens.current && !Dialog.isOpen()) Screens.nav(b.dataset.nav);
    }));

  Events.on('interact:target', (t) => { target = t; refresh(); });
  Events.on('ui:changed', refresh);
  Events.on('forge:opened', refresh);
  refresh();

  return { refresh };
})();
