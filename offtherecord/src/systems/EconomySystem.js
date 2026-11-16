/**
 * EconomySystem — 현금 · 하루 생활비 · 수입/지출 기록 · 날짜별 결산.
 * 상태 조각: state.economy = { cash, fixed, ledger[], days[] }
 *  - fixed: 한 달 고정 지출 { rent, utilities, phone, transport } → 하루 생활비로 나눠 매일 밤 빠져나가요
 *  - ledger: 거래 하나하나 { id, day, minute, kind: 'income'|'expense', category, label, amount }
 *  - days: 날짜별 결산 { day, income, expense, cashEnd }
 * 다음 PHASE 에서 월급일·주거 계약·자산·부채·투자가 이 구조 위에 더해져요.
 */
import { REGIONS, byId } from '../data/world.js';

export const LEDGER_MAX = 1500;
export const FIXED_LABELS = { rent: '월세', utilities: '관리비·공과금', phone: '통신비', transport: '교통비' };

export function create(cash, regionId) {
  const r = byId(REGIONS, regionId) ?? REGIONS[0];
  return { cash, fixed: { rent: r.rent, utilities: r.utilities, phone: r.phone, transport: r.transport }, ledger: [], days: [], seq: 0 };
}

/** 하루 생활비 (한 달 고정 지출 ÷ 30, 원 단위 반올림) 와 항목별 내역 */
export function dailyCost(econ) {
  const items = Object.entries(econ.fixed).map(([k, v]) => ({ key: k, label: FIXED_LABELS[k] ?? k, monthly: v, daily: Math.round(v / 30) }));
  return { total: items.reduce((a, x) => a + x.daily, 0), items };
}

export const canAfford = (econ, amount) => amount <= 0 || econ.cash >= amount;

function record(econ, kind, { day, minute, category, label, amount }) {
  const entry = { id: ++econ.seq, day, minute, kind, category, label, amount: Math.round(amount) };
  econ.ledger.push(entry);
  if (econ.ledger.length > LEDGER_MAX) econ.ledger.splice(0, econ.ledger.length - LEDGER_MAX);
  return entry;
}

/** 지출 (잔액이 모자라면 하지 않고 null) */
export function spend(econ, tx) {
  if (!(tx.amount > 0) || !canAfford(econ, tx.amount)) return null;
  econ.cash -= Math.round(tx.amount);
  return record(econ, 'expense', tx);
}

/** 생활비처럼 반드시 나가는 돈 (잔액이 마이너스가 될 수 있어요) */
export function charge(econ, tx) {
  if (!(tx.amount > 0)) return null;
  econ.cash -= Math.round(tx.amount);
  return record(econ, 'expense', tx);
}

export function earn(econ, tx) {
  if (!(tx.amount > 0)) return null;
  econ.cash += Math.round(tx.amount);
  return record(econ, 'income', tx);
}

/** 어떤 날의 수입·지출 합계 */
export function totals(econ, day) {
  let income = 0;
  let expense = 0;
  for (const t of econ.ledger) {
    if (t.day !== day) continue;
    if (t.kind === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/** 하루 마감: 생활비를 빼고 결산을 남겨요 */
export function settleDay(econ, day) {
  const cost = dailyCost(econ);
  const tx = charge(econ, { day, minute: 1440, category: 'living', label: '하루 생활비 (월세·공과금·통신·교통)', amount: cost.total });
  const t = totals(econ, day);
  const summary = { day, income: t.income, expense: t.expense, cashEnd: econ.cash };
  econ.days = econ.days.filter((d) => d.day !== day);
  econ.days.push(summary);
  if (econ.days.length > 400) econ.days.splice(0, econ.days.length - 400);
  return { living: tx, summary };
}

export const inDebt = (econ) => econ.cash < 0;

/** 12,345원 */
export const won = (n) => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`;
