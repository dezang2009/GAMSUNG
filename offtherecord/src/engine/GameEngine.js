/**
 * GameEngine — 시스템들을 이어 주는 곳.
 * 화면(UIController)은 이 엔진의 명령(start · perform · sleep …)만 부르고, 'change' 이벤트를 듣고 다시 그려요.
 * 각 시스템은 자기 상태 조각만 다뤄요:
 *   character ← CharacterSystem · time ← TimeSystem · life ← LifeSystem · economy ← EconomySystem
 *   활동 계획 ← ActivitySystem · 저장 ← SaveSystem
 */
import * as Character from '../systems/CharacterSystem.js';
import * as Time from '../systems/TimeSystem.js';
import * as Life from '../systems/LifeSystem.js';
import * as Economy from '../systems/EconomySystem.js';
import * as Activity from '../systems/ActivitySystem.js';
import { SAVE_VERSION } from '../systems/SaveSystem.js';
import { BACKGROUNDS, JOBS, byId } from '../data/world.js';

export const WAKE_OPTIONS = [5, 6, 7, 8, 9, 10, 11].map((h) => h * 60);
export const SLEEP_FROM = 20 * 60;
const REPORTS_MAX = 120;

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

const freshToday = () => ({ blocks: [], counts: {}, gains: {}, notes: [], workMinutes: 0, worked: false });

/** 새 게임 상태 (캐릭터 입력 검사 포함) */
export function newState(input, now = Date.now()) {
  const character = Character.create(input);
  const bg = byId(BACKGROUNDS, input.background);
  const time = Time.create();
  const life = Life.create(bg.life);
  life.energy = Math.min(life.energy, Life.maxEnergy(character.stats));
  return {
    version: SAVE_VERSION,
    meta: { createdAt: now, updatedAt: now },
    character,
    time,
    life,
    economy: Economy.create(bg.cash, input.region),
    today: freshToday(),
    history: { reports: [], series: [snapshot({ time, life, economy: { cash: bg.cash } })] },
  };
}

const snapshot = (s) => ({ day: s.time.day, cash: s.economy.cash, mood: s.life.mood, stress: s.life.stress, energy: s.life.energy, fatigue: s.life.fatigue, hunger: s.life.hunger });

export function createEngine({ saveSystem, now = () => Date.now() } = {}) {
  const bus = emitter();
  let state = null;
  let saving = Promise.resolve();

  const persist = () => {
    if (!saveSystem || !state) return saving;
    state.meta.updatedAt = now();
    const copy = structuredClone(state);
    saving = saving.then(() => saveSystem.save(copy)).catch((e) => bus.emit('error', { message: '저장하지 못했어요', detail: String(e) }));
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

    /** 저장된 게임 불러오기 */
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

    /** 지금 할 수 있는 활동들 + 막힌 이유 + 예상 변화 */
    activities(opts = {}) {
      const eff = Life.efficiency(state.life).value;
      return Activity.all(state).map((act) => {
        const o = opts[act.id] ?? {};
        const blocked = Activity.check(state, act, o);
        const minutes = Activity.duration(state, act, o);
        return { act, blocked, minutes, preview: blocked && act.id === 'work' && act.job.type === 'office' ? null : Activity.plan(state, act, o, eff) };
      });
    },

    /**
     * 활동하기. 결과 { ok, reason?, summary }
     *  1) 검사 → 2) 시간 흐름(그동안 배고픔·피로) → 3) 활동 효과 → 4) 성장 → 5) 돈 → 6) 기록 → 7) 쓰러짐 확인
     */
    async perform(id, opts = {}) {
      const act = Activity.find(state, id);
      const reason = Activity.check(state, act, opts);
      if (reason) return { ok: false, reason };
      const eff = Life.efficiency(state.life);
      const p = Activity.plan(state, act, opts, eff.value);
      const startMinute = state.time.minute;
      const day = state.time.day;
      const st = state.character.stats;

      // 돈 먼저 (검사에서 잔액 확인함)
      if (p.cost) Economy.spend(state.economy, { day, minute: startMinute, category: p.category, label: p.name, amount: p.cost });
      for (const c of p.extraCosts) Economy.charge(state.economy, { day, minute: startMinute, ...c });

      Time.advance(state.time, p.minutes, (m) => Life.passAwake(state.life, m, st, p.load));
      const lifeDiff = Life.apply(state.life, p.effects, st);

      const gains = {};
      for (const [stat, base] of Object.entries(p.grow)) {
        const g = Character.grow(state.character, stat, base, eff.value);
        if (g) {
          gains[stat] = g;
          state.today.gains[stat] = round2((state.today.gains[stat] ?? 0) + g);
        }
      }
      if (p.income) Economy.earn(state.economy, { day, minute: state.time.minute, category: 'work', label: p.incomeLabel, amount: p.income });

      state.today.counts[id] = (state.today.counts[id] ?? 0) + 1;
      state.today.blocks.push(...p.blocks);
      if (id === 'work') {
        state.today.worked = true;
        state.today.workMinutes += p.minutes;
        if (p.late) {
          Character.decline(state.character, 'diligence', 0.3);
          state.today.notes.push('지각');
        }
      }
      const summary = { id, name: p.name, minutes: p.minutes, start: startMinute, end: state.time.minute, cost: p.cost + p.extraCosts.reduce((a, c) => a + c.amount, 0), income: p.income, life: lifeDiff, gains, efficiency: eff.value, notes: p.notes };

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
      const job = JOBS[state.character.job];
      const notes = [...state.today.notes];

      // 평일에 출근하지 않았으면 결근
      if (job?.type === 'office' && Time.isWeekday(state.time) && !state.today.worked) {
        Life.apply(state.life, { stress: 8 }, st);
        Character.decline(state.character, 'diligence', 0.8);
        notes.push('결근');
      }
      if (collapsed) {
        Life.apply(state.life, { mood: -10, stress: 8 }, st);
        notes.push('지쳐 쓰러짐');
      }
      const { living, summary: money } = Economy.settleDay(state.economy, day);
      if (Economy.inDebt(state.economy)) {
        Life.apply(state.life, { stress: 5 }, st);
        notes.push('잔액 부족');
      }

      const timeBy = {};
      for (const b of state.today.blocks) timeBy[b.category] = (timeBy[b.category] ?? 0) + (b.end - b.start);
      const sleepStart = state.time.minute;
      const sleptMinutes = Time.nextDay(state.time, wakeMinute);
      const sl = Life.sleep(state.life, sleptMinutes, st);

      const report = { day, sleepStart, wake: wakeMinute, sleptHours: sl.hours, sleepQuality: sl.quality, timeBy, income: money.income, expense: money.expense, living: living?.amount ?? 0, cashEnd: state.economy.cash, gains: { ...state.today.gains }, notes, blocks: state.today.blocks, lifeAfter: { ...state.life } };
      state.history.reports.push(report);
      if (state.history.reports.length > REPORTS_MAX) state.history.reports.shift();
      state.history.series.push(snapshot(state));
      if (state.history.series.length > 400) state.history.series.shift();
      state.today = freshToday();
      if (!silent) changed('sleep', { report });
      return report;
    },

    /** 오늘의 일정: 해야 할 일(근무·식사 때) + 한 일 */
    schedule() {
      const items = [];
      const { minute } = state.time;
      const job = JOBS[state.character.job];
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

    /** 저장이 끝날 때까지 기다리기 (테스트·앱 종료 직전) */
    flush: () => saving,
  };

  return engine;
}

const round2 = (n) => Math.round(n * 100) / 100;
