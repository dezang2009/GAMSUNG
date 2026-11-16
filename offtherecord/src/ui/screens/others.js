/** 나 · 가계 · 일지 화면 (+ 날짜별 상세) */
import { h } from '../dom.js';
import { gauges, moneyChart, moodChart, miniRibbon, catName, catColor, lineChart, shareBar } from '../components.js';
import { STATS, REGIONS, EDUCATIONS, GENDERS, BACKGROUNDS, JOBS, byId } from '../../data/world.js';
import { ACTIVITIES } from '../../data/activities.js';
import * as Time from '../../systems/TimeSystem.js';
import * as Life from '../../systems/LifeSystem.js';
import * as Economy from '../../systems/EconomySystem.js';
import * as Activity from '../../systems/ActivitySystem.js';
import * as Career from '../../systems/CareerSystem.js';
import * as Journal from '../../systems/JournalSystem.js';
import { ageOn } from '../../systems/CharacterSystem.js';

const STAT_NAME = Object.fromEntries(STATS.map((x) => [x.id, x.name]));
const section = (id, title, aside, ...body) => h('section', { class: 'section', 'aria-labelledby': id }, h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id }, title), aside ? h('span', { class: 'section__aside' }, aside) : null), ...body);
const row = (label, value, sub) => h('div', { class: 'row' }, h('span', {}, label), h('b', {}, value, sub ? h('small', {}, sub) : null));
const signed = (n, d = 1) => `${n > 0 ? '+' : n < 0 ? '-' : '±'}${Math.abs(n).toFixed(d).replace(/\.0+$/, '')}`;
const dayLabel = (time, day) => {
  const d = Time.dateInfo(time, day);
  return `${d.month}월 ${d.date}일 ${d.weekday}요일`;
};
const shortDay = (time, day) => {
  const d = Time.dateInfo(time, day);
  return `${d.month}/${d.date}`;
};
const pct = (x) => `${Math.round(x * 100)}%`;

/** 능력치를 키우는 활동 이름 (데이터에서 자동으로) */
function growers(state, stat) {
  const names = ACTIVITIES.filter((a) => (a.grow?.[stat] ?? 0) > 0).map((a) => a.name);
  const w = Activity.workActivity(state);
  if (w) {
    const p = Activity.plan(state, w, { hours: 1 }, 1);
    if ((p.grow?.[stat] ?? 0) > 0) names.unshift(w.name);
  }
  return names;
}

/** 능력치 기록 점: 하루를 시작할 때의 기록(최근 6일) + 지금 */
function statPoints(state, stat) {
  const series = state.history.series.filter((p) => p.stats && p.day < state.time.day).slice(-6);
  return [...series.map((p) => ({ day: p.day, label: shortDay(state.time, p.day), v: p.stats[stat] })), { day: state.time.day, label: '지금', v: state.character.stats[stat] }];
}

/** 성장 기록: 날짜별 합계와 출처 */
function growthLog(state, stat) {
  const out = [];
  const today = state.today.gainLog.filter((g) => g.stat === stat);
  if (today.length) out.push({ day: state.time.day, total: today.reduce((a, g) => a + g.amount, 0), log: today });
  for (const r of [...state.history.reports].reverse()) {
    const log = (r.gainLog ?? []).filter((g) => g.stat === stat);
    const total = r.gains?.[stat] ?? 0;
    if (Math.abs(total) >= 0.01) out.push({ day: r.day, total, log });
    if (out.length >= 7) break;
  }
  return out;
}
const sources = (log) => {
  const m = new Map();
  for (const g of log) m.set(g.source, (m.get(g.source) ?? 0) + g.amount);
  return [...m.entries()].map(([k, v]) => `${k} ${signed(v, 2)}`).join(' · ');
};

