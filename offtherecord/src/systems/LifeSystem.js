/**
 * LifeSystem — 생활 상태 다섯 가지와 컨디션 효율.
 * 상태 조각: state.life = { energy, fatigue, stress, mood, hunger } (모두 0~100)
 *  - 체력(energy): 지금 남은 기운. 높을수록 좋아요. 최대치는 능력치 ‘체력’에 따라 달라져요.
 *  - 피로·스트레스·배고픔: 낮을수록 좋아요.
 *  - 기분: 높을수록 좋아요. 다른 상태 쪽으로 천천히 끌려가요.
 */
export const KEYS = ['energy', 'fatigue', 'stress', 'mood', 'hunger'];
export const LABELS = { energy: '체력', fatigue: '피로', stress: '스트레스', mood: '기분', hunger: '배고픔' };
/** 높을수록 좋은 값인지 */
export const HIGHER_IS_BETTER = { energy: true, fatigue: false, stress: false, mood: true, hunger: false };

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export const create = (init) => ({ energy: 80, fatigue: 25, stress: 35, mood: 58, hunger: 30, ...init });

/** 능력치 ‘체력’으로 정해지는 최대 체력 */
export const maxEnergy = (stats) => Math.round(Math.min(100, 70 + stats.fitness * 0.3));

/**
 * 깨어 있는 시간이 흐를 때의 저절로 생기는 변화 (minutes 동안)
 *  load: 활동의 몸 부담 (0 = 가만히, 1 = 보통, 2 = 힘든 일)
 */
export function passAwake(life, minutes, stats, load = 1) {
  const h = minutes / 60;
  const resist = 1 - stats.fitness / 250; // 체력이 좋을수록 덜 지쳐요
  life.hunger = clamp(life.hunger + 4.5 * h);
  life.fatigue = clamp(life.fatigue + 2.2 * h * load * resist);
  life.energy = clamp(life.energy - 2.5 * h * load * resist);
  if (life.hunger >= 80) life.stress = clamp(life.stress + 1.5 * h);
  driftMood(life, h);
}

/** 기분은 지금 상태가 가리키는 쪽으로 시간당 10%씩 다가가요 */
function driftMood(life, h) {
  const target = 62 - (life.stress - 40) * 0.45 - Math.max(0, life.hunger - 60) * 0.5 - Math.max(0, life.fatigue - 60) * 0.4 - Math.max(0, 30 - life.energy) * 0.3;
  life.mood = clamp(life.mood + (target - life.mood) * (1 - 0.9 ** h));
}

/** 활동이 끝났을 때의 변화량 적용. 실제로 바뀐 양을 돌려줘요 */
export function apply(life, effects = {}, stats) {
  const before = { ...life };
  for (const k of KEYS) if (effects[k]) life[k] = clamp(life[k] + effects[k]);
  if (stats) life.energy = Math.min(life.energy, maxEnergy(stats));
  const diff = {};
  for (const k of KEYS) {
    const d = Math.round((life[k] - before[k]) * 10) / 10;
    if (d) diff[k] = d;
  }
  return diff;
}

/**
 * 잠: minutes 만큼 잤을 때. 결과 { hours, quality, diff }
 *  7~9시간이 가장 좋고, 5시간 미만이면 덜 회복되고 기분이 나빠져요.
 */
export function sleep(life, minutes, stats) {
  const h = minutes / 60;
  const before = { ...life };
  const quality = h < 5 ? 'short' : h < 7 ? 'fair' : h <= 9.5 ? 'good' : 'long';
  const recover = quality === 'short' ? 0.75 : 1;
  life.fatigue = clamp(life.fatigue - 11 * h * recover);
  life.energy = clamp(Math.min(maxEnergy(stats), life.energy + 12 * h * recover));
  life.stress = clamp(life.stress - 1.8 * h);
  life.hunger = clamp(life.hunger + 1.5 * h);
  life.mood = clamp(life.mood + { short: -8, fair: 0, good: 5, long: -2 }[quality]);
  const diff = {};
  for (const k of KEYS) {
    const d = Math.round((life[k] - before[k]) * 10) / 10;
    if (d) diff[k] = d;
  }
  return { hours: Math.round(h * 10) / 10, quality, diff };
}

/**
 * 컨디션 효율 (0.4~1.15). 성장량·외주 수입에 곱해져요.
 * reasons: 효율을 깎은 이유 (화면에 보여 줘요)
 */
export function efficiency(life) {
  const reasons = [];
  let e = 1;
  const hit = (cond, amount, text) => {
    if (cond > 0) {
      e -= cond * amount;
      reasons.push(text);
    }
  };
  hit(Math.max(0, life.fatigue - 60), 0.009, '피로가 쌓였어요');
  hit(Math.max(0, life.hunger - 70), 0.008, '배가 고파요');
  hit(Math.max(0, life.stress - 65), 0.008, '스트레스가 높아요');
  hit(Math.max(0, 30 - life.energy), 0.012, '체력이 바닥이에요');
  e += (life.mood - 55) * 0.002;
  return { value: Math.max(0.4, Math.min(1.15, Math.round(e * 100) / 100)), reasons };
}

/** 쓰러질 만큼 나쁜지 */
export const collapsed = (life) => life.energy <= 0 || life.fatigue >= 100;

/** 한 값의 말 표현 */
export function describe(key, v) {
  const good = HIGHER_IS_BETTER[key] ? v : 100 - v;
  return good >= 70 ? '좋음' : good >= 45 ? '보통' : good >= 25 ? '나쁨' : '위험';
}
