/**
 * ActivitySystem — 지금 할 수 있는 활동 목록과, 활동 하나를 했을 때의 ‘계획’(시간·돈·변화량)을 계산해요.
 * 상태를 직접 바꾸지 않아요. 실제 적용은 GameEngine 이 각 시스템에 나눠 맡겨요.
 */
import { ACTIVITIES, CATEGORIES, activityById } from '../data/activities.js';
import { JOBS, REGIONS, byId } from '../data/world.js';
import * as Time from './TimeSystem.js';
import * as Economy from './EconomySystem.js';
import * as Career from './CareerSystem.js';

const H = 60;
export const LUNCH_COST = 9000;

/** 일자리에 따라 만들어지는 ‘일’ 활동 */
export function workActivity(state) {
  const job = Career.currentJob(state.character);
  if (!job) return null;
  const st = state.character.stats;
  if (job.type === 'office') {
    const commute = byId(REGIONS, state.character.region)?.commute ?? 40;
    return {
      id: 'work',
      name: '출근하기',
      category: 'work',
      job,
      commute,
      perDay: 1,
      weekdayOnly: true,
      desc: `${job.title} · 평일 ${Time.clock(job.start)}~${Time.clock(job.end)} · 출퇴근 편도 ${commute}분 · 점심 포함`,
    };
  }
  const hourly = job.type === 'freelance' ? freelanceHourly(st) : job.hourly;
  return {
    id: 'work',
    name: job.type === 'freelance' ? '외주 작업' : `${job.title} 하기`,
    category: 'work',
    job,
    hoursOptions: Array.from({ length: job.maxHours }, (_, i) => i + 1),
    window: job.from != null ? [job.from, job.to] : [6 * H, 24 * H],
    desc: job.type === 'freelance' ? `${job.title} · 시간당 약 ${Economy.won(hourly)} (전문성·창의성·컨디션에 따라)` : `${job.title} · 시급 ${Economy.won(hourly)} · 하루 최대 ${job.maxHours}시간`,
  };
}

/** 외주 기본 단가 (컨디션 효율은 실제 계산 때 곱해요) */
export const freelanceHourly = (stats) => Math.round((JOBS.freelance.baseHourly + stats.expertise * 180 + stats.creativity * 80) / 100) * 100;

/** 화면에 보여 줄 활동 전체 (일 활동 포함) */
export function all(state) {
  const work = workActivity(state);
  return work ? [work, ...ACTIVITIES] : [...ACTIVITIES];
}
export const find = (state, id) => (id === 'work' ? workActivity(state) : activityById(id));
export { CATEGORIES };

/** 정해진 시간 길이 (분) */
export function duration(state, act, opts = {}) {
  if (act.id === 'work' && act.job.type === 'office') return act.job.end + act.commute - state.time.minute;
  if (act.hoursOptions) return (opts.hours ?? act.hoursOptions[0]) * H;
  return act.minutes;
}

/**
 * 할 수 있는지 검사. 안 되면 사람이 읽을 수 있는 이유를 돌려줘요 (되면 null)
 */
export function check(state, act, opts = {}) {
  if (!act) return '알 수 없는 활동이에요';
  const { time } = state;
  const now = time.minute;
  const count = state.today.counts[act.id] ?? 0;
  if (act.perDay && count >= act.perDay) return act.id === 'work' ? '오늘은 이미 출근했어요' : '오늘은 이미 했어요';
  if (act.weekdayOnly && !Time.isWeekday(time)) return '주말에는 출근하지 않아요';
  if (act.id === 'work' && act.job.type === 'office') {
    const leave = act.job.start - act.commute; // 제시간에 가려면 나서야 하는 시각
    if (now > leave + 60) return `출근 시간이 지났어요 (${Time.clock(leave + 60)}까지 나서야 해요)`;
    if (now < 5 * H) return '아직 너무 이른 시간이에요';
  }
  if (act.hoursOptions) {
    const h = opts.hours ?? act.hoursOptions[0];
    if (!act.hoursOptions.includes(h)) return '일할 시간을 골라 주세요';
    const done = state.today.workMinutes ?? 0;
    if (act.job.maxHours && done + h * H > act.job.maxHours * H) return `오늘은 ${act.job.maxHours}시간까지만 일할 수 있어요 (남은 ${Math.max(0, act.job.maxHours - done / H)}시간)`;
  }
  const mins = duration(state, act, opts);
  if (act.window) {
    const [from, to] = act.window;
    if (now < from) return `${Time.clock(from)}부터 할 수 있어요`;
    if (now + mins > to) return now >= to ? `${Time.clock(to)}까지만 할 수 있어요` : `${Time.clock(to)}까지 끝내야 해서 시간이 모자라요`;
  }
  if (!Time.fits(time, mins)) return `오늘 남은 시간(${Time.span(Time.remaining(time))})이 부족해요`;
  const cost = act.cost ?? 0;
  if (!Economy.canAfford(state.economy, cost)) return `돈이 부족해요 (${Economy.won(cost)} 필요)`;
  return act.needs?.(state) ?? null;
}