/* ── 나 ── */
export function meScreen(ui) {
  const s = ui.engine.state;
  const c = s.character;
  const job = Career.currentJob(c);
  const work = Activity.workActivity(s);
  const sel = ui.statSel ?? 'intelligence';

  const jobDetail = !job
    ? '지금은 일하지 않아요'
    : job.type === 'office'
      ? `평일 ${Time.clock(job.start)}–${Time.clock(job.end)} · 월 ${Economy.won(job.monthly)} (출근한 날 하루치씩)`
      : job.type === 'freelance'
        ? `시간당 약 ${Economy.won(Activity.freelanceHourly(c.stats))} · 하루 최대 ${job.maxHours}시간`
        : `시급 ${Economy.won(job.hourly)} · ${Time.clock(job.from)}–${Time.clock(job.to)} · 하루 최대 ${job.maxHours}시간`;

  const profile = h('section', { class: 'profile', 'data-testid': 'profile' },
    h('div', { class: 'profile__name' }, c.name, h('small', { class: 'num' }, `${ageOn(c, s.time.day)}세`)),
    h('div', { class: 'chips' }, [byId(GENDERS, c.gender).name, byId(REGIONS, c.region).name, byId(EDUCATIONS, c.education).name, `시작: ${byId(BACKGROUNDS, c.background).name}`].map((t) => h('span', { class: 'chip' }, t))),
    h('div', { class: 'job', 'data-testid': 'job' },
      h('div', { class: 'job__head' }, h('span', { class: 'job__label' }, '현재 직업'), job ? h('span', { class: 'chip chip--accent' }, Career.JOB_TYPE_LABEL[job.type]) : null),
      h('b', { class: 'job__title' }, job ? job.title : '무직'),
      h('span', { class: 'job__detail' }, jobDetail),
      job ? h('span', { class: 'job__detail num' }, `${Career.tenureDays(c, s.time.day)}일째 · ${work?.commute ? `출퇴근 편도 ${work.commute}분` : '출퇴근 없음'}`) : null,
      c.career.history.length
        ? h('div', { class: 'job__history' }, h('span', { class: 'job__label' }, '지난 경력'), c.career.history.slice().reverse().map((x) => h('span', { class: 'job__detail num' }, `${JOBS[x.jobId]?.title ?? x.jobId} · ${shortDay(s.time, x.from)}–${shortDay(s.time, x.to)}${x.reason ? ` · ${x.reason}` : ''}`)))
        : null));

  // 능력치 그래프 + 목록
  const pts = statPoints(s, sel);
  const first = pts[0].v;
  const chart = h('div', { class: 'sheet sheet--pad', 'data-testid': 'stat-chart' },
    h('div', { class: 'chips chips--select', role: 'radiogroup', 'aria-label': '그래프로 볼 능력치' }, STATS.map((st) => h('button', { type: 'button', role: 'radio', class: `chip chip--btn ${sel === st.id ? 'is-on' : ''}`, 'aria-checked': String(sel === st.id), dataset: { stat: st.id }, onclick: () => ((ui.statSel = st.id), ui.render()) }, st.name))),
    pts.length > 1 ? lineChart(pts, { label: `${STAT_NAME[sel]} 최근 변화` }) : h('p', { class: 'empty' }, '하루를 마치면 날마다의 변화가 그래프로 쌓여요.'),
    h('p', { class: 'note num' }, pts.length > 1 ? `${pts[0].label}보다 ${signed(pts.at(-1).v - first)} · 하루를 시작할 때 기준` : `지금 ${STAT_NAME[sel]} ${pts[0].v.toFixed(1)}`));

  const list = h('div', { class: 'sheet', 'data-testid': 'stats' }, STATS.map((st) => {
    const v = c.stats[st.id];
    const p = statPoints(s, st.id);
    const change = p.length > 1 ? p.at(-1).v - p[0].v : 0;
    const g = growers(s, st.id);
    return h('div', { class: 'stat', dataset: { stat: st.id } },
      h('span', { class: 'stat__name' }, st.name),
      h('span', { class: 'stat__val num' }, v.toFixed(1), Math.abs(change) >= 0.05 ? h('small', { class: change > 0 ? 'pos' : 'neg' }, signed(change)) : null),
      h('span', { class: 'stat__bar' }, h('i', { style: { width: `${v}%` } })),
      h('span', { class: 'stat__note' }, h('b', {}, '영향 '), st.affects),
      h('span', { class: 'stat__note' }, h('b', {}, '키우기 '), g.length ? g.join(', ') : '아직 키우는 활동이 없어요'));
  }));

  const log = growthLog(s, sel);
  const logEl = h('div', { class: 'sheet', 'data-testid': 'growth-log' },
    log.length
      ? log.map((x) => h('div', { class: 'row' }, h('span', {}, x.day === s.time.day ? '오늘' : dayLabel(s.time, x.day)), h('b', { class: `num ${x.total >= 0 ? 'pos' : 'neg'}` }, signed(x.total, 2), x.log.length ? h('small', {}, sources(x.log)) : null)))
      : h('p', { class: 'empty' }, `아직 ${STAT_NAME[sel]} 성장 기록이 없어요.`));

  return h('div', { class: 'screen', 'data-screen': 'me' },
    profile,
    section('h-stats', '능력치 변화', '최근 7일', chart),
    section('h-log', `${STAT_NAME[sel]} 성장 기록`, '날짜별 · 무엇으로 늘었나', logEl),
    section('h-list', '능력치', '무엇에 영향을 주고 어떻게 키우나', list),
    section('h-life', '생활 상태', `최대 체력 ${Life.maxEnergy(c.stats)}`, h('div', { class: 'sheet' }, gauges(s.life))));
}

