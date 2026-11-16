/** 씨앗 고정 난수 (같은 씨앗 → 같은 결과). mulberry32 */
export type Rng = () => number;

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 여러 값으로 씨앗 만들기 (문자열·숫자 섞어서) */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export const randomSeed = () => (Math.random() * 2 ** 32) >>> 0;
