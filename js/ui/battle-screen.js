// 전투 화면 (포켓몬 스타일): 위쪽은 전투 장면, 아래쪽 메뉴는 전투 명령으로 바뀐다.
// 규칙은 systems/battle.js 가 계산하고, 여기서는 그 결과(steps)를 차례로 보여 주기만 한다.
//   명령 선택: 방향 버튼 + 확인/뒤로, 또는 명령 버튼을 직접 터치
//   기술: 배운 기술(최대 4개) 중 고른다. 승리 후 새 기술을 배울 때 기술이 가득 차 있으면 하나를 잊을지 고른다.
const BattleUI = (() => {
  const $ = (id) => document.getElementById(id);
  const root = $('battle');
  const dock = $('dock');
  const cmdBox = $('battle-cmds');
  const textEl = $('bt-text');
  const eCanvas = $('bt-enemy');
  const hCanvas = $('bt-hero');

  const STEP_MS = 1150;
  const MAIN = [
    { id: 'skill', label: '기술' },
    { id: 'bag', label: '가방' },
    { id: 'party', label: '동료' },
    { id: 'flee', label: '도망' },
  ];

  let active = false;
  let busy = false;       // 메시지/연출 재생 중이면 명령을 받지 않는다
  let finishing = false;  // 전투가 끝나고 마무리 대기 중
  let outcome = null;
  let queue = [];
  let timer = 0;
  let view = 'main';      // 'main' | 'items' | 'skills' | 'learn'
  let learning = null;    // 새 기술을 배우는 중이면 { skill, source }
  let sel = 0;
  let enemyMax = 1;
  let heroMax = { hp: 1, mp: 1 };

  // ---------- 그리기 보조 ----------
  function drawSprite(canvas, img, scale) {
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.style.width = img.width * scale + 'px';
    canvas.style.height = img.height * scale + 'px';
  }

  function setBar(el, value, max) {
    const pct = Math.max(0, Math.min(1, value / max));
    el.firstElementChild.style.width = pct * 100 + '%';
    el.classList.toggle('low', pct <= 0.5 && pct > 0.2);
    el.classList.toggle('crit', pct <= 0.2);
  }

  function setHero(hp, mp, maxHp, maxMp) {
    if (maxHp) heroMax = { hp: maxHp, mp: maxMp };   // 레벨업으로 최대치가 늘어난 경우
    setBar($('bt-h-bar'), hp, heroMax.hp);
    setBar($('bt-h-mpbar'), mp, heroMax.mp);
    $('bt-h-num').textContent = `HP ${hp}/${heroMax.hp}  MP ${mp}/${heroMax.mp}`;
  }

  function playAnim(canvas, name) {
    const cls = 'a-' + name;
    canvas.classList.remove(cls);
    void canvas.offsetWidth;
    canvas.classList.add(cls);
    if (!/faint|flee/.test(name)) setTimeout(() => canvas.classList.remove(cls), 1000);
  }

  const ANIM_TARGET = {
    'hero-attack': [hCanvas, 'hero-attack'], 'enemy-attack': [eCanvas, 'enemy-attack'],
    'enemy-hit': [eCanvas, 'hit'], 'hero-hit': [hCanvas, 'hit'],
    'enemy-faint': [eCanvas, 'faint'], 'hero-faint': [hCanvas, 'faint'],
    heal: [hCanvas, 'heal'], flee: [hCanvas, 'flee'],
  };

  // ---------- 메시지 재생 ----------
  function play(steps) {
    queue = steps.slice();
    busy = true;
    renderCmds();
    Events.emit('ui:changed');
    next();
  }

  function next() {
    clearTimeout(timer);
    if (!queue.length) return done();
    const s = queue.shift();
    if (s.type === 'learn') return startLearn(s);   // 새 기술: 잊을 기술을 고르게 한다
    textEl.textContent = s.text;
    if (s.hp) {
      if (s.hp.enemy) setBar($('bt-e-bar'), s.hp.enemy.hp, enemyMax);
      if (s.hp.hero) setHero(s.hp.hero.hp, s.hp.hero.mp, s.hp.hero.maxHp, s.hp.hero.maxMp);
    }
    if (s.anim && ANIM_TARGET[s.anim]) playAnim(...ANIM_TARGET[s.anim]);
    timer = setTimeout(next, STEP_MS);
  }

  function done() {
    if (outcome) {
      finishing = true;
      timer = setTimeout(finish, 900);
      return;
    }
    busy = false;
    view = 'main';
    sel = 0;
    textEl.textContent = '어떻게 할까?';
    renderCmds();
    Events.emit('ui:changed');
  }

  function finish() {
    clearTimeout(timer);
    if (!active) return;
    active = false;
    busy = false;
    finishing = false;
    root.hidden = true;
    dock.dataset.mode = '';
    cmdBox.hidden = true;
    Events.emit('ui:changed');
    Events.emit('battle:finish');
  }

  // ---------- 하단 명령 ----------
  function potions() {
    return GameState.get('inventory').items.filter((it) => ItemData[it.id] && ItemData[it.id].use);
  }

  // 배운 기술 목록 (없으면 맨손치기)
  function knownSkills() {
    const known = GameState.get('skills').known;
    return (known.length ? known : ['punch']).map((id) => SkillData[id]);
  }

  function startLearn(step) {
    learning = { skill: step.skill, source: step.source };
    busy = false;
    view = 'learn';
    sel = 0;
    renderCmds();
    Events.emit('ui:changed');
  }

  // 새 기술을 배울지 정한다 (forget: 잊을 기술 id, 없으면 배우지 않음)
  function decideLearn(forget) {
    const { skill, source } = learning;
    learning = null;
    Events.emit('skill:decide', { skill, source, forget });
    const name = SkillData[skill].name;
    queue.unshift({
      text: forget
        ? `${Util.josa(SkillData[forget].name, '을/를')} 잊고 ${Util.q(name, '을/를')} 배웠다!`
        : `${Util.q(name, '을/를')} 배우지 않았다.`,
      anim: forget ? 'heal' : undefined,
    });
    view = 'main';
    busy = true;
    renderCmds();
    Events.emit('ui:changed');
    next();
  }

  function entries() {
    if (view === 'skills') {
      const mp = GameState.get('player').mp;
      const list = knownSkills().map((s) => ({
        id: s.id, label: s.mp ? `${s.name}  MP ${s.mp}` : s.name, desc: s.desc, disabled: mp < s.mp,
      }));
      list.push({ id: 'cancel', label: '취소', wide: true });
      return list;
    }
    if (view === 'learn') {
      const list = GameState.get('skills').known.map((id) => ({ id: 'forget', forget: id, label: `${SkillData[id].name} 잊기`, desc: SkillData[id].desc }));
      list.push({ id: 'decline', label: '배우지 않는다', wide: true });
      return list;
    }
    if (view === 'items') {
      const list = potions().map((it) => ({ id: it.id, label: `${ItemData[it.id].name} ×${it.count}` }));
      if (!list.length) list.push({ id: 'none', label: '쓸 수 있는 물약이 없어요', disabled: true });
      list.push({ id: 'cancel', label: '취소', wide: true });
      return list;
    }
    return MAIN;
  }

  function renderCmds() {
    const list = entries();
    sel = Math.min(sel, list.length - 1);
    cmdBox.replaceChildren();
    cmdBox.classList.toggle('is-busy', busy);
    cmdBox.classList.toggle('is-items', view !== 'main');
    if (!busy && view === 'learn') {
      const sk = SkillData[learning.skill];
      textEl.textContent = `새 기술 ${Util.q(sk.name, '을/를')} 배울 수 있다! 기술이 가득 찼으니, 잊을 기술을 고르자.`;
    } else if (!busy && (view === 'skills') && list[sel] && list[sel].desc) {
      textEl.textContent = list[sel].desc;
    }
    list.forEach((e, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bt-cmd' + (i === sel && !busy ? ' is-selected' : '') + (e.wide ? ' is-wide' : '');
      b.textContent = e.label;
      b.disabled = !!e.disabled;
      b.addEventListener('click', () => { if (busy) { skip(); return; } sel = i; run(e); });
      cmdBox.appendChild(b);
    });
  }

  function run(e) {
    if (busy || e.disabled) return;
    if (view === 'learn') { decideLearn(e.forget || null); return; }
    if (view === 'skills') {
      if (e.id === 'cancel') { view = 'main'; sel = 0; renderCmds(); Events.emit('ui:changed'); return; }
      view = 'main';
      Events.emit('battle:command', { type: 'skill', id: e.id });
      return;
    }
    if (view === 'items') {
      if (e.id === 'cancel') { view = 'main'; sel = 0; renderCmds(); Events.emit('ui:changed'); return; }
      view = 'main';
      Events.emit('battle:command', { type: 'item', id: e.id });
      return;
    }
    if (e.id === 'skill') { view = 'skills'; sel = 0; renderCmds(); Events.emit('ui:changed'); }
    else if (e.id === 'flee') Events.emit('battle:command', { type: 'flee' });
    else if (e.id === 'bag') { view = 'items'; sel = 0; renderCmds(); Events.emit('ui:changed'); }
    else if (e.id === 'party') Events.emit('toast', { text: '동료는 아직 없어요. (준비 중)' });
  }

  function skip() {
    if (finishing) finish();
    else if (busy) next();
  }

  // ---------- 하단 컨트롤에서 부르는 조작 ----------
  function nav(dir) {
    if (busy) return;
    const n = entries().length;
    if (view === 'main') {
      const row = sel >> 1, col = sel & 1;
      if (dir === 'left') sel = row * 2;
      else if (dir === 'right') sel = row * 2 + 1;
      else if (dir === 'up') sel = col;
      else if (dir === 'down') sel = 2 + col;
    } else {                       // 2열 격자 (마지막 '취소'는 한 줄 전체)
      if (dir === 'left') sel = Math.max(0, sel - 1);
      else if (dir === 'right') sel = Math.min(n - 1, sel + 1);
      else if (dir === 'up') sel = sel - 2 >= 0 ? sel - 2 : sel;
      else sel = sel + 2 < n ? sel + 2 : n - 1;
    }
    renderCmds();
  }

  function confirm() {
    if (busy) { skip(); return; }
    run(entries()[sel]);
  }

  function back() {
    if (busy) { skip(); return; }
    if (view === 'learn') { decideLearn(null); return; }   // 뒤로 = 배우지 않는다
    if (view === 'items' || view === 'skills') { view = 'main'; sel = 0; renderCmds(); Events.emit('ui:changed'); }
  }

  // ---------- 이벤트 ----------
  Events.on('battle:start', (d) => {
    active = true;
    busy = true;
    finishing = false;
    outcome = null;
    learning = null;
    view = 'main';
    sel = 0;
    enemyMax = d.enemy.maxHp;
    heroMax = { hp: d.player.maxHp, mp: d.player.maxMp };

    $('bt-e-name').textContent = (d.enemy.boss ? '◆ ' : '') + d.enemy.name;
    $('bt-e-lv').textContent = 'Lv.' + d.enemy.level;
    setBar($('bt-e-bar'), d.enemy.hp, enemyMax);
    $('bt-h-name').textContent = d.player.name;
    $('bt-h-lv').textContent = 'Lv.' + d.player.level;
    setHero(d.player.hp, d.player.mp);

    const eImg = Sprites.monsters[d.enemy.sprite].left[0];
    const fw = $('field').clientWidth, fh = $('field').clientHeight;
    const eScale = Math.max(4, Math.min(12, Math.floor(Math.min(fw * 0.4, fh * 0.24) / Math.max(eImg.width, eImg.height * 1.1))) + (d.enemy.boss ? 1 : 0));
    drawSprite(eCanvas, eImg, eScale);
    drawSprite(hCanvas, Sprites.player.up[2], Math.max(4, Math.min(8, Math.floor(fh * 0.22 / 18))));
    [eCanvas, hCanvas].forEach((c) => { c.className = 'bt-sprite'; });
    playAnimEnter();

    root.hidden = false;
    root.classList.remove('intro');
    void root.offsetWidth;
    root.classList.add('intro');
    dock.dataset.mode = 'battle';
    cmdBox.hidden = false;
    renderCmds();
    Events.emit('ui:changed');
    play(d.intro);
  });

  function playAnimEnter() {
    eCanvas.classList.add('a-enter-e');
    hCanvas.classList.add('a-enter-h');
    setTimeout(() => { eCanvas.classList.remove('a-enter-e'); hCanvas.classList.remove('a-enter-h'); }, 800);
  }

  Events.on('battle:steps', (d) => {
    outcome = d.outcome;
    play(d.steps);
  });

  $('bt-msg').addEventListener('click', skip); // 메시지 상자를 눌러 빨리 넘긴다

  return {
    get active() { return active; },
    confirmLabel: () => (busy ? '다음' : '확인'),
    canBack: () => active && !busy && view !== 'main',
    nav,
    confirm,
    back,
  };
})();
