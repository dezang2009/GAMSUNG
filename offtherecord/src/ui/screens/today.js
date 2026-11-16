/**
 * 오늘: 시간 카드(지금 시각·남은 시간·24시간 띠) → 방금 한 일 → 상태 → 추천 → 활동 → 오늘의 일정
 * 잠자리에 들 수 있으면 하단 메뉴 위에 ‘하루 마무리’ 막대가 떠요 (UIController).
 */
import { h } from '../dom.js';
import { ribbon, strip, catName } from '../components.js';
import { CATEGORIES } from '../../data/activities.js';
import { STATS } from '../../data/world.js';
import * as Time from '../../systems/TimeSystem.js';
import * as Life from '../../systems/LifeSystem.js';
import * as Economy from '../../systems/EconomySystem.js';
import { ageOn } from '../../systems/CharacterSystem.js';

const STAT_NAME = Object.fromEntries(STATS.map((x) => [x.id, x.name]));
const fmt = (n) => (Math.abs(n) >= 10 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, ''));

/** 상태 변화 칩: 좋아지면 초록, 나빠지면 주황 (1 미만 변화는 생략) */
export function effectChips(life = {}, gains = {}, { max = 6 } = {}) {
  const chips = [];
  const entries = Object.entries(life).filter(([, d]) => Math.abs(d) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [k, d] of entries) {
    const good = Life.HIGHER_IS_BETTER[k] ? d > 0 : d < 0;
    chips.push(h('span', { class: `chip ${good ? 'chip--good' : 'chip--bad'}` }, `${Life.LABELS[k]} ${d > 0 ? '+' : '-'}${fmt(Math.abs(d))}`));
  }
  for (const [k, d] of Object.entries(gains)) if (Math.abs(d) >= 0.05) chips.push(h('span', { class: `chip ${d > 0 ? 'chip--grow' : 'chip--bad'}` }, `${STAT_NAME[k]} ${d > 0 ? '+' : '-'}${Math.abs(d).toFixed(1)}`));
  return chips.slice(0, max);
}

function timeCard(ui, state) {
  const d = Time.dateInfo(state.time);
  const c = state.character;
  const now = state.time.minute;
  const left = Time.remaining(state.time);
  const can = ui.engine.canSleep();
  const schedule = ui.engine.schedule();
  return h('section', { class: 'hero', 'aria-label': '오늘 시간' },
    h('div', { class: 'hero__top' },
      h('span', { class: 'hero__who' }, h('b', { 'data-testid': 'who' }, c.name), ` ${ageOn(c, state.time.day)}세 · ${state.time.day}일째`),
      h('span', { class: `hero__cash num ${state.economy.cash < 0 ? 'is-neg' : ''}`, 'data-testid': 'cash' }, Economy.won(state.economy.cash))),
    h('div', { class: 'hero__date', 'data-testid': 'date' }, `${d.month}월 ${d.date}일 ${d.weekday}요일`),
    h('div', { class: 'hero__time' },
      h('div', { class: 'hero__clock num', 'data-testid': 'clock' }, Time.clock(now)),
      h('div', { class: 'hero__left' },
        h('span', {}, '오늘 남은 시간'),
        h('b', { class: 'num', 'data-testid': 'left' }, Time.span(left)))),
    ribbon({ blocks: state.today.blocks, minute: now, duties: schedule.filter((x) => x.kind === 'duty' && x.status === 'planned') }),
    can.ok ? null : h('p', { class: 'hero__hint' }, can.reason));
}

function resultCard(ui) {
  const r = ui.lastResult;
  if (!r) return null;
  const money = [];
  if (r.cost) money.push(h('span', { class: 'num' }, `-${Economy.won(r.cost)}`));
  if (r.income) money.push(h('span', { class: 'num pos' }, `+${Economy.won(r.income)}`));
  return h('section', { class: 'result', 'data-testid': 'result', 'aria-live': 'polite' },
    h('div', { class: 'result__head' },
      h('div', {}, h('span', { class: 'result__label' }, '방금 한 일'), h('b', { class: 'result__name' }, r.name, r.notes?.length ? ` (${r.notes.join(', ')})` : '')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '결과 닫기', onclick: () => ((ui.lastResult = null), ui.render()) }, ui.icon('close', 20))),
    h('div', { class: 'result__meta num' }, `${Time.clock(r.start)} → ${Time.clock(r.end)} · ${Time.span(r.minutes)}`, money.length ? h('span', { class: 'result__money' }, money) : null),
    h('div', { class: 'chips' }, effectChips(r.life, r.gains, { max: 8 })));
}

