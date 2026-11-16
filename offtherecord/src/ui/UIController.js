/**
 * UIController — 화면 전환 · 하단 메뉴 · 알림 · 시트(잠자기·아침 보고·확인) · 화면 모드.
 * 게임 상태는 엔진만 바꾸고, 여기서는 엔진의 'change' 를 듣고 다시 그려요.
 */
import { h, icon } from './dom.js';
import { createScreen } from './screens/create.js';
import { todayScreen } from './screens/today.js';
import { meScreen, moneyScreen, journalScreen, dayDetail } from './screens/others.js';
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
  const sleepbar = h('div', { class: 'sleepbar', hidden: true, 'data-testid': 'sleepbar' });
  const saveBanner = h('div', { class: 'save-banner', role: 'alert', hidden: true, 'data-testid': 'save-banner' });
  root.replaceChildren(saveBanner, main, sleepbar, nav, toasts);

  /* 화면 모드 */
  const media = matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    const t = ui.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1115' : '#f6f7fb');
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
      if (r.collapsed) {
        ui.lastResult = null;
        return showMorning(r.collapsed, true);
      }
      // 결과는 오늘 화면의 ‘방금 한 일’ 카드로 보여 줘요
      ui.lastResult = { ...r.summary, day: engine.state.time.day };
      render();
      main.querySelector('[data-testid=result]')?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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

  /* 날짜별 상세 */
  ui.openDay = (day) =>
    ui.panel((p, close) => {
      const s = engine.state;
      const d = Time.dateInfo(s.time, day);
      p.setAttribute('aria-label', `${d.month}월 ${d.date}일 기록`);
      p.append(
        h('div', { class: 'panel__head' }, h('h2', { class: 'panel__title' }, `${d.month}월 ${d.date}일 ${d.weekday}요일${day === s.time.day ? ' (오늘)' : ''}`), h('button', { type: 'button', class: 'icon-btn', 'aria-label': '닫기', 'data-autofocus': true, onclick: () => close(null) }, icon('close', 20))),
        dayDetail(s, day),
      );
    });

  /* 저장 데이터 내보내기·가져오기 */
  ui.openExport = () =>
    ui.panel((p, close) => {
      const text = engine.exportText();
      const area = h('textarea', { class: 'input textarea', readonly: true, rows: 5, 'aria-label': '내보낸 저장 데이터', 'data-testid': 'export-text' }, text);
      const status = h('p', { class: 'note', 'aria-live': 'polite' }, `${Math.ceil(text.length / 1024)}KB · 이 글자 전체가 저장 데이터예요. 메모 앱 등에 붙여 넣어 보관하세요.`);
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(text);
          status.textContent = '복사했어요. 안전한 곳에 붙여 넣어 보관하세요.';
        } catch {
          area.focus();
          area.select();
          status.textContent = '자동 복사가 막혀 있어요. 글자를 길게 눌러 전체 선택 후 복사해 주세요.';
        }
      };
      p.setAttribute('aria-label', '저장 데이터 내보내기');
      p.append(h('h2', { class: 'panel__title' }, '저장 데이터 내보내기'), area, status, h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => close(null) }, '닫기'), h('button', { type: 'button', class: 'btn btn--ink', 'data-autofocus': true, 'data-testid': 'export-copy', onclick: copy }, '복사하기')));
    });

  ui.openImport = () =>
    ui.panel((p, close) => {
      const area = h('textarea', { class: 'input textarea', rows: 5, placeholder: '내보낸 글자를 여기에 붙여 넣어 주세요', 'aria-label': '가져올 저장 데이터', 'data-testid': 'import-text' });
      const status = h('p', { class: 'note note--warn', 'aria-live': 'polite', 'data-testid': 'import-status' }, '가져오면 지금 기록은 가져온 기록으로 바뀌어요.');
      const go = async () => {
        if (!area.value.trim()) return (status.textContent = '붙여 넣은 글자가 없어요.');
        const r = await engine.importText(area.value);
        if (r.error) return (status.textContent = r.error);
        close(true);
        ui.toast('기록을 가져왔어요', `${engine.state.character.name} · ${engine.state.time.day}일째`);
      };
      p.setAttribute('aria-label', '저장 데이터 가져오기');
      p.append(h('h2', { class: 'panel__title' }, '저장 데이터 가져오기'), area, status, h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => close(null) }, '취소'), h('button', { type: 'button', class: 'btn btn--danger', 'data-testid': 'import-go', onclick: go }, '가져오기')));
      setTimeout(() => area.focus(), 50);
    });

  ui.confirmAbandon = async () => {
    const ok = await ui.confirm('새 인생을 시작할까요?', `${engine.state.character.name}의 기록이 모두 지워지고 캐릭터를 새로 만들어요. 되돌릴 수 없어요.`, '기록 지우기');
    if (ok) await engine.abandon();
  };

  /* 화면 */
  ui.go = (id) => go(id);
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
      sleepbar.hidden = true;
      main.replaceChildren(createScreen(ui));
      return;
    }
    nav.hidden = false;
    const tab = TABS.find((t) => t.id === ui.tab) ?? TABS[0];
    // 하루 마무리 막대: 오늘 화면에서 잠자리에 들 수 있을 때
    const can = engine.canSleep();
    sleepbar.hidden = !(tab.id === 'today' && can.ok);
    main.classList.toggle('has-sleepbar', !sleepbar.hidden);
    if (!sleepbar.hidden) {
      const s = engine.state;
      const nothing = !engine.activities(ui.hoursSel).some((a) => !a.blocked);
      sleepbar.replaceChildren(
        h('div', { class: 'sleepbar__text' }, h('b', {}, nothing ? '오늘은 더 할 수 있는 일이 없어요' : '하루를 마무리할 수 있어요'), h('span', { class: 'num' }, `자정에 생활비 -${Economy.won(Economy.dailyCost(s.economy).total)}`)),
        h('button', { type: 'button', class: 'btn btn--ink', 'data-testid': 'sleep-btn', onclick: () => ui.openSleep() }, icon('moon', 18), '잠자리에 들기'));
    }
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
      ui.lastResult = null;
      scrollTo({ top: 0 });
    }
    render();
    if (reason === 'start') ui.toast(`${engine.state.character.name}의 기록이 시작됐어요`, '활동을 고르면 그만큼 시간이 흘러요. 밤 8시부터 잠자리에 들 수 있어요.');
  });
  /* 저장 실패 안내: 화면 위에 남아 있는 막대 + 다시 시도 */
  engine.on('save', ({ ok, message }) => {
    saveBanner.hidden = ok;
    if (!ok) {
      saveBanner.replaceChildren(
        h('div', {}, h('b', {}, '저장하지 못했어요'), h('span', {}, `${message}. 지금 앱을 닫으면 마지막 저장 이후 진행이 사라질 수 있어요. 저장 공간을 확보한 뒤 다시 시도해 주세요.`)),
        h('button', { type: 'button', class: 'btn btn--small', 'data-testid': 'save-retry', onclick: async (e) => { e.currentTarget.classList.add('is-busy'); await engine.retrySave(); } }, '다시 시도'));
    } else ui.toast('저장했어요', '진행 상황이 안전하게 저장됐어요');
  });

  /* 안드로이드: 뒤로 가기 = 시트 닫기 → 오늘 화면 → 앱 종료, 백그라운드로 갈 때 저장 마무리 */
  import('@capacitor/app')
    .then(({ App }) => {
      App.addListener('backButton', async () => {
        if (closeTop) return closeTop();
        if (engine.hasGame() && ui.tab !== 'today') return go('today');
        await engine.flush();
        App.exitApp();
      });
      App.addListener('pause', () => engine.flush());
    })
    .catch(() => {});

  return ui;
}
