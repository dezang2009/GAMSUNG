/**
 * Data — 설정(콘텐츠) 데이터 읽기·검사·찾기.
 * 데이터는 src/data/*.json 에만 있어요. 이름·속성·수치를 바꿀 땐 코드가 아니라 그 파일을 고쳐요.
 * 시작할 때 형식을 검사해서 errors 에 모아요. 오류가 있으면 화면이 게임 대신 오류 목록을 보여 줘요.
 */
import metaJson from '../data/meta.json';
import elementsJson from '../data/elements.json';
import raritiesJson from '../data/rarities.json';
import rolesJson from '../data/roles.json';
import resourcesJson from '../data/resources.json';
import planetsJson from '../data/planets.json';
import regionsJson from '../data/regions.json';
import statsJson from '../data/stats.json';
import traitsJson from '../data/traits.json';
import ecoJson from '../data/eco_abilities.json';
import speciesJson from '../data/species.json';
import skillsJson from '../data/skills.json';
import stagesJson from '../data/stages.json';
import balanceJson from '../data/balance.json';

export type Item = Record<string, any> & { id: string; name: string; placeholder?: boolean };
export type RawFiles = Record<string, any>;

export const TABLES = ['elements', 'rarities', 'roles', 'resources', 'planets', 'regions', 'stats', 'traits', 'eco_abilities', 'skills', 'species', 'stages'] as const;
export type Table = (typeof TABLES)[number];

export const DEFAULT_FILES: RawFiles = {
  meta: metaJson,
  elements: elementsJson,
  rarities: raritiesJson,
  roles: rolesJson,
  resources: resourcesJson,
  planets: planetsJson,
  regions: regionsJson,
  stats: statsJson,
  traits: traitsJson,
  eco_abilities: ecoJson,
  skills: skillsJson,
  species: speciesJson,
  stages: stagesJson,
  balance: balanceJson,
};

/** 칸 형식: id · string · int · number · bool · color · array · dict · vec2 · ref:표 · array<ref:표> · 끝에 ? = 생략 가능 */
const SCHEMAS: Record<Table, Record<string, string>> = {
  elements: { id: 'id', name: 'string', color: 'color', placeholder: 'bool?' },
  rarities: { id: 'id', name: 'string', tier: 'int', color: 'color', placeholder: 'bool?' },
  roles: { id: 'id', name: 'string', placeholder: 'bool?' },
  resources: { id: 'id', name: 'string', color: 'color', start: 'int', placeholder: 'bool?' },
  planets: { id: 'id', name: 'string', order: 'int', palette: 'array', placeholder: 'bool?' },
  regions: { id: 'id', planet: 'ref:planets', name: 'string', map: 'vec2', unlock: 'dict', surveys: 'int?', encounters: 'array?', placeholder: 'bool?' },
  stats: { id: 'id', name: 'string', placeholder: 'bool?' },
  traits: { id: 'id', name: 'string', desc: 'string', placeholder: 'bool?' },
  eco_abilities: { id: 'id', name: 'string', element: 'ref:elements', desc: 'string', placeholder: 'bool?' },
  skills: { id: 'id', name: 'string', kind: 'string', effect: 'string', target: 'string', power: 'number?', stat: 'ref:stats?', amount: 'number?', turns: 'int?', cost: 'int?', cooldown: 'int?', placeholder: 'bool?' },
  species: { id: 'id', name: 'string', rarity: 'ref:rarities', element: 'ref:elements', role: 'ref:roles', base_stats: 'dict', skills: 'array<ref:skills>', evolution: 'dict', traits: 'array<ref:traits>', eco_abilities: 'array<ref:eco_abilities>', art: 'path?', placeholder: 'bool?' },
  stages: { id: 'id', name: 'string', type: 'string', enemies: 'array', placeholder: 'bool?' },
};

export const UNLOCK_TYPES: Record<string, Record<string, string>> = { start: {}, region_cleared: { region: 'ref:regions' } };
export const ENCOUNTER_METHODS = ['wild', 'egg'];
export const SKILL_KINDS = ['skill', 'ultimate'];
export const SKILL_EFFECTS = ['damage', 'heal', 'buff', 'debuff'];
export const SKILL_TARGETS = ['enemy', 'enemy_all', 'ally', 'ally_all', 'self'];
export const STAGE_TYPES = ['training', 'normal', 'boss'];

const ID = /^[a-z][a-z0-9_]*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

