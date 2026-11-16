import { describe, it, expect } from 'vitest';
import { Data, Registry, DEFAULT_FILES, unreachableRegions, unobtainableSpecies, isUnlocked } from '../../src/core/data';

const clone = () => structuredClone(DEFAULT_FILES);

describe('설정 데이터', () => {
  it('실제 데이터 오류 없음', () => expect(Data.errors).toEqual([]));
  it('기본 속성 4종 확정 (열·생물·유체·광물), 상성은 미정 1배', () => {
    expect(Data.all('elements').map((e) => e.name)).toEqual(['열', '생물', '유체', '광물']);
    expect(Data.all('elements').every((e) => !e.placeholder)).toBe(true);
    expect(Data.affinity.placeholder).toBe(true);
    for (const a of ['heat', 'bio', 'fluid', 'mineral']) for (const d of ['heat', 'bio', 'fluid', 'mineral']) expect(Data.affinityMultiplier(a, d)).toBe(1);
  });
  it('미정 콘텐츠는 모두 임시 표시', () => {
    for (const t of ['rarities', 'roles', 'resources', 'planets', 'regions', 'species', 'skills', 'stages'] as const) for (const it of Data.all(t)) expect(it.placeholder, `${t} ${it.id}`).toBe(true);
  });
  it('잘못된 데이터를 정확히 짚어요', () => {
    const f = clone();
    delete f.resources;
    f.elements.items.push({ id: 'heat', name: '중복', color: '#123456' });
    f.elements.items[1].color = 'green';
    f.elements.items[2].extra = 1;
    f.elements.affinity = { default: 1, matrix: { heat: { water: 2 } } };
    f.regions.items[1].planet = 'planet_99';
    f.regions.items[2].unlock = { any: [{ type: 'teleport' }] };
    f.skills.items[0].power = -1;
    f.species.items[0].skills = ['nope'];
    f.stages.items[0].enemies = [{ species: 'sp_99', level: 0 }];
    f.balance.energy.max = 0;
    const r = new Registry(f);
    const all = r.errors.join('\n');
    for (const needle of ['resources.json: 파일이 없어요', "id 'heat' 가 두 번", "'color' 는 #rrggbb", "알 수 없는 칸 'extra'", 'planet_99', 'teleport', "방어 속성 'water'", 'damage 에는 양수 power', "skills' 가 가리키는 skills 'nope'", "적 개체 'sp_99'", 'balance.json: energy.max']) expect(all, needle).toContain(needle);
  });
  it('막다른 길·얻을 수 없는 개체 검사', () => {
    expect(unreachableRegions([{ id: 'a', name: '', unlock: { any: [{ type: 'start' }] } }, { id: 'b', name: '', unlock: { all: [{ type: 'region_cleared', region: 'c' }] } }, { id: 'c', name: '', unlock: { all: [{ type: 'region_cleared', region: 'b' }] } }])).toEqual(['b', 'c']);
    expect(unobtainableSpecies(Data.all('species'), Data.all('regions'), Data.meta.starting_creatures)).toEqual([]);
    expect(isUnlocked({ any: [{ type: 'region_cleared', region: 'x' }, { type: 'region_cleared', region: 'y' }] }, { y: true })).toBe(true);
    expect(isUnlocked({ all: [{ type: 'region_cleared', region: 'x' }, { type: 'region_cleared', region: 'y' }] }, { y: true })).toBe(false);
  });
});
