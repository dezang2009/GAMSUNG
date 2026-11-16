/** 오늘: 날짜·시간·돈, 24시간 띠, 상태, 오늘의 일정, 활동 고르기, 하루 마치기 */
import { h } from '../dom.js';
import { ribbon, strip, deltas, catName } from '../components.js';
import { CATEGORIES } from '../../data/activities.js';
import { STATS } from '../../data/world.js';
import * as Time from '../../systems/TimeSystem.js';
import * as Life from '../../systems/LifeSystem.js';
import * as Economy from '../../systems/EconomySystem.js';
import { ageOn } from '../../systems/CharacterSystem.js';

const STAT_NAME = Object.fromEntries(STATS.map((x) => [x.id, x.name]));

export function masthead(state) {
  const d = Time.dateInfo(state.time);
  const c = state.character;
  return h('header', { class: 'masthead' },
    h('div', { class: 'masthead__who' }, h('b', { 'data-testid': 'who' }, c.name), h('span', { class: 'num' }, `${ageOn(c, state.time.day)}세`), h('span', { class: 'num' }, `· ${state.time.day}일째`)),
    h('div', { class: 'masthead__row' },
      h('div', { class: 'masthead__date', 'data-testid': 'date' }, `${d.month}월 ${d.date}일`, h('small', {}, `${d.weekday}요일`)),
      h('div', { class: 'masthead__clock num', 'data-testid': 'clock' }, Time.clock(state.time.minute))),
    h('div', { class: 'masthead__meta' },
      h('span', { class: 'num' }, `오늘 남은 시간 ${Time.span(Time.remaining(state.time))}`),
      h('span', { class: `masthead__cash num ${state.economy.cash < 0 ? 'is-neg' : ''}`, 'data-testid': 'cash' }, Economy.won(state.economy.cash))));
}

export function todayScreen(ui) {
  const { engine } = ui;
  const state = engine.state;
  const schedule = engine.schedule();
  const eff = Life.efficiency(state.life);

  // 상태
  const effLine = h('div', { class: `efficiency ${eff.value < 0.85 ? 'is-low' : ''}`, 'data-testid': 'efficiency' },
    h('span', {}, eff.reasons.length ? eff.reasons.join(' · ') : '컨디션이 무난해요'),
    h('span', { class: 'num' }, '활동 효율 ', h('b', {}, `${Math.round(eff.value * 100)}%`)));
  const condition = h('section', { class: 'section', 'aria-labelledby': 'h-cond' },
    h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id: 'h-cond' }, '지금 상태'), h('button', { type: 'button', class: 'linkish', onclick: () => ((ui.tab = 'me'), ui.render()) }, '자세히')),
    h('div', { class: 'sheet', 'data-testid': 'gauges' }, strip(state.life), effLine));

  // 일정
  const now = state.time.minute;
  const done = state.today.blocks.filter((b) => b.category !== 'commute');
  const agendaItems = [
    ...schedule.map((it) => ({ start: it.start, end: it.end, label: it.label, hint: it.hint, status: it.status })),
    ...done.filter((b) => b.category !== 'meal' && b.category !== 'work').map((b) => ({ start: b.start, end: b.end, label: b.label, status: 'done', did: true })),
  ].sort((a, b) => a.start - b.start || (a.did ? 1 : -1));
  const statusText = { done: '완료', missed: '놓침', planned: '예정', open: '가능' };
  const agenda = h('section', { class: 'section', 'aria-labelledby': 'h-agenda' },
    h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id: 'h-agenda' }, '오늘의 일정'), h('span', { class: 'section__aside num' }, `한 일 ${done.length}건`)),
    h('div', { class: 'sheet agenda', 'data-testid': 'agenda' }, agendaItems.map((it) => {
      const isNow = it.status !== 'done' && it.status !== 'missed' && now >= it.start && now < it.end;
      return h('div', { class: 'agenda__item', dataset: { status: isNow ? 'now' : it.status } },
        h('span', { class: 'agenda__time num' }, `${Time.clock(it.start)}–${Time.clock(it.end)}`),
        h('span', { class: 'agenda__label' }, it.label, it.hint ? h('small', {}, it.hint) : null),
        h('span', { class: 'agenda__status' }, isNow ? '지금' : statusText[it.status] ?? ''));
    })));

  // 활동
  const all = engine.activities(ui.hoursSel);
  const cats = CATEGORIES.filter((c) => all.some((a) => a.act.category === c.id));
  if (!cats.some((c) => c.id === ui.cat)) ui.cat = cats[0].id;
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': '활동 분류' }, cats.map((c) => {
    const avail = all.filter((a) => a.act.category === c.id && !a.blocked).length;
    return h('button', { type: 'button', role: 'tab', class: `tab ${ui.cat === c.id ? 'is-on' : ''}`, 'aria-selected': String(ui.cat === c.id), dataset: { cat: c.id }, onclick: () => ((ui.cat = c.id), ui.render()) }, c.name);
  }));
  const list = h('div', { class: 'sheet acts', 'data-testid': 'acts' }, all.filter((a) => a.act.category === ui.cat).map((a) => actRow(ui, a)));
  const acts = h('section', { class: 'section', 'aria-labelledby': 'h-acts' },
    h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id: 'h-acts' }, '무엇을 할까요'), h('span', { class: 'section__aside' }, '시간은 활동한 만큼 흘러요')),
    tabs, list);

  // 하루 마치기
  const can = engine.canSleep();
  const nothingFits = !all.some((a) => !a.blocked);
  const end = h('div', { class: 'endday', 'data-testid': 'endday' },
    h('p', {}, h('b', {}, can.ok ? '오늘을 마무리할까요?' : '하루 마치기'), can.ok ? (nothingFits ? '오늘은 더 할 수 있는 일이 없어요.' : '자고 일어나면 다음 날이에요.') : can.reason),
    h('button', { type: 'button', class: 'btn btn--ink', disabled: !can.ok, 'data-testid': 'sleep-btn', onclick: () => ui.openSleep() }, ui.icon('moon', 18), '잠자리에 들기'));

  return h('div', { class: 'screen', 'data-screen': 'today' },
    masthead(state),
    ribbon({ blocks: state.today.blocks, minute: now, duties: schedule.filter((x) => x.kind === 'duty' && x.status === 'planned') }),
    condition, agenda, acts, end);
}

