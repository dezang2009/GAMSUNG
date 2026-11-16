/**
 * RecommendSystem — 지금 상태와 돈 사정을 보고 할 만한 활동을 골라요 (무작위 없음, 규칙 + 점수).
 * entries: GameEngine.activities() 결과 [{ act, blocked, preview }]
 * 돌려주는 값: [{ id, opts, reason, score }] (최대 n개, 점수 높은 순)
 *
 * 규칙 (점수가 클수록 급해요)
 *  - 정규직 출근 시간이 됐으면 출근 (200)
 *  - 식사 시간에 배고픔 40 이상 → 가장 싼 식사 (95)
 *  - 배고픔 60 이상 → 식사. 돈이 넉넉하지 않으면 가장 싼 식사, 넉넉하면 기분에 좋은 식사 (100 + 배고픔)
 *  - 피로 70 이상 또는 체력 30 이하 → 낮잠·쉬기 (90 + 피로)
 *  - 스트레스 65 이상 → 산책·게임, 돈이 넉넉하면 친구 만나기 (80 + 스트레스)
 *  - 잔액이 생활비 30일치보다 적고 오늘 더 일할 수 있으면 → 일 (75)
 *  - 기분 40 이하 → 취미 (60)
 *  - 그 밖에는 하는 일에 필요한 능력치를 키우는 자기계발 (30)
 *  활동 결과로 쓰러질 것 같은 활동은 추천하지 않아요.
 */
import * as Economy from './EconomySystem.js';
import * as Time from './TimeSystem.js';
import { currentJob } from './CareerSystem.js';

const JOB_STAT = { office: 'expertise', shift: 'diligence', freelance: 'expertise' };

export function recommend(state, entries, n = 3) {
  const life = state.life;
  const ok = new Map(entries.filter((e) => !e.blocked && !e.preview?.collapse).map((e) => [e.act.id, e]));
  const daily = Economy.dailyCost(state.economy).total;
  const runway = state.economy.cash / Math.max(1, daily); // 생활비 며칠치
  const job = currentJob(state.character);
  const out = [];
  const push = (id, score, reason, opts = {}) => ok.has(id) && !out.some((x) => x.id === id) && out.push({ id, score, reason, opts });

  if (job?.type === 'office' && ok.has('work')) {
    const leave = job.start - (ok.get('work').act.commute ?? 0);
    push('work', 200, state.time.minute > leave ? `지금 나서면 지각이에요 (늦어도 ${Time.clock(leave + 60)}까지)` : `${Time.clock(leave)}까지 나서야 늦지 않아요`);
  }
  // 식사 시간(아침 7–9시·점심 12–13시·저녁 18–20시)에 배가 고프기 시작했으면 끼니부터
  const m = state.time.minute;
  const mealTime = (m >= 420 && m < 540) || (m >= 720 && m < 840) || (m >= 1080 && m < 1200);
  if (mealTime && life.hunger >= 40 && life.hunger < 60) {
    const meals = ['home_meal', 'eat_out', 'convenience_meal'].filter((id) => ok.has(id)).map((id) => ok.get(id));
    const pick = meals.sort((a, b) => (a.preview?.cost ?? 0) - (b.preview?.cost ?? 0))[0];
    if (pick) push(pick.act.id, 95, `식사 시간이에요 (배고픔 ${Math.round(life.hunger)})`);
  }
  if (life.hunger >= 60) {
    const meals = ['home_meal', 'eat_out', 'convenience_meal'].filter((id) => ok.has(id)).map((id) => ok.get(id));
    const pick = runway < 30 ? meals.sort((a, b) => (a.preview?.cost ?? 0) - (b.preview?.cost ?? 0))[0] : meals.sort((a, b) => (b.act.effects?.mood ?? 0) - (a.act.effects?.mood ?? 0))[0];
    if (pick) push(pick.act.id, 100 + life.hunger, `배고픔 ${Math.round(life.hunger)} — ${runway < 30 ? '돈을 아끼면서 ' : ''}끼니를 챙길 때예요`);
  }
  if (life.fatigue >= 70 || life.energy <= 30) {
    const why = life.fatigue >= 70 ? `피로 ${Math.round(life.fatigue)}` : `체력 ${Math.round(life.energy)}`;
    push('nap', 90 + life.fatigue, `${why} — 짧게 자면 회복이 커요`);
    push('rest', 89 + life.fatigue, `${why} — 잠깐 쉬어 가요`);
  }
  if (life.stress >= 65) {
    push('walk', 80 + life.stress, `스트레스 ${Math.round(life.stress)} — 돈 들이지 않고 풀 수 있어요`);
    if (runway >= 30) push('friends', 79 + life.stress, `스트레스 ${Math.round(life.stress)} — 사람을 만나면 많이 풀려요`);
    push('game', 78 + life.stress, `스트레스 ${Math.round(life.stress)} — 머리를 식혀요`);
  }
  if (job && job.type !== 'office' && ok.has('work')) {
    const left = job.maxHours * 60 - (state.today.workMinutes ?? 0);
    const hours = Math.min(job.maxHours, Math.floor(left / 60), Math.floor(Time.remaining(state.time) / 60));
    const opts = { hours: Math.max(1, Math.min(hours, 4)) };
    if (runway < 30) push('work', 75, `잔액이 생활비 ${Math.max(0, Math.floor(runway))}일치예요 — 벌어 둘 때예요`, opts);
    else push('work', 35, `오늘 ${left / 60}시간 더 일할 수 있어요`, opts);
  }
  if (life.mood <= 40) {
    push('create', 60, `기분 ${Math.round(life.mood)} — 좋아하는 걸 해 봐요`);
    push('game', 59, `기분 ${Math.round(life.mood)} — 기분 전환이 필요해요`);
  }
  // 하는 일에 필요한 능력치를 키우는 활동
  const target = JOB_STAT[job?.type] ?? 'intelligence';
  const growth = [...ok.values()].filter((e) => e.act.category === 'growth' && (e.act.grow?.[target] ?? 0) > 0).sort((a, b) => (b.act.grow[target] ?? 0) - (a.act.grow[target] ?? 0));
  if (growth[0]) push(growth[0].act.id, 30, `${job ? `${job.title}에` : '앞으로'} 필요한 능력을 키워요`);

  return out.sort((a, b) => b.score - a.score).slice(0, n);
}
