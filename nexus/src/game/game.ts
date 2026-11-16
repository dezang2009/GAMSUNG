/**
 * Game — 진행 상태(저장 대상) 하나와 그 상태를 바꾸는 명령들.
 * 화면은 state 를 읽기만 하고, 바꿀 땐 여기 명령을 불러요. 바뀌면 'change' 로 알리고 곧 자동 저장해요.
 *
 * state:
 *   meta { created_at, updated_at, content_version } · resources { id: 양 } · seed
 *   collection { owned[], seen{}, research{}, party[5] (앞 3 출전 · 뒤 2 대기, 빈칸 ''), next_uid }
 *   planets { id: { cleared{}, env{}, facilities[], placed{} } } · current_planet
 *   exploration { surveys{} } · research { done{}, active } · battles { played, wins, losses } · log[]
 */
import { Data, isUnlocked, type Item } from '../core/data';
import * as Save from '../core/save';
import { randomSeed } from '../core/rng';
import * as C from '../systems/collection';
import * as X from '../systems/exploration';
import * as Bt from '../systems/battle';

const LOG_MAX = 200;
type Listener = (reason: string) => void;

class GameStore {
  state: any = null;
  settings = Save.loadSettings();
  saveError = '';
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  now: () => number = () => Date.now();

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(reason: string) {
    for (const fn of this.listeners) fn(reason);
  }
  has() {
    return !!this.state;
  }

  newGame() {
    const now = this.now();
    const planets: Record<string, any> = {};
    const sorted = [...Data.all('planets')].sort((a, b) => a.order - b.order);
    for (const p of sorted) planets[p.id] = { cleared: {}, env: {}, facilities: [], placed: {} };
    this.state = {
      meta: { created_at: now, updated_at: now, content_version: Data.meta.content_version ?? 1 },
      resources: Object.fromEntries(Data.all('resources').map((r) => [r.id, r.start])),
      collection: { owned: [], seen: {}, research: {}, party: ['', '', '', '', ''], next_uid: 1 },
      planets,
      current_planet: sorted[0]?.id ?? '',
      exploration: { surveys: {} },
      research: { done: {}, active: null },
      battles: { played: 0, wins: 0, losses: 0 },
      log: [],
      seed: randomSeed(),
    };
    this.log('base', '탐사 기지를 열었어요. 첫 행성 탐사를 시작해요.');
    const names: string[] = [];
    for (const sid of Data.meta.starting_creatures ?? []) {
      const r = C.acquire(this.state, sid, 'start', '', now);
      if (r.kind === 'new') {
        names.push(Data.get('species', sid)!.name);
        const i = this.state.collection.party.indexOf('');
        if (i >= 0) this.state.collection.party[i] = r.uid;
      }
    }
    if (names.length) this.log('creature', `함께 출발한 개체: ${names.join(', ')}`);
    this.changed('new_game');
  }

  async load(): Promise<{ data?: any; empty?: boolean; recovered?: boolean; error?: string }> {
    const r = await Save.load(this.now());
    if (r.data) {
      this.state = r.data;
      this.sync();
      this.emit('load');
    }
    return r;
  }

  importText(text: string): { ok?: true; error?: string } {
    const r = Save.parseText(text);
    if (r.error) return { error: r.error };
    this.state = r.data;
    this.sync();
    this.changed('import');
    return { ok: true };
  }
  exportText() {
    return Save.exportText(this.state, this.now());
  }

  async reset() {
    if (this.timer) clearTimeout(this.timer);
    await this.saving;
    await Save.clear();
    this.state = null;
    this.emit('reset');
  }

  /** 설정 파일에 새 자원·행성이 생겼으면 빈 칸 채우기 */
  private sync() {
    const s = this.state;
    for (const r of Data.all('resources')) if (!(r.id in s.resources)) s.resources[r.id] = r.start;
    for (const p of Data.all('planets')) s.planets[p.id] ??= { cleared: {}, env: {}, facilities: [], placed: {} };
    if (!s.planets[s.current_planet]) s.current_planet = Object.keys(s.planets)[0];
    s.collection.party = (s.collection.party ?? []).concat(['', '', '', '', '']).slice(0, 5).map((u: string) => (u && C.creature(s, u) ? u : ''));
  }

