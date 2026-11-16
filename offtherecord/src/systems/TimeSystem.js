/**
 * TimeSystem — 하루 24시간, 분 단위 시계, 날짜.
 * 상태 조각: state.time = { day, minute, startDate }
 *  - day: 1부터 시작하는 게임 날짜 번호
 *  - minute: 그날 0시부터 지난 분 (0~1440). 1440 이면 그날은 더 쓸 시간이 없어요.
 * 활동은 그날 자정을 넘길 수 없어요. 다음 날로 가는 건 잠자기(nextDay)뿐이에요.
 */
export const DAY_MINUTES = 1440;
export const START_DATE = '2026-03-02'; // 월요일
export const START_MINUTE = 7 * 60;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const create = (startDate = START_DATE) => ({ day: 1, minute: START_MINUTE, startDate });

export const remaining = (time) => DAY_MINUTES - time.minute;
export const fits = (time, minutes) => minutes > 0 && time.minute + minutes <= DAY_MINUTES;

/** 게임 날짜 → 실제 달력 날짜 */
export function dateOf(time, day = time.day) {
  const [y, m, d] = time.startDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + day - 1));
}
export function dateInfo(time, day = time.day) {
  const dt = dateOf(time, day);
  const wd = dt.getUTCDay();
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, date: dt.getUTCDate(), weekday: WEEKDAYS[wd], weekdayIndex: wd, isWeekend: wd === 0 || wd === 6 };
}
/** 'YYYY-MM' (월별 결산 열쇠) */
export function monthKey(time, day = time.day) {
  const d = dateInfo(time, day);
  return `${d.year}-${String(d.month).padStart(2, '0')}`;
}
/** 이번 달에 남은 날 수 (오늘 포함) */
export function daysLeftInMonth(time, day = time.day) {
  const d = dateOf(time, day);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return last - d.getUTCDate() + 1;
}
export const isWeekday = (time, day = time.day) => !dateInfo(time, day).isWeekend;

/** 14:05 형식 */
export function clock(minute) {
  const m = Math.max(0, Math.round(minute));
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** 2시간 30분 형식 */
export function span(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h}시간 ${r}분` : h ? `${h}시간` : `${r}분`;
}

/**
 * 시간을 앞으로 보내요. 1시간 이하 조각으로 나눠 onChunk(분) 을 불러요(상태가 시간에 맞춰 변하도록).
 * 자정을 넘기려 하면 아무것도 하지 않고 false.
 */
export function advance(time, minutes, onChunk) {
  if (!fits(time, minutes)) return false;
  let left = minutes;
  while (left > 0) {
    const step = Math.min(60, left);
    onChunk?.(step);
    time.minute += step;
    left -= step;
  }
  return true;
}

/** 잠들어서 다음 날 wakeMinute 에 일어나요. 잔 시간(분)을 돌려줘요 */
export function nextDay(time, wakeMinute) {
  const slept = DAY_MINUTES - time.minute + wakeMinute;
  time.day += 1;
  time.minute = wakeMinute;
  return slept;
}
