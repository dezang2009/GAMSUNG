/**
 * GameEngine — 시스템들을 이어 주는 곳.
 * 화면(UIController)은 이 엔진의 명령(start · perform · sleep …)만 부르고, 'change' 이벤트를 듣고 다시 그려요.
 * 각 시스템은 자기 상태 조각만 다뤄요:
 *   character ← CharacterSystem(+CareerSystem) · time ← TimeSystem · life ← LifeSystem
 *   economy ← EconomySystem · journal ← JournalSystem · 활동 계획 ← ActivitySystem · 추천 ← RecommendSystem · 저장 ← SaveSystem
 */
import * as Character from '../systems/CharacterSystem.js';
import * as Career from '../systems/CareerSystem.js';
import * as Time from '../systems/TimeSystem.js';
import * as Life from '../systems/LifeSystem.js';
import * as Economy from '../systems/EconomySystem.js';
import * as Activity from '../systems/ActivitySystem.js';
import * as Journal from '../systems/JournalSystem.js';
import { recommend } from '../systems/RecommendSystem.js';
import { SAVE_VERSION, exportText, importText } from '../systems/SaveSystem.js';
import { BACKGROUNDS, STATS, byId } from '../data/world.js';

export const WAKE_OPTIONS = [5, 6, 7, 8, 9, 10, 11].map((h) => h * 60);
export const SLEEP_FROM = 20 * 60;
const REPORTS_MAX = 120;
const STAT_NAME = Object.fromEntries(STATS.map((x) => [x.id, x.name]));

/** 아주 작은 이벤트 버스 */
function emitter() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type).delete(fn);
    },
    emit(type, payload) {
      for (const fn of map.get(type) ?? []) fn(payload);
    },
  };
}

const freshToday = () => ({ blocks: [], counts: {}, gains: {}, gainLog: [], notes: [], workMinutes: 0, worked: false });

/** 새 게임 상태 (캐릭터 입력 검사 포함) */
export function newState(input, now = Date.now()) {
  const character = Character.create(input);
  const bg = byId(BACKGROUNDS, input.background);
  const time = Time.create();
  const life = Life.create(bg.life);
  life.energy = Math.min(life.energy, Life.maxEnergy(character.stats));
  const state = {
    version: SAVE_VERSION,
    meta: { createdAt: now, updatedAt: now },
    character,
    time,
    life,
    economy: Economy.create(bg.cash, input.region),
    today: freshToday(),
    journal: Journal.create(),
    history: { reports: [], series: [] },
  };
  state.history.series.push(snapshot(state));
  const job = Career.currentJob(character);
  Journal.add(state.journal, { day: 1, minute: time.minute, type: 'life', title: `${character.name}의 기록이 시작됐어요`, text: `${bg.name} · ${job ? job.title : '무직'}` });
  return state;
}

const snapshot = (s) => ({ day: s.time.day, cash: s.economy.cash, mood: s.life.mood, stress: s.life.stress, energy: s.life.energy, fatigue: s.life.fatigue, hunger: s.life.hunger, stats: { ...s.character.stats } });
const tx = (s, extra) => ({ day: s.time.day, month: Time.monthKey(s.time), ...extra });

/** 능력치 변화 기록 (성장·하락 모두, 출처와 함께) */
function noteGain(s, stat, amount, source) {
  if (!amount) return;
  s.today.gains[stat] = round2((s.today.gains[stat] ?? 0) + amount);
  s.today.gainLog.push({ stat, amount, source, minute: s.time.minute });
}

/**
 * 활동 한 번을 상태에 적용해요 (검사는 끝났다고 봐요). 진짜 상태와 미리보기용 복사본 모두에 써요.
 *  돈 → 시간 흐름(그동안 배고픔·피로) → 활동 효과 → 성장 → 수입 → 기록
 */
