/**
 * JournalSystem — 인생의 ‘사건’ 기록.
 * 상태 조각: state.journal = { events: [{ id, day, minute, type, title, text, people }], seq }
 *
 * 하루 결산(history.reports)이 ‘그날 무엇을 했나’라면, 사건은 ‘그날 무슨 일이 있었나’예요.
 *  type: 'life'(시작·이정표) · 'work'(지각·결근·이직 등) · 'health'(쓰러짐) · 'money'(잔액 부족 등)
 *        · 'growth'(능력치 이정표) · 'social'(다음 PHASE: 인간관계)
 *  people: 관련 인물 id 목록 — 다음 PHASE 의 NPC 시스템이 채워요 (지금은 빈 배열)
 */
export const EVENTS_MAX = 600;
export const TYPE_LABEL = { life: '인생', work: '일', health: '건강', money: '돈', growth: '성장', social: '관계' };

export const create = () => ({ events: [], seq: 0 });

export function add(journal, { day, minute = 0, type = 'life', title, text = '', people = [] }) {
  const ev = { id: ++journal.seq, day, minute, type, title, text, people };
  journal.events.push(ev);
  if (journal.events.length > EVENTS_MAX) journal.events.splice(0, journal.events.length - EVENTS_MAX);
  return ev;
}

export const forDay = (journal, day) => journal.events.filter((e) => e.day === day).sort((a, b) => a.minute - b.minute || a.id - b.id);
export const recent = (journal, n = 20) => journal.events.slice(-n).reverse();