export class Registry {
  meta: Record<string, any> = {};
  balance: Record<string, any> = {};
  affinity: Record<string, any> = { default: 1, matrix: {} };
  lists = {} as Record<Table, Item[]>;
  index = {} as Record<Table, Record<string, Item>>;
  errors: string[] = [];

  constructor(files: RawFiles = DEFAULT_FILES) {
    this.load(files);
  }

  load(files: RawFiles): number {
    const errs: string[] = (this.errors = []);
    this.meta = isObj(files.meta) ? files.meta : (errs.push('meta.json: 파일이 없어요'), {});
    this.balance = isObj(files.balance) ? files.balance : (errs.push('balance.json: 파일이 없어요'), {});
    for (const t of TABLES) {
      const raw = files[t];
      if (!isObj(raw)) {
        errs.push(`${t}.json: 파일이 없어요`);
        this.lists[t] = [];
        continue;
      }
      if (raw.schema !== t) errs.push(`${t}.json: schema 가 '${t}' 여야 해요`);
      if (!Array.isArray(raw.items)) errs.push(`${t}.json: items 목록이 없어요`);
      this.lists[t] = Array.isArray(raw.items) ? raw.items : [];
      if (t === 'elements') this.affinity = raw.affinity ?? { default: 1, matrix: {} };
    }
    for (const t of TABLES) {
      this.index[t] = {};
      for (const it of this.lists[t]) {
        if (!isObj(it) || typeof it.id !== 'string') continue;
        if (this.index[t][it.id]) errs.push(`${t}.json: id '${it.id}' 가 두 번 나와요`);
        this.index[t][it.id] = it as Item;
      }
    }
    for (const t of TABLES) this.lists[t].forEach((it, i) => errs.push(...this.checkItem(t, i, it)));
    for (const r of this.lists.regions) if (isObj(r)) errs.push(...this.checkUnlock(r), ...this.checkEncounters(r));
    for (const s of this.lists.species) if (isObj(s)) errs.push(...this.checkSpecies(s));
    for (const s of this.lists.skills) if (isObj(s)) errs.push(...this.checkSkill(s));
    for (const s of this.lists.stages) if (isObj(s)) errs.push(...this.checkStage(s));
    for (const s of this.meta.starting_creatures ?? []) if (!this.index.species[s]) errs.push(`meta.json: 시작 개체 '${s}' 가 species.json 에 없어요`);
    this.checkResearch();
    this.checkAffinity();
    this.checkBalance();
    if (errs.length === 0) {
      for (const id of unobtainableSpecies(this.lists.species, this.lists.regions, this.meta.starting_creatures ?? [])) errs.push(`species.json '${id}': 얻을 수 있는 경로가 없어요 (시작 개체·조사·진화 어디에도 없음)`);
      for (const id of unreachableRegions(this.lists.regions)) errs.push(`regions.json '${id}': 어떤 경로로도 열 수 없어요 (막다른 길)`);
    }
    return errs.length;
  }

  private checkValue(v: any, kind: string): string {
    switch (kind) {
      case 'id':
        return typeof v === 'string' && ID.test(v) ? '' : '는 영문 소문자·숫자·_ 로 된 id 여야 해요';
      case 'string':
        return typeof v === 'string' && v.trim() !== '' ? '' : '는 비어 있지 않은 글자여야 해요';
      case 'int':
        return isNum(v) && Number.isInteger(v) ? '' : '는 정수여야 해요';
      case 'number':
        return isNum(v) ? '' : '는 숫자여야 해요';
      case 'bool':
        return typeof v === 'boolean' ? '' : '는 true/false 여야 해요';
      case 'color':
        return typeof v === 'string' && COLOR.test(v) ? '' : '는 #rrggbb 색이어야 해요';
      case 'array':
        return Array.isArray(v) ? '' : '는 목록이어야 해요';
      case 'path': // 최종 그림 경로 (비어 있으면 임시 그림)
        return typeof v === 'string' ? '' : '는 글자여야 해요';
      case 'dict':
        return isObj(v) ? '' : '는 객체여야 해요';
      case 'vec2':
        return Array.isArray(v) && v.length === 2 && v.every((n) => isNum(n) && n >= 0 && n <= 1) ? '' : '는 0~1 사이 [x, y] 여야 해요';
    }
    if (kind.startsWith('ref:')) return this.checkRef(v, kind.slice(4) as Table);
    if (kind.startsWith('array<ref:')) {
      if (!Array.isArray(v)) return '는 목록이어야 해요';
      for (const x of v) {
        const m = this.checkRef(x, kind.slice(10, -1) as Table);
        if (m) return m;
      }
      return '';
    }
    return `의 형식(${kind})을 알 수 없어요`;
  }

