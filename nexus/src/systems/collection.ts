/**
 * Collection — 도감·보유 개체·종별 연구 데이터 (화면 없이 state 와 Data 만).
 * 종 상태: unknown(모름) → seen(목격·도감 등록) → owned(확보)
 * 중복 확보는 새 개체를 만들지 않고 그 종의 연구 데이터로 바꿔요 (뽑기 없음).
 */
import { Data, type Item } from '../core/data';

export type Creature = { uid: string; species: string; level: number; exp: number; nickname: string; obtained_at: number; method: string; region: string };
export type Status = 'unknown' | 'seen' | 'owned';

export const owns = (s: any, sid: string) => s.collection.owned.some((c: Creature) => c.species === sid);
export const status = (s: any, sid: string): Status => (owns(s, sid) ? 'owned' : s.collection.seen[sid] ? 'seen' : 'unknown');
export const researchPoints = (s: any, sid: string): number => s.collection.research[sid] ?? 0;

export function researchLevel(s: any, sid: string): number {
  const p = researchPoints(s, sid);
  return Data.research().levels.filter((need) => p >= need).length;
}
export const researchMax = () => Data.research().levels.length;
export function nextLevelNeed(s: any, sid: string): number {
  const p = researchPoints(s, sid);
  return Data.research().levels.find((need) => p < need) ?? -1;
}
const addResearch = (s: any, sid: string, n: number) => (s.collection.research[sid] = researchPoints(s, sid) + n);

/** 목격: 처음이면 도감 등록. 목격할 때마다 연구 데이터 +sighting. 처음이면 true */
export function see(s: any, sid: string, now: number): boolean {
  const first = !s.collection.seen[sid];
  if (first) s.collection.seen[sid] = now;
  addResearch(s, sid, Data.research().sighting);
  return first;
}

/** 확보 → { kind: new | duplicate, uid?, research } */
export function acquire(s: any, sid: string, method: string, region: string, now: number): { kind: 'new' | 'duplicate'; uid?: string; research: number } {
  const cfg = Data.research();
  if (!s.collection.seen[sid]) s.collection.seen[sid] = now;
  if (owns(s, sid)) {
    addResearch(s, sid, cfg.duplicate);
    return { kind: 'duplicate', research: cfg.duplicate };
  }
  const uid = `c${s.collection.next_uid++}`;
  s.collection.owned.push({ uid, species: sid, level: 1, exp: 0, nickname: '', obtained_at: now, method, region });
  addResearch(s, sid, cfg.owned);
  return { kind: 'new', uid, research: cfg.owned };
}

export const creature = (s: any, uid: string): Creature | undefined => s.collection.owned.find((c: Creature) => c.uid === uid);
export const speciesOf = (c: Creature): Item => Data.get('species', c.species)!;
export const displayName = (c: Creature) => c.nickname || speciesOf(c)?.name || c.species;
const tier = (c: Creature) => Data.get('rarities', speciesOf(c).rarity)?.tier ?? 0;

/** 보유 목록 (속성 거르기 · 정렬 recent | rarity | name) */
export function ownedList(s: any, element = '', sort: 'recent' | 'rarity' | 'name' = 'recent'): Creature[] {
  const out: Creature[] = s.collection.owned.filter((c: Creature) => !element || speciesOf(c).element === element);
  const num = (c: Creature) => Number(c.uid.slice(1));
  if (sort === 'rarity') out.sort((a, b) => tier(b) - tier(a) || a.species.localeCompare(b.species));
  else if (sort === 'name') out.sort((a, b) => displayName(a).localeCompare(displayName(b), 'ko'));
  else out.sort((a, b) => b.obtained_at - a.obtained_at || num(b) - num(a));
  return out;
}

/** 능력치 (지금은 기본값. 레벨 성장은 육성 단계에서) */
export function statsOf(c: Creature): Record<string, number> {
  const sp = speciesOf(c);
  return Object.fromEntries(Data.all('stats').map((st) => [st.id, sp.base_stats[st.id] ?? 0]));
}

/** 같은 진화 계통 (단계 순) */
export function evolutionLine(sid: string): Item[] {
  const line = Data.get('species', sid)?.evolution?.line;
  return Data.all('species')
    .filter((x) => x.evolution.line === line)
    .sort((a, b) => a.evolution.stage - b.evolution.stage || a.id.localeCompare(b.id));
}

/** 이 종을 만날 수 있는 곳 */
export function habitats(sid: string): { region: string; method: string; from_survey: number }[] {
  return Data.all('regions').flatMap((r) => (r.encounters ?? []).filter((e: any) => e.species === sid).map((e: any) => ({ region: r.id, method: e.method, from_survey: e.from_survey })));
}
export const evolutionOnly = (sid: string) => habitats(sid).length === 0 && !(Data.meta.starting_creatures ?? []).includes(sid);

export function counts(s: any) {
  const species = new Set(s.collection.owned.map((c: Creature) => c.species));
  return { total: Data.all('species').length, seen: Object.keys(s.collection.seen).length, ownedSpecies: species.size, owned: s.collection.owned.length };
}
