// 가상 조이스틱: 터치와 마우스를 Pointer Events로 함께 처리
const Input = (() => {
  const DEAD_ZONE = 0.12;
  const state = { x: 0, y: 0, active: false };

  const joy = document.getElementById('joy');
  const base = document.getElementById('joy-base');
  const knob = document.getElementById('joy-knob');
  let pointerId = null;
  let cx = 0, cy = 0;

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
  }

  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointerId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    update(e.clientX, e.clientY);
  });

  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    update(e.clientX, e.clientY);
  });

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    release();
  };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
  joy.addEventListener('lostpointercapture', end);

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get: () => state,
  };
})();
