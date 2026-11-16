/**
 * SaveSystem — 진행 저장 (IndexedDB) · 설정 (localStorage).
 *
 * 저장 형식: { slot, version, savedAt, data }
 *  - 'main' 에 저장할 때 이전 저장본을 'main-prev' 로 옮겨 둬요 (한 번 되돌릴 수 있게).
 *  - 읽을 때 version 을 보고 MIGRATIONS 로 최신 구조까지 올려요. 다음 PHASE 에서 새 시스템이 추가되면
 *    SAVE_VERSION 을 올리고 MIGRATIONS[이전 버전] 에 기본값을 채우는 함수를 더해요.
 *  - IndexedDB 를 못 쓰는 환경이면 localStorage 로 대신 저장해요.
 */
import { MIGRATIONS } from './migrations.js';

export const SAVE_VERSION = 2;
export const DB_NAME = 'off-the-record';
const STORE = 'saves';
const SETTINGS_KEY = 'otr:settings';
const LS_PREFIX = 'otr:save:';
export const EXPORT_APP = 'off-the-record';

/** 버전 n → n+1 로 올리는 함수들 (migrations.js) */
export { MIGRATIONS };

export function migrate(data, fromVersion) {
  let v = fromVersion;
  let d = data;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`저장 버전 ${v} 를 올릴 방법이 없어요`);
    d = step(d);
    v += 1;
  }
  if (v > SAVE_VERSION) throw new Error(`이 앱보다 새 버전(${v})의 저장 파일이에요`);
  return d;
}

/** 꼭 있어야 하는 칸이 있는지 (깨진 저장 걸러내기) */
export function isValid(d) {
  return !!(d && d.character?.name && d.character?.stats && d.character?.career && d.time && Number.isFinite(d.time.day) && Number.isFinite(d.time.minute) && d.life && d.economy && Number.isFinite(d.economy.cash) && d.economy.months && d.today && d.history && d.journal);
}

let dbPromise = null;
function openDb(idb) {
  if (!idb) return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    let req;
    try {
      req = idb.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => req.result.objectStoreNames.contains(STORE) || req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

const tx = (db, mode, fn) =>
  new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    fn(store, (r) => (result = r));
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

const ls = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function createSaveSystem({ idb = globalThis.indexedDB } = {}) {
  const getRecord = async (slot) => {
    const db = await openDb(idb);
    if (db) return tx(db, 'readonly', (s, done) => (s.get(slot).onsuccess = (e) => done(e.target.result ?? null)));
    const raw = ls()?.getItem(LS_PREFIX + slot);
    return raw ? JSON.parse(raw) : null;
  };

  return {
    /** 저장. 직전 저장본은 main-prev 로 */
    async save(data, slot = 'main') {
      const record = { slot, version: SAVE_VERSION, savedAt: Date.now(), data: structuredClone(data) };
      const db = await openDb(idb);
      if (db) {
        await tx(db, 'readwrite', (s) => {
          s.get(slot).onsuccess = (e) => {
            const prev = e.target.result;
            if (prev) s.put({ ...prev, slot: `${slot}-prev` });
            s.put(record);
          };
        });
      } else {
        const store = ls();
        if (!store) throw new Error('이 기기에서 저장 공간을 쓸 수 없어요');
        const prev = store.getItem(LS_PREFIX + slot);
        if (prev) store.setItem(LS_PREFIX + slot + '-prev', prev);
        store.setItem(LS_PREFIX + slot, JSON.stringify(record));
      }
      return true;
    },

    /**
     * 불러오기 → { data } | { empty: true } | { data, recovered: true } | { error }
     * 최신 저장본이 깨졌으면 직전 저장본으로 이어가요.
     */
    async load(slot = 'main') {
      const tryRecord = (r) => {
        if (!r) return null;
        const d = migrate(r.data, r.version ?? 1);
        return isValid(d) ? d : null;
      };
      let main;
      try {
        main = await getRecord(slot);
        const d = tryRecord(main);
        if (d) return { data: d, savedAt: main.savedAt };
      } catch (e) {
        main = main ?? { broken: String(e) };
      }
      try {
        const d = tryRecord(await getRecord(`${slot}-prev`));
        if (d) return { data: d, recovered: true };
      } catch {
        /* 아래로 */
      }
      return main ? { error: '저장 파일을 읽을 수 없어요' } : { empty: true };
    },

    async clear(slot = 'main') {
      const db = await openDb(idb);
      if (db) await tx(db, 'readwrite', (s) => (s.delete(slot), s.delete(`${slot}-prev`)));
      ls()?.removeItem(LS_PREFIX + slot);
      ls()?.removeItem(LS_PREFIX + slot + '-prev');
    },
  };
}

/**
 * 내보내기: 다른 기기·재설치에 옮길 수 있는 글자 묶음 (JSON).
 * { app, version, exportedAt, data }
 */
export function exportText(data, now = Date.now()) {
  return JSON.stringify({ app: EXPORT_APP, version: SAVE_VERSION, exportedAt: now, data });
}

/** 가져오기: 검사·버전 올리기까지 마친 데이터 또는 { error } */
export function importText(text) {
  let obj;
  try {
    obj = JSON.parse(String(text).trim());
  } catch {
    return { error: '저장 데이터 형식이 아니에요. 내보낸 글자를 빠짐없이 붙여 넣어 주세요.' };
  }
  if (obj?.app !== EXPORT_APP || !obj.data) return { error: 'OFF THE RECORD 에서 내보낸 데이터가 아니에요.' };
  try {
    const d = migrate(obj.data, obj.version ?? 1);
    if (!isValid(d)) return { error: '데이터 일부가 빠져 있어 불러올 수 없어요.' };
    return { data: d };
  } catch (e) {
    return { error: String(e.message ?? e) };
  }
}

/** 설정 (화면 모드 등 가벼운 값) */
export function loadSettings() {
  try {
    return { theme: 'auto', ...JSON.parse(ls()?.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { theme: 'auto' };
  }
}
export function saveSettings(settings) {
  try {
    ls()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* 저장 못 해도 게임은 계속 */
  }
}

/** 테스트에서 DB 연결을 새로 열 수 있게 */
export const _resetDbForTest = () => (dbPromise = null);
