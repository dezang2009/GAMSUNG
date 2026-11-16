/**
 * Exploration — 지역 조사. 결과는 (게임 씨앗, 지역, 몇 번째 조사)로 정해져서 같은 기록이면 항상 같아요.
 * 조사 n번째:
 *   - from_survey == n 인 알 → 확보 (중복이면 연구 데이터)
 *   - from_survey == n 인 야생 개체(n>1) → 반드시 목격 (깊이 조사해서 드러난 서식지)
 *   - 나머지 야생 개체 중 from_survey ≤ n 인 것에서 무게대로 최대 2종 목격
 * 비용·피로 같은 반복 관리는 없어요. 횟수를 다 쓰면 그 지역 조사는 끝.
 */
import { type Item } from '../core/data';
import { rng, hashSeed } from '../core/rng';
import * as C from './collection';

export const SIGHTINGS_PER_SURVEY = 2;
export type SurveyResult = { type: 'egg' | 'sighting'; species: string; new: boolean; acquire?: ReturnType<typeof C.acquire> };

export const done = (s: any, regionId: string): number => s.exploration.surveys[regionId] ?? 0;
export const remaining = (s: any, r: Item) => Math.max(0, (r.surveys ?? 0) - done(s, r.id));

export function blockedReason(s: any, r: Item, unlocked: boolean): string {
  if (!unlocked) return '아직 열리지 않은 지역이에요';
  if (!r.surveys) return '조사할 곳이 없는 지역이에요';
  if (remaining(s, r) === 0) return '이 지역은 조사를 모두 마쳤어요';
  return '';
}

export function survey(s: any, r: Item, now: number): SurveyResult[] {
  const n = done(s, r.id) + 1;
  s.exploration.surveys[r.id] = n;
  const rand = rng(hashSeed(s.seed, r.id, n));
  const out: SurveyResult[] = [];
  const enc: any[] = r.encounters ?? [];
  for (const e of enc)
    if (e.method === 'egg' && e.from_survey === n) {
      const first = C.status(s, e.species) === 'unknown';
      out.push({ type: 'egg', species: e.species, new: first, acquire: C.acquire(s, e.species, 'egg', r.id, now) });
    }
  const picked: string[] = enc.filter((e) => e.method === 'wild' && e.from_survey === n && n > 1).map((e) => e.species);
  const pool = enc.filter((e) => e.method === 'wild' && e.from_survey <= n && !picked.includes(e.species));
  while (picked.length < SIGHTINGS_PER_SURVEY && pool.length) {
    const total = pool.reduce((a, e) => a + e.weight, 0);
    let roll = rand() * total;
    let idx = pool.findIndex((e) => (roll -= e.weight) <= 0);
    if (idx < 0) idx = pool.length - 1;
    picked.push(pool[idx].species);
    pool.splice(idx, 1);
  }
  for (const sid of picked) out.push({ type: 'sighting', species: sid, new: C.see(s, sid, now) });
  return out;
}
