// 가상 조이스틱: 하단 패드 어디를 눌러도 그 자리에 조이스틱이 나타난다 (터치/마우스 공용, Pointer Events)
const Input = (() => {
  const DEAD_ZONE = 0.12;
  const state = { x: 0, y: 0, active: false };

  const pad = document.getElementById('pad');
  const base = document.getElementById('joy-base');
  const knob = document.getElementById('joy-knob');
  let pointerId = null;
  let enabled = true;     // 메뉴 화면이 열려 있는 동안은 입력을 받지 않는다
  let cx = 0, cy = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function update(clientX, clientY) {
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const maxR = base.clientWidth * 0.3; // 노브가 움직일 수 있는 최대 거리
    const travel = Math.min(dist, maxR);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    knob.style.transform = `translate(${nx * travel}px, ${ny * travel}px)`;

    const mag = travel / maxR;
    if (mag < DEAD_ZONE) {
      state.x = 0; state.y = 0; state.active = false;
      return;
    }
    state.x = nx * mag;
    state.y = ny * mag;
    state.active = true;
  }

  function release() {
    pointerId = null;
    state.x = 0; state.y = 0; state.active = false;
    knob.style.transform = '';
    base.style.left = '';   // 기본 위치로 복귀
    base.style.top = '';
    pad.classList.remove('is-active');
  }

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!enabled || pointerId !== null) return;
    pointerId = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    // 누른 자리에 조이스틱 중심을 두되, 패드 밖으로 나가지 않게 한다
    const pr = pad.getBoundingClientRect();
    const r = base.offsetWidth / 2;
    cx = clamp(e.clientX, pr.left + r, pr.right - r);
    cy = clamp(e.clientY, pr.top + r, pr.bottom - r);
    base.style.left = cx - pr.left + 'px';
    base.style.top = cy - pr.top + 'px';
    pad.classList.add('is-active');
    update(e.clientX, e.clientY);
  });

  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    update(e.clientX, e.clientY);
  });

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    release();
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get: () => state,
    reset: release,
    setEnabled(on) {
      enabled = on;
      if (!on) release();
    },
  };
})();