/**
 * 활동 계획: 걸리는 시간, 드는 돈, 버는 돈, 상태 변화, 능력치 성장 기본량, 타임라인 조각
 * efficiency: 지금 컨디션 효율 (LifeSystem.efficiency)
 */
export function plan(state, act, opts = {}, efficiency = 1) {
  const st = state.character.stats;
  const minutes = duration(state, act, opts);
  const now = state.time.minute;
  const p = { id: act.id, name: act.name, category: act.category, minutes, cost: act.cost ?? 0, income: 0, incomeLabel: '', extraCosts: [], effects: { ...(act.effects ?? {}) }, grow: { ...(act.grow ?? {}) }, load: 1, blocks: [{ start: now, end: now + minutes, category: act.category, label: act.name }], notes: [] };

  if (act.category === 'rest' || act.id === 'game' || act.id === 'call_family') p.load = 0.4;
  if (act.id === 'workout') p.load = 1.6;

  // 사교성: 사람 만나는 활동의 기분·스트레스가 달라져요
  if (act.category === 'social') {
    const k = (st.sociability - 50) / 50; // -1 ~ +1
    p.effects.mood = round1((p.effects.mood ?? 0) + 4 * k);
    p.effects.stress = round1((p.effects.stress ?? 0) - 5 * k);
  }
  // 창의성: 취미의 만족감
  if (act.category === 'hobby') p.effects.mood = round1((p.effects.mood ?? 0) * (0.8 + st.creativity / 250));

  if (act.id === 'work') {
    const job = act.job;
    const hours = minutes / H;
    const calm = 1.3 - st.diligence / 200; // 성실할수록 덜 스트레스
    if (job.type === 'office') {
      const workMins = job.end - Math.max(now + act.commute, job.start);
      const late = now > job.start - act.commute;
      p.income = Math.round(job.monthly / 21);
      p.incomeLabel = `${job.title} 급여 (하루치)`;
      p.extraCosts.push({ category: 'meal', label: '회사 점심', amount: LUNCH_COST });
      p.effects = { stress: round1(job.stressPerHour * (workMins / H) * calm + (late ? 6 : 0)), fatigue: round1(job.fatiguePerHour * (workMins / H) * 0.5), hunger: -45 };
      p.grow = { expertise: 0.6, diligence: late ? 0 : 0.3 };
      p.blocks = [
        { start: now, end: now + act.commute, category: 'commute', label: '출근길' },
        { start: now + act.commute, end: job.end, category: 'work', label: late ? '근무 (지각)' : '근무' },
        { start: job.end, end: job.end + act.commute, category: 'commute', label: '퇴근길' },
      ];
      if (late) p.notes.push('지각했어요');
      p.late = late;
    } else {
      const rate = job.type === 'freelance' ? Math.round((freelanceHourly(st) * efficiency) / 100) * 100 : job.hourly;
      p.income = rate * hours;
      p.incomeLabel = `${job.title} ${hours}시간`;
      p.effects = { stress: round1(job.stressPerHour * hours * calm), fatigue: round1(job.fatiguePerHour * hours * 0.5) };
      p.grow = job.type === 'freelance' ? { expertise: 0.25 * hours, creativity: 0.1 * hours } : { diligence: 0.12 * hours, expertise: 0.05 * hours };
      p.blocks[0].label = act.name.replace(' 하기', '') + ` ${hours}시간`;
    }
  }
  return p;
}

const round1 = (n) => Math.round(n * 10) / 10;
