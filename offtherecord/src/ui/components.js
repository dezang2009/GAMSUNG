/** 여러 화면에서 쓰는 조각: 24시간 띠 · 상태 계기 · 그래프 */
import { h, s } from './dom.js';
import { CATEGORIES, TIMELINE_ONLY } from '../data/activities.js';
import * as Life from '../systems/LifeSystem.js';
import * as Time from '../systems/TimeSystem.js';

const CAT_NAME = Object.fromEntries([...CATEGORIES, ...TIMELINE_ONLY].map((c) => [c.id, c.name]));
export const catName = (id) => CAT_NAME[id] ?? id;
export const catColor = (id) => `var(--c-${id})`;
const pct = (min) => `${(min / 1440) * 100}%`;

/** 24시간 띠: 지난 시간 음영 · 한 일 · 정해진 일(점선) · 지금 */
export function ribbon({ blocks, minute, duties = [], showNow = true }) {
  const track = h('div', { class: 'ribbon__track', role: 'img', 'aria-label': `오늘 ${Time.clock(minute)}까지의 시간표` });
  if (showNow) track.append(h('div', { class: 'ribbon__past', style: { width: pct(minute) } }));
  for (const d of duties) track.append(h('div', { class: 'ribbon__block is-duty', style: { left: pct(d.start), width: pct(d.end - d.start) } }));
  for (const b of blocks) track.append(h('div', { class: 'ribbon__block', dataset: { cat: b.category }, title: `${Time.clock(b.start)}–${Time.clock(b.end)} ${b.label}`, style: { left: pct(b.start), width: pct(b.end - b.start), '--c': catColor(b.category) } }));
  if (showNow) track.append(h('div', { class: 'ribbon__now', style: { left: pct(minute) } }));
  const cats = [...new Set(blocks.map((b) => b.category))];
  return h('div', { class: 'ribbon' },
    track,
    h('div', { class: 'ribbon__scale num' }, ['0', '6', '12', '18', '24'].map((t) => h('span', {}, t))),
    cats.length ? h('div', { class: 'ribbon__legend' }, cats.map((c) => h('span', {}, h('i', { class: 'dot', style: { '--c': catColor(c) } }), catName(c)))) : null);
}

/** 작은 띠 (일지용) */
export function miniRibbon(blocks) {
  return h('div', { class: 'mini-ribbon', 'aria-hidden': 'true' }, blocks.map((b) => h('i', { style: { left: pct(b.start), width: pct(b.end - b.start), '--c': catColor(b.category) } })));
}

/** 상태 다섯 가지 */
export function gauges(life) {
  return h('div', { class: 'gauges' }, Life.KEYS.map((k) => {
    const v = life[k];
    const word = Life.describe(k, v);
    const tone = word === '좋음' ? 'good' : word === '나쁨' ? 'bad' : word === '위험' ? 'danger' : 'mid';
    return h('div', { class: 'gauge', dataset: { tone, key: k } },
      h('span', { class: 'gauge__name' }, Life.LABELS[k]),
      h('span', { class: 'gauge__bar', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v), 'aria-label': Life.LABELS[k] }, h('i', { style: { width: `${v}%` } })),
      h('span', { class: 'gauge__val num' }, Math.round(v), h('small', {}, word)));
  }));
}

/** 상태 다섯 가지를 한 줄로 (오늘 화면용) */
export function strip(life) {
  return h('div', { class: 'strip' }, Life.KEYS.map((k) => {
    const v = life[k];
    const word = Life.describe(k, v);
    const tone = word === '좋음' ? 'good' : word === '나쁨' ? 'bad' : word === '위험' ? 'danger' : 'mid';
    return h('div', { class: 'strip__cell', dataset: { tone, key: k } },
      h('span', { class: 'strip__name' }, Life.LABELS[k]),
      h('b', { class: 'strip__val num' }, Math.round(v)),
      h('span', { class: 'strip__bar', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v), 'aria-label': `${Life.LABELS[k]} ${word}` }, h('i', { style: { width: `${v}%` } })),
      h('small', { class: 'strip__word' }, word));
  }));
}

/** 변화량 한 줄 (예: 피로 +6 · 지능 +0.9) */
export function deltas(lifeDiff = {}, gains = {}, statNames = {}) {
  const parts = [];
  for (const [k, d] of Object.entries(lifeDiff)) {
    const good = Life.HIGHER_IS_BETTER[k] ? d > 0 : d < 0;
    parts.push({ text: `${Life.LABELS[k]} ${d > 0 ? '+' : '-'}${fmt(Math.abs(d))}`, good });
  }
  for (const [k, d] of Object.entries(gains)) parts.push({ text: `${statNames[k] ?? k} ${d > 0 ? '+' : '-'}${fmt(Math.abs(d))}`, good: d > 0 });
  return parts;
}
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

