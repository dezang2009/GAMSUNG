/** 숫자 표시: 한국식 큰 단위(만·억·조·경). 게임 숫자는 빠르게 커지므로 짧게 */
const UNITS = [
  [1e16, '경'],
  [1e12, '조'],
  [1e8, '억'],
  [1e4, '만'],
];

export function shortNum(n) {
  if (!Number.isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  for (const [v, u] of UNITS) {
    if (a >= v) {
      const x = a / v;
      return `${sign}${x >= 100 ? Math.floor(x).toLocaleString('ko-KR') : x.toFixed(x >= 10 ? 1 : 2).replace(/\.?0+$/, '')}${u}`;
    }
  }
  return sign + (a >= 100 ? Math.floor(a) : Math.round(a * 10) / 10).toLocaleString('ko-KR');
}

export const won = (n) => `${shortNum(Math.floor(n))}원`;
export const lines = (n) => `${shortNum(Math.floor(n))}줄`;
export const people = (n) => `${shortNum(Math.floor(n))}명`;

/** 초당 값: 작은 수는 소수 한 자리 */
export const perSec = (n, unit) => `${n > 0 && n < 1 ? n.toFixed(2) : n > 0 && n < 10 ? n.toFixed(1) : shortNum(n)}${unit}/초`;

export function duration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return m ? `${h}시간 ${m}분` : `${h}시간`;
  if (m) return `${m}분`;
  return `${s}초`;
}