/* ── 가계 ── */
export function moneyScreen(ui) {
  const s = ui.engine.state;
  const e = s.economy;
  const day = s.time.day;
  const today = Economy.totals(e, day);
  const living = Economy.dailyCost(e);
  const mKey = Time.monthKey(s.time);
  const month = Economy.monthSummary(e, mKey);
  const bs = Economy.balanceSheet(e);
  const daysLeft = Time.daysLeftInMonth(s.time);
  const fc = Economy.forecast(e, daysLeft);
  const d = Time.dateInfo(s.time);
  const nextMonth = d.month === 12 ? 1 : d.month + 1;

  const past = e.days.slice(-6).map((x) => ({ label: shortDay(s.time, x.day), income: x.income, expense: x.expense, cash: x.cashEnd }));
  const days = [...past, { label: '오늘', income: today.income, expense: today.expense, cash: e.cash }];

  const byDay = new Map();
  for (const t of [...e.ledger].reverse().slice(0, 60)) {
    if (!byDay.has(t.day)) byDay.set(t.day, []);
    byDay.get(t.day).push(t);
  }

  const catColorOf = (id) => (id === 'living' ? 'var(--c-sleep)' : catColor(id));

  return h('div', { class: 'screen', 'data-screen': 'money' },
    h('section', { class: 'hero hero--money' },
      h('span', { class: 'hero__label' }, '가진 돈'),
      h('span', { class: `hero__big num ${e.cash < 0 ? 'is-neg' : ''}`, 'data-testid': 'money-cash' }, Economy.won(e.cash)),
      h('div', { class: 'hero__pair num' },
        h('span', {}, '오늘 ', h('b', { class: 'pos' }, `+${Economy.won(today.income)}`), ' / ', h('b', {}, `-${Economy.won(today.expense)}`)),
        h('span', {}, '순자산 ', h('b', { class: bs.netWorth < 0 ? 'neg' : '' }, Economy.won(bs.netWorth))))),
    section('h-month', `${d.month}월 결산`, '이번 달 실제 기록', h('div', { class: 'sheet', 'data-testid': 'month' },
      row('수입', h('span', { class: 'num pos' }, `+${Economy.won(month.income)}`)),
      row('지출', h('span', { class: 'num' }, `-${Economy.won(month.expense)}`)),
      row('저축액', h('span', { class: `num ${month.saved < 0 ? 'neg' : 'pos'}` }, Economy.won(month.saved)), month.rate === null ? '수입이 아직 없어요' : `수입의 ${pct(month.rate)}`),
      h('div', { class: 'forecast', 'data-testid': 'forecast' },
        h('span', {}, `${nextMonth}월 1일 예상 잔액`),
        h('b', { class: `num ${fc.amount < 0 ? 'neg' : ''}` }, Economy.won(fc.amount)),
        h('small', {}, `${fc.basis} × 남은 ${daysLeft}일`)))),
    section('h-share', '어디에 썼나', `${d.month}월 지출 ${Economy.won(month.expense)}`, h('div', { class: 'sheet sheet--pad', 'data-testid': 'share' },
      month.categories.length
        ? [shareBar(month.categories.map((c) => ({ ...c, color: catColorOf(c.id) }))),
            h('div', { class: 'rows' }, month.categories.map((c) => h('div', { class: 'row' }, h('span', {}, h('i', { class: 'dot', style: { '--c': catColorOf(c.id) } }), c.label), h('b', { class: 'num' }, Economy.won(c.amount), h('small', {}, pct(c.share))))))]
        : h('p', { class: 'empty' }, '이번 달 지출이 아직 없어요.'))),
    section('h-bs', '자산과 부채', null, h('div', { class: 'sheet', 'data-testid': 'balance' },
      bs.assets.map((a) => row(a.label, h('span', { class: 'num' }, Economy.won(a.amount)), '자산')),
      bs.liabilities.length ? bs.liabilities.map((l) => row(l.label, h('span', { class: 'num neg' }, `-${Economy.won(l.amount)}`), '부채')) : row('부채', h('span', { class: 'num' }, '없음')),
      row('순자산', h('span', { class: `num ${bs.netWorth < 0 ? 'neg' : ''}` }, Economy.won(bs.netWorth)), '자산 - 부채'))),
    section('h-chart', '최근 7일', null,
      h('div', { class: 'sheet sheet--pad' }, moneyChart(days), h('div', { class: 'chart-legend' }, h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--good)' } }), '수입'), h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--warn)' } }), '지출'), h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--accent)' } }), '잔액')))),
    section('h-living', '하루 생활비', '매일 밤 자정에 빠져나가요', h('div', { class: 'sheet rows', 'data-testid': 'living' },
      living.items.map((it) => row(it.label, Economy.won(it.daily), `한 달 ${Economy.won(it.monthly)}`)),
      row('합계', Economy.won(living.total)))),
    section('h-ledger', '수입·지출 기록', `최근 ${Math.min(60, e.ledger.length)}건`, h('div', { class: 'sheet', 'data-testid': 'ledger' },
      byDay.size
        ? [...byDay.entries()].map(([dd, list]) => h('div', { class: 'rows' },
            h('div', { class: 'row row--head' }, h('span', {}, dd === day ? '오늘' : dayLabel(s.time, dd))),
            list.map((t) => row(t.label, h('span', { class: `num ${t.kind === 'income' ? 'pos' : ''}` }, `${t.kind === 'income' ? '+' : '-'}${Economy.won(t.amount)}`), `${Economy.CATEGORY_LABELS[t.category] ?? t.category} · ${t.minute >= 1440 ? '자정' : Time.clock(t.minute)}`))))
        : h('p', { class: 'empty' }, '아직 기록이 없어요. 식사하거나 일하면 여기에 쌓여요.'))));
}

