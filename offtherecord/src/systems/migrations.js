/**
 * 저장 데이터 버전 올리기. MIGRATIONS[n] 은 버전 n 데이터를 n+1 로 바꿔요 (원본은 건드리지 않음).
 *
 * v1 → v2 (0.1.0 → 0.2.0)
 *  - character.job(문자열) → character.career { current: { jobId, since: 1 }, history: [] }
 *  - economy: 거래마다 month 를 붙이고, 남아 있는 거래로 월별 누계(months)를 만들어요. assets·liabilities 빈 목록 추가
 *  - journal(사건 기록) 추가: 지난 하루 결산의 메모(지각·결근·쓰러짐·잔액 부족)를 사건으로 옮겨요
 *  - today.gainLog(성장 출처) 추가. 지난 기록에는 출처가 없어서 비워 둬요
 *  - history.series: 0.1.0 에는 능력치 기록이 없어서, 지금 능력치를 ‘불러온 날’ 기록으로 하나 남겨요
 *    (지난 날의 능력치를 추측해서 채우지 않아요)
 */
import * as Time from './TimeSystem.js';

const NOTE_EVENT = {
  지각: { type: 'work', title: '지각했어요' },
  결근: { type: 'work', title: '출근하지 않았어요 (결근)' },
  '지쳐 쓰러짐': { type: 'health', title: '지쳐서 쓰러졌어요' },
  '잔액 부족': { type: 'money', title: '잔액이 마이너스가 됐어요' },
};

export const MIGRATIONS = {
  1: (old) => {
    const d = structuredClone(old);
    const c = d.character;
    c.career = c.career ?? { current: c.job ? { jobId: c.job, since: 1 } : null, history: [] };
    delete c.job;

    const e = d.economy;
    e.months = {};
    e.assets = e.assets ?? [];
    e.liabilities = e.liabilities ?? [];
    for (const t of e.ledger) {
      t.month = Time.monthKey(d.time, t.day);
      const m = (e.months[t.month] ??= { income: 0, expense: 0, byCategory: {} });
      if (t.kind === 'income') m.income += t.amount;
      else {
        m.expense += t.amount;
        m.byCategory[t.category] = (m.byCategory[t.category] ?? 0) + t.amount;
      }
    }

    d.journal = { events: [], seq: 0 };
    for (const r of d.history.reports ?? []) {
      for (const n of r.notes ?? []) {
        const ev = NOTE_EVENT[n];
        if (ev) d.journal.events.push({ id: ++d.journal.seq, day: r.day, minute: 1440, type: ev.type, title: ev.title, text: '', people: [] });
      }
    }

    d.today.gainLog = d.today.gainLog ?? [];
    const last = d.history.series.at(-1);
    if (last && last.day === d.time.day) last.stats = { ...c.stats };
    else d.history.series.push({ day: d.time.day, cash: e.cash, mood: d.life.mood, stress: d.life.stress, energy: d.life.energy, fatigue: d.life.fatigue, hunger: d.life.hunger, stats: { ...c.stats } });

    d.version = 2;
    return d;
  },
};
