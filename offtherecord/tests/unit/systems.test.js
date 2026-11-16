import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import * as Character from '../../src/systems/CharacterSystem.js';
import * as Time from '../../src/systems/TimeSystem.js';
import * as Life from '../../src/systems/LifeSystem.js';
import * as Economy from '../../src/systems/EconomySystem.js';
import * as Activity from '../../src/systems/ActivitySystem.js';
import { createSaveSystem, migrate, SAVE_VERSION, _resetDbForTest } from '../../src/systems/SaveSystem.js';
import { createEngine, newState } from '../../src/engine/GameEngine.js';

const input = (over = {}) => ({ name: '김하루', age: 24, gender: 'none', region: 'seoul', education: 'university', background: 'graduate', ...over });

describe('CharacterSystem', () => {
  it('입력 검사: 빈 이름·나이 범위·배경과 맞지 않는 학력', () => {
    expect(Character.validate(input())).toEqual({});
    expect(Character.validate(input({ name: '  ' })).name).toBeTruthy();
    expect(Character.validate(input({ name: '가'.repeat(13) })).name).toBeTruthy();
    expect(Character.validate(input({ age: 18 })).age).toBeTruthy();
    expect(Character.validate(input({ age: 24.5 })).age).toBeTruthy();
    expect(Character.validate(input({ education: 'highschool' })).education).toMatch(/대학 졸업자/);
    expect(Character.validate(input({ region: 'mars' })).region).toBeTruthy();
  });
  it('배경과 학력에 따라 능력치·일자리가 달라져요', () => {
    const a = Character.create(input());
    const b = Character.create(input({ background: 'veteran', age: 30 }));
    expect(a.stats.intelligence).toBe(58 + 5);
    expect(a.job).toBe('tutor');
    expect(b.job).toBe('office');
    expect(b.stats.expertise).toBeGreaterThan(a.stats.expertise);
  });
  it('성장은 높을수록 더디고, 효율이 곱해져요', () => {
    const c = Character.create(input());
    c.stats.creativity = 20;
    const low = Character.grow(c, 'creativity', 1, 1);
    c.stats.creativity = 90;
    const high = Character.grow(c, 'creativity', 1, 1);
    expect(low).toBeGreaterThan(high);
    c.stats.creativity = 20;
    expect(Character.grow(c, 'creativity', 1, 0.5)).toBeLessThan(low);
  });
  it('나이는 365일마다 한 살', () => {
    const c = Character.create(input());
    expect(Character.ageOn(c, 1)).toBe(24);
    expect(Character.ageOn(c, 365)).toBe(24);
    expect(Character.ageOn(c, 366)).toBe(25);
  });
});

describe('TimeSystem', () => {
  it('자정을 넘기는 시간은 쓸 수 없어요', () => {
    const t = Time.create();
    t.minute = 23 * 60;
    expect(Time.fits(t, 60)).toBe(true);
    expect(Time.fits(t, 61)).toBe(false);
    expect(Time.advance(t, 90)).toBe(false);
    expect(t.minute).toBe(23 * 60);
  });
  it('1시간 조각으로 흘러요', () => {
    const t = Time.create();
    const chunks = [];
    Time.advance(t, 150, (m) => chunks.push(m));
    expect(chunks).toEqual([60, 60, 30]);
    expect(t.minute).toBe(7 * 60 + 150);
  });
  it('다음 날: 잔 시간 계산, 날짜·요일', () => {
    const t = Time.create();
    t.minute = 23 * 60;
    expect(Time.nextDay(t, 7 * 60)).toBe(8 * 60);
    expect(t.day).toBe(2);
    expect(Time.dateInfo(t)).toMatchObject({ month: 3, date: 3, weekday: '화' });
    expect(Time.dateInfo(t, 6)).toMatchObject({ weekday: '토', isWeekend: true });
    expect(Time.dateInfo(t, 31)).toMatchObject({ month: 4, date: 1 });
  });
  it('시각·길이 표기', () => {
    expect(Time.clock(7 * 60 + 5)).toBe('07:05');
    expect(Time.span(150)).toBe('2시간 30분');
    expect(Time.span(40)).toBe('40분');
  });
});

