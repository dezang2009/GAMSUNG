/** 나 · 가계 · 일지 화면 */
import { h } from '../dom.js';
import { gauges, moneyChart, moodChart, miniRibbon, catName } from '../components.js';
import { STATS, REGIONS, EDUCATIONS, GENDERS, BACKGROUNDS, byId } from '../../data/world.js';
import * as Time from '../../systems/TimeSystem.js';
import * as Life from '../../systems/LifeSystem.js';
import * as Economy from '../../systems/EconomySystem.js';
import * as Activity from '../../systems/ActivitySystem.js';
import { ageOn, job as jobOf } from '../../systems/CharacterSystem.js';

const STAT_NAME = Object.fromEntries(STATS.map((x) => [x.id, x.name]));
const section = (id, title, aside, ...body) => h('section', { class: 'section', 'aria-labelledby': id }, h('div', { class: 'section__head' }, h('h2', { class: 'section__title', id }, title), aside ? h('span', { class: 'section__aside' }, aside) : null), ...body);
const row = (label, value, sub) => h('div', { class: 'row' }, h('span', {}, label), h('b', {}, value, sub ? h('small', {}, sub) : null));
const fmtGain = (n) => `${n > 0 ? '+' : '-'}${Math.abs(n).toFixed(1).replace(/\.0$/, '')}`;
const dayLabel = (time, day) => {
  const d = Time.dateInfo(time, day);
  return `${d.month}월 ${d.date}일 ${d.weekday}요일`;
};

/* ── 나 ── */
export function meScreen(ui) {
  const s = ui.engine.state;
  const c = s.character;
  const job = jobOf(c);
  const work = Activity.workActivity(s);
  const jobDetail = job.type === 'office' ? `평일 ${Time.clock(job.start)}~${Time.clock(job.end)} · 월 ${Economy.won(job.monthly)} (하루치씩 지급)` : job.type === 'freelance' ? `시간당 약 ${Economy.won(Activity.freelanceHourly(c.stats))} · 하루 최대 ${job.maxHours}시간` : `시급 ${Economy.won(job.hourly)} · ${Time.clock(job.from)}~${Time.clock(job.to)} · 하루 최대 ${job.maxHours}시간`;
  const gains = s.today.gains;

  return h('div', { class: 'screen', 'data-screen': 'me' },
    h('header', { class: 'masthead' }, h('div', { class: 'masthead__date' }, c.name, h('small', { class: 'num' }, `${ageOn(c, s.time.day)}세`)), h('div', { class: 'masthead__who' }, byId(BACKGROUNDS, c.background).name)),
    section('h-profile', '프로필', null, h('div', { class: 'sheet rows', 'data-testid': 'profile' },
      row('성별', byId(GENDERS, c.gender).name),
      row('거주 지역', byId(REGIONS, c.region).name),
      row('학력', byId(EDUCATIONS, c.education).name),
      row('초기 배경', byId(BACKGROUNDS, c.background).name),
      row('하는 일', job.title, jobDetail),
      work?.commute ? row('출퇴근', `편도 ${work.commute}분`) : null)),
    section('h-stats', '능력치', '오늘 성장한 만큼 함께 보여요', h('div', { class: 'sheet', 'data-testid': 'stats' }, STATS.map((st) => {
      const v = c.stats[st.id];
      const g = gains[st.id];
      return h('div', { class: 'stat', dataset: { stat: st.id } },
        h('span', { class: 'stat__name' }, st.name),
        h('span', { class: 'stat__val num' }, v.toFixed(1), g ? h('small', { class: g > 0 ? 'pos' : 'neg', style: { fontSize: '0.78rem', marginLeft: '6px', fontWeight: 600 } }, fmtGain(g)) : null),
        h('span', { class: 'stat__bar' }, h('i', { style: { width: `${v}%` } })),
        h('span', { class: 'stat__note' }, st.affects));
    }))),
    section('h-life', '생활 상태', `최대 체력 ${Life.maxEnergy(c.stats)}`, h('div', { class: 'sheet' }, gauges(s.life))));
}

/* ── 가계 ── */
export function moneyScreen(ui) {
  const s = ui.engine.state;
  const e = s.economy;
  const day = s.time.day;
  const today = Economy.totals(e, day);
  const living = Economy.dailyCost(e);

  // 최근 7일: 지난 결산 + 오늘(진행 중)
  const past = e.days.slice(-6).map((d) => ({ label: `${Time.dateInfo(s.time, d.day).month}/${Time.dateInfo(s.time, d.day).date}`, income: d.income, expense: d.expense, cash: d.cashEnd }));
  const days = [...past, { label: '오늘', income: today.income, expense: today.expense, cash: e.cash }];

  const byDay = new Map();
  for (const t of [...e.ledger].reverse().slice(0, 60)) {
    if (!byDay.has(t.day)) byDay.set(t.day, []);
    byDay.get(t.day).push(t);
  }

  return h('div', { class: 'screen', 'data-screen': 'money' },
    h('header', { class: 'masthead' },
      h('div', { class: 'figure' },
        h('span', { class: 'figure__label' }, '가진 돈'),
        h('span', { class: `figure__value num ${e.cash < 0 ? 'is-neg' : ''}`, 'data-testid': 'money-cash' }, Economy.won(e.cash)),
        h('span', { class: 'figure__sub num' }, `오늘 들어온 돈 ${Economy.won(today.income)} · 나간 돈 ${Economy.won(today.expense)}`)),
      e.cash < 0 ? h('p', { class: 'muted', style: { margin: 0, color: 'var(--danger)' } }, '잔액이 마이너스예요. 매일 밤 스트레스가 쌓여요.') : null),
    section('h-chart', '최근 7일', null,
      h('div', { class: 'sheet sheet--pad' }, moneyChart(days), h('div', { class: 'chart-legend', style: { marginTop: '8px' } }, h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--good)' } }), '수입'), h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--warn)' } }), '지출'), h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--accent)' } }), '잔액')))),
    section('h-living', '하루 생활비', '매일 밤 자정에 빠져나가요', h('div', { class: 'sheet rows', 'data-testid': 'living' },
      living.items.map((it) => row(it.label, Economy.won(it.daily), `한 달 ${Economy.won(it.monthly)}`)),
      row('합계', Economy.won(living.total)))),
    section('h-ledger', '수입·지출 기록', `${e.ledger.length}건`, h('div', { class: 'sheet', 'data-testid': 'ledger' },
      byDay.size
        ? [...byDay.entries()].map(([d, list]) => h('div', { class: 'rows' },
            h('div', { class: 'row', style: { paddingTop: '14px' } }, h('span', { style: { color: 'var(--ink)', fontWeight: 600 } }, d === day ? '오늘' : dayLabel(s.time, d)), h('b', {})),
            list.map((t) => row(t.label, h('span', { class: `num ${t.kind === 'income' ? 'pos' : ''}` }, `${t.kind === 'income' ? '+' : '-'}${Economy.won(t.amount)}`), t.minute >= 1440 ? '자정' : Time.clock(t.minute)))))
        : h('p', { class: 'empty' }, '아직 기록이 없어요. 식사하거나 일하면 여기에 쌓여요.'))));
}