  private checkRef(v: any, table: Table): string {
    if (typeof v !== 'string') return `는 ${table} 의 id 여야 해요`;
    return this.index[table]?.[v] ? '' : `가 가리키는 ${table} '${v}' 가 없어요`;
  }

  checkItem(t: Table, i: number, it: any): string[] {
    const errs: string[] = [];
    if (!isObj(it)) return [`${t}.json [${i}]: 항목이 객체가 아니에요`];
    const where = `${t}.json '${it.id ?? i}'`;
    const schema = SCHEMAS[t];
    for (const [field, k] of Object.entries(schema)) {
      const optional = k.endsWith('?');
      const kind = k.replace(/\?$/, '');
      if (!(field in it)) {
        if (!optional) errs.push(`${where}: '${field}' 칸이 없어요`);
        continue;
      }
      const m = this.checkValue(it[field], kind);
      if (m) errs.push(`${where}: '${field}' ${m}`);
    }
    for (const field of Object.keys(it)) if (!(field in schema)) errs.push(`${where}: 알 수 없는 칸 '${field}'`);
    return errs;
  }

  checkUnlock(r: Record<string, any>): string[] {
    const where = `regions.json '${r.id}': unlock`;
    const u = r.unlock;
    if (!isObj(u)) return [];
    const keys = Object.keys(u);
    if (keys.length !== 1 || !['any', 'all'].includes(keys[0]) || !Array.isArray(u[keys[0]]) || u[keys[0]].length === 0) return [`${where} 는 { any: [...] } 또는 { all: [...] } 하나여야 해요`];
    const errs: string[] = [];
    for (const c of u[keys[0]]) {
      if (!isObj(c) || !UNLOCK_TYPES[c.type]) {
        errs.push(`${where}: 알 수 없는 조건 ${JSON.stringify(c)}`);
        continue;
      }
      for (const [f, kind] of Object.entries(UNLOCK_TYPES[c.type])) {
        const m = f in c ? this.checkValue(c[f], kind) : '칸이 없어요';
        if (m) errs.push(`${where}: 조건 ${c.type} 의 '${f}' ${m}`);
        else if (c.type === 'region_cleared' && c[f] === r.id) errs.push(`${where}: 자기 자신을 조건으로 쓸 수 없어요`);
      }
    }
    return errs;
  }

  checkEncounters(r: Record<string, any>): string[] {
    const errs: string[] = [];
    const where = `regions.json '${r.id}'`;
    const n = r.surveys ?? 0;
    for (const e of r.encounters ?? []) {
      if (!isObj(e)) {
        errs.push(`${where}: encounters 항목이 객체가 아니에요`);
        continue;
      }
      if (!this.index.species[e.species]) errs.push(`${where}: 만남 개체 '${e.species}' 가 없어요`);
      if (!ENCOUNTER_METHODS.includes(e.method)) errs.push(`${where}: 만남 방법 '${e.method}' 를 알 수 없어요 (${ENCOUNTER_METHODS.join(', ')})`);
      if (!isNum(e.weight) || e.weight <= 0) errs.push(`${where}: 만남 weight 는 양수여야 해요`);
      if (!isNum(e.from_survey) || e.from_survey < 1 || e.from_survey > n) errs.push(`${where}: from_survey 는 1~${n} 사이여야 해요`);
    }
    if (r.encounters && n < 1) errs.push(`${where}: encounters 가 있으면 surveys 가 1 이상이어야 해요`);
    return errs;
  }

