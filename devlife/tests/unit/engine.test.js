import { describe, it, expect } from 'vitest';
import * as E from '../../src/game/engine.js';
import { rollEvent, choose, scheduler, EVENTS } from '../../src/game/events.js';
import { sanitize } from '../../src/game/save.js';
import { shortNum, won, duration } from '../../src/game/format.js';

const T0 = 1_700_000_000_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const withApp = () => {
  const s = E.newGame(T0);
  s.project.progress = E.projectLines(s);
  E.launch(s, T0, () => 0.5);
  return s;
};

describe('숫자 표시', () => {
  it('만·억·조', () => {
    expect(shortNum(1234)).toBe('1,234');
    expect(shortNum(12345)).toBe('1.23만');
    expect(shortNum(3.5e8)).toBe('3.5억');
    expect(won(2e12)).toBe('2조원');
    expect(shortNum(0.6)).toBe('0.6');
    expect(duration(3 * 3600 + 120)).toBe('3시간 2분');
  });
});

describe('코드 쓰기와 출시', () => {
  it('탭하면 탭 값만큼 진행, 다 차면 넘치지 않고 출시 대기', () => {
    const s = E.newGame(T0);
    expect(E.tap(s, T0)).toBe(1);
    expect(s.project.progress).toBe(1);
    s.project.progress = E.projectLines(s) - 0.5;
    E.tap(s, T0);
    expect(s.project.progress).toBe(E.projectLines(s));
    expect(E.projectReady(s)).toBe(true);
  });
  it('출시: 앱이 생기고 다음 프로젝트는 더 크다, 평점 2.5~4.9', () => {
    const s = withApp();
    expect(s.apps).toHaveLength(1);
    expect(s.apps[0]).toMatchObject({ name: '할 일 앱', rating: 3.6 });
    expect(s.project).toEqual({ index: 1, progress: 0 });
    expect(E.projectLines(s)).toBeGreaterThan(120);
    expect(E.launch(s, T0)).toBeNull(); // 덜 찼으면 출시 안 됨
  });
  it('앱 이름: 목록을 다 돌면 후속작', () => expect(E.appName(16)).toBe('할 일 앱 2'));
});

describe('구매', () => {
  it('돈이 모자라면 실패, 사면 비용이 오른다', () => {
    const s = E.newGame(T0);
    expect(E.buyUpgrade(s, 'keyboard')).toBe(false);
    s.money = 1000;
    const c1 = E.upgradeCost(s, 'keyboard');
    expect(E.buyUpgrade(s, 'keyboard')).toBe(true);
    expect(s.money).toBe(1000 - c1);
    expect(E.upgradeCost(s, 'keyboard')).toBeGreaterThan(c1);
    expect(E.tapValue(s, T0)).toBe(2);
  });
  it('직원은 사무실 자리만큼만, 이사하면 자리가 늘어난다', () => {
    const s = E.newGame(T0);
    s.money = 1e9;
    for (let i = 0; i < 3; i++) expect(E.hire(s, 'intern')).toBe(true);
    expect(E.hire(s, 'intern')).toBe(false);
    expect(E.moveOffice(s)).toBe(true);
    expect(E.officeSlots(s)).toBe(8);
    expect(E.hire(s, 'intern')).toBe(true);
    expect(E.linesPerSec(s, T0)).toBeCloseTo(0.6 * 4);
  });
  it('최대 레벨이 있는 장비는 더 못 산다', () => {
    const s = E.newGame(T0);
    s.money = 1e30;
    for (let i = 0; i < 10; i++) E.buyUpgrade(s, 'ci');
    expect(s.upgrades.ci).toBe(8);
  });
});

describe('시간 흐름', () => {
  it('직원이 코드를 쓰고, 앱은 사용자가 목표치로 늘며 수익이 난다', () => {
    const s = withApp();
    s.staff.junior = 2;
    const r = E.tick(s, 10, T0);
    expect(r.lines).toBeCloseTo(80);
    const target = E.targetUsers(s, s.apps[0]);
    for (let i = 0; i < 2000; i++) E.tick(s, 1, T0);
    expect(s.apps[0].users).toBeGreaterThan(target * 0.99);
    expect(s.money).toBeGreaterThan(0);
    expect(s.totalEarned).toBeCloseTo(s.money);
  });
  it('자리 비운 사이: 1분 미만은 무시, 최대 8시간, 75% 효율', () => {
    const s = withApp();
    s.staff.junior = 1;
    s.lastTick = T0;
    expect(E.offlineProgress(s, T0 + 30_000)).toBeNull();
    const r = E.offlineProgress(s, T0 + 48 * 3600_000);
    expect(r.secs).toBe(8 * 3600);
    expect(r.money).toBeGreaterThan(0);
    expect(s.lastTick).toBe(T0 + 48 * 3600_000);
  });
  it('버프는 시간이 지나면 사라진다', () => {
    const s = E.newGame(T0);
    s.buffs.push({ target: 'tap', mult: 2, until: T0 + 1000 });
    expect(E.tapValue(s, T0)).toBe(2);
    E.tick(s, 1, T0 + 2000);
    expect(s.buffs).toHaveLength(0);
  });
});

