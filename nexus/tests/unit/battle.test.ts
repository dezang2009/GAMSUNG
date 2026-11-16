import { describe, it, expect } from 'vitest';
import { Data } from '../../src/core/data';
import * as Bt from '../../src/systems/battle';

const P = (...ids: (string | null)[]) => ids.map((s) => (s ? { species: s, level: 1 } : null));
const E = (...ids: string[]) => ids.map((s) => ({ species: s, level: 1 }));

describe('전투: 편성·라운드·행동 순서', () => {
  it('앞 3 출전 · 뒤 2 대기, 앞자리가 비면 대기에서 채움', () => {
    const b = Bt.createBattle(P('sp_01', 'sp_02', 'sp_03', 'sp_04', 'sp_05'), E('sp_13'), 1);
    expect(b.active).toEqual(['a0', 'a1', 'a2']);
    expect(b.reserve).toEqual(['a3', 'a4']);
    const c = Bt.createBattle(P(null, 'sp_02', null, 'sp_04', null), E('sp_13'), 1);
    expect(c.active).toEqual(['a1', 'a3']);
    expect(() => Bt.createBattle(P(null, null, null, null, null), E('sp_13'), 1)).toThrow();
  });
  it('라운드마다 속도순, 같은 속도면 아군 먼저', () => {
    const b = Bt.createBattle(P('sp_01', 'sp_02', 'sp_03'), E('sp_13', 'sp_14'), 1);
    const spd = (id: string) => b.units[id].stats.spd;
    for (let i = 1; i < b.queue.length; i++) expect(spd(b.queue[i - 1])).toBeGreaterThanOrEqual(spd(b.queue[i]));
    const t = Bt.createBattle(P('sp_01'), E('sp_01'), 1); // 같은 종 = 같은 속도
    expect(t.queue).toEqual(['a0', 'e0']);
    expect(b.log[0]).toMatchObject({ t: 'round', round: 1 });
  });
  it('모두 한 번씩 행동하면 다음 라운드', () => {
    const b = Bt.createBattle(P('sp_01', 'sp_02', 'sp_03'), E('sp_13', 'sp_14', 'sp_02'), 3);
    const n = b.queue.length;
    for (let i = 0; i < n; i++) Bt.act(b, Bt.autoAction(b));
    expect(b.round).toBe(2);
  });
});

