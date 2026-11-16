/**
 * UIController — 화면 전환 · 하단 메뉴 · 알림 · 시트(잠자기·아침 보고·확인) · 화면 모드.
 * 게임 상태는 엔진만 바꾸고, 여기서는 엔진의 'change' 를 듣고 다시 그려요.
 */
import { h, icon } from './dom.js';
import { deltas } from './components.js';
import { createScreen } from './screens/create.js';
import { todayScreen } from './screens/today.js';
import { meScreen, moneyScreen, journalScreen } from './screens/others.js';
import { WAKE_OPTIONS } from '../engine/GameEngine.js';
import { STATS } from '../data/world.js';
import * as Time from '../systems/TimeSystem.js';
import * as Economy from '../systems/EconomySystem.js';
import { loadSettings, saveSettings } from '../systems/SaveSystem.js';

const TABS = [
  { id: 'today', name: '오늘', icon: 'today', view: todayScreen },
  { id: 'me', name: '나', icon: 'me', view: meScreen },
  { id: 'money', name: '가계', icon: 'money', view: moneyScreen },
  { id: 'journal', name: '일지', icon: 'journal', view: journalScreen },
];
const STAT_NAME = Object.fromEntries(STATS.map((x) => [x.id, x.name]));
const QUALITY = { short: '잠이 모자랐어요', fair: '그럭저럭 잤어요', good: '푹 잤어요', long: '너무 오래 잤어요' };