describe('회사 매각', () => {
  it('앱 5개 전에는 불가, 매각하면 통찰을 얻고 처음부터 (업적·통계는 유지)', () => {
    const s = withApp();
    s.runEarned = 1e9;
    expect(E.insightGain(s)).toBe(0);
    for (let i = 0; i < 4; i++) {
      s.project.progress = E.projectLines(s);
      E.launch(s, T0, () => 0.5);
    }
    s.achievements.first_app = T0;
    const gain = E.insightGain(s);
    expect(gain).toBe(100);
    expect(E.sellCompany(s, T0)).toBe(100);
    expect(s).toMatchObject({ insight: 100, money: 0, apps: [], office: 0 });
    expect(s.achievements.first_app).toBe(T0);
    expect(s.stats.sold).toBe(1);
    expect(E.tapValue(s, T0)).toBe(6); // 통찰 100 → ×6
  });
});

describe('업적', () => {
  it('조건을 처음 만족할 때 한 번만', () => {
    const s = withApp();
    s.taps = 1;
    expect(E.checkAchievements(s, T0).map((a) => a.id)).toEqual(expect.arrayContaining(['first_code', 'first_app']));
    expect(E.checkAchievements(s, T0)).toEqual([]);
  });
});

describe('사건', () => {
  it('앱이 없으면 앱 관련 사건은 나오지 않는다', () => {
    const s = E.newGame(T0);
    for (let i = 0; i < 50; i++) expect(['allnighter', 'coffee_out', 'applicant']).toContain(rollEvent(s, T0, Math.random)?.id);
  });
  it('모든 사건의 모든 선택이 오류 없이 결과 문장을 남긴다', () => {
    for (const ev of EVENTS) {
      ev.choices.forEach((_, ci) => {
        const s = withApp();
        s.money = 1e6;
        s.staff.junior = 3;
        for (let k = 0; k < 2; k++) { s.project.progress = E.projectLines(s); E.launch(s, T0, () => 0.5); }
        s.apps.forEach((a) => (a.users = 5000));
        const p = { id: ev.id, key: `${ev.id}-x`, at: T0, data: ev.data ? ev.data(s, () => 0) : {} };
        s.pending.push(p);
        const msg = choose(s, p.key, ci, T0);
        expect(typeof msg, `${ev.id}/${ci}`).toBe('string');
        expect(s.pending).toHaveLength(0);
        expect(s.log[0].kind).toBe('event');
        expect(Number.isFinite(s.money) && s.money >= 0).toBe(true);
        s.apps.forEach((a) => expect(a.rating).toBeGreaterThanOrEqual(1));
      });
    }
  });
  it('스케줄러: 시간이 되면 사건(최대 3개)과 분위기 기록', () => {
    const s = E.newGame(T0);
    const r = scheduler(s, T0 + 60_000, seq(0.1, 0.2, 0.3));
    expect(r.event).toBeTruthy();
    expect(r.flavor).toBeTruthy();
    s.pending.push({ id: 'x1', key: 'a' }, { id: 'x2', key: 'b' });
    s.nextEventAt = 0;
    scheduler(s, T0 + 999_999, seq(0.5));
    expect(s.pending.length).toBeLessThanOrEqual(3);
  });
});

describe('저장본 검사', () => {
  it('버전이 다르거나 깨진 값은 걸러 낸다', () => {
    expect(sanitize({ v: 99 })).toBeNull();
    const s = sanitize({ v: 1, money: -5, apps: [{ index: 0, name: 'x', users: 'a', rating: 3 }, { index: 0, name: '할 일 앱', users: 10, rating: 4 }], office: 99, upgrades: [] }, T0);
    expect(s.money).toBe(0);
    expect(s.apps).toHaveLength(1);
    expect(s.office).toBe(5);
    expect(s.upgrades).toEqual({});
  });
});