function applyActivity(s, act, opts) {
  const eff = Life.efficiency(s.life);
  const p = Activity.plan(s, act, opts, eff.value);
  const startMinute = s.time.minute;
  const st = s.character.stats;
  const lifeBefore = { ...s.life };

  if (p.cost) Economy.spend(s.economy, tx(s, { minute: startMinute, category: p.category, label: p.name, amount: p.cost }));
  for (const c of p.extraCosts) Economy.charge(s.economy, tx(s, { minute: startMinute, ...c }));

  Time.advance(s.time, p.minutes, (m) => Life.passAwake(s.life, m, st, p.load));
  Life.apply(s.life, p.effects, st);

  const gains = {};
  for (const [stat, base] of Object.entries(p.grow)) {
    const before = st[stat];
    const g = Character.grow(s.character, stat, base, eff.value);
    if (!g) continue;
    gains[stat] = g;
    noteGain(s, stat, g, p.name);
    if (Math.floor(before / 10) < Math.floor(st[stat] / 10)) Journal.add(s.journal, { day: s.time.day, minute: s.time.minute, type: 'growth', title: `${STAT_NAME[stat]}이(가) ${Math.floor(st[stat] / 10) * 10}을 넘었어요`, text: `${p.name}을(를) 하다가` });
  }
  if (p.income) Economy.earn(s.economy, tx(s, { minute: s.time.minute, category: 'work', label: p.incomeLabel, amount: p.income }));

  s.today.counts[act.id] = (s.today.counts[act.id] ?? 0) + 1;
  s.today.blocks.push(...p.blocks);
  if (act.id === 'work') {
    s.today.worked = true;
    s.today.workMinutes += p.minutes;
    if (p.late) {
      noteGain(s, 'diligence', Character.decline(s.character, 'diligence', 0.3), '지각');
      s.today.notes.push('지각');
      Journal.add(s.journal, { day: s.time.day, minute: startMinute, type: 'work', title: '지각했어요', text: `${Time.clock(startMinute)}에 집을 나섰어요` });
    }
  }
  const lifeDiff = {};
  for (const k of Life.KEYS) {
    const d = Math.round((s.life[k] - lifeBefore[k]) * 10) / 10;
    if (d) lifeDiff[k] = d;
  }
  return { id: act.id, name: p.name, category: p.category, minutes: p.minutes, start: startMinute, end: s.time.minute, cost: p.cost + p.extraCosts.reduce((a, c) => a + c.amount, 0), income: p.income, life: lifeDiff, lifeBefore, lifeAfter: { ...s.life }, gains, efficiency: eff.value, notes: p.notes, collapse: Life.collapsed(s.life) };
}

/** 미리보기용 가벼운 복사본 (기록 목록은 비워서) */
const lightClone = (s) => ({
  character: structuredClone(s.character),
  time: { ...s.time },
  life: { ...s.life },
  economy: { ...s.economy, fixed: { ...s.economy.fixed }, ledger: [], days: [], months: {} },
  today: structuredClone(s.today),
  journal: Journal.create(),
});

