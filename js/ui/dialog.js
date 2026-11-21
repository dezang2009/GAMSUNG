// NPC 대화창 (임시): 이름표 + 대사. 보여 주기만 하고, 넘기기/닫기는 하단 컨트롤(ui/controls.js)이 next()/close() 로 조작한다.
// 실제 상점/제작/의뢰 연결은 추후 'npc:interact' 를 듣는 시스템이 맡는다.
const Dialog = (() => {
  const root = document.getElementById('dialog');
  const nameEl = document.getElementById('dialog-name');
  const textEl = document.getElementById('dialog-text');
  const moreEl = document.getElementById('dialog-more');
  const listeners = [];
  let lines = [];
  let index = 0;

  const isOpen = () => !root.hidden;
  const isLast = () => index >= lines.length - 1;

  function render() {
    textEl.textContent = lines[index];
    moreEl.style.visibility = isLast() ? 'hidden' : 'visible';
  }

  function notify(open) {
    listeners.forEach((fn) => fn(open));
    Events.emit('ui:changed');
  }

  function open(npc) {
    lines = npc.lines && npc.lines.length ? npc.lines : ['...'];
    index = 0;
    nameEl.textContent = npc.name;
    render();
    root.hidden = false;
    notify(true);
  }

  function close() {
    if (!isOpen()) return;
    root.hidden = true;
    notify(false);
  }

  function next() {
    if (!isOpen()) return;
    if (isLast()) {
      close();
    } else {
      index++;
      render();
      Events.emit('ui:changed'); // 확인 버튼 이름(다음/닫기) 갱신
    }
  }

  // 확인 버튼에 표시할 이름
  const confirmLabel = () => (isLast() ? '닫기' : '다음');

  Events.on('npc:interact', ({ npc }) => open(npc));

  return { open, close, next, isOpen, confirmLabel, onChange: (fn) => listeners.push(fn) };
})();
