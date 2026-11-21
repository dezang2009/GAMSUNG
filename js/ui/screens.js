// 메인 메뉴 화면 전환. 마을/탐험 필드(게임 상태)는 건드리지 않고 그 위에 화면만 덮는다.
// 실제 기능을 붙일 때는 Screens.register(id, { render(body), onOpen(), onClose(), onNav(dir), onConfirm(), onBack() }) 로 교체하면 된다.
// 조작은 하단 컨트롤(ui/controls.js)의 방향/확인/뒤로 버튼으로 모두 할 수 있고, 위쪽 화면을 직접 터치해도 된다.
const Screens = (() => {
  const overlay = document.getElementById('screen');
  const titleEl = document.getElementById('screen-title');
  const body = document.getElementById('screen-body');
  const dockButtons = document.querySelectorAll('.dock-btn');

  let current = null;
  const listeners = [];

  // 임시 화면 정의 (아이콘은 하단 메뉴 버튼의 것을 재사용)
  const defs = {
    battle: { title: '전투', desc: '전투 화면이 들어갈 자리예요.' },
    explore: { title: '탐험', desc: '탐험 지역 목록이 들어갈 자리예요.' }, // ui/explore-screen.js 가 실제 화면을 등록
    bag: { title: '가방', desc: '아이템 목록이 들어갈 자리예요.' },
    party: { title: '동료', desc: '동료 목록이 들어갈 자리예요.' },
    dex: { title: '도감', desc: '도감이 들어갈 자리예요.' },
    char: { title: '캐릭터', desc: '캐릭터 정보가 들어갈 자리예요.' },
  };

  // 기본 임시 콘텐츠
  function placeholder(id, def) {
    const btn = document.querySelector(`.dock-btn[data-menu="${id}"]`);
    const wrap = document.createElement('div');
    wrap.className = 'screen-placeholder';
    const icon = document.createElement('span');
    icon.className = 'screen-placeholder-icon';
    if (btn) icon.innerHTML = btn.querySelector('.dock-icon').innerHTML;
    const name = document.createElement('strong');
    name.textContent = '준비 중';
    const desc = document.createElement('p');
    desc.textContent = def.desc;
    wrap.append(icon, name, desc);
    return wrap;
  }

  function setCurrent(id) {
    // 열린 화면의 버튼만 강조한다 (화면이 없으면 필드를 보고 있는 상태)
    dockButtons.forEach((b) => b.classList.toggle('is-current', b.dataset.menu === id));
  }

  function open(id) {
    if (!defs[id]) return close();
    const prev = current;
    if (prev && prev !== id && defs[prev].onClose) defs[prev].onClose();
    const def = defs[id];
    current = id;
    titleEl.textContent = def.title;
    body.replaceChildren();
    if (def.render) def.render(body); // 실제 화면은 render(body) 에서 body 를 채운다
    else body.appendChild(placeholder(id, def));
    overlay.hidden = false;
    setCurrent(id);
    if (def.onOpen) def.onOpen();
    listeners.forEach((fn) => fn(current));
    Events.emit('ui:changed');
  }

  function close() {
    if (!current) return;
    const def = defs[current];
    current = null;
    overlay.hidden = true;
    body.replaceChildren();
    setCurrent(null);
    if (def.onClose) def.onClose();
    listeners.forEach((fn) => fn(null));
    Events.emit('ui:changed');
  }

  // 하단 메뉴 버튼: 다른 화면으로 전환하고, 열려 있는 화면의 버튼을 다시 누르면 닫는다
  dockButtons.forEach((b) => b.addEventListener('click', () => (current === b.dataset.menu ? close() : open(b.dataset.menu))));

  // 위쪽 화면의 뒤로 버튼 (하단 컨트롤의 뒤로와 같은 동작)
  document.getElementById('screen-back').addEventListener('click', () => back());

  // 하단 컨트롤에서 들어오는 조작을 현재 화면에 전달한다
  function nav(dir) {
    const def = current && defs[current];
    if (def && def.onNav) def.onNav(dir);
  }
  function confirm() {
    const def = current && defs[current];
    if (def && def.onConfirm) def.onConfirm();
  }
  function back() {
    const def = current && defs[current];
    if (def && def.onBack) def.onBack(); else close();
  }

  return {
    open,
    close,
    nav,
    confirm,
    back,
    get current() { return current; },
    onChange: (fn) => listeners.push(fn),
    // 실제 기능 구현 시 화면 정의를 덮어쓴다
    register: (id, def) => { defs[id] = Object.assign(defs[id] || {}, def); },
  };
})();
