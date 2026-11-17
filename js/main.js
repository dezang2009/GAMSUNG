// PROJECT EDEN — 진입점. 월드 배경을 그리고 HUD에 표시용 값을 채운다.
(function () {
  'use strict';

  var cfg = EDEN.config;

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setBar(id, ratio) {
    var el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
  }

  function renderHud(hud) {
    Object.keys(hud.resources).forEach(function (key) {
      var el = document.querySelector('[data-resource="' + key + '"] [data-value]');
      if (el) el.textContent = hud.resources[key].toLocaleString('ko-KR');
    });

    var e = hud.energy;
    setText('energy-current', e.current);
    setText('energy-max', e.max);
    setText('energy-rate', (e.rate >= 0 ? '+' : '') + e.rate + '/s');
    setBar('energy-bar', e.current / e.max);

    var env = hud.environment;
    setText('env-state', env.state);
    setText('env-temp', env.temperature + '°C');
    setText('env-air', env.atmosphere + '%');
    setText('env-water', env.moisture + '%');
    setBar('env-bar', env.habitability / 100);
  }

  function init() {
    renderHud(cfg.hud);
    setText('sector-label', cfg.world.sector);

    var canvas = document.getElementById('world-canvas');
    var world = EDEN.createWorld(cfg.world);
    var renderer = new EDEN.WorldRenderer(canvas, world, cfg.world);

    function redraw() { renderer.resize(); renderer.render(); }
    redraw();

    if (window.ResizeObserver) new ResizeObserver(redraw).observe(canvas);
    else window.addEventListener('resize', redraw);

    EDEN.world = world;
    EDEN.renderer = renderer;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