describe('LifeSystem', () => {
  const stats = { fitness: 50 };
  it('깨어 있으면 배고파지고 지쳐요', () => {
    const l = Life.create({ hunger: 20, fatigue: 20, energy: 80 });
    Life.passAwake(l, 120, stats, 1);
    expect(l.hunger).toBeGreaterThan(20);
    expect(l.fatigue).toBeGreaterThan(20);
    expect(l.energy).toBeLessThan(80);
  });
  it('값은 0~100 을 벗어나지 않아요', () => {
    const l = Life.create({ hunger: 98 });
    Life.apply(l, { hunger: 50, mood: -500 });
    expect(l.hunger).toBe(100);
    expect(l.mood).toBe(0);
  });
  it('잠: 7~9시간이 가장 좋고 짧으면 덜 회복', () => {
    const a = Life.create({ fatigue: 80, energy: 20, mood: 50 });
    const b = Life.create({ fatigue: 80, energy: 20, mood: 50 });
    const ga = Life.sleep(a, 8 * 60, stats);
    const gb = Life.sleep(b, 4 * 60, stats);
    expect(ga.quality).toBe('good');
    expect(gb.quality).toBe('short');
    expect(a.fatigue).toBeLessThan(b.fatigue);
    expect(a.mood).toBeGreaterThan(b.mood);
  });
  it('상태가 나쁘면 효율이 떨어지고 이유가 나와요', () => {
    const good = Life.efficiency(Life.create({ fatigue: 20, hunger: 20, stress: 20, energy: 90, mood: 70 }));
    const bad = Life.efficiency(Life.create({ fatigue: 95, hunger: 95, stress: 90, energy: 10, mood: 20 }));
    expect(good.value).toBeGreaterThan(1);
    expect(bad.value).toBeLessThan(0.6);
    expect(bad.reasons).toContain('배가 고파요');
  });
});

describe('EconomySystem', () => {
  it('하루 생활비 = 한 달 고정 지출 ÷ 30', () => {
    const e = Economy.create(1000000, 'seoul');
    expect(Economy.dailyCost(e).total).toBe(Math.round(650000 / 30) + Math.round(120000 / 30) + Math.round(55000 / 30) + Math.round(75000 / 30));
  });
  it('지출은 잔액이 모자라면 안 되고, 생활비는 마이너스가 될 수 있어요', () => {
    const e = Economy.create(10000, 'local');
    expect(Economy.spend(e, { day: 1, minute: 0, category: 'meal', label: 'x', amount: 20000 })).toBeNull();
    expect(e.cash).toBe(10000);
    Economy.earn(e, { day: 1, minute: 60, category: 'work', label: '알바', amount: 5000 });
    Economy.spend(e, { day: 1, minute: 70, category: 'meal', label: '밥', amount: 4000 });
    const { summary } = Economy.settleDay(e, 1);
    expect(summary.income).toBe(5000);
    expect(summary.expense).toBe(4000 + Economy.dailyCost(e).total);
    expect(e.cash).toBe(10000 + 5000 - 4000 - Economy.dailyCost(e).total);
    expect(Economy.inDebt(e)).toBe(true);
  });
});

describe('ActivitySystem', () => {
  let s;
  beforeEach(() => (s = newState(input())));
  it('시간대·하루 횟수·남은 시간·돈을 검사해요', () => {
    expect(Activity.check(s, Activity.find(s, 'nap'))).toMatch(/11:00부터/);
    s.time.minute = 23 * 60;
    expect(Activity.check(s, Activity.find(s, 'reading'))).toMatch(/남은 시간/);
    s.time.minute = 12 * 60;
    s.economy.cash = 1000;
    expect(Activity.check(s, Activity.find(s, 'eat_out'))).toMatch(/돈이 부족/);
    s.today.counts.nap = 1;
    expect(Activity.check(s, Activity.find(s, 'nap'))).toMatch(/이미/);
  });
  it('과외: 오후 4시부터, 하루 3시간까지', () => {
    const w = Activity.find(s, 'work');
    expect(Activity.check(s, w, { hours: 1 })).toMatch(/16:00부터/);
    s.time.minute = 16 * 60;
    expect(Activity.check(s, w, { hours: 3 })).toBeNull();
    expect(Activity.check(s, w, { hours: 4 })).toBeTruthy();
  });
  it('직장인: 평일 출근 블록(출근길·근무·퇴근길), 늦으면 지각, 너무 늦으면 불가', () => {
    const v = newState(input({ background: 'veteran', age: 30 }));
    const w = Activity.find(v, 'work');
    const p = Activity.plan(v, w);
    expect(p.blocks.map((b) => b.category)).toEqual(['commute', 'work', 'commute']);
    expect(p.minutes).toBe(18 * 60 + 50 - 7 * 60);
    v.time.minute = 8 * 60 + 30;
    expect(Activity.plan(v, w).late).toBe(true);
    v.time.minute = 9 * 60 + 30;
    expect(Activity.check(v, w)).toMatch(/출근 시간이 지났어요/);
    v.time.day = 6; // 토요일
    v.time.minute = 7 * 60;
    expect(Activity.check(v, w)).toMatch(/주말/);
  });
});

