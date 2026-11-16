import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { Data } from '../../src/core/data';
import * as Save from '../../src/core/save';
import { Game } from '../../src/game/game';
import * as C from '../../src/systems/collection';
import * as X from '../../src/systems/exploration';
import * as Bt from '../../src/systems/battle';

beforeEach(async () => {
  Save._resetDbForTest();
  await Save.clear();
  Game.newGame();
  Game.state.seed = 12345;
});

describe('새 게임 · 편성', () => {
  it('시작 개체 3종이 출전 자리에', () => {
    expect(Game.state.collection.owned.map((c: any) => c.species)).toEqual(['sp_01', 'sp_02', 'sp_03']);
    expect(Game.state.collection.party).toEqual(['c1', 'c2', 'c3', '', '']);
  });
  it('자리 바꾸기·비우기', () => {
    Game.setPartySlot(3, 'c1');
    expect(Game.state.collection.party).toEqual(['', 'c2', 'c3', 'c1', '']);
    Game.setPartySlot(0, 'c1');
    expect(Game.state.collection.party).toEqual(['c1', 'c2', 'c3', '', '']);
    for (let i = 0; i < 5; i++) Game.setPartySlot(i, '');
    expect(Game.partyReady()).toContain('편성된 개체가 없어요');
    expect(() => Game.startBattle('training_01')).toThrow();
  });
  it('전투 시작·결과 기록 (훈련은 보상 없음)', () => {
    const res = { ...Game.state.resources };
    const b = Bt.runAuto(Game.startBattle('training_01'));
    Game.finishBattle('training_01', b);
    expect(Game.state.battles.played).toBe(1);
    expect(Game.state.battles.wins + Game.state.battles.losses).toBe(1);
    expect(Game.state.resources).toEqual(res);
    expect(Game.state.log[0].text).toContain('훈련 전투');
  });
});

describe('수집·조사 (Godot 판과 같은 규칙)', () => {
  it('중복 → 연구 데이터, 연구 단계', () => {
    const r = C.acquire(Game.state, 'sp_01', 'egg', '', 0);
    expect(r.kind).toBe('duplicate');
    expect(C.researchLevel(Game.state, 'sp_04')).toBe(0);
    C.see(Game.state, 'sp_04', 1);
    expect(C.status(Game.state, 'sp_04')).toBe('seen');
    C.acquire(Game.state, 'sp_04', 'egg', '', 2);
    expect(C.researchLevel(Game.state, 'sp_04')).toBe(C.researchMax());
  });
  it('조사: 잠긴 지역 불가 · 알 · 새 서식지 · 횟수 · 같은 씨앗 같은 결과', () => {
    expect(Game.survey('region_02').error).toContain('열리지 않은');
    const a = Game.survey('region_01');
    expect(a.results!.every((x) => x.type === 'sighting')).toBe(true);
    const b2 = Game.survey('region_01');
    expect(b2.results!.some((x) => x.type === 'egg' && x.species === 'sp_03' && x.acquire!.kind === 'duplicate')).toBe(true);
    expect(Game.survey('region_01').results!.some((x) => x.species === 'sp_05')).toBe(true);
    expect(Game.survey('region_01').error).toContain('모두 마쳤어요');
    const first = Game.state.collection.seen;
    Game.newGame();
    Game.state.seed = 12345;
    for (let i = 0; i < 3; i++) Game.survey('region_01');
    expect(Object.keys(Game.state.collection.seen).sort()).toEqual(Object.keys(first).sort());
    expect(X.done(Game.state, 'region_01')).toBe(3);
  });
});

describe('저장', () => {
  it('저장 → 불러오기, 직전 저장본, 깨진 저장 복구', async () => {
    Game.state.resources.res_a = 7;
    await Game.saveNow();
    Game.state.resources.res_a = 9;
    await Game.saveNow();
    const r = await Save.load();
    expect(r.data.resources.res_a).toBe(9);
    // 최신을 깨뜨리면 직전으로
    const db = await new Promise<IDBDatabase>((res) => {
      const q = indexedDB.open('nexus', 1);
      q.onsuccess = () => res(q.result);
    });
    await new Promise<void>((res) => {
      const t = db.transaction('saves', 'readwrite');
      t.objectStore('saves').put('{깨짐', 'main');
      t.oncomplete = () => res();
    });
    const r2 = await Save.load();
    expect(r2.recovered).toBe(true);
    expect(r2.data.resources.res_a).toBe(7);
  });
  it('버전·형식 검사, 내보내기·가져오기', () => {
    expect(Save.parseText(JSON.stringify({ app: 'nexus', version: Save.VERSION + 1, data: {} })).error).toContain('새 버전');
    expect(Save.parseText('hello').error).toContain('형식');
    expect(Save.parseText(JSON.stringify({ app: 'x', data: {} })).error).toContain('NEXUS');
    Game.state.resources.res_b = 5;
    const text = Game.exportText();
    Game.newGame();
    expect(Game.importText('엉뚱')).toHaveProperty('error');
    expect(Game.importText(text)).toEqual({ ok: true });
    expect(Game.state.resources.res_b).toBe(5);
  });
});

it('데이터 오류 없음 (회귀)', () => expect(Data.errors).toEqual([]));