  // ── 읽기 ──
  planetState(id = this.state.current_planet) {
    return this.state.planets[id] ?? { cleared: {} };
  }
  isUnlocked(r: Item) {
    return isUnlocked(r.unlock, this.planetState(r.planet).cleared);
  }
  isCleared(r: Item) {
    return !!this.planetState(r.planet).cleared[r.id];
  }
  regionState(r: Item): 'locked' | 'open' | 'cleared' {
    return this.isCleared(r) ? 'cleared' : this.isUnlocked(r) ? 'open' : 'locked';
  }
  progress(id = this.state.current_planet) {
    const rs = Data.regionsOf(id);
    return rs.length ? Object.keys(this.planetState(id).cleared).length / rs.length : 0;
  }

  // ── 명령 ──
  survey(regionId: string): { results?: X.SurveyResult[]; survey?: number; error?: string } {
    const r = Data.get('regions', regionId);
    if (!r) return { error: '알 수 없는 지역이에요' };
    const why = X.blockedReason(this.state, r, this.isUnlocked(r));
    if (why) return { error: why };
    const results = X.survey(this.state, r, this.now());
    const n = X.done(this.state, regionId);
    const parts = results
      .map((x) => {
        const nm = Data.get('species', x.species)!.name;
        return x.type === 'egg' ? (x.acquire!.kind === 'new' ? `${nm} 알 확보` : `${nm} 알 (중복 → 연구 데이터)`) : x.new ? `${nm} 첫 목격` : '';
      })
      .filter(Boolean);
    this.log('explore', `${r.name} ${n}차 조사${parts.length ? ' — ' + parts.join(', ') : ''}`);
    this.changed('survey');
    return { results, survey: n };
  }

  /** 편성 바꾸기: slot 자리에 uid (''면 비우기). 같은 개체가 다른 자리에 있으면 자리를 바꿔요 */
  setPartySlot(slot: number, uid: string) {
    const p: string[] = this.state.collection.party;
    const from = uid ? p.indexOf(uid) : -1;
    if (from >= 0) p[from] = p[slot];
    p[slot] = uid;
    this.changed('party');
  }
  partyReady(): string {
    const p: string[] = this.state.collection.party;
    return p.some((u) => u) ? '' : '편성된 개체가 없어요';
  }

  /** 전투 시작 (화면이 들고 진행) */
  startBattle(stageId: string): Bt.BattleState {
    const st = Data.get('stages', stageId);
    if (!st) throw new Error('알 수 없는 전투예요');
    const why = this.partyReady();
    if (why) throw new Error(why);
    const party = this.state.collection.party.map((uid: string) => {
      const c = uid ? C.creature(this.state, uid) : undefined;
      return c ? { species: c.species, level: c.level, uid: c.uid } : null;
    });
    return Bt.createBattle(party, st.enemies, (this.state.seed ^ (this.state.battles.played * 2654435761)) >>> 0);
  }

  /** 전투 결과 반영 (훈련 전투는 보상 없음 — 보상은 스테이지 단계에서) */
  finishBattle(stageId: string, b: Bt.BattleState) {
    const st = Data.get('stages', stageId)!;
    this.state.battles.played += 1;
    if (b.result === 'win') this.state.battles.wins += 1;
    else this.state.battles.losses += 1;
    this.log('battle', `${st.name} ${b.result === 'win' ? '승리' : '패배'} · ${b.round}라운드`);
    this.changed('battle');
  }

  log(kind: string, text: string) {
    this.state.log.unshift({ t: this.now(), kind, text });
    if (this.state.log.length > LOG_MAX) this.state.log.length = LOG_MAX;
  }

  setSettings(patch: Partial<ReturnType<typeof Save.loadSettings>>) {
    this.settings = { ...this.settings, ...patch };
    Save.saveSettings(this.settings);
    this.emit('settings');
  }

  // ── 저장 ──
  private changed(reason: string) {
    this.state.meta.updated_at = this.now();
    this.emit(reason);
    this.requestSave();
  }
  requestSave() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 400);
  }
  saveNow(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.state) return this.saving;
    const copy = structuredClone(this.state);
    this.saving = this.saving
      .then(() => Save.save(copy, this.now()))
      .then(() => {
        if (this.saveError) (this.saveError = ''), this.emit('saved');
      })
      .catch((e) => {
        this.saveError = String(e?.message ?? e);
        this.emit('save_error');
      });
    return this.saving;
  }
}

export const Game = new GameStore();
export type { GameStore };