/* ── 일지 ── */
const QUALITY = { short: '잠 부족', fair: '보통', good: '푹 잠', long: '늦잠' };

/** 날짜 하나의 상세 (지난 날·오늘 공통) */
export function dayDetail(state, day) {
  const isToday = day === state.time.day;
  const r = isToday ? null : state.history.reports.find((x) => x.day === day);
  const blocks = isToday ? state.today.blocks : r?.blocks ?? [];
  const gainLog = isToday ? state.today.gainLog : r?.gainLog ?? [];
  const gains = isToday ? state.today.gains : r?.gains ?? {};
  const events = Journal.forDay(state.journal, day);
  const money = state.economy.ledger.filter((t) => t.day === day);
  const byStat = {};
  for (const g of gainLog) (byStat[g.stat] ??= []).push(g);

  return h('div', { class: 'detail', 'data-testid': 'day-detail' },
    miniRibbon(blocks),
    r ? h('p', { class: 'note num' }, `${Time.clock(r.sleepStart)}에 잠들어 ${r.sleptHours}시간 (${QUALITY[r.sleepQuality]}) · 하루를 마칠 때 잔액 ${Economy.won(r.cashEnd)}`) : null,
    events.length ? h('div', { class: 'detail__block' }, h('h3', {}, '있었던 일'), events.map((ev) => h('div', { class: 'event' }, h('span', { class: 'chip' }, Journal.TYPE_LABEL[ev.type] ?? ev.type), h('span', {}, h('b', {}, ev.title), ev.text ? h('small', {}, ev.text) : null)))) : null,
    h('div', { class: 'detail__block' }, h('h3', {}, '시간표'),
      blocks.length
        ? blocks.map((b) => h('div', { class: 'tl' }, h('span', { class: 'tl__time num' }, `${Time.clock(b.start)}–${Time.clock(b.end)}`), h('i', { class: 'dot', style: { '--c': catColor(b.category) } }), h('span', {}, b.label, h('small', {}, catName(b.category)))))
        : h('p', { class: 'empty' }, '한 일이 없어요.')),
    h('div', { class: 'detail__block' }, h('h3', {}, '돈'),
      money.length ? money.map((t) => row(t.label, h('span', { class: `num ${t.kind === 'income' ? 'pos' : ''}` }, `${t.kind === 'income' ? '+' : '-'}${Economy.won(t.amount)}`), t.minute >= 1440 ? '자정' : Time.clock(t.minute))) : h('p', { class: 'empty' }, r ? '이 날의 자세한 거래 기록은 남아 있지 않아요.' : '아직 쓰거나 번 돈이 없어요.'),
      r ? row('합계', h('span', { class: 'num' }, `+${Economy.won(r.income)} / -${Economy.won(r.expense)}`)) : null),
    h('div', { class: 'detail__block' }, h('h3', {}, '성장'),
      Object.keys(gains).length
        ? Object.entries(gains).filter(([, v]) => Math.abs(v) >= 0.01).map(([k, v]) => row(STAT_NAME[k], h('span', { class: `num ${v >= 0 ? 'pos' : 'neg'}` }, signed(v, 2)), byStat[k] ? sources(byStat[k]) : ''))
        : h('p', { class: 'empty' }, '능력치 변화가 없었어요.')));
}