describe('GameEngine', () => {
  const engine = () => createEngine({ now: () => 1 });
  it('활동: 시간이 흐르고 상태·능력치·돈이 바뀌어요', async () => {
    const g = engine();
    await g.start(input());
    const s = g.state;
    const before = { minute: s.time.minute, int: s.character.stats.intelligence, cash: s.economy.cash, hunger: s.life.hunger };
    const r = await g.perform('reading');
    expect(r.ok).toBe(true);
    expect(s.time.minute).toBe(before.minute + 120);
    expect(s.character.stats.intelligence).toBeGreaterThan(before.int);
    expect(s.life.hunger).toBeGreaterThan(before.hunger);
    await g.perform('eat_out');
    expect(s.economy.cash).toBe(before.cash - 12000);
    expect(s.economy.ledger.at(-1)).toMatchObject({ kind: 'expense', amount: 12000, label: '밖에서 사 먹기' });
    expect(s.today.blocks).toHaveLength(2);
  });
  it('일하면 돈을 벌어요 (과외 2시간)', async () => {
    const g = engine();
    await g.start(input());
    g.state.time.minute = 16 * 60;
    const cash = g.state.economy.cash;
    const r = await g.perform('work', { hours: 2 });
    expect(r.summary.income).toBe(50000);
    expect(g.state.economy.cash).toBe(cash + 50000);
  });
  it('막힌 활동은 상태를 바꾸지 않아요', async () => {
    const g = engine();
    await g.start(input());
    const snap = JSON.stringify(g.state);
    const r = await g.perform('nap');
    expect(r.ok).toBe(false);
    expect(JSON.stringify(g.state)).toBe(snap);
  });
  it('하루 마치기: 밤 8시 전엔 못 자고, 자면 결산 후 다음 날 아침', async () => {
    const g = engine();
    await g.start(input());
    expect(g.canSleep().ok).toBe(false);
    expect(g.sleep(7 * 60)).toBeNull();
    g.state.time.minute = 23 * 60;
    const cash = g.state.economy.cash;
    const rep = g.sleep(7 * 60);
    expect(rep.sleptHours).toBe(8);
    expect(g.state.time).toMatchObject({ day: 2, minute: 7 * 60 });
    expect(g.state.economy.cash).toBe(cash - Economy.dailyCost(g.state.economy).total);
    expect(g.state.history.reports).toHaveLength(1);
    expect(g.state.history.series).toHaveLength(2);
    expect(g.state.today.blocks).toHaveLength(0);
  });
  it('직장인이 평일에 출근하지 않으면 결근으로 남아요', async () => {
    const g = engine();
    await g.start(input({ background: 'veteran', age: 30 }));
    const dil = g.state.character.stats.diligence;
    g.state.time.minute = 22 * 60;
    const rep = g.sleep(7 * 60);
    expect(rep.notes).toContain('결근');
    expect(g.state.character.stats.diligence).toBeLessThan(dil);
  });
  it('지쳐 쓰러지면 다음 날 10시에 깨요', async () => {
    const g = engine();
    await g.start(input());
    g.state.life.fatigue = 99;
    g.state.life.energy = 1;
    const r = await g.perform('reading');
    expect(r.collapsed?.notes).toContain('지쳐 쓰러짐');
    expect(g.state.time).toMatchObject({ day: 2, minute: 600 });
  });
  it('schedule: 식사 시간과 일 표시', async () => {
    const g = engine();
    await g.start(input({ background: 'veteran', age: 30 }));
    const items = g.schedule();
    expect(items.find((i) => i.kind === 'duty')).toMatchObject({ status: 'planned' });
    expect(items.filter((i) => i.kind === 'meal')).toHaveLength(3);
  });
});

describe('SaveSystem (IndexedDB)', () => {
  beforeEach(async () => {
    _resetDbForTest();
    await createSaveSystem().clear();
  });
  it('저장 → 불러오기 (버전 포함), 직전 저장본 보관', async () => {
    const save = createSaveSystem();
    expect(await save.load()).toEqual({ empty: true });
    const s1 = newState(input());
    await save.save(s1);
    s1.economy.cash = 1;
    await save.save(s1);
    const r = await save.load();
    expect(r.data.economy.cash).toBe(1);
    expect(r.data.version).toBe(SAVE_VERSION);
  });
  it('엔진이 활동마다 자동 저장하고, 새 엔진에서 이어 불러와요', async () => {
    const save = createSaveSystem();
    const g = createEngine({ saveSystem: save });
    await g.start(input());
    await g.perform('reading');
    await g.flush();
    _resetDbForTest();
    const g2 = createEngine({ saveSystem: createSaveSystem() });
    const r = await g2.load();
    expect(r.data).toBeTruthy();
    expect(g2.state.time.minute).toBe(9 * 60);
    expect(g2.state.character.name).toBe('김하루');
  });
  it('깨진 최신 저장본이면 직전 저장본으로', async () => {
    const save = createSaveSystem();
    await save.save(newState(input()));
    await save.save({ broken: true });
    const r = await save.load();
    expect(r.recovered).toBe(true);
    expect(r.data.character.name).toBe('김하루');
  });
  it('모르는 미래 버전은 거절', () => {
    expect(() => migrate({}, SAVE_VERSION + 1)).toThrow();
  });
});