export function createUI(root, engine) {
  const ui = {
    engine,
    tab: 'today',
    cat: 'meal',
    hoursSel: {},
    settings: loadSettings(),
    icon,
  };

  const main = h('main', { class: 'app' });
  const navItems = TABS.map((t) => h('button', { type: 'button', class: 'nav__item', dataset: { tab: t.id }, onclick: () => go(t.id) }, icon(t.icon), t.name));
  const nav = h('nav', { class: 'nav', 'aria-label': '메뉴' }, h('div', { class: 'nav__inner' }, navItems));
  const toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  root.replaceChildren(main, nav, toasts);

  /* 화면 모드 */
  const media = matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    const t = ui.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121311' : '#f1eee7');
  };
  media.addEventListener?.('change', applyTheme);
  ui.setTheme = (t) => {
    ui.settings = { ...ui.settings, theme: t };
    saveSettings(ui.settings);
    applyTheme();
    render();
  };

  /* 알림 */
  ui.toast = (title, sub, warn = false) => {
    const t = h('div', { class: `toast ${warn ? 'is-warn' : ''}`, role: 'status' }, h('b', {}, title), sub ? h('small', {}, sub) : null);
    toasts.append(t);
    while (toasts.children.length > 2) toasts.firstChild.remove();
    setTimeout(() => {
      t.classList.add('is-leaving');
      setTimeout(() => t.remove(), 260);
    }, 3200);
  };

  /* 아래에서 올라오는 시트 */
  let closeTop = null;
  ui.panel = (build) =>
    new Promise((resolve) => {
      let done = false;
      const close = (v) => {
        if (done) return;
        done = true;
        overlay.classList.add('is-leaving');
        setTimeout(() => overlay.remove(), 200);
        closeTop = null;
        resolve(v);
      };
      const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true' });
      const overlay = h('div', { class: 'overlay', onclick: (e) => e.target === overlay && close(null) }, panel);
      build(panel, close);
      closeTop = () => close(null);
      document.body.append(overlay);
      panel.querySelector('[data-autofocus]')?.focus();
    });
  addEventListener('keydown', (e) => e.key === 'Escape' && closeTop?.());

  ui.confirm = (title, text, ok, danger = true) =>
    ui.panel((p, close) => {
      p.setAttribute('aria-label', title);
      p.append(h('h2', { class: 'panel__title' }, title), h('p', { class: 'panel__lead' }, text), h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => close(false), 'data-autofocus': true }, '취소'), h('button', { type: 'button', class: `btn ${danger ? 'btn--danger' : ''}`, 'data-testid': 'confirm-ok', onclick: () => close(true) }, ok)));
    });

  /* 활동 */
  let busy = false;
  ui.perform = async (id, opts, btn) => {
    if (busy) return;
    busy = true;
    btn?.classList.add('is-busy');
    try {
      const r = await engine.perform(id, opts);
      if (!r.ok) return ui.toast('할 수 없어요', r.reason, true);
      const sm = r.summary;
      const parts = deltas(sm.life, sm.gains, STAT_NAME).map((d) => d.text);
      if (sm.income) parts.unshift(`+${Economy.won(sm.income)}`);
      if (sm.cost) parts.unshift(`-${Economy.won(sm.cost)}`);
      if (r.collapsed) return showMorning(r.collapsed, true);
      ui.toast(`${sm.name} · ${Time.clock(sm.start)}–${Time.clock(sm.end)}${sm.notes.length ? ` (${sm.notes.join(', ')})` : ''}`, parts.join(' · '));
    } finally {
      busy = false;
    }
  };

  /* 잠자기 */
  ui.openSleep = async () => {
    if (!engine.canSleep().ok) return;
    let wake = WAKE_OPTIONS.includes(ui.settings.wake) ? ui.settings.wake : 7 * 60;
    const go = await ui.panel((p, close) => {
      p.setAttribute('aria-label', '잠자리에 들기');
      const grid = h('div', { class: 'wake', role: 'radiogroup', 'aria-label': '일어날 시간' });
      const lead = h('p', { class: 'panel__lead num' });
      const paint = () => {
        grid.replaceChildren(...WAKE_OPTIONS.map((w) => {
          const pv = engine.sleepPreview(w);
          return h('button', { type: 'button', role: 'radio', class: w === wake ? 'is-on' : '', 'aria-checked': String(w === wake), dataset: { wake: w }, onclick: () => ((wake = w), paint()) }, h('b', { class: 'num' }, Time.clock(w)), h('small', { class: 'num' }, `${pv.hours}시간`));
        }));
        const pv = engine.sleepPreview(wake);
        lead.textContent = `${Time.clock(engine.state.time.minute)}에 잠들어 ${pv.hours}시간 자요. ${pv.hours < 5 ? '너무 짧으면 회복이 덜 돼요.' : pv.hours > 9.5 ? '너무 오래 자면 오히려 개운하지 않아요.' : '7~9시간이 가장 좋아요.'} 자정에 하루 생활비가 빠져나가요.`;
      };
      paint();
      p.append(h('h2', { class: 'panel__title' }, '언제 일어날까요?'), lead, grid, h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => close(false) }, '조금 더 있기'), h('button', { type: 'button', class: 'btn btn--ink', 'data-testid': 'sleep-confirm', 'data-autofocus': true, onclick: () => close(true) }, '잠들기')));
    });
    if (!go) return;
    ui.settings = { ...ui.settings, wake };
    saveSettings(ui.settings);
    const report = engine.sleep(wake);
    if (report) showMorning(report, false);
  };

  function showMorning(r, collapsed) {
    const s = engine.state;
    const d = Time.dateInfo(s.time);
    const gains = Object.entries(r.gains).filter(([, v]) => Math.abs(v) >= 0.05).map(([k, v]) => `${STAT_NAME[k]} ${v > 0 ? '+' : '-'}${Math.abs(v).toFixed(1)}`);
    ui.panel((p, close) => {
      p.setAttribute('aria-label', '아침');
      p.dataset.testid = 'morning';
      p.append(...[
        h('h2', { class: 'panel__title' }, `${d.month}월 ${d.date}일 ${d.weekday}요일 아침`),
        h('p', { class: 'panel__lead' }, collapsed ? '너무 지쳐서 그대로 쓰러져 잠들었어요. 기분이 가라앉고 스트레스가 쌓였어요.' : `${QUALITY[r.sleepQuality]} (${r.sleptHours}시간)`),
        h('div', { class: 'rows' },
          h('div', { class: 'row' }, h('span', {}, '어제 들어온 돈'), h('b', { class: 'num pos' }, `+${Economy.won(r.income)}`)),
          h('div', { class: 'row' }, h('span', {}, '어제 나간 돈'), h('b', { class: 'num' }, `-${Economy.won(r.expense)}`, h('small', {}, `생활비 ${Economy.won(r.living)} 포함`))),
          h('div', { class: 'row' }, h('span', {}, '지금 가진 돈'), h('b', { class: `num ${r.cashEnd < 0 ? 'neg' : ''}` }, Economy.won(r.cashEnd))),
          gains.length ? h('div', { class: 'row' }, h('span', {}, '어제 성장'), h('b', {}, gains.join(' · '))) : null),
        r.notes.length ? h('div', { class: 'entry__tags' }, r.notes.map((n) => h('span', { class: 'tag tag--warn' }, n))) : null,
        h('button', { type: 'button', class: 'btn btn--ink btn--block', 'data-testid': 'morning-ok', 'data-autofocus': true, onclick: () => close(true) }, '오늘 시작하기'),
      ].filter(Boolean));
    });
  }

  ui.confirmAbandon = async () => {
    const ok = await ui.confirm('새 인생을 시작할까요?', `${engine.state.character.name}의 기록이 모두 지워지고 캐릭터를 새로 만들어요. 되돌릴 수 없어요.`, '기록 지우기');
    if (ok) await engine.abandon();
  };

  /* 화면 */
  function go(id) {
    if (id === ui.tab) return scrollTo({ top: 0, behavior: 'smooth' });
    ui.tab = id;
    scrollTo({ top: 0 });
    render();
  }

  function render() {
    applyTheme();
    if (!engine.hasGame()) {
      nav.hidden = true;
      main.replaceChildren(createScreen(ui));
      return;
    }
    nav.hidden = false;
    const tab = TABS.find((t) => t.id === ui.tab) ?? TABS[0];
    const y = scrollY;
    main.replaceChildren(tab.view(ui));
    scrollTo({ top: y });
    for (const b of navItems) {
      const on = b.dataset.tab === tab.id;
      b.classList.toggle('is-on', on);
      on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    }
  }
  ui.render = render;

  engine.on('change', ({ reason }) => {
    if (reason === 'start' || reason === 'abandon' || reason === 'load') {
      ui.tab = 'today';
      ui.hoursSel = {};
      scrollTo({ top: 0 });
    }
    render();
    if (reason === 'start') ui.toast(`${engine.state.character.name}의 기록이 시작됐어요`, '활동을 고르면 그만큼 시간이 흘러요. 밤 8시부터 잠자리에 들 수 있어요.');
  });
  engine.on('error', ({ message }) => ui.toast(message, '저장 공간을 확인해 주세요', true));

  return ui;
}