function actRow(ui, { act, blocked, minutes, preview }) {
  const facts = [];
  if (minutes > 0) facts.push(h('span', { class: 'num' }, Time.span(minutes)));
  if (preview) {
    const cost = preview.cost + preview.extraCosts.reduce((a, c) => a + c.amount, 0);
    if (cost) facts.push(h('span', { class: 'num down' }, `-${Economy.won(cost)}`));
    if (preview.income) facts.push(h('span', { class: 'num up' }, `+${Economy.won(preview.income)}`));
    for (const d of deltas(preview.effects ? pickEffects(preview.effects) : {}, {}, STAT_NAME).slice(0, 3)) facts.push(h('span', { class: d.good ? 'up' : 'down' }, d.text));
    for (const k of Object.keys(preview.grow ?? {}).filter((k) => preview.grow[k] > 0)) facts.push(h('span', { class: 'up' }, `${STAT_NAME[k]} 성장`));
  }
  const hours = act.hoursOptions
    ? h('div', { class: 'act__hours', role: 'radiogroup', 'aria-label': '일할 시간' }, act.hoursOptions.map((n) => {
        const on = (ui.hoursSel[act.id]?.hours ?? act.hoursOptions[0]) === n;
        return h('button', { type: 'button', role: 'radio', class: on ? 'is-on' : '', 'aria-checked': String(on), onclick: () => ((ui.hoursSel[act.id] = { hours: n }), ui.render()) }, `${n}시간`);
      }))
    : null;
  return h('div', { class: `act ${blocked ? 'is-blocked' : ''}`, dataset: { act: act.id } },
    h('div', { class: 'act__name' }, act.name),
    h('button', { type: 'button', class: 'btn btn--small', disabled: !!blocked, 'aria-label': `${act.name} 하기`, 'data-testid': `do-${act.id}`, onclick: (e) => ui.perform(act.id, ui.hoursSel[act.id] ?? {}, e.currentTarget) }, '하기'),
    h('div', { class: 'act__desc' }, act.desc),
    hours,
    h('div', { class: 'act__facts' }, facts),
    blocked ? h('div', { class: 'act__blocked', 'data-testid': 'blocked' }, blocked) : null);
}

/** 미리보기에는 활동 고유의 큰 변화만 (0.5 미만은 생략) */
function pickEffects(effects) {
  const out = {};
  for (const [k, v] of Object.entries(effects)) if (Math.abs(v) >= 0.5) out[k] = Math.round(v);
  return out;
}

export { catName };
