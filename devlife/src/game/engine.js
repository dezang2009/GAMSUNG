/**
 * 게임 규칙 (순수 함수). 화면과 분리되어 단위 테스트로 확인한다.
 * 시간은 모두 '초', 시각은 밀리초(Date.now).
 */
import { UPGRADES, STAFF, OFFICES, APP_IDEAS, BALANCE as B, ACHIEVEMENTS, staffCount } from './data.js';

export const SAVE_VERSION = 1;

export function newGame(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    money: 0,
    project: { index: 0, progress: 0 },
    apps: [],
    upgrades: {},
    staff: {},
    office: 0,
    insight: 0,
    buffs: [],
    log: [],
    pending: [],
    achievements: {},
    taps: 0,
    totalLines: 0,
    totalEarned: 0,
    runEarned: 0,
    stats: { sold: 0, playSecs: 0, startedAt: now },
    nextEventAt: now + 45_000,
    nextFlavorAt: now + 20_000,
    lastTick: now,
    settings: { mode: 'auto' },
  };
}

/* ── 계산 ── */
const lvl = (s, id) => s.upgrades[id] ?? 0;
const cnt = (s, id) => s.staff[id] ?? 0;
const buffMult = (s, target, now) => s.buffs.filter((b) => b.target === target && b.until > now).reduce((m, b) => m * b.mult, 1);
export const insightMult = (s) => 1 + s.insight * B.insightPerLevel;

export const cost = (base, growth, owned) => Math.ceil(base * growth ** owned);
export const upgradeCost = (s, id) => {
  const u = UPGRADES.find((x) => x.id === id);
  return cost(u.base, u.growth, lvl(s, id));
};
export const staffCost = (s, id) => {
  const u = STAFF.find((x) => x.id === id);
  return cost(u.base, u.growth, cnt(s, id));
};
export const officeSlots = (s) => OFFICES[s.office].slots;
export const nextOffice = (s) => OFFICES[s.office + 1] ?? null;

export const tapValue = (s, now = Date.now()) => (1 + lvl(s, 'keyboard')) * (1 + 0.5 * lvl(s, 'monitor')) * insightMult(s) * buffMult(s, 'tap', now);
export function linesPerSec(s, now = Date.now()) {
  const raw = STAFF.reduce((a, x) => a + x.lps * cnt(s, x.id), 0);
  return raw * (1 + 0.1 * lvl(s, 'coffee')) * insightMult(s) * buffMult(s, 'lps', now);
}

export const appName = (i) => {
  const base = APP_IDEAS[i % APP_IDEAS.length];
  const gen = Math.floor(i / APP_IDEAS.length);
  return gen ? `${base} ${gen + 1}` : base;
};
export const projectLines = (s, i = s.project.index) => Math.ceil(B.linesBase * B.linesGrowth ** i * (1 - 0.06 * lvl(s, 'ci')));
export const appCap = (i) => B.capBase * B.capGrowth ** i;
export const appArpu = (i) => B.arpuBase * B.arpuGrowth ** i;
export const projectReady = (s) => s.project.progress >= projectLines(s);

export function revenuePerSec(s, now = Date.now()) {
  const server = 1 + 0.15 * lvl(s, 'server');
  return s.apps.reduce((a, app) => a + app.users * appArpu(app.index), 0) * server * insightMult(s) * buffMult(s, 'rev', now);
}
/** 앱 하나의 목표 사용자 수 (평점이 높을수록, 디자이너가 많을수록 많다) */
export const targetUsers = (s, app) => appCap(app.index) * (app.rating / 5) ** 2 * (1 + 0.05 * cnt(s, 'designer')) * buffMult(s, 'users', Date.now());
const growthK = (s) => B.growthRate * (1 + 0.2 * lvl(s, 'ads')) * (1 + 0.12 * cnt(s, 'marketer'));

/* ── 행동 ── */
export function tap(s, now = Date.now()) {
  const v = tapValue(s, now);
  s.taps += 1;
  addLines(s, v);
  return v;
}

function addLines(s, v) {
  const need = projectLines(s);
  s.project.progress = Math.min(need, s.project.progress + v); // 다 차면 출시 대기 (넘치는 줄은 버림)
  s.totalLines += v;
}

