/**
 * Save — 진행 저장 (IndexedDB, 없으면 localStorage).
 *  - 저장 형식: { app, version, saved_at, data }
 *  - 'main' 에 쓸 때 이전 저장본을 'main-prev' 로 옮겨 둬요. 최신이 깨졌으면 직전 저장본으로 이어가요.
 *  - 읽을 때 version 을 보고 MIGRATIONS 로 최신 구조까지 올려요. 구조가 바뀌면 VERSION 을 올리고 변환 함수를 더해요.
 *  - 설정(화면 모드 등)은 localStorage 'nexus:settings'.
 */
export const APP = 'nexus';
export const VERSION = 1;
const DB = 'nexus';
const STORE = 'saves';
const LS = 'nexus:save:';
const SETTINGS = 'nexus:settings';

/** 버전 n → n+1 변환 */
export const MIGRATIONS: Record<number, (d: any) => any> = {};

export function migrate(data: any, from: number): any {
  let v = from;
  let d = data;
  if (v > VERSION) throw new Error(`이 앱보다 새 버전(${v})의 저장 데이터예요`);
  while (v < VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`저장 버전 ${v} 을(를) 올릴 방법이 없어요`);
    d = step(structuredClone(d));
    v += 1;
  }
  return d;
}

/** 꼭 있어야 하는 칸 (빈 글자면 정상) */
export function validate(d: any): string {
  if (!d || typeof d !== 'object') return '저장 데이터가 아니에요';
  for (const k of ['meta', 'resources', 'collection', 'planets', 'exploration', 'research', 'log', 'seed', 'battles']) if (!(k in d)) return `'${k}' 칸이 없어요`;
  if (!Array.isArray(d.collection.owned) || !Array.isArray(d.collection.party)) return '개체 데이터가 올바르지 않아요';
  return '';
}

/** 저장 글자 → { data } | { error } (내보내기 글자도 같은 형식) */
export function parseText(text: string): { data?: any; error?: string; saved_at?: number } {
  let obj: any;
  try {
    obj = JSON.parse(String(text).trim());
  } catch {
    return { error: '저장 데이터 형식이 아니에요' };
  }
  if (obj?.app !== APP || typeof obj.data !== 'object') return { error: 'NEXUS 저장 데이터가 아니에요' };
  try {
    const d = migrate(obj.data, obj.version ?? 1);
    const why = validate(d);
    return why ? { error: why } : { data: d, saved_at: obj.saved_at };
  } catch (e: any) {
    return { error: String(e.message ?? e) };
  }
}

export const exportText = (data: any, now = Date.now()) => JSON.stringify({ app: APP, version: VERSION, saved_at: now, data });

// ── 저장소 ──
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = globalThis.indexedDB?.open(DB, 1);
      if (!req) return resolve(null);
      req.onupgradeneeded = () => req.result.objectStoreNames.contains(STORE) || req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}
export const _resetDbForTest = () => (dbp = null);

const ls = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

async function getRaw(key: string): Promise<string | null> {
  const d = await db();
  if (d)
    return new Promise((res, rej) => {
      const r = d.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => rej(r.error);
    });
  return ls()?.getItem(LS + key) ?? null;
}

async function putRaw(pairs: [string, string | null][]): Promise<void> {
  const d = await db();
  if (d)
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, 'readwrite');
      const s = t.objectStore(STORE);
      for (const [k, v] of pairs) v === null ? s.delete(k) : s.put(v, k);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error ?? new Error('저장이 중단됐어요'));
    });
  const store = ls();
  if (!store) throw new Error('이 기기에서 저장 공간을 쓸 수 없어요');
  for (const [k, v] of pairs) v === null ? store.removeItem(LS + k) : store.setItem(LS + k, v);
}

/** 저장 (직전 저장본은 main-prev 로, 한 번에) */
export async function save(data: any, now = Date.now()): Promise<void> {
  const prev = await getRaw('main');
  const text = exportText(data, now);
  await putRaw(prev ? [['main-prev', prev], ['main', text]] : [['main', text]]);
}

/** 불러오기 → { data } | { empty } | { data, recovered } | { error } (깨진 원본은 broken-시각 으로 보관) */
export async function load(now = Date.now()): Promise<{ data?: any; empty?: boolean; recovered?: boolean; error?: string }> {
  const main = await getRaw('main');
  if (main) {
    const r = parseText(main);
    if (r.data) return { data: r.data };
    await putRaw([[`broken-${now}`, main]]);
  }
  const prev = await getRaw('main-prev');
  if (prev) {
    const r = parseText(prev);
    if (r.data) return { data: r.data, recovered: true };
  }
  return main ? { error: '저장 데이터를 읽을 수 없어요 (원본은 따로 보관했어요)' } : { empty: true };
}

export async function hasSave(): Promise<boolean> {
  return !!(await getRaw('main')) || !!(await getRaw('main-prev'));
}

export async function clear(): Promise<void> {
  await putRaw([
    ['main', null],
    ['main-prev', null],
  ]);
}

export function loadSettings(): { theme: 'dark' | 'light'; speed: number; auto: boolean } {
  try {
    return { theme: 'dark', speed: 1, auto: false, ...JSON.parse(ls()?.getItem(SETTINGS) ?? '{}') };
  } catch {
    return { theme: 'dark', speed: 1, auto: false };
  }
}
export function saveSettings(s: object) {
  try {
    ls()?.setItem(SETTINGS, JSON.stringify(s));
  } catch {
    /* 설정 저장 실패는 게임 진행에 영향 없음 */
  }
}