export function createEngine({ saveSystem, now = () => Date.now() } = {}) {
  const bus = emitter();
  let state = null;
  let saving = Promise.resolve();
  let saveError = null;

  const persist = () => {
    if (!saveSystem || !state) return saving;
    state.meta.updatedAt = now();
    const copy = structuredClone(state);
    saving = saving
      .then(() => saveSystem.save(copy))
      .then(() => {
        if (saveError) {
          saveError = null;
          bus.emit('save', { ok: true });
        }
      })
      .catch((e) => {
        saveError = String(e?.message ?? e);
        bus.emit('save', { ok: false, message: saveError });
      });
    return saving;
  };
  const changed = (reason, extra) => {
    bus.emit('change', { reason, ...extra });
    return persist();
  };

  const engine = {
    on: bus.on,
    get state() {
      return state;
    },
    hasGame: () => !!state,
    get saveError() {
      return saveError;
    },
    /** 저장 다시 시도 */
    retrySave: () => persist(),

    /** 저장된 게임 불러오기 (예전 버전이면 SaveSystem 이 올려 줘요) */
    async load() {
      if (!saveSystem) return { empty: true };
      const r = await saveSystem.load();
      if (r.data) {
        state = r.data;
        bus.emit('change', { reason: 'load' });
      }
      return r;
    },

    /** 새 인생 시작 (입력 검사 실패 시 errors 를 담은 오류) */
    async start(input) {
      state = newState(input, now());
      await changed('start');
      return state;
    },

    /** 기록을 지우고 처음으로 */
    async abandon() {
      await saving;
      state = null;
      await saveSystem?.clear();
      bus.emit('change', { reason: 'abandon' });
    },

    /**
     * 지금 할 수 있는 활동들 + 막힌 이유 + 예상 결과
     * preview: 실제로 했을 때와 같은 계산을 복사본에 돌린 결과 (시간·돈·상태 변화·성장·쓰러짐 위험)
     */
    activities(opts = {}) {
      return Activity.all(state).map((act) => {
        const o = opts[act.id] ?? {};
        const blocked = Activity.check(state, act, o);
        const minutes = Activity.duration(state, act, o);
        let preview = null;
        if (!blocked) preview = applyActivity(lightClone(state), act, o);
        else if (!(act.id === 'work' && act.job.type === 'office')) {
          const p = Activity.plan(state, act, o, Life.efficiency(state.life).value);
          preview = { cost: p.cost + p.extraCosts.reduce((a, c) => a + c.amount, 0), income: p.income, life: {}, gains: {} };
        }
        return { act, blocked, minutes, preview };
      });
    },

    /** 추천 활동 (상태·돈·일정 기반, 최대 3개) */
    recommend(entries = engine.activities()) {
      return recommend(state, entries);
    },

    /** 활동하기. 결과 { ok, reason?, summary, collapsed? } */
    async perform(id, opts = {}) {
      const act = Activity.find(state, id);
      const reason = Activity.check(state, act, opts);
      if (reason) return { ok: false, reason };
      const summary = applyActivity(state, act, opts);
      let collapsed = null;
      if (Life.collapsed(state.life)) collapsed = engine.sleep(10 * 60, { collapsed: true, silent: true });
      await changed('perform', { summary });
      return { ok: true, summary, collapsed };
    },

    /** 잠자리에 들 수 있는지 (밤 8시 이후, 또는 많이 지쳤을 때, 또는 남은 시간이 거의 없을 때) */
    canSleep() {
      if (!state) return { ok: false };
      const { minute } = state.time;
      if (minute >= SLEEP_FROM || Time.remaining(state.time) < 60 || state.life.fatigue >= 75 || state.life.energy <= 20) return { ok: true };
      return { ok: false, reason: `밤 ${SLEEP_FROM / 60}시부터 잘 수 있어요 (많이 지쳤으면 그 전에도)` };
    },

    /** 잘 경우의 미리보기 */
    sleepPreview(wakeMinute) {
      const minutes = Time.DAY_MINUTES - state.time.minute + wakeMinute;
      return { minutes, hours: Math.round((minutes / 60) * 10) / 10 };
    },

    /**
     * 하루 마치기: 자정 결산(생활비·결근) → 잠 → 다음 날. 아침 보고서를 돌려줘요.
     * (collapsed: 쓰러져서 강제로 잠든 경우)
     */
    sleep(wakeMinute, { collapsed = false, silent = false } = {}) {
      if (!WAKE_OPTIONS.includes(wakeMinute)) throw new Error('일어날 시간을 골라 주세요');
      if (!collapsed && !engine.canSleep().ok) return null;
      const day = state.time.day;
      const st = state.character.stats;
      const job = Career.currentJob(state.character);
      const notes = state.today.notes;
      const at = state.time.minute;

      // 평일에 출근하지 않았으면 결근
      if (job?.type === 'office' && Time.isWeekday(state.time) && !state.today.worked) {
        Life.apply(state.life, { stress: 8 }, st);
        noteGain(state, 'diligence', Character.decline(state.character, 'diligence', 0.8), '결근');
        notes.push('결근');
        Journal.add(state.journal, { day, minute: at, type: 'work', title: '출근하지 않았어요 (결근)', text: '성실성이 떨어지고 스트레스가 쌓였어요' });
      }
      if (collapsed) {
        Life.apply(state.life, { mood: -10, stress: 8 }, st);
        notes.push('지쳐 쓰러짐');
        Journal.add(state.journal, { day, minute: at, type: 'health', title: '지쳐서 쓰러졌어요', text: '다음 날 10시에 깼어요' });
      }
      const wasDebt = Economy.inDebt(state.economy);
      const { living, summary: money } = Economy.settleDay(state.economy, day, Time.monthKey(state.time));
      if (Economy.inDebt(state.economy)) {
        Life.apply(state.life, { stress: 5 }, st);
        notes.push('잔액 부족');
        if (!wasDebt) Journal.add(state.journal, { day, minute: 1440, type: 'money', title: '잔액이 마이너스가 됐어요', text: `밀린 생활비 ${Economy.won(-state.economy.cash)}` });
      }

      const timeBy = {};
      for (const b of state.today.blocks) timeBy[b.category] = (timeBy[b.category] ?? 0) + (b.end - b.start);
      const sleptMinutes = Time.nextDay(state.time, wakeMinute);
      const sl = Life.sleep(state.life, sleptMinutes, st);

      const report = { day, sleepStart: at, wake: wakeMinute, sleptHours: sl.hours, sleepQuality: sl.quality, timeBy, income: money.income, expense: money.expense, living: living?.amount ?? 0, cashEnd: state.economy.cash, gains: { ...state.today.gains }, gainLog: state.today.gainLog, notes: [...notes], blocks: state.today.blocks, lifeAfter: { ...state.life } };
      state.history.reports.push(report);
      if (state.history.reports.length > REPORTS_MAX) state.history.reports.shift();
      state.history.series.push(snapshot(state));
      if (state.history.series.length > 400) state.history.series.shift();
      state.today = freshToday();
      if (!silent) changed('sleep', { report });
      return report;
    },

    /** 오늘의 일정: 해야 할 일(근무·식사 때) */
    schedule() {
      const items = [];
      const { minute } = state.time;
      const job = Career.currentJob(state.character);
      const act = Activity.workActivity(state);
      if (job?.type === 'office' && Time.isWeekday(state.time)) {
        const leave = job.start - act.commute;
        items.push({ start: job.start, end: job.end, label: `근무 · ${job.title}`, kind: 'duty', status: state.today.worked ? 'done' : minute > leave + 60 ? 'missed' : 'planned', hint: state.today.worked ? '' : `${Time.clock(leave)}에 나서야 늦지 않아요` });
      } else if (job && job.type !== 'office') {
        const left = job.maxHours * 60 - state.today.workMinutes;
        items.push({ start: job.from ?? 6 * 60, end: job.to ?? 24 * 60, label: `${job.title} 가능`, kind: 'duty', status: left <= 0 ? 'done' : 'open', hint: left > 0 ? `오늘 ${left / 60}시간 더 일할 수 있어요` : '오늘 일은 다 했어요' });
      }
      const meals = state.today.blocks.filter((b) => b.category === 'meal' || b.category === 'social');
      const mealTimes = [
        [7 * 60, 9 * 60, '아침'],
        [12 * 60, 13 * 60, '점심'],
        [18 * 60, 20 * 60, '저녁'],
      ];
      for (const [s, e, label] of mealTimes) {
        const ate = meals.some((b) => b.start < e + 60 && b.end > s - 60) || (label === '점심' && state.today.worked && job?.type === 'office');
        items.push({ start: s, end: e, label: `${label} 식사`, kind: 'meal', status: ate ? 'done' : minute > e + 60 ? 'missed' : 'planned' });
      }
      items.sort((a, b) => a.start - b.start);
      return items;
    },

    /** 저장 데이터 내보내기 (글자) */
    exportText: () => exportText(state, now()),

    /** 저장 데이터 가져오기: 검사 통과 시 지금 기록을 바꿔요. { ok } | { error } */
    async importText(text) {
      const r = importText(text);
      if (r.error) return { error: r.error };
      state = r.data;
      await changed('load');
      return { ok: true };
    },

    /** 저장이 끝날 때까지 기다리기 (테스트·앱 종료 직전) */
    flush: () => saving,
  };

  return engine;
}

const round2 = (n) => Math.round(n * 100) / 100;