export function launch(s, now = Date.now(), rng = Math.random) {
  if (!projectReady(s)) return null;
  const i = s.project.index;
  const rating = Math.min(4.9, Math.max(2.5, 3.6 + 0.1 * cnt(s, 'designer') + (rng() - 0.5) * 0.4));
  const app = { index: i, name: appName(i), users: Math.round(appCap(i) * 0.02), rating: Math.round(rating * 10) / 10, releasedAt: now };
  s.apps.push(app);
  s.project = { index: i + 1, progress: 0 };
  return app;
}

function spend(s, price) {
  if (s.money < price) return false;
  s.money -= price;
  return true;
}

export function buyUpgrade(s, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || (u.max && lvl(s, id) >= u.max)) return false;
  if (!spend(s, upgradeCost(s, id))) return false;
  s.upgrades[id] = lvl(s, id) + 1;
  return true;
}

export function hire(s, id) {
  if (!STAFF.some((x) => x.id === id) || staffCount(s) >= officeSlots(s)) return false;
  if (!spend(s, staffCost(s, id))) return false;
  s.staff[id] = cnt(s, id) + 1;
  return true;
}

export function moveOffice(s) {
  const next = nextOffice(s);
  if (!next || !spend(s, next.cost)) return false;
  s.office += 1;
  return true;
}

/* ── 시간 흐름 ── */
export function tick(s, dt, now = Date.now(), { efficiency = 1 } = {}) {
  if (!(dt > 0)) return { money: 0, lines: 0 };
  const lps = linesPerSec(s, now) * efficiency;
  const before = s.project.progress;
  addLines(s, lps * dt);
  const rev = revenuePerSec(s, now) * efficiency * dt;
  s.money += rev;
  s.totalEarned += rev;
  s.runEarned += rev;
  const k = growthK(s);
  for (const app of s.apps) {
    const target = targetUsers(s, app);
    app.users += (target - app.users) * (1 - Math.exp(-k * dt * efficiency));
    app.users = Math.max(0, app.users);
  }
  s.buffs = s.buffs.filter((b) => b.until > now);
  s.stats.playSecs += dt;
  return { money: rev, lines: s.project.progress - before };
}

/** 자리 비운 사이: 최대 8시간, 75% 효율로 나눠 계산 */
export function offlineProgress(s, now = Date.now()) {
  const away = Math.min((now - (s.lastTick ?? now)) / 1000, B.offlineCapSec);
  if (away < 60) return null;
  const usersBefore = s.apps.reduce((a, x) => a + x.users, 0);
  const moneyBefore = s.money;
  const linesBefore = s.totalLines;
  const steps = Math.min(240, Math.ceil(away / 30));
  for (let i = 0; i < steps; i++) tick(s, away / steps, now, { efficiency: B.offlineEfficiency });
  s.stats.playSecs -= away; // 자리 비운 시간은 플레이 시간에서 뺀다
  s.lastTick = now;
  return { secs: away, money: s.money - moneyBefore, lines: s.totalLines - linesBefore, users: s.apps.reduce((a, x) => a + x.users, 0) - usersBefore };
}

/* ── 회사 매각 (새로 시작) ── */
export const insightGain = (s) => (s.apps.length >= B.sellMinApps ? Math.floor(Math.sqrt(s.runEarned / 1e5)) : 0);
export function sellCompany(s, now = Date.now()) {
  const gain = insightGain(s);
  if (gain < 1) return 0;
  const keep = { insight: s.insight + gain, achievements: s.achievements, taps: s.taps, totalLines: s.totalLines, totalEarned: s.totalEarned, stats: { ...s.stats, sold: s.stats.sold + 1 }, settings: s.settings, log: s.log };
  Object.assign(s, newGame(now), keep);
  return gain;
}

/* ── 업적 ── */
export function checkAchievements(s, now = Date.now()) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.test(s)) {
      s.achievements[a.id] = now;
      got.push(a);
    }
  }
  return got;
}

/* ── 소식 기록 ── */
export function addLog(s, text, kind = 'info', now = Date.now()) {
  s.log.unshift({ t: now, text, kind });
  if (s.log.length > 80) s.log.length = 80;
}
