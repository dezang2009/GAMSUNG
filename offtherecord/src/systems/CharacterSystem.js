/**
 * CharacterSystem — 캐릭터 생성 · 능력치 성장 · 나이.
 * 상태 조각: state.character
 */
import { STATS, STAT_IDS, REGIONS, EDUCATIONS, GENDERS, BACKGROUNDS, byId } from '../data/world.js';
import * as Career from './CareerSystem.js';

export const AGE_MIN = 19;
export const AGE_MAX = 45;
export const NAME_MAX = 12;

/** 입력값 검사. 문제가 있으면 { field: 사유 } 를 돌려줘요 */
export function validate(input) {
  const errors = {};
  const name = String(input?.name ?? '').trim();
  if (!name) errors.name = '이름을 입력해 주세요';
  else if (name.length > NAME_MAX) errors.name = `이름은 ${NAME_MAX}자까지예요`; // 입력창 maxlength 와 같은 기준(문자열 길이)
  const age = Number(input?.age);
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) errors.age = `나이는 ${AGE_MIN}~${AGE_MAX}세 사이로 정해 주세요`;
  if (!byId(GENDERS, input?.gender)) errors.gender = '성별을 골라 주세요';
  if (!byId(REGIONS, input?.region)) errors.region = '거주 지역을 골라 주세요';
  const bg = byId(BACKGROUNDS, input?.background);
  if (!bg) errors.background = '초기 배경을 골라 주세요';
  if (!byId(EDUCATIONS, input?.education)) errors.education = '학력을 골라 주세요';
  else if (bg && !bg.educations.includes(input.education)) errors.education = `‘${bg.name}’ 배경에서는 고를 수 없는 학력이에요`;
  return errors;
}

/** 새 캐릭터 (검사를 통과한 입력만) */
export function create(input) {
  const errors = validate(input);
  if (Object.keys(errors).length) throw Object.assign(new Error('잘못된 캐릭터 입력'), { errors });
  const bg = byId(BACKGROUNDS, input.background);
  const edu = byId(EDUCATIONS, input.education);
  const stats = {};
  for (const id of STAT_IDS) stats[id] = clampStat((bg.stats[id] ?? 40) + (edu.bonus[id] ?? 0));
  return {
    name: String(input.name).trim(),
    age: Number(input.age),
    gender: input.gender,
    region: input.region,
    education: input.education,
    background: input.background,
    career: Career.create(bg.job, 1), // 배경은 처음 일자리만 정해요. 이후 변경은 CareerSystem
    stats,
  };
}

const clampStat = (n) => Math.max(0, Math.min(100, n));

/** 게임 날짜 기준 나이 (게임 시작일이 생일 다음 날이라고 보고 365일마다 한 살) */
export const ageOn = (character, day) => character.age + Math.floor((day - 1) / 365);

/** 지금 일자리 (CareerSystem 으로 넘김) */
export const job = (character) => Career.currentJob(character);

/**
 * 능력치 성장: 기본량 × 컨디션 효율 × 수준 보정(높을수록 더디게) × 배움 보정(지능)
 * 돌려준 값만큼 실제로 올라요(소수 둘째 자리까지 보관).
 */
export function grow(character, stat, base, efficiency = 1) {
  if (!STAT_IDS.includes(stat) || !(base > 0)) return 0;
  const cur = character.stats[stat];
  const learning = stat === 'intelligence' || stat === 'expertise' ? 1 + (character.stats.intelligence - 50) / 200 : 1;
  const gain = round2(base * efficiency * learning * Math.max(0.1, 1 - cur / 130));
  character.stats[stat] = clampStat(round2(cur + gain));
  return round2(character.stats[stat] - cur);
}

/** 능력치 하락 (결근·지각 같은 결과) */
export function decline(character, stat, amount) {
  if (!STAT_IDS.includes(stat)) return 0;
  const cur = character.stats[stat];
  character.stats[stat] = clampStat(round2(cur - amount));
  return round2(character.stats[stat] - cur);
}

const round2 = (n) => Math.round(n * 100) / 100;

export { STATS };
