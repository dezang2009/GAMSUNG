/**
 * Battle — 턴제 전투 (화면 없는 순수 로직). 같은 씨앗·같은 선택이면 항상 같은 결과.
 *
 * 편성: 아군 최대 5 (앞 3 = 출전, 뒤 2 = 대기). 적 1~5 (모두 출전).
 * 라운드제: 라운드 시작마다 필드의 모든 개체를 속도순으로 줄 세우고 한 번씩 행동해요.
 *   (같은 속도면 아군 먼저, 그다음 자리 순)
 * 행동: 기본 공격(에너지 +) · 스킬(에너지 소모, 재사용 대기) · 궁극기(에너지 가득일 때) · 교체(대기 개체와 자리 바꿈, 그 개체의 차례 사용)
 * 출전 개체가 쓰러지면 대기 개체가 자동으로 나와요. 적이 모두 쓰러지면 승리, 아군이 모두 쓰러지거나 최대 라운드를 넘기면 패배.
 * 수치는 모두 balance.json · skills.json 에서 읽어요.
 */
import { Data, type Item } from '../core/data';
import { rng, hashSeed } from '../core/rng';

export type Side = 'ally' | 'enemy';
export type Buff = { stat: string; amount: number; turns: number };
export type Unit = {
  id: string;
  side: Side;
  slot: number;
  species: string;
  uid?: string;
  name: string;
  element: string;
  level: number;
  stats: Record<string, number>;
  hp: number;
  maxHp: number;
  energy: number;
  cooldowns: Record<string, number>;
  buffs: Buff[];
};
export type Action = { type: 'basic' | 'skill' | 'ultimate' | 'swap'; skill?: string; target?: string; swapWith?: string };
export type Event =
  | { t: 'round'; round: number; order: string[] }
  | { t: 'act'; actor: string; action: Action['type']; skill?: string; name: string }
  | { t: 'damage'; actor: string; target: string; amount: number; hp: number }
  | { t: 'heal'; actor: string; target: string; amount: number; hp: number }
  | { t: 'buff'; target: string; stat: string; amount: number; turns: number }
  | { t: 'faint'; target: string }
  | { t: 'swap'; out: string; in: string; reason: 'manual' | 'faint' }
  | { t: 'end'; result: 'win' | 'lose'; reason: string };

export type BattleState = {
  seed: number;
  draws: number;
  round: number;
  units: Record<string, Unit>;
  active: string[];   // 아군 출전 (최대 balance.party.active, 쓰러지면 대기에서 채움)
  reserve: string[];  // 아군 대기
  enemies: string[];
  queue: string[];
  turn: number;
  result: null | 'win' | 'lose';
  log: Event[];
};

const B = () => Data.balance;

/** 전투용 개체 만들기 (레벨 성장은 육성 단계에서. 지금은 기본 능력치) */
export function makeUnit(side: Side, slot: number, speciesId: string, level = 1, uid?: string): Unit {
  const sp = Data.get('species', speciesId)!;
  const stats: Record<string, number> = { ...sp.base_stats };
  return {
    id: `${side === 'ally' ? 'a' : 'e'}${slot}`,
    side,
    slot,
    species: speciesId,
    uid,
    name: sp.name,
    element: sp.element,
    level,
    stats,
    hp: stats.hp,
    maxHp: stats.hp,
    energy: B().energy.start,
    cooldowns: {},
    buffs: [],
  };
}

/** 전투 시작. party: [{species, level, uid}] 최대 5 (빈칸은 null), enemies: [{species, level}] */
export function createBattle(party: ({ species: string; level: number; uid?: string } | null)[], enemies: { species: string; level: number }[], seed: number): BattleState {
  const units: Record<string, Unit> = {};
  const allies: string[] = [];
  party.slice(0, B().party.active + B().party.reserve).forEach((p, i) => {
    if (!p) return;
    const u = makeUnit('ally', i, p.species, p.level, p.uid);
    units[u.id] = u;
    allies.push(u.id);
  });
  const nActive = B().party.active;
  const active = allies.filter((id) => units[id].slot < nActive);
  const reserve = allies.filter((id) => units[id].slot >= nActive);
  while (active.length < nActive && reserve.length) active.push(reserve.shift()!); // 앞자리가 비었으면 대기에서 채움
  const ens = enemies.map((e, i) => {
    const u = makeUnit('enemy', i, e.species, e.level);
    units[u.id] = u;
    return u.id;
  });
  const s: BattleState = { seed, draws: 0, round: 0, units, active, reserve, enemies: ens, queue: [], turn: 0, result: null, log: [] };
  if (!active.length) throw new Error('출전할 개체가 없어요');
  if (!ens.length) throw new Error('적이 없어요');
  startRound(s);
  return s;
}

