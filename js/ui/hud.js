// 상단 HUD: 레벨, HP/MP, 골드, 현재 지역. GameState 를 읽어 그리기만 한다.
const Hud = (() => {
  const $ = (id) => document.getElementById(id);

  function renderPlayer(p) {
    $('hud-lv').textContent = 'Lv.' + p.level;
    $('hud-hp-fill').style.width = (p.hp / p.maxHp) * 100 + '%';
    $('hud-mp-fill').style.width = (p.mp / p.maxMp) * 100 + '%';
    $('hud-hp-text').textContent = 'HP ' + p.hp + '/' + p.maxHp;
    $('hud-mp-text').textContent = 'MP ' + p.mp + '/' + p.maxMp;
  }

  function renderWallet(w) {
    $('hud-gold').textContent = w.gold.toLocaleString('ko-KR');
  }

  function renderLocation(l) {
    $('hud-loc-name').textContent = l.name;
    $('hud-loc').dataset.type = l.type;
  }

  Events.on('state:player', renderPlayer);
  Events.on('state:wallet', renderWallet);
  Events.on('state:location', renderLocation);

  renderPlayer(GameState.get('player'));
  renderWallet(GameState.get('wallet'));
  renderLocation(GameState.get('location'));
})();
