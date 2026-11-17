// PROJECT EDEN — 월드 카메라 조작.
// 한 손가락 드래그로 이동, 두 손가락 핀치로 확대·축소한다. (마우스: 드래그 / 휠)
// 입력은 월드 캔버스에서만 받으므로 상단 상태 정보와 하단 메뉴에는 영향이 없다.
(function () {
  'use strict';

  window.EDEN = window.EDEN || {};

  var INERTIA_MS = 325;      // 드래그 관성 감쇠 시간
  var INERTIA_MIN = 0.02;    // 관성 종료 속도 (px/ms)
  var ZOOM_EASE_MS = 90;     // 휠 줌 보간 시간
  var WHEEL_STEP = 0.0015;

  function CameraController(el, renderer, onChange) {
    var pointers = new Map();   // pointerId → {x, y} (캔버스 기준 좌표)
    var vel = { x: 0, y: 0 };   // 드래그 속도 (px/ms)
    var lastMove = 0;
    var zoomTarget = null;      // 휠 줌 목표 {zoom, x, y}
    var raf = 0, lastTick = 0;

    function local(e) {
      var r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function stopMotion() {
      vel.x = vel.y = 0;
      zoomTarget = null;
    }

    // 관성 이동과 휠 줌 보간을 처리하는 프레임 루프
    function tick(now) {
      raf = 0;
      var dt = Math.min(48, now - lastTick);
      lastTick = now;
      var active = false;

      if (zoomTarget) {
        var k = 1 - Math.exp(-dt / ZOOM_EASE_MS);
        var z = renderer.zoom + (zoomTarget.zoom - renderer.zoom) * k;
        if (Math.abs(zoomTarget.zoom - z) < 0.002) { z = zoomTarget.zoom; }
        renderer.zoomAt(zoomTarget.x, zoomTarget.y, z);
        if (z === zoomTarget.zoom) zoomTarget = null; else active = true;
      }

      if (pointers.size === 0 && (vel.x || vel.y)) {
        var cx = renderer.camera.x, cy = renderer.camera.y;
        renderer.panBy(vel.x * dt, vel.y * dt);
        var decay = Math.exp(-dt / INERTIA_MS);
        // 월드 가장자리에 닿은 축은 바로 멈춘다.
        vel.x = renderer.camera.x === cx ? 0 : vel.x * decay;
        vel.y = renderer.camera.y === cy ? 0 : vel.y * decay;
        if (Math.abs(vel.x) + Math.abs(vel.y) < INERTIA_MIN) vel.x = vel.y = 0;
        else active = true;
      }

      onChange();
      if (active) start();
    }

    function start() {
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (pointers.size >= 2) return; // 세 번째 손가락부터는 무시
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      pointers.set(e.pointerId, local(e));
      stopMotion();
      lastMove = e.timeStamp;
      e.preventDefault();
    }

    function onMove(e) {
      var prev = pointers.get(e.pointerId);
      if (!prev) return;
      var cur = local(e);
      e.preventDefault();

      if (pointers.size === 1) {
        var dx = cur.x - prev.x, dy = cur.y - prev.y;
        renderer.panBy(dx, dy);
        var dt = Math.max(1, e.timeStamp - lastMove);
        vel.x = vel.x * 0.4 + (dx / dt) * 0.6;
        vel.y = vel.y * 0.4 + (dy / dt) * 0.6;
        lastMove = e.timeStamp;
      } else {
        // 핀치: 두 손가락의 중점 이동만큼 끌고, 간격 비율만큼 중점 기준으로 확대·축소
        var other = null;
        pointers.forEach(function (p, id) { if (id !== e.pointerId) other = p; });
        var pmx = (prev.x + other.x) / 2, pmy = (prev.y + other.y) / 2;
        var mx = (cur.x + other.x) / 2, my = (cur.y + other.y) / 2;
        var pd = Math.hypot(prev.x - other.x, prev.y - other.y);
        var d = Math.hypot(cur.x - other.x, cur.y - other.y);
        renderer.panBy(mx - pmx, my - pmy);
        if (pd > 0 && d > 0) renderer.zoomAt(mx, my, renderer.zoom * (d / pd));
        vel.x = vel.y = 0;
      }

      pointers.set(e.pointerId, cur);
      onChange();
    }

    function onUp(e) {
      if (!pointers.delete(e.pointerId)) return;
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      if (pointers.size === 0) {
        // 손을 멈춘 뒤 뗐거나 취소된 경우에는 관성을 주지 않는다.
        if (e.type !== 'pointerup' || e.timeStamp - lastMove > 80) vel.x = vel.y = 0;
        if (vel.x || vel.y) { lastTick = performance.now(); start(); }
      } else {
        // 핀치 → 드래그 전환: 남은 손가락 기준으로 이어서 이동
        vel.x = vel.y = 0;
        lastMove = e.timeStamp;
      }
    }

    function onWheel(e) {
      e.preventDefault();
      var p = local(e);
      var base = zoomTarget ? zoomTarget.zoom : renderer.zoom;
      var z = base * Math.exp(-e.deltaY * WHEEL_STEP);
      z = Math.max(renderer.minZoom, Math.min(renderer.maxZoom, z));
      vel.x = vel.y = 0;
      zoomTarget = { zoom: z, x: p.x, y: p.y };
      lastTick = performance.now();
      start();
    }

    function prevent(e) { e.preventDefault(); }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    // 브라우저 기본 제스처(길게 누르기 메뉴, iOS 페이지 확대)와의 충돌 방지
    el.addEventListener('contextmenu', prevent);
    el.addEventListener('gesturestart', prevent);
    el.addEventListener('gesturechange', prevent);

    this.stop = stopMotion;
  }

  EDEN.CameraController = CameraController;
})();