describe('전투: 행동', () => {
  const fresh = () => Bt.createBattle(P('sp_01', 'sp_02', 'sp_03', 'sp_04'), E('sp_13', 'sp_14'), 7);
  const toAlly = (b: Bt.BattleState) => {
    while (Bt.current(b)!.side !== 'ally') Bt.act(b, Bt.autoAction(b));
    return Bt.current(b)!;
  };
  it('기본 공격: 데미지 + 에너지', () => {
    const b = fresh();
    const u = toAlly(b);
    const before = u.energy;
    const tgt = Bt.livingEnemies(b)[0];
    const hp = tgt.hp;
    const ev = Bt.act(b, { type: 'basic', target: tgt.id });
    expect(tgt.hp).toBeLessThan(hp);
    expect(u.energy).toBe(Math.min(Data.balance.energy.max, before + Data.balance.energy.basic_attack));
    expect(ev.some((e) => e.t === 'damage')).toBe(true);
  });
  it('스킬: 에너지 부족·재사용 대기 검사, 쓰면 소모', () => {
    const b = fresh();
    const u = toAlly(b);
    const sk = Bt.skillsOf(u).find((s) => s.kind === 'skill')!;
    u.energy = sk.cost - 1;
    expect(Bt.canUse(b, u, { type: 'skill', skill: sk.id })).toContain('에너지');
    u.energy = sk.cost + 5;
    Bt.act(b, { type: 'skill', skill: sk.id, target: Bt.livingEnemies(b)[0]?.id ?? Bt.livingActive(b)[0].id });
    expect(u.energy).toBe(5);
    expect(u.cooldowns[sk.id]).toBe(sk.cooldown);
    expect(Bt.canUse(b, u, { type: 'skill', skill: sk.id })).toContain('라운드 뒤');
  });
  it('궁극기: 에너지 가득일 때만, 쓰면 0', () => {
    const b = fresh();
    const u = toAlly(b);
    const ult = Bt.skillsOf(u).find((s) => s.kind === 'ultimate')!;
    expect(Bt.canUse(b, u, { type: 'ultimate', skill: ult.id })).toContain('가득');
    u.energy = Data.balance.energy.max;
    Bt.act(b, { type: 'ultimate', skill: ult.id, target: Bt.livingEnemies(b)[0].id });
    expect(u.energy).toBe(0);
  });
  it('교체: 차례를 쓰고 대기 개체와 자리 바꿈', () => {
    const b = fresh();
    const u = toAlly(b);
    const ev = Bt.act(b, { type: 'swap', swapWith: 'a3' });
    expect(b.active).toContain('a3');
    expect(b.reserve).toContain(u.id);
    expect(ev.find((e) => e.t === 'swap')).toMatchObject({ out: u.id, in: 'a3', reason: 'manual' });
    expect(Bt.canUse(Bt.createBattle(P('sp_01'), E('sp_13'), 1), Bt.createBattle(P('sp_01'), E('sp_13'), 1).units.a0, { type: 'swap' })).toContain('대기');
  });
  it('출전 개체가 쓰러지면 대기 개체가 자동으로 나와요', () => {
    const b = fresh();
    b.units.a0.hp = 1;
    b.units.a0.stats.def = 1;
    let guard = 0;
    while (b.units.a0.hp > 0 && guard++ < 200) Bt.act(b, Bt.autoAction(b));
    expect(b.active).toContain('a3');
    expect(b.log.some((e) => e.t === 'swap' && e.reason === 'faint')).toBe(true);
  });
  it('회복·버프·디버프 (모든 스킬 효과)', () => {
    for (const sk of Data.all('skills')) {
      const b = Bt.createBattle(P('sp_01', 'sp_02', 'sp_03'), E('sp_13', 'sp_14'), 11);
      const u = toAlly(b);
      (Data.get('species', u.species)!.skills as string[]).splice(0, 0); // 데이터 그대로
      const fake = { ...u, species: u.species };
      // 이 스킬을 가진 종으로 바꿔 끼워 실행
      const owner = Data.all('species').find((s) => s.skills.includes(sk.id))!;
      Object.assign(b.units[u.id], { species: owner.id });
      b.units[u.id].energy = Data.balance.energy.max;
      b.units[u.id].cooldowns = {};
      if (sk.effect === 'heal') b.units.a1.hp = 10;
      const ev = Bt.act(b, { type: sk.kind === 'ultimate' ? 'ultimate' : 'skill', skill: sk.id, target: sk.target === 'ally' ? 'a1' : Bt.livingEnemies(b)[0].id });
      const kinds = ev.map((e) => e.t);
      if (sk.effect === 'damage') expect(kinds, sk.id).toContain('damage');
      if (sk.effect === 'heal') expect(kinds, sk.id).toContain('heal');
      if (sk.effect === 'buff' || sk.effect === 'debuff') expect(kinds, sk.id).toContain('buff');
      expect(fake).toBeTruthy();
    }
  });
  it('버프는 라운드가 지나면 사라져요', () => {
    const b = fresh();
    const u = b.units.a0;
    u.buffs.push({ stat: 'atk', amount: 0.5, turns: 1 });
    expect(Bt.stat(u, 'atk')).toBeCloseTo(u.stats.atk * 1.5);
    const r = b.round;
    while (b.round === r) Bt.act(b, Bt.autoAction(b));
    expect(u.buffs.some((x) => x.stat === 'atk' && x.amount === 0.5)).toBe(false);
  });
});

describe('전투: 승패·재현', () => {
  it('같은 씨앗이면 같은 전투', () => {
    const run = (seed: number) => Bt.runAuto(Bt.createBattle(P('sp_01', 'sp_02', 'sp_03'), E('sp_13', 'sp_14', 'sp_02'), seed)).log;
    expect(run(42)).toEqual(run(42));
  });
  it('최대 라운드를 넘기면 패배', () => {
    const b = Bt.createBattle(P('sp_04'), E('sp_04'), 1);
    for (const u of Object.values(b.units)) (u.stats.atk = 1), (u.hp = u.maxHp = 9999);
    Bt.runAuto(b, undefined, 100000);
    expect(b.result).toBe('lose');
    expect(b.round).toBe(Data.balance.rounds.max + 1);
  });
  it('훈련 전투: 시작 개체 3종 자동 전투로 이길 수 있어요 (200판)', () => {
    const st = Data.get('stages', 'training_01')!;
    let wins = 0;
    for (let i = 0; i < 200; i++) if (Bt.runAuto(Bt.createBattle(P('sp_01', 'sp_02', 'sp_03'), st.enemies, i)).result === 'win') wins++;
    expect(wins).toBeGreaterThan(150);
  });
  it('어떤 조합이든 전투가 끝나요 (무작위 조합 300판)', () => {
    const ids = Data.all('species').map((s) => s.id);
    for (let i = 0; i < 300; i++) {
      const pick = (n: number) => Array.from({ length: n }, (_, k) => ids[(i * 7 + k * 13) % ids.length]);
      const b = Bt.runAuto(Bt.createBattle(P(...pick(5)), E(...pick(1 + (i % 5))), i));
      expect(b.result).not.toBeNull();
    }
  });
});
