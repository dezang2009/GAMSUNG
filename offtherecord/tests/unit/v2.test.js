import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import * as Character from '../../src/systems/CharacterSystem.js';
import * as Career from '../../src/systems/CareerSystem.js';
import * as Economy from '../../src/systems/EconomySystem.js';
import * as Time from '../../src/systems/TimeSystem.js';
import * as Activity from '../../src/systems/ActivitySystem.js';
import { createSaveSystem, migrate, isValid, SAVE_VERSION, exportText, importText, _resetDbForTest, DB_NAME } from '../../src/systems/SaveSystem.js';
import { createEngine, newState } from '../../src/engine/GameEngine.js';
import { BACKGROUNDS } from '../../src/data/world.js';
import { ACTIVITIES } from '../../src/data/activities.js';

const V1 = JSON.parse(readFileSync(new URL('../fixtures/save-v1.json', import.meta.url), 'utf8'));
const input = (over = {}) => ({ name: '김하루', age: 24, gender: 'none', region: 'seoul', education: 'university', background: 'graduate', ...over });

describe('0.1.0 저장 데이터 호환 (실제 0.1.0 코드로 만든 저장본)', () => {
  it('v1 → v2: 일자리·돈·기록이 그대로 옮겨져요', () => {
    expect(V1.version).toBe(1);
    const d = migrate(V1.data, 1);
    expect(d.version).toBe(SAVE_VERSION);
    expect(isValid(d)).toBe(true);
    expect(d.character.job).toBeUndefined();
    expect(d.character.career.current).toEqual({ jobId: 'office', since: 1 });
    expect(d.economy.cash).toBe(V1.data.economy.cash);
    expect(d.time).toEqual(V1.data.time);
    expect(d.character.stats).toEqual(V1.data.character.stats);
    // 월별 누계 = 남아 있는 거래 합계
    const inc = V1.data.economy.ledger.filter((t) => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
    const exp = V1.data.economy.ledger.filter((t) => t.kind === 'expense').reduce((a, t) => a + t.amount, 0);
    expect(d.economy.months['2026-03']).toMatchObject({ income: inc, expense: exp });
    expect(d.history.series.at(-1).stats).toEqual(V1.data.character.stats);
    expect(d.journal.events).toBeDefined();
  });
  it('원본 v1 객체는 바뀌지 않아요', () => {
    const before = JSON.stringify(V1.data);
    migrate(V1.data, 1);
    expect(JSON.stringify(V1.data)).toBe(before);
  });
  it('IndexedDB 에 v1 저장본이 있으면 불러와서 이어서 할 수 있어요', async () => {
    _resetDbForTest();
    await createSaveSystem().clear();
    await new Promise((res) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.objectStoreNames.contains('saves') || r.result.createObjectStore('saves', { keyPath: 'slot' });
      r.onsuccess = () => {
        const t = r.result.transaction('saves', 'readwrite');
        t.objectStore('saves').put(V1);
        t.oncomplete = () => (r.result.close(), res());
      };
    });
    _resetDbForTest();
    const g = createEngine({ saveSystem: createSaveSystem() });
    const r = await g.load();
    expect(r.data.character.name).toBe('옛저장');
    const cash = g.state.economy.cash;
    g.state.time.minute = 20 * 60;
    expect((await g.perform('home_meal')).ok).toBe(true);
    expect(g.state.economy.cash).toBe(cash - 4500);
    const rep = g.sleep(7 * 60);
    expect(rep).toBeTruthy();
    expect(g.state.time.day).toBe(3);
    await g.flush();
    _resetDbForTest();
    const again = await createSaveSystem().load();
    expect(again.data.version).toBe(2);
    expect(again.data.time.day).toBe(3);
  });
});

describe('이름 길이: 입력창(maxlength)과 검사가 같은 12자', () => {
  it('12자 통과, 13자 거절', () => {
    expect(Character.NAME_MAX).toBe(12);
    expect(Character.validate(input({ name: '가'.repeat(12) })).name).toBeUndefined();
    expect(Character.validate(input({ name: '가'.repeat(13) })).name).toBeTruthy();
    expect(Character.validate(input({ name: 'a'.repeat(12) })).name).toBeUndefined();
  });
});

