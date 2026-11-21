// NPC 대화창 (임시): 이름표 + 대사. 넘기기/닫기는 하단 컨트롤(ui/controls.js)이나 대화창 터치로 한다.
// 실제 상점/제작/의뢰 연결은 추후 'npc:interact' 를 듣는 시스템이 맡는다.
const Dialog = (() => {
  const root = document.getElementById('dialog');
  const nameEl = document.getElementById('dialog-name');
  const textEl = document.getElementById('dialog-text');
  const moreEl = document.getElementById('dialog-more');
  const listeners = [];
  let lines = [];
  let index = 0;
  let current = null;

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
    current = npc;
    const src = npc.currentLines ? npc.currentLines() : npc.lines;
    lines = src && src.length ? src : ['...'];
    index = 0;
    nameEl.textContent = npc.name;
    render();
    root.hidden = false;
    notify(true);
  }

  function close() {
    if (!isOpen()) return;
    root.hidden = true;
    const ended = { npc: current, reachedEnd: isLast() };
    notify(false);
    Events.emit('dialog:end', ended); // 대화가 끝났음을 알린다 (선물 지급 등은 이 이벤트를 듣는 시스템이 처리)
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

  root.querySelector('.dialog-card').addEventListener('click', next); // 대화창을 직접 눌러도 넘어간다
  Events.on('npc:interact', ({ npc }) => open(npc));

  return { open, close, next, isOpen, confirmLabel, onChange: (fn) => listeners.push(fn) };
})();
