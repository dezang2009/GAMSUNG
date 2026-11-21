// NPC 대화창 (임시): 이름표 + 대사. 실제 상점/제작/의뢰 연결은 추후 'npc:interact' 를 듣는 시스템이 맡는다.
const Dialog = (() => {
  const root = document.getElementById('dialog');
  const nameEl = document.getElementById('dialog-name');
  const textEl = document.getElementById('dialog-text');
  const nextBtn = document.getElementById('dialog-next');
  const listeners = [];
  let lines = [];
  let index = 0;

  const isOpen = () => !root.hidden;

  function render() {
    textEl.textContent = lines[index];
    nextBtn.textContent = index < lines.length - 1 ? '다음' : '닫기';
  }

  function open(npc) {
    lines = npc.lines && npc.lines.length ? npc.lines : ['...'];
    index = 0;
    nameEl.textContent = npc.name;
    render();
    root.hidden = false;
    listeners.forEach((fn) => fn(true));
  }

  function close() {
    if (!isOpen()) return;
    root.hidden = true;
    listeners.forEach((fn) => fn(false));
  }

  function next() {
    if (index < lines.length - 1) {
      index++;
      render();
    } else {
      close();
    }
  }

  nextBtn.addEventListener('click', next);
  root.querySelector('.dialog-card').addEventListener('click', (e) => { if (e.target !== nextBtn) next(); });
  Events.on('npc:interact', ({ npc }) => open(npc));

  return { open, close, isOpen, onChange: (fn) => listeners.push(fn) };
})();
