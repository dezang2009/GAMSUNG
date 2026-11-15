/**
 * 앱 뼈대: 상단 바 · 화면 · 하단 메뉴 · 알림 · 대화상자 · 게임 시계(0.1초) · 자동 저장.
 */
import { h, svg, ICONS } from './dom.js';
import * as E from '../game/engine.js';
import { choose, scheduler, eventDef } from '../game/events.js';
import * as Save from '../game/save.js';
import { won, lines, people, duration } from '../game/format.js';
import { homeView, growView, newsView, recordsView } from './views.js';

const TABS = [
  ['home', '홈', homeView],
  ['grow', '성장', growView],
  ['news', '소식', newsView],
  ['records', '기록', recordsView],
];

export function startApp(root) {
  let { state: s, fresh, recovered, broken } = Save.load();
  if (fresh) E.addLog(s, '자취방 책상에서 1인 개발사를 차렸어요. 첫 앱은 ‘할 일 앱’!', 'launch');
  let tab = 'home';
  let view = null;
  let viewKey = '';
  let dirty = false;

  /* 알림 */
  const toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  const toast = (text) => {
    const t = h('div', { class: 'toast' }, text);
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => {
      t.classList.add('is-leaving');
      setTimeout(() => t.remove(), 260);
    }, 2600);
  };

  /* 대화상자 (뒤로 가기로 닫힘) */
  let closeDialog = null;
  const dialog = (title, body, actions) =>
    new Promise((resolve) => {
      const done = (v) => {
        overlay.remove();
        closeDialog = null;
        resolve(v);
      };
      const overlay = h('div', { class: 'dialog-overlay', onclick: (e) => e.target === overlay && done(false) },
        h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('div', { class: 'dialog__title' }, title),
          h('div', { class: 'dialog__body' }, body),
          h('div', { class: 'dialog__actions' }, actions.map(([label, cls, v]) => h('button', { type: 'button', class: `btn ${cls}`, onclick: () => done(v) }, label)))));
      closeDialog = () => done(false);
      document.body.append(overlay);
      overlay.querySelector('.dialog__actions button:last-child')?.focus();
    });
  const confirm = (title, text, okLabel) => dialog(title, h('p', {}, text), [['취소', 'btn--ghost', false], [okLabel, 'btn--danger', true]]);

  /* 화면 모드 */
  const media = matchMedia('(prefers-color-scheme: dark)');
  const applyMode = () => {
    const m = s.settings.mode;
    document.documentElement.dataset.mode = m === 'auto' ? (media.matches ? 'dark' : 'light') : m;
  };
  media.addEventListener?.('change', applyMode);

  /* 뼈대 */
  const title = h('div', {});
  const moneyText = h('span', { class: 'num' });
  const pill = h('span', { class: 'money-pill', 'data-testid': 'money-pill' }, h('i'), moneyText);
  const bar = h('header', { class: 'app-bar' }, title, pill);
  const main = h('main', { class: 'content' });
  const navBadge = h('span', { class: 'nav-badge num', hidden: true });
  const navItems = TABS.map(([id, label]) =>
    h('button', { type: 'button', class: 'bottom-nav__item', 'data-tab': id, 'aria-label': label, onclick: () => go(id) },
      h('span', { class: 'bottom-nav__icon' }, svg(ICONS[id])),
      h('span', {}, label),
      id === 'news' ? navBadge : null));
  const nav = h('nav', { class: 'bottom-nav', 'aria-label': '메뉴' }, navItems);
  root.replaceChildren(h('div', { class: 'shell' }, bar, main), nav, toasts);
  addEventListener('scroll', () => bar.classList.toggle('is-scrolled', scrollY > 4), { passive: true });

  const ctx = {
    toast,
    confirm,
    applyMode,
    go: (id) => go(id),
    rerender: () => render(),
    /** 구조가 바뀌는 행동: 실행 → 업적 → 다시 그리기 → 저장 */
    act: (fn) => {
      fn();
      afterChange();
      render();
      persist();
    },
    /** 코드 쓰기처럼 자주 일어나는 행동: 다시 그리지 않음 */
    after: () => {
      dirty = true;
      afterChange();
    },
    choose: (key, i) => choose(s, key, i),
    resetGame: () => {
      Save.reset();
      s = E.newGame();
      applyMode();
      tab = 'home';
      render();
      persist();
      toast('새 회사를 차렸어요');
    },
  };

  function afterChange() {
    for (const a of E.checkAchievements(s)) {
      E.addLog(s, `업적 달성 · ${a.name}`, 'achievement');
      toast(`업적 달성! ${a.name}`);
    }
  }

  function go(id) {
    if (id === tab) return scrollTo({ top: 0, behavior: 'smooth' });
    tab = id;
    scrollTo({ top: 0 });
    render();
  }

  function render() {
    const def = TABS.find((t) => t[0] === tab);
    view = def[2](s, ctx);
    viewKey = view.key?.() ?? '';
    main.replaceChildren(view.el);
    pill.hidden = tab === 'home'; // 홈은 큰 금액 카드가 있으니 중복 표시하지 않음
    title.replaceChildren(tab === 'home' ? h('div', { class: 'wordmark' }, 'DEV', h('span', {}, 'LIFE')) : h('h1', { class: 'app-bar__title' }, def[1]));
    for (const b of navItems) {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    }
    update(Date.now());
  }

  function update(now) {
    moneyText.textContent = won(s.money);
    navBadge.hidden = !s.pending.length;
    navBadge.textContent = String(s.pending.length);
    if (view.key && view.key() !== viewKey) return render();
    view.update(s, now);
  }

  function persist() {
    s.lastTick = Date.now();
    Save.save(s);
    dirty = false;
  }

  /* 게임 시계 */
  let last = performance.now();
  let lastSave = Date.now();
  let running = true;
  const loop = () => {
    if (!running) return;
    const t = performance.now();
    const dt = Math.min((t - last) / 1000, 1); // 화면이 멈췄던 시간은 자리 비움으로 처리
    last = t;
    const now = Date.now();
    E.tick(s, dt, now);
    s.lastTick = now;
    const { event } = scheduler(s, now);
    if (event) toast(`새 소식: ${eventDef(event.id)?.title ?? ''}`);
    afterChange();
    update(now);
    if (now - lastSave > 10000) (lastSave = now), persist();
  };
  let timer = setInterval(loop, 100);

  const showAway = (r) => {
    if (!r || (r.money < 1 && r.lines < 1)) return;
    dialog('자리를 비운 사이', [
      h('p', {}, `${duration(r.secs)} 동안 팀이 일했어요.${r.secs >= 8 * 3600 ? ' (최대 8시간까지 쌓여요)' : ''}`),
      h('div', { class: 'away' },
        h('div', {}, h('span', {}, '번 돈'), h('b', {}, `+${won(r.money)}`)),
        h('div', {}, h('span', {}, '쓴 코드'), h('b', {}, `+${lines(r.lines)}`)),
        r.users >= 1 ? h('div', {}, h('span', {}, '늘어난 사용자'), h('b', {}, `+${people(r.users)}`)) : null),
    ], [['좋아요', 'btn--primary', true]]);
  };

  const pause = () => {
    if (!running) return;
    running = false;
    clearInterval(timer);
    persist();
  };
  const resume = () => {
    if (running) return;
    const r = E.offlineProgress(s, Date.now());
    afterChange();
    running = true;
    last = performance.now();
    timer = setInterval(loop, 100);
    render();
    persist();
    showAway(r);
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
  addEventListener('pagehide', persist);

  /* 안드로이드 뒤로 가기: 대화상자 → 홈 → 종료 */
  import('@capacitor/app')
    .then(({ App }) => {
      App.addListener('pause', pause);
      App.addListener('resume', resume);
      App.addListener('backButton', () => {
        if (closeDialog) return closeDialog();
        if (tab !== 'home') return go('home');
        persist();
        App.exitApp();
      });
    })
    .catch(() => {});

  /* 시작 */
  applyMode();
  const away = E.offlineProgress(s, Date.now());
  afterChange();
  render();
  persist();
  if (recovered) toast('저장 파일이 손상돼 직전 저장본으로 이어서 해요');
  else if (broken) toast('저장 파일을 읽을 수 없어 새로 시작해요 (원본은 보관해 뒀어요)');
  showAway(away);
  setInterval(() => dirty && persist(), 3000);

  // 테스트용 (실제 게임 진행에는 쓰이지 않음)
  globalThis.__devlife = { get state() { return s; } };
}
