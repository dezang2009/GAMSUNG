/**
 * 저장: 기기 안 localStorage 한 곳 (서버 없음). 깨진 저장은 버리지 않고 '…-broken'으로 옮겨 둔다.
 * 저장할 때 직전 저장본을 '…-prev'로 남겨 하나 이전으로 돌아갈 수 있게 한다.
 */
import { newGame, SAVE_VERSION } from './engine.js';

export const KEY = 'devlife:save';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** 저장본 검사·보정 (모르는 값은 기본값으로) */
export function sanitize(raw, now = Date.now()) {
  const base = newGame(now);
  if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return null;
  const s = { ...base, ...raw };
  for (const k of ['money', 'insight', 'taps', 'totalLines', 'totalEarned', 'runEarned', 'office', 'lastTick', 'nextEventAt', 'nextFlavorAt']) if (!isNum(s[k]) || s[k] < 0) s[k] = base[k];
  s.office = Math.min(Math.floor(s.office), 5);
  if (!s.project || !isNum(s.project.index) || !isNum(s.project.progress)) s.project = base.project;
  s.apps = Array.isArray(s.apps) ? s.apps.filter((a) => a && isNum(a.index) && isNum(a.users) && isNum(a.rating) && typeof a.name === 'string') : [];
  for (const k of ['upgrades', 'staff', 'achievements']) s[k] = s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) ? s[k] : {};
  s.buffs = Array.isArray(s.buffs) ? s.buffs.filter((b) => b && isNum(b.until) && isNum(b.mult)) : [];
  s.log = Array.isArray(s.log) ? s.log.slice(0, 80) : [];
  s.pending = Array.isArray(s.pending) ? s.pending.filter((p) => p && typeof p.id === 'string').slice(0, 3) : [];
  s.stats = { ...base.stats, ...(s.stats && typeof s.stats === 'object' ? s.stats : {}) };
  s.settings = { ...base.settings, ...(s.settings && typeof s.settings === 'object' ? s.settings : {}) };
  return s;
}

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function load(now = Date.now()) {
  const ls = storage();
  const text = ls?.getItem(KEY);
  if (!text) return { state: newGame(now), fresh: true };
  try {
    const s = sanitize(JSON.parse(text), now);
    if (s) return { state: s, fresh: false };
  } catch {
    /* 아래에서 처리 */
  }
  // 읽을 수 없는 저장본: 지우지 않고 옮겨 두고, 직전 저장본으로 시도
  ls.setItem(`${KEY}-broken-${now}`, text);
  try {
    const prev = sanitize(JSON.parse(ls.getItem(`${KEY}-prev`) ?? 'null'), now);
    if (prev) return { state: prev, fresh: false, recovered: true };
  } catch {
    /* 새로 시작 */
  }
  return { state: newGame(now), fresh: true, recovered: false, broken: true };
}

export function save(s) {
  const ls = storage();
  if (!ls) return false;
  try {
    const cur = ls.getItem(KEY);
    if (cur) ls.setItem(`${KEY}-prev`, cur);
    ls.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function reset() {
  const ls = storage();
  ls?.removeItem(KEY);
  ls?.removeItem(`${KEY}-prev`);
}