/**
 * 막대(수입·지출) + 선(잔액) 그래프. days: [{ label, income, expense, cash }]
 */
export function moneyChart(days) {
  const W = 320;
  const Hh = 150;
  const pad = { l: 4, r: 4, t: 10, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = Hh - pad.t - pad.b;
  const maxBar = Math.max(1, ...days.flatMap((d) => [d.income, d.expense]));
  const cashes = days.map((d) => d.cash);
  const cMin = Math.min(...cashes);
  const cMax = Math.max(...cashes);
  const cy = (v) => pad.t + ih - ((v - cMin) / Math.max(1, cMax - cMin)) * ih * 0.8 - ih * 0.1;
  const slot = iw / days.length;
  const bw = Math.min(10, slot / 3.2);
  const svgEl = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': '최근 수입·지출과 잔액' });
  svgEl.append(s('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: pad.t + ih, y2: pad.t + ih }));
  days.forEach((d, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const hi = (d.income / maxBar) * ih * 0.9;
    const ho = (d.expense / maxBar) * ih * 0.9;
    svgEl.append(
      s('rect', { class: 'bar-in', x: cx - bw - 1, y: pad.t + ih - hi, width: bw, height: Math.max(hi, d.income ? 1 : 0), rx: 2 }),
      s('rect', { class: 'bar-out', x: cx + 1, y: pad.t + ih - ho, width: bw, height: Math.max(ho, d.expense ? 1 : 0), rx: 2 }),
      s('text', { x: cx, y: Hh - 6, 'text-anchor': 'middle' }, d.label),
    );
  });
  const pts = days.map((d, i) => [pad.l + slot * i + slot / 2, cy(d.cash)]);
  svgEl.append(s('polyline', { class: 'line', points: pts.map((p) => p.join(',')).join(' ') }));
  for (const [x, y] of pts) svgEl.append(s('circle', { class: 'pt', cx: x, cy: y, r: 2.4 }));
  return svgEl;
}

/** 두 줄 그래프 (기분·스트레스). points: [{ label, a, b }] (0~100) */
export function moodChart(points) {
  const W = 320;
  const Hh = 130;
  const pad = { l: 22, r: 6, t: 8, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = Hh - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const y = (v) => pad.t + ih - (v / 100) * ih;
  const svgEl = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': '날짜별 기분과 스트레스' });
  for (const v of [0, 50, 100]) svgEl.append(s('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }), s('text', { x: 0, y: y(v) + 3 }, v));
  svgEl.append(s('polyline', { class: 'line', points: points.map((p, i) => `${x(i)},${y(p.a)}`).join(' ') }));
  svgEl.append(s('polyline', { class: 'line line--b', points: points.map((p, i) => `${x(i)},${y(p.b)}`).join(' ') }));
  const step = Math.ceil(points.length / 7);
  points.forEach((p, i) => {
    if (i % step === 0 || i === points.length - 1) svgEl.append(s('text', { x: x(i), y: Hh - 6, 'text-anchor': 'middle' }, p.label));
  });
  return svgEl;
}

/**
 * 한 줄 그래프 (능력치 등). points: [{ label, v }]. 값이 변한 폭에 맞춰 위아래를 잡고, 점마다 값을 적어요.
 */
export function lineChart(points, { label = '그래프', digits = 1 } = {}) {
  const W = 320;
  const Hh = 140;
  const pad = { l: 14, r: 14, t: 22, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = Hh - pad.t - pad.b;
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 1) (lo -= 0.5), (hi += 0.5);
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
  const svgEl = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': label });
  svgEl.append(s('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: pad.t + ih, y2: pad.t + ih }));
  svgEl.append(s('polyline', { class: 'line', points: points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ') }));
  points.forEach((p, i) => {
    svgEl.append(s('circle', { class: 'pt', cx: x(i), cy: y(p.v), r: 3 }));
    svgEl.append(s('text', { class: 'val', x: x(i), y: y(p.v) - 8, 'text-anchor': 'middle' }, p.v.toFixed(digits)));
    svgEl.append(s('text', { x: x(i), y: Hh - 6, 'text-anchor': 'middle' }, p.label));
  });
  return svgEl;
}

/** 비중 막대 (가로 한 줄). parts: [{ label, amount, share, color }] */
export function shareBar(parts) {
  return h('div', { class: 'sharebar', role: 'img', 'aria-label': parts.map((p) => `${p.label} ${Math.round(p.share * 100)}%`).join(', ') },
    parts.map((p) => h('i', { style: { width: `${Math.max(p.share * 100, 0.8)}%`, '--c': p.color } })));
}