  checkSpecies(sp: Record<string, any>): string[] {
    const errs: string[] = [];
    const where = `species.json '${sp.id}'`;
    const bs = sp.base_stats;
    if (isObj(bs)) {
      for (const k of Object.keys(this.index.stats)) if (!(k in bs)) errs.push(`${where}: base_stats 에 '${k}' 가 없어요`);
      for (const [k, v] of Object.entries(bs)) {
        if (!this.index.stats[k]) errs.push(`${where}: base_stats 의 '${k}' 는 stats.json 에 없는 능력치예요`);
        else if (!isNum(v) || v <= 0 || !Number.isInteger(v)) errs.push(`${where}: base_stats.${k} 는 양의 정수여야 해요`);
      }
    }
    const skills = (sp.skills ?? []).map((id: string) => this.index.skills[id]).filter(Boolean);
    if (Array.isArray(sp.skills) && skills.filter((s: Item) => s.kind === 'ultimate').length > 1) errs.push(`${where}: 궁극기는 하나만 둘 수 있어요`);
    const ev = sp.evolution;
    if (!isObj(ev)) return errs;
    if (typeof ev.line !== 'string' || !isNum(ev.stage) || ev.stage < 1) return [...errs, `${where}: evolution 에 line(글자)·stage(1 이상)가 필요해요`];
    if (!Array.isArray(ev.next ?? [])) return [...errs, `${where}: evolution.next 는 목록이어야 해요`];
    for (const n of ev.next ?? []) {
      const tgt = this.index.species[n?.to];
      if (!tgt) {
        errs.push(`${where}: 진화 대상 '${n?.to}' 가 없어요`);
        continue;
      }
      if (tgt.evolution?.stage !== ev.stage + 1) errs.push(`${where}: 진화 대상 '${n.to}' 의 단계가 ${ev.stage + 1} 이어야 해요`);
    }
    return errs;
  }

  checkSkill(s: Record<string, any>): string[] {
    const errs: string[] = [];
    const where = `skills.json '${s.id}'`;
    if (!SKILL_KINDS.includes(s.kind)) errs.push(`${where}: kind 는 ${SKILL_KINDS.join('·')} 중 하나`);
    if (!SKILL_EFFECTS.includes(s.effect)) errs.push(`${where}: effect 는 ${SKILL_EFFECTS.join('·')} 중 하나`);
    if (!SKILL_TARGETS.includes(s.target)) errs.push(`${where}: target 은 ${SKILL_TARGETS.join('·')} 중 하나`);
    if ((s.effect === 'damage' || s.effect === 'heal') && !(isNum(s.power) && s.power > 0)) errs.push(`${where}: ${s.effect} 에는 양수 power 가 필요해요`);
    if ((s.effect === 'buff' || s.effect === 'debuff') && !(s.stat && isNum(s.amount) && s.amount > 0 && isNum(s.turns) && s.turns > 0)) errs.push(`${where}: ${s.effect} 에는 stat·amount·turns 가 필요해요`);
    if (s.kind === 'skill' && !(isNum(s.cost) && s.cost >= 0 && isNum(s.cooldown) && s.cooldown >= 0)) errs.push(`${where}: 스킬에는 cost·cooldown 이 필요해요`);
    if (s.effect === 'damage' && s.target.startsWith('ally')) errs.push(`${where}: 데미지 스킬은 적을 대상으로 해요`);
    if (s.effect === 'heal' && s.target.startsWith('enemy')) errs.push(`${where}: 회복 스킬은 아군을 대상으로 해요`);
    return errs;
  }

  checkStage(s: Record<string, any>): string[] {
    const errs: string[] = [];
    const where = `stages.json '${s.id}'`;
    if (!STAGE_TYPES.includes(s.type)) errs.push(`${where}: type 은 ${STAGE_TYPES.join('·')} 중 하나`);
    if (!Array.isArray(s.enemies) || s.enemies.length === 0 || s.enemies.length > 5) errs.push(`${where}: enemies 는 1~5 마리`);
    for (const e of s.enemies ?? []) {
      if (!this.index.species[e?.species]) errs.push(`${where}: 적 개체 '${e?.species}' 가 없어요`);
      if (!(isNum(e?.level) && e.level >= 1)) errs.push(`${where}: 적 level 은 1 이상`);
    }
    return errs;
  }

  private checkResearch() {
    const r = this.meta.research;
    if (!isObj(r) || !Array.isArray(r.levels) || r.levels.length === 0) return this.errors.push('meta.json: research.levels 목록이 필요해요');
    let prev = 0;
    for (const x of r.levels) {
      if (!isNum(x) || x <= prev) return this.errors.push('meta.json: research.levels 는 커지는 양수여야 해요');
      prev = x;
    }
    for (const k of ['sighting', 'duplicate', 'owned']) if (!isNum(r[k]) || r[k] < 0) this.errors.push(`meta.json: research.${k} 는 0 이상 숫자여야 해요`);
  }