const roll = (s: BattleState) => rng(hashSeed(s.seed, s.draws++))();
export const alive = (u?: Unit) => !!u && u.hp > 0;
export const onField = (s: BattleState, id: string) => s.active.includes(id) || s.enemies.includes(id);
export const livingEnemies = (s: BattleState) => s.enemies.map((id) => s.units[id]).filter(alive);
export const livingActive = (s: BattleState) => s.active.map((id) => s.units[id]).filter(alive);
export const livingReserve = (s: BattleState) => s.reserve.map((id) => s.units[id]).filter(alive);
const foesOf = (s: BattleState, u: Unit) => (u.side === 'ally' ? livingEnemies(s) : livingActive(s));
const friendsOf = (s: BattleState, u: Unit) => (u.side === 'ally' ? livingActive(s) : livingEnemies(s));

/** 버프·디버프를 반영한 능력치 */
export function stat(u: Unit, key: string): number {
  const mult = 1 + u.buffs.filter((b) => b.stat === key).reduce((a, b) => a + b.amount, 0);
  return Math.max(1, u.stats[key] * Math.max(0.1, mult));
}

function startRound(s: BattleState) {
  s.round += 1;
  if (s.round > B().rounds.max) return finish(s, 'lose', `${B().rounds.max}라운드 안에 끝내지 못했어요`);
  const field = [...livingActive(s), ...livingEnemies(s)];
  for (const u of field) u.energy = Math.min(B().energy.max, u.energy + B().energy.round_start);
  field.sort((a, b) => stat(b, 'spd') - stat(a, 'spd') || (a.side === b.side ? a.slot - b.slot : a.side === 'ally' ? -1 : 1));
  s.queue = field.map((u) => u.id);
  s.turn = 0;
  s.log.push({ t: 'round', round: s.round, order: [...s.queue] });
  skipDead(s);
}

function endRound(s: BattleState) {
  for (const u of Object.values(s.units)) {
    u.buffs = u.buffs.map((b) => ({ ...b, turns: b.turns - 1 })).filter((b) => b.turns > 0);
    for (const k of Object.keys(u.cooldowns)) u.cooldowns[k] = Math.max(0, u.cooldowns[k] - 1);
  }
  startRound(s);
}

/** 지금 차례인 개체 (전투가 끝났으면 undefined) */
export function current(s: BattleState): Unit | undefined {
  return s.result ? undefined : s.units[s.queue[s.turn]];
}

function skipDead(s: BattleState) {
  while (!s.result && s.turn < s.queue.length && !(alive(s.units[s.queue[s.turn]]) && onField(s, s.queue[s.turn]))) s.turn += 1;
  if (!s.result && s.turn >= s.queue.length) endRound(s);
}

export function skillsOf(u: Unit): Item[] {
  return (Data.get('species', u.species)?.skills ?? []).map((id: string) => Data.get('skills', id)!).filter(Boolean);
}

/** 이 행동을 지금 할 수 있나? 안 되면 이유 */
export function canUse(s: BattleState, u: Unit, a: Action): string {
  if (a.type === 'basic') return '';
  if (a.type === 'swap') {
    if (u.side !== 'ally') return '교체할 수 없어요';
    return livingReserve(s).length ? '' : '교체할 대기 개체가 없어요';
  }
  const sk = Data.get('skills', a.skill ?? '');
  if (!sk || !skillsOf(u).some((x) => x.id === sk.id)) return '쓸 수 없는 스킬이에요';
  if (sk.kind === 'ultimate') return u.energy >= B().energy.max ? '' : '에너지가 가득 차야 해요';
  if ((u.cooldowns[sk.id] ?? 0) > 0) return `${u.cooldowns[sk.id]}라운드 뒤에 쓸 수 있어요`;
  if (u.energy < sk.cost) return `에너지 ${sk.cost} 필요`;
  return '';
}