describe('네 가지 초기 배경', () => {
  for (const bg of BACKGROUNDS) {
    it(`${bg.name}: 생성 → 일 → 하루 마무리`, async () => {
      const g = createEngine();
      await g.start(input({ background: bg.id, education: bg.defaultEducation, age: bg.defaultAge }));
      const s = g.state;
      expect(s.economy.cash).toBe(bg.cash);
      expect(s.character.career.current.jobId).toBe(bg.job);
      const w = Activity.find(s, 'work');
      if (w.job.type !== 'office') s.time.minute = Math.max(s.time.minute, w.window[0]);
      const r = await g.perform('work', { hours: 1 });
      expect(r.ok).toBe(true);
      expect(r.summary.income).toBeGreaterThan(0);
      s.time.minute = Math.max(s.time.minute, 21 * 60);
      expect(g.sleep(7 * 60).income).toBe(r.summary.income);
      expect(s.time.day).toBe(2);
    });
  }
});

describe('모든 활동: 시간과 상태가 실제로 바뀌어요 (미리보기 = 실제)', () => {
  for (const a of ACTIVITIES) {
    it(a.name, async () => {
      const g = createEngine();
      await g.start(input({ background: 'founder', education: 'university', age: 28 }));
      const s = g.state;
      s.time.minute = Math.max(a.window?.[0] ?? 0, 12 * 60);
      if (s.time.minute + a.minutes > (a.window?.[1] ?? 1440)) s.time.minute = (a.window?.[1] ?? 1440) - a.minutes;
      s.life = { energy: 70, fatigue: 30, stress: 50, mood: 50, hunger: 50 };
      const pv = g.activities().find((x) => x.act.id === a.id);
      expect(pv.blocked).toBeNull();
      const before = { ...s.life };
      const cash = s.economy.cash;
      const r = await g.perform(a.id);
      expect(r.ok).toBe(true);
      expect(r.summary.minutes).toBe(a.minutes);
      expect(r.summary.end - r.summary.start).toBe(a.minutes);
      expect(s.economy.cash).toBe(cash - (a.cost ?? 0));
      expect(Object.keys(r.summary.life).length).toBeGreaterThan(0);
      expect(JSON.stringify(s.life)).not.toBe(JSON.stringify(before));
      // 미리보기와 실제 결과가 같아요
      expect(pv.preview.life).toEqual(r.summary.life);
      expect(pv.preview.gains).toEqual(r.summary.gains);
      for (const st of Object.keys(a.grow ?? {})) expect(r.summary.gains[st]).toBeGreaterThan(0);
    });
  }
});

describe('직업: 배경은 시작만, 바꿀 수 있는 구조', () => {
  it('change: 이직·퇴사가 경력 기록에 남고 일 활동이 따라 바뀌어요', () => {
    const s = newState(input());
    expect(Career.currentJob(s.character).id).toBe('tutor');
    Career.change(s.character, 'convenience', 5, '이직');
    expect(Activity.find(s, 'work').job.id).toBe('convenience');
    expect(s.character.career.history).toEqual([{ jobId: 'tutor', from: 1, to: 5, reason: '이직' }]);
    Career.change(s.character, null, 9, '퇴사');
    expect(Activity.find(s, 'work')).toBeNull();
    expect(Career.change(s.character, null, 10)).toBe(false);
    expect(() => Career.change(s.character, 'astronaut', 11)).toThrow();
  });
});

describe('경제: 월별·비중·자산부채·예상 잔액 (실제 기록에서)', () => {
  it('월별 합계와 분류 비중', async () => {
    const g = createEngine();
    await g.start(input());
    await g.perform('eat_out');
    await g.perform('course');
    const m = Economy.monthSummary(g.state.economy, '2026-03');
    expect(m.expense).toBe(12000 + 9900);
    expect(m.categories.map((c) => c.id)).toEqual(['meal', 'growth']);
    expect(m.categories[0].share).toBeCloseTo(12000 / 21900);
    expect(m.saved).toBe(-21900);
  });
  it('달이 바뀌면 다른 달로 쌓여요', () => {
    const e = Economy.create(0, 'seoul');
    Economy.earn(e, { day: 30, minute: 0, month: '2026-03', category: 'work', label: 'a', amount: 100 });
    Economy.earn(e, { day: 31, minute: 0, month: '2026-04', category: 'work', label: 'b', amount: 50 });
    expect(Economy.monthSummary(e, '2026-03').income).toBe(100);
    expect(Economy.monthSummary(e, '2026-04').income).toBe(50);
    expect(Time.monthKey({ startDate: '2026-03-02' }, 31)).toBe('2026-04');
    expect(Time.daysLeftInMonth({ startDate: '2026-03-02' }, 1)).toBe(30);
  });
  it('마이너스 잔액은 부채로', () => {
    const e = Economy.create(-5000, 'seoul');
    const b = Economy.balanceSheet(e);
    expect(b.totalAssets).toBe(0);
    expect(b.liabilities[0]).toMatchObject({ id: 'overdue', amount: 5000 });
    expect(b.netWorth).toBe(-5000);
  });
  it('예상 잔액: 결산 전에는 생활비만, 결산 후에는 최근 평균', () => {
    const e = Economy.create(100000, 'local');
    const f0 = Economy.forecast(e, 10);
    expect(f0.amount).toBe(100000 - Economy.dailyCost(e).total * 10);
    e.days.push({ day: 1, income: 30000, expense: 10000, cashEnd: 0 }, { day: 2, income: 0, expense: 10000, cashEnd: 0 });
    expect(Economy.forecast(e, 10).amount).toBe(100000 + 5000 * 10);
  });
});