/* ── 일지 ── */
export function journalScreen(ui) {
  const s = ui.engine.state;
  const reports = [...s.history.reports].reverse();
  const series = s.history.series.slice(-14);
  const quality = { short: '부족', fair: '보통', good: '푹 잠', long: '늦잠' };
  const themes = [
    ['auto', '기기 설정'],
    ['light', '밝게'],
    ['dark', '어둡게'],
  ];

  return h('div', { class: 'screen', 'data-screen': 'journal' },
    h('header', { class: 'masthead' }, h('div', { class: 'masthead__date' }, '일지'), h('div', { class: 'masthead__who' }, `${s.time.day}일째 기록 중`)),
    section('h-mood', '기분과 스트레스', '날마다 아침 기준', h('div', { class: 'sheet sheet--pad' },
      series.length > 1 ? moodChart(series.map((p) => {
        const d = Time.dateInfo(s.time, p.day);
        return { label: `${d.month}/${d.date}`, a: p.mood, b: p.stress };
      })) : h('p', { class: 'empty' }, '하루를 마치면 그래프가 그려져요.'),
      h('div', { class: 'chart-legend', style: { marginTop: '8px' } }, h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--accent)' } }), '기분'), h('span', {}, h('i', { class: 'dot', style: { '--c': 'var(--warn)' } }), '스트레스')))),
    section('h-days', '지난 날들', reports.length ? `${reports.length}일` : null, h('div', { class: 'sheet', 'data-testid': 'reports' },
      reports.length
        ? reports.map((r) => {
            const top = Object.entries(r.timeBy).filter(([k]) => k !== 'commute').sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, m]) => `${catName(k)} ${Time.span(m)}`);
            const gains = Object.entries(r.gains).filter(([, v]) => Math.abs(v) >= 0.05).map(([k, v]) => `${STAT_NAME[k]} ${fmtGain(v)}`);
            return h('article', { class: 'entry' },
              h('div', { class: 'entry__head' }, h('span', { class: 'entry__date' }, dayLabel(s.time, r.day)), h('span', { class: 'entry__money num' }, h('span', { class: 'pos' }, `+${Economy.won(r.income)}`), ' / ', h('span', {}, `-${Economy.won(r.expense)}`))),
              miniRibbon(r.blocks),
              h('div', { class: 'entry__line' }, top.length ? top.join(' · ') : '특별히 한 일 없이 보냈어요'),
              h('div', { class: 'entry__line muted num' }, `${Time.clock(r.sleepStart)}에 잠들어 ${r.sleptHours}시간 잠 (${quality[r.sleepQuality]}) · 잔액 ${Economy.won(r.cashEnd)}`),
              gains.length ? h('div', { class: 'entry__line' }, gains.join(' · ')) : null,
              r.notes.length ? h('div', { class: 'entry__tags' }, r.notes.map((n) => h('span', { class: 'tag tag--warn' }, n))) : null);
          })
        : h('p', { class: 'empty' }, '아직 마친 날이 없어요.'))),
    section('h-settings', '설정', null, h('div', { class: 'sheet sheet--pad', style: { display: 'grid', gap: '14px' } },
      h('div', { class: 'field' }, h('div', { class: 'field__label' }, '화면 모드'), h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '화면 모드' }, themes.map(([id, label]) => h('button', { type: 'button', role: 'radio', class: ui.settings.theme === id ? 'is-on' : '', 'aria-checked': String(ui.settings.theme === id), onclick: () => ui.setTheme(id) }, label)))),
      h('p', { class: 'muted', style: { margin: 0, fontSize: '0.84rem' } }, '진행 상황은 활동할 때마다 이 기기에 자동 저장돼요. 인터넷으로 보내지 않아요.'),
      h('button', { type: 'button', class: 'btn btn--quiet btn--block', 'data-testid': 'abandon', onclick: () => ui.confirmAbandon() }, '새 인생 시작하기'),
      h('p', { class: 'muted num', style: { margin: 0, fontSize: '0.78rem', textAlign: 'center' } }, `OFF THE RECORD ${__APP_VERSION__} · PHASE 1`))));
}