/** 대상이 필요한가 (적 하나·아군 하나) */
export function targetKind(s: BattleState, u: Unit, a: Action): 'enemy' | 'ally' | 'reserve' | null {
  if (a.type === 'basic') return 'enemy';
  if (a.type === 'swap') return 'reserve';
  const sk = Data.get('skills', a.skill ?? '');
  if (sk?.target === 'enemy') return 'enemy';
  if (sk?.target === 'ally') return 'ally';
  return null;
}

/** 지금 차례 개체의 행동 실행 → 이번에 생긴 사건들 */
export function act(s: BattleState, a: Action): Event[] {
  const u = current(s);
  if (!u) throw new Error('전투가 끝났어요');
  const why = canUse(s, u, a);
  if (why) throw new Error(why);
  const from = s.log.length;
  const ev = (e: Event) => s.log.push(e);
  if (a.type === 'swap') {
    const inc = s.units[a.swapWith ?? ''] ?? livingReserve(s)[0];
    if (!inc || !s.reserve.includes(inc.id) || !alive(inc)) throw new Error('교체할 수 없는 개체예요');
    ev({ t: 'act', actor: u.id, action: 'swap', name: '교체' });
    swap(s, u.id, inc.id, 'manual');
  } else {
    const sk = a.type === 'basic' ? null : Data.get('skills', a.skill!)!;
    ev({ t: 'act', actor: u.id, action: a.type, skill: sk?.id, name: sk?.name ?? '기본 공격' });
    if (!sk) {
      const tgt = pickTarget(s, u, a.target, 'enemy');
      hit(s, u, tgt, B().damage.basic_power);
      u.energy = Math.min(B().energy.max, u.energy + B().energy.basic_attack);
    } else {
      if (sk.kind === 'ultimate') u.energy = 0;
      else {
        u.energy -= sk.cost;
        u.cooldowns[sk.id] = sk.cooldown;
      }
      const targets = resolveTargets(s, u, sk.target, a.target);
      for (const t of targets) {
        if (sk.effect === 'damage') hit(s, u, t, sk.power);
        else if (sk.effect === 'heal') {
          const amt = Math.round(stat(u, Data.balance.heal.stat) * sk.power);
          const before = t.hp;
          t.hp = Math.min(t.maxHp, t.hp + amt);
          ev({ t: 'heal', actor: u.id, target: t.id, amount: t.hp - before, hp: t.hp });
        } else {
          const amount = sk.effect === 'buff' ? sk.amount : -sk.amount;
          t.buffs.push({ stat: sk.stat, amount, turns: sk.turns });
          ev({ t: 'buff', target: t.id, stat: sk.stat, amount, turns: sk.turns });
        }
      }
    }
  }
  checkEnd(s);
  if (!s.result) {
    s.turn += 1;
    skipDead(s);
  }
  return s.log.slice(from);
}

function pickTarget(s: BattleState, u: Unit, want: string | undefined, kind: 'enemy' | 'ally'): Unit {
  const pool = kind === 'enemy' ? foesOf(s, u) : friendsOf(s, u);
  return pool.find((x) => x.id === want) ?? pool[0];
}

function resolveTargets(s: BattleState, u: Unit, target: string, want?: string): Unit[] {
  switch (target) {
    case 'enemy':
      return [pickTarget(s, u, want, 'enemy')];
    case 'enemy_all':
      return foesOf(s, u);
    case 'ally':
      return [pickTarget(s, u, want, 'ally')];
    case 'ally_all':
      return friendsOf(s, u);
    default:
      return [u];
  }
}