export function todayScreen(ui) {
  const { engine } = ui;
  const state = engine.state;
  const eff = Life.efficiency(state.life);
  if (ui.lastResult && ui.lastResult.day !== state.time.day) ui.lastResult = null;

  // 상태 (간결하게: 다섯 칸 + 효율 한 줄)
  const condition = h('section', { class: 'section', 'aria-labelledby': 'h-cond' },
    h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id: 'h-cond' }, '지금 상태'), h('button', { type: 'button', class: 'linkish', onclick: () => ui.go('me') }, '자세히')),
    h('div', { class: 'sheet', 'data-testid': 'gauges' }, strip(state.life),
      h('div', { class: `efficiency ${eff.value < 0.85 ? 'is-low' : ''}`, 'data-testid': 'efficiency' },
        h('span', {}, eff.reasons.length ? eff.reasons.join(' · ') : '컨디션이 무난해요'),
        h('span', { class: 'num' }, '활동 효율 ', h('b', {}, `${Math.round(eff.value * 100)}%`)))));

  // 활동 목록 + 추천
  const all = engine.activities(ui.hoursSel);
  const recs = engine.recommend(all);
  const byId = new Map(all.map((a) => [a.act.id, a]));
  const rec = recs.length
    ? h('section', { class: 'section', 'aria-labelledby': 'h-rec' },
        h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id: 'h-rec' }, '추천'), h('span', { class: 'section__aside' }, '지금 상태와 돈 사정을 보고 골랐어요')),
        h('div', { class: 'sheet acts', 'data-testid': 'recs' }, recs.map((r) => actRow(ui, r.opts?.hours ? engine.activities({ [r.id]: r.opts }).find((a) => a.act.id === r.id) : byId.get(r.id), { reason: r.reason, opts: r.opts }))))
    : null;

  const cats = CATEGORIES.filter((c) => all.some((a) => a.act.category === c.id));
  if (!cats.some((c) => c.id === ui.cat)) ui.cat = cats[0].id;
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': '활동 분류' }, cats.map((c) => {
    const avail = all.filter((a) => a.act.category === c.id && !a.blocked).length;
    return h('button', { type: 'button', role: 'tab', class: `tab ${ui.cat === c.id ? 'is-on' : ''} ${avail ? '' : 'is-empty'}`, 'aria-selected': String(ui.cat === c.id), dataset: { cat: c.id }, onclick: () => ((ui.cat = c.id), ui.render()) }, c.name, h('small', { class: 'num' }, avail));
  }));
  const acts = h('section', { class: 'section', 'aria-labelledby': 'h-acts' },
    h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id: 'h-acts' }, '모든 활동'), h('span', { class: 'section__aside' }, '숫자는 지금 할 수 있는 개수')),
    tabs,
    h('div', { class: 'sheet acts', 'data-testid': 'acts' }, all.filter((a) => a.act.category === ui.cat).map((a) => actRow(ui, a))));

  // 일정
  const schedule = engine.schedule();
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

  return h('div', { class: 'screen', 'data-screen': 'today' }, timeCard(ui, state), resultCard(ui), condition, rec, acts, agenda);
}

/** 활동 한 줄: 이름·하기 / 시간·끝나는 시각·돈 / 예상 변화 칩 / 막힌 이유 */
function actRow(ui, entry, { reason, opts } = {}) {
  const { act, blocked, minutes, preview } = entry;
  const sel = opts ?? ui.hoursSel[act.id] ?? {};
  const facts = [];
  if (minutes > 0) facts.push(h('span', { class: 'fact num' }, ui.icon('clock', 15), Time.span(minutes), blocked ? '' : h('small', {}, ` · ${Time.clock(ui.engine.state.time.minute + minutes)}까지`)));
  if (preview?.cost) facts.push(h('span', { class: 'fact num fact--cost' }, `-${Economy.won(preview.cost)}`));
  else if (preview && !preview.income) facts.push(h('span', { class: 'fact fact--free' }, '무료'));
  if (preview?.income) facts.push(h('span', { class: 'fact num fact--income' }, `+${Economy.won(preview.income)}`));
  const hours = act.hoursOptions && !reason
    ? h('div', { class: 'act__hours', role: 'radiogroup', 'aria-label': '일할 시간' }, act.hoursOptions.map((n) => {
        const on = (ui.hoursSel[act.id]?.hours ?? act.hoursOptions[0]) === n;
        return h('button', { type: 'button', role: 'radio', class: on ? 'is-on' : '', 'aria-checked': String(on), onclick: () => ((ui.hoursSel[act.id] = { hours: n }), ui.render()) }, `${n}시간`);
      }))
    : null;
  const label = act.hoursOptions && reason ? `${act.name} ${sel.hours ?? 1}시간` : act.name;
  return h('div', { class: `act ${blocked ? 'is-blocked' : ''}`, dataset: { act: act.id, rec: reason ? '1' : null } },
    h('div', { class: 'act__main' },
      h('div', { class: 'act__name' }, label),
      reason ? h('div', { class: 'act__reason' }, reason) : h('div', { class: 'act__desc' }, act.desc),
      h('div', { class: 'act__facts' }, facts)),
    h('button', { type: 'button', class: 'btn act__go', disabled: !!blocked, 'aria-label': `${label} 하기`, 'data-testid': reason ? `rec-${act.id}` : `do-${act.id}`, onclick: (e) => ui.perform(act.id, sel, e.currentTarget) }, '하기'),
    hours,
    !blocked && preview ? h('div', { class: 'chips act__chips', 'aria-label': '예상 변화' }, preview.collapse ? h('span', { class: 'chip chip--bad' }, '쓰러질 수 있어요') : null, effectChips(preview.life, preview.gains, { max: 5 })) : null,
    blocked ? h('div', { class: 'act__blocked', 'data-testid': 'blocked' }, blocked) : null);
}

export { catName };
