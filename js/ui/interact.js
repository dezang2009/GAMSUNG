// 대화 버튼: 상호작용할 대상 옆에 있을 때만 하단 오른쪽에 나타난다.
// 대상 판정은 main.js 가 하고 'interact:target' 이벤트로 알려 준다 (payload: { kind, npc } 또는 null).
// 버튼을 누르면 'npc:interact' 이벤트를 보낸다 (대화창/상점 등 실제 처리는 이 이벤트를 듣는 쪽이 맡는다).
const Interact = (() => {
  const btn = document.getElementById('act-btn');
  const label = btn.querySelector('.act-label');
  let target = null;

  function show(t) {
    target = t;
    if (!t) {
      btn.hidden = true;
      return;
    }
    label.textContent = '대화';
    if (btn.hidden) {
      btn.hidden = false;
      btn.classList.remove('pop');
      void btn.offsetWidth; // 애니메이션 재시작
      btn.classList.add('pop');
    }
  }

  btn.addEventListener('click', () => {
    if (target && target.kind === 'npc') Events.emit('npc:interact', { npc: target.npc });
  });

  Events.on('interact:target', show);

  return { get target() { return target; } };
})();