export function journalScreen(ui) {
  const s = ui.engine.state;
  const reports = [...s.history.reports].reverse();
  const series = s.history.series.slice(-14);
  const events = Journal.recent(s.journal, 8);
  const themes = [
    ['auto', '기기 설정'],
    ['light', '밝게'],
    ['dark', '어둡게'],
  ];

  const dayCard = (day, r) => {
    const isToday = !r;
    const blocks = isToday ? s.today.blocks : r.blocks;
    const timeBy = {};
    for (const b of blocks) if (b.category !== 'commute') timeBy[b.category] = (timeBy[b.category] ?? 0) + (b.end - b.start);
    const top = Object.entries(timeBy).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const evs = Journal.forDay(s.journal, day);
    return h('button', { type: 'button', class: 'entry', dataset: { day }, 'aria-label': `${dayLabel(s.time, day)} 자세히`, onclick: () => ui.openDay(day) },
      h('div', { class: 'entry__head' },
        h('span', { class: 'entry__date' }, isToday ? `오늘 · ${dayLabel(s.time, day)}` : dayLabel(s.time, day)),
        r ? h('span', { class: 'entry__money num' }, h('span', { class: 'pos' }, `+${Economy.won(r.income)}`), ' / ', `-${Economy.won(r.expense)}`) : h('span', { class: 'entry__money' }, '진행 중')),
      miniRibbon(blocks),
      h('div', { class: 'chips' }, top.length ? top.map(([k, m]) => h('span', { class: 'chip' }, h('i', { class: 'dot', style: { '--c': catColor(k) } }), `${catName(k)} ${Time.span(m)}`)) : h('span', { class: 'chip' }, '특별히 한 일 없음')),
      evs.length ? h('div', { class: 'entry__line' }, evs.map((e) => e.title).join(' · ')) : null,
      h('span', { class: 'entry__more' }, '자세히', ui.icon('chevron', 16)));
  };

  return h('div', { class: 'screen', 'data-screen': 'journal' },
    h('header', { class: 'page-head' }, h('h1', {}, '일지'), h('p', {}, `${s.time.day}일째 기록 중 · 날짜를 누르면 자세히 볼 수 있어요`)),
    section('h-events', '주요 사건', `${s.journal.events.length}건`, h('div', { class: 'sheet', 'data-testid': 'events' },
      events.length ? events.map((ev) => h('div', { class: 'event' }, h('span', { class: 'chip' }, Journal.TYPE_LABEL[ev.type] ?? ev.type), h('span', {}, h('b', {}, ev.title), h('small', {}, `${shortDay(s.time, ev.day)}${ev.text ? ` · ${ev.text}` : ''}`)))) : h('p', { class: 'empty' }, '아직 기록된 사건이 없어요.'))),
    section('h-days', '날짜별 기록', null, h('div', { class: 'sheet', 'data-testid': 'reports' }, dayCard(s.time.day, null), reports.map((r) => dayCard(r.day, r)))),
    section('h-mood', '기분과 스트레스', '하루를 시작할 때 기준', h('div', { class: 'sheet sheet--pad' },
      series.length > 1 ? moodChart(series.map((p) => ({ label: shortDay(s.time, p.day), a: p.mood, b: p.stress }))) : h('p', { class: 'empty' }, '하루를 마치면 그래프가 그려져요.'),
      h('div', { class: 'chart-legend' }, h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--accent)' } }), '기분'), h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--warn)' } }), '스트레스')))),
    section('h-settings', '설정', null, h('div', { class: 'sheet sheet--pad settings' },
      h('div', { class: 'field' }, h('div', { class: 'field__label' }, '화면 모드'), h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '화면 모드' }, themes.map(([id, label]) => h('button', { type: 'button', role: 'radio', class: ui.settings.theme === id ? 'is-on' : '', 'aria-checked': String(ui.settings.theme === id), dataset: { theme: id }, onclick: () => ui.setTheme(id) }, label)))),
      h('div', { class: 'field' }, h('div', { class: 'field__label' }, '저장 데이터'),
        h('p', { class: 'note' }, '활동할 때마다 이 기기에 자동 저장돼요. 기기를 바꾸거나 다시 설치할 때는 내보낸 글자를 보관했다가 가져오기에 붙여 넣어요.'),
        h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn btn--quiet', 'data-testid': 'export', onclick: () => ui.openExport() }, '내보내기'), h('button', { type: 'button', class: 'btn btn--quiet', 'data-testid': 'import', onclick: () => ui.openImport() }, '가져오기'))),
      h('button', { type: 'button', class: 'btn btn--quiet btn--block', 'data-testid': 'abandon', onclick: () => ui.confirmAbandon() }, '새 인생 시작하기'),
      h('p', { class: 'note num', style: { textAlign: 'center' } }, `OFF THE RECORD ${__APP_VERSION__}`))));
}