/** 데미지 = 공격 × 배율 × 100 ÷ (100 + 방어 × 가중치) × (1 ± 흔들림) × 상성 */
export function damage(s: BattleState, atk: Unit, def: Unit, power: number): number {
  const d = B().damage;
  const v = 1 + (roll(s) * 2 - 1) * d.variance;
  const raw = ((stat(atk, 'atk') * power * 100) / (100 + stat(def, 'def') * d.defense_weight)) * v * Data.affinityMultiplier(atk.element, def.element);
  return Math.max(d.minimum, Math.round(raw));
}

function hit(s: BattleState, atk: Unit, def: Unit, power: number) {
  if (!def || !alive(def)) return;
  const amt = Math.min(def.hp, damage(s, atk, def, power));
  def.hp -= amt;
  def.energy = Math.min(B().energy.max, def.energy + B().energy.hit_taken);
  s.log.push({ t: 'damage', actor: atk.id, target: def.id, amount: amt, hp: def.hp });
  if (def.hp <= 0) {
    s.log.push({ t: 'faint', target: def.id });
    if (def.side === 'ally' && s.active.includes(def.id)) {
      const next = livingReserve(s)[0];
      if (next) swap(s, def.id, next.id, 'faint');
    }
  }
}

function swap(s: BattleState, outId: string, inId: string, reason: 'manual' | 'faint') {
  const ai = s.active.indexOf(outId);
  const ri = s.reserve.indexOf(inId);
  s.active[ai] = inId;
  s.reserve[ri] = outId;
  s.log.push({ t: 'swap', out: outId, in: inId, reason });
}

function checkEnd(s: BattleState) {
  if (!livingEnemies(s).length) finish(s, 'win', '적을 모두 쓰러뜨렸어요');
  else if (!livingActive(s).length && !livingReserve(s).length) finish(s, 'lose', '아군이 모두 쓰러졌어요');
}

function finish(s: BattleState, result: 'win' | 'lose', reason: string) {
  s.result = result;
  s.queue = [];
  s.log.push({ t: 'end', result, reason });
}

/**
 * 자동 행동 (자동 전투 · 적 공통, 무작위 없음)
 *  궁극기 가능 → 궁극기 / 회복 스킬: 체력 heal_below 아래 아군이 있으면 / 버프 스킬: 같은 버프가 없을 때
 *  / 데미지·디버프 스킬: 쓸 수 있으면 / 그 밖엔 기본 공격. 공격 대상은 체력이 가장 낮은 상대.
 */
export function autoAction(s: BattleState, u: Unit = current(s)!): Action {
  const foes = foesOf(s, u);
  const friends = friendsOf(s, u);
  const weakest = (list: Unit[]) => [...list].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.slot - b.slot)[0];
  const hurt = friends.filter((f) => f.hp / f.maxHp < Data.balance.ai.heal_below);
  const plans: Action[] = [];
  for (const sk of skillsOf(u)) {
    const a: Action = { type: sk.kind === 'ultimate' ? 'ultimate' : 'skill', skill: sk.id };
    if (canUse(s, u, a)) continue;
    if (sk.effect === 'heal' && !hurt.length) continue;
    if (sk.effect === 'buff' && friends.some((f) => f.buffs.some((b) => b.stat === sk.stat && b.amount > 0)) && sk.target !== 'self') continue;
    if (sk.effect === 'buff' && sk.target === 'self' && u.buffs.some((b) => b.stat === sk.stat && b.amount > 0)) continue;
    a.target = sk.effect === 'heal' ? weakest(hurt)?.id : weakest(foes)?.id;
    plans.push(a);
  }
  return plans.find((p) => p.type === 'ultimate') ?? plans[0] ?? { type: 'basic', target: weakest(foes)?.id };
}

/** 끝날 때까지 자동으로 (시뮬레이터·테스트용). 아군 선택을 바꾸고 싶으면 choose 를 넘겨요 */
export function runAuto(s: BattleState, choose: (s: BattleState, u: Unit) => Action = (st, u) => autoAction(st, u), limit = 2000): BattleState {
  let n = 0;
  while (!s.result && n++ < limit) {
    const u = current(s)!;
    act(s, u.side === 'ally' ? choose(s, u) : autoAction(s, u));
  }
  return s;
}