  private checkAffinity() {
    if (!isNum(this.affinity.default)) this.errors.push('elements.json: affinity.default 는 숫자여야 해요');
    const m = this.affinity.matrix ?? {};
    if (!isObj(m)) return this.errors.push('elements.json: affinity.matrix 는 객체여야 해요');
    for (const [atk, row] of Object.entries(m)) {
      if (!this.index.elements[atk]) {
        this.errors.push(`elements.json: 상성표의 공격 속성 '${atk}' 가 없어요`);
        continue;
      }
      for (const [def, v] of Object.entries(row as Record<string, any>)) {
        if (!this.index.elements[def]) this.errors.push(`elements.json: 상성표의 방어 속성 '${def}' 가 없어요`);
        else if (!isNum(v)) this.errors.push(`elements.json: 상성 ${atk}→${def} 는 숫자여야 해요`);
      }
    }
  }

  private checkBalance() {
    const b = this.balance;
    const need: [string, (v: any) => boolean][] = [
      ['party.active', (v) => isNum(v) && v >= 1],
      ['party.reserve', (v) => isNum(v) && v >= 0],
      ['damage.basic_power', (v) => isNum(v) && v > 0],
      ['damage.defense_weight', (v) => isNum(v) && v >= 0],
      ['damage.variance', (v) => isNum(v) && v >= 0 && v < 1],
      ['damage.minimum', (v) => isNum(v) && v >= 0],
      ['energy.max', (v) => isNum(v) && v > 0],
      ['energy.start', isNum],
      ['energy.basic_attack', isNum],
      ['energy.hit_taken', isNum],
      ['energy.round_start', isNum],
      ['rounds.max', (v) => isNum(v) && v >= 1],
      ['ai.heal_below', (v) => isNum(v) && v > 0 && v < 1],
    ];
    for (const [path, ok] of need) {
      const v = path.split('.').reduce((o: any, k) => o?.[k], b);
      if (!ok(v)) this.errors.push(`balance.json: ${path} 값이 올바르지 않아요`);
    }
  }

  // ── 찾기 ──
  all(t: Table): Item[] {
    return this.lists[t] ?? [];
  }
  get(t: Table, id: string): Item | undefined {
    return this.index[t]?.[id];
  }
  affinityMultiplier(attack: string, defend: string): number {
    return this.affinity.matrix?.[attack]?.[defend] ?? this.affinity.default ?? 1;
  }
  regionsOf(planetId: string): Item[] {
    return this.all('regions').filter((r) => r.planet === planetId);
  }
  research(): { levels: number[]; sighting: number; duplicate: number; owned: number } {
    return this.meta.research;
  }
  placeholderCount(): number {
    return TABLES.reduce((n, t) => n + this.all(t).filter((x) => x.placeholder).length, 0);
  }
}

/** 지역 해금 조건 평가 (cleared: 개척한 지역 id 집합) */
export function isUnlocked(unlock: Record<string, any>, cleared: Record<string, boolean>): boolean {
  const mode = Object.keys(unlock)[0];
  const hits = unlock[mode].filter((c: any) => c.type === 'start' || (c.type === 'region_cleared' && cleared[c.region])).length;
  return mode === 'any' ? hits > 0 : hits === unlock[mode].length;
}

/** 처음부터 시작해 모든 지역을 언젠가 열 수 있는지 (막다른 길) */
export function unreachableRegions(regions: Item[]): string[] {
  const open: Record<string, boolean> = {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of regions) if (!open[r.id] && isUnlocked(r.unlock, open)) (open[r.id] = true), (changed = true);
  }
  return regions.filter((r) => !open[r.id]).map((r) => r.id);
}

/** 어떤 방법으로도 얻을 수 없는 개체 (시작 개체 · 조사 만남 · 얻을 수 있는 개체의 진화) */
export function unobtainableSpecies(species: Item[], regions: Item[], starters: string[]): string[] {
  const ok: Record<string, boolean> = {};
  for (const s of starters) ok[s] = true;
  for (const r of regions) for (const e of r.encounters ?? []) ok[e.species] = true;
  let changed = true;
  while (changed) {
    changed = false;
    for (const sp of species) if (ok[sp.id]) for (const n of sp.evolution?.next ?? []) if (!ok[n.to]) (ok[n.to] = true), (changed = true);
  }
  return species.filter((s) => !ok[s.id]).map((s) => s.id);
}

/** 앱 전체가 쓰는 하나 */
export const Data = new Registry();
