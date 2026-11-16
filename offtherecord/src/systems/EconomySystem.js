/**
 * EconomySystem — 현금 · 하루 생활비 · 수입/지출 기록 · 날짜별·월별 결산 · 자산/부채.
 * 상태 조각: state.economy = { cash, fixed, ledger[], days[], months{}, assets[], liabilities[], seq }
 *  - fixed: 한 달 고정 지출 { rent, utilities, phone, transport } → 하루 생활비로 나눠 매일 밤 빠져나가요
 *  - ledger: 거래 하나하나 { id, day, minute, month, kind: 'income'|'expense', category, label, amount } (최근 LEDGER_MAX 건)
 *  - days: 날짜별 결산 { day, income, expense, cashEnd }
 *  - months: 월별 누계 { 'YYYY-MM': { income, expense, byCategory: { 분류: 금액 } } } — 거래 기록이 잘려도 남아요
 *  - assets / liabilities: 현금 외 자산·부채 항목 (예금·대출 등은 다음 PHASE 에서 { id, kind, label, amount } 로 추가)
 */
import { REGIONS, byId } from '../data/world.js';

export const LEDGER_MAX = 1500;
export const FIXED_LABELS = { rent: '월세', utilities: '관리비·공과금', phone: '통신비', transport: '교통비' };
/** 분류 이름 (활동 분류 + 경제 전용) */
export const CATEGORY_LABELS = { meal: '식비', growth: '자기계발', hobby: '취미', social: '사람·모임', life: '생활', rest: '휴식', living: '고정 생활비', work: '근로 소득', commute: '교통' };

export function create(cash, regionId) {
  const r = byId(REGIONS, regionId) ?? REGIONS[0];
  return { cash, fixed: { rent: r.rent, utilities: r.utilities, phone: r.phone, transport: r.transport }, ledger: [], days: [], months: {}, assets: [], liabilities: [], seq: 0 };
}

/** 하루 생활비 (한 달 고정 지출 ÷ 30, 원 단위 반올림) 와 항목별 내역 */
export function dailyCost(econ) {
  const items = Object.entries(econ.fixed).map(([k, v]) => ({ key: k, label: FIXED_LABELS[k] ?? k, monthly: v, daily: Math.round(v / 30) }));
  return { total: items.reduce((a, x) => a + x.daily, 0), items };
}

export const canAfford = (econ, amount) => amount <= 0 || econ.cash >= amount;

function bumpMonth(econ, entry) {
  if (!entry.month) return;
  const m = (econ.months[entry.month] ??= { income: 0, expense: 0, byCategory: {} });
  if (entry.kind === 'income') m.income += entry.amount;
  else {
    m.expense += entry.amount;
    m.byCategory[entry.category] = (m.byCategory[entry.category] ?? 0) + entry.amount;
  }
}

function record(econ, kind, { day, minute, month, category, label, amount }) {
  const entry = { id: ++econ.seq, day, minute, month, kind, category, label, amount: Math.round(amount) };
  econ.ledger.push(entry);
  if (econ.ledger.length > LEDGER_MAX) econ.ledger.splice(0, econ.ledger.length - LEDGER_MAX);
  bumpMonth(econ, entry);
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
export function settleDay(econ, day, month) {
  const cost = dailyCost(econ);
  const tx = charge(econ, { day, minute: 1440, month, category: 'living', label: '하루 생활비 (월세·공과금·통신·교통)', amount: cost.total });
  const t = totals(econ, day);
  const summary = { day, income: t.income, expense: t.expense, cashEnd: econ.cash };
  econ.days = econ.days.filter((d) => d.day !== day);
  econ.days.push(summary);
  if (econ.days.length > 400) econ.days.splice(0, econ.days.length - 400);
  return { living: tx, summary };
}

export const inDebt = (econ) => econ.cash < 0;

/** 한 달 요약: 수입·지출·저축액·저축률·분류별 비중 (실제 기록에서) */
export function monthSummary(econ, monthKey) {
  const m = econ.months[monthKey] ?? { income: 0, expense: 0, byCategory: {} };
  const saved = m.income - m.expense;
  const categories = Object.entries(m.byCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => ({ id, label: CATEGORY_LABELS[id] ?? id, amount, share: m.expense ? amount / m.expense : 0 }));
  return { month: monthKey, income: m.income, expense: m.expense, saved, rate: m.income ? saved / m.income : null, categories };
}

/** 자산·부채: 현금이 마이너스면 ‘밀린 생활비’ 부채로 봐요 */
export function balanceSheet(econ) {
  const assets = [{ id: 'cash', label: '현금', amount: Math.max(0, econ.cash) }, ...econ.assets];
  const liabilities = [...(econ.cash < 0 ? [{ id: 'overdue', label: '밀린 생활비', amount: -econ.cash }] : []), ...econ.liabilities];
  const a = assets.reduce((s, x) => s + x.amount, 0);
  const l = liabilities.reduce((s, x) => s + x.amount, 0);
  return { assets, liabilities, totalAssets: a, totalLiabilities: l, netWorth: a - l };
}

/**
 * 다음 달 1일 예상 잔액: 지금 잔액 + (최근 결산일들의 하루 평균 순수입 × 이번 달 남은 날 수)
 *  결산한 날이 없으면 ‘하루 생활비만 나간다’고 보고 계산해요. basis 에 근거를 담아 화면에 보여 줘요.
 *  daysLeft: 오늘을 포함해 이번 달에 남은 날 수
 */
export function forecast(econ, daysLeft, recent = 7) {
  const days = econ.days.slice(-recent);
  let avg;
  let basis;
  if (days.length) {
    avg = days.reduce((s, d) => s + (d.income - d.expense), 0) / days.length;
    basis = `최근 ${days.length}일 평균 하루 ${avg >= 0 ? '+' : '-'}${won(Math.abs(avg))}`;
  } else {
    avg = -dailyCost(econ).total;
    basis = `아직 결산한 날이 없어 하루 생활비 ${won(dailyCost(econ).total)}만 반영`;
  }
  return { amount: Math.round(econ.cash + avg * daysLeft), daily: Math.round(avg), daysLeft, basis };
}

/** 12,345원 */
export const won = (n) => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`;