describe('추천: 상태와 돈 사정 기반 (무작위 아님)', () => {
  it('배고프면 식사, 돈이 적으면 가장 싼 식사', async () => {
    const g = createEngine();
    await g.start(input());
    g.state.life.hunger = 85;
    expect(g.recommend()[0].id).toBe('eat_out');
    g.state.economy.cash = 20000;
    expect(g.recommend()[0].id).toBe('home_meal');
  });
  it('식사 시간에 배고픔 40 이상이면 가장 싼 식사부터', async () => {
    const g = createEngine();
    await g.start(input());
    g.state.life.hunger = 45;
    expect(g.recommend()[0]).toMatchObject({ id: 'home_meal' });
    g.state.time.minute = 10 * 60; // 식사 시간이 아니면 이 규칙은 없어요
    expect(g.recommend().some((r) => r.reason.startsWith('식사 시간'))).toBe(false);
  });
  it('같은 상태면 항상 같은 추천', async () => {
    const g = createEngine();
    await g.start(input());
    g.state.life.stress = 80;
    expect(g.recommend()).toEqual(g.recommend());
    expect(g.recommend().map((r) => r.id)).toContain('walk');
  });
  it('직장인 출근 시간에는 출근이 먼저', async () => {
    const g = createEngine();
    await g.start(input({ background: 'veteran', age: 30 }));
    expect(g.recommend()[0].id).toBe('work');
  });
});

describe('사건 기록·성장 출처', () => {
  it('시작·지각·결근이 사건으로, 성장은 출처와 함께', async () => {
    const g = createEngine();
    await g.start(input({ background: 'veteran', age: 30 }));
    const s = g.state;
    expect(s.journal.events[0].title).toMatch(/기록이 시작/);
    s.time.minute = 8 * 60 + 30;
    await g.perform('work');
    expect(s.journal.events.some((e) => e.title === '지각했어요')).toBe(true);
    expect(s.today.gainLog.some((x) => x.source === '지각' && x.amount < 0)).toBe(true);
    s.time.minute = 22 * 60;
    const rep = g.sleep(7 * 60);
    expect(rep.gainLog.length).toBeGreaterThan(0);
    s.time.minute = 22 * 60; // 화요일, 출근 안 함
    g.sleep(7 * 60);
    expect(s.journal.events.some((e) => e.type === 'work' && e.title.includes('결근'))).toBe(true);
    expect(s.journal.events.every((e) => Array.isArray(e.people))).toBe(true);
  });
});

describe('저장: 내보내기·가져오기·실패 안내', () => {
  it('내보낸 글자를 가져오면 같은 상태', () => {
    const s = newState(input());
    const r = importText(exportText(s));
    expect(r.data).toEqual(s);
  });
  it('v1 내보내기(버전 1)도 가져오면 v2 로', () => {
    const r = importText(JSON.stringify({ app: 'off-the-record', version: 1, data: V1.data }));
    expect(r.data.version).toBe(2);
  });
  it('엉뚱한 글자는 이유와 함께 거절', () => {
    expect(importText('hello').error).toMatch(/형식/);
    expect(importText('{"a":1}').error).toMatch(/OFF THE RECORD/);
    expect(importText(JSON.stringify({ app: 'off-the-record', version: 2, data: { x: 1 } })).error).toBeTruthy();
  });
  it('저장이 실패하면 save 이벤트로 알리고, 다시 시도해 성공하면 해제', async () => {
    let fail = true;
    const g = createEngine({ saveSystem: { save: async () => { if (fail) throw new Error('디스크 가득 참'); }, load: async () => ({ empty: true }), clear: async () => {} } });
    const seen = [];
    g.on('save', (e) => seen.push(e));
    await g.start(input());
    expect(seen.at(-1)).toMatchObject({ ok: false, message: '디스크 가득 참' });
    expect(g.saveError).toBe('디스크 가득 참');
    fail = false;
    await g.retrySave();
    expect(seen.at(-1)).toEqual({ ok: true });
    expect(g.saveError).toBeNull();
  });
});
