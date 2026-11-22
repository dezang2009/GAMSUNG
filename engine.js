// 게임 로직 (UI 없음). 브라우저: DATA 전역 사용 / node: require로 DATA 주입
const WEEKS = 20, BREAKS = [7, 14], RETIRE_AGE = 36, YOUTH_END = 18;
const STR = { // 구단 전력 (임시 수치, 없으면 58)
  'manchester-city': 84, arsenal: 83, liverpool: 83, chelsea: 78, 'manchester-united': 76,
  'tottenham-hotspur': 76, 'newcastle-united': 74, 'aston-villa': 73, 'brighton-and-hove-albion': 68,
  'crystal-palace': 66, fulham: 65, brentford: 65, bournemouth: 65, everton: 63, 'nottingham-forest': 63,
  'leeds-united': 61, sunderland: 58, 'coventry-city': 56, 'ipswich-town': 55, 'hull-city': 53,
};
const POS_W = { // 포지션별 종합능력 가중치
  FW: { att: .7, def: .1, sta: .2, gk: 0 }, MF: { att: .35, def: .35, sta: .3, gk: 0 },
  DF: { att: .1, def: .65, sta: .25, gk: 0 }, GK: { att: 0, def: 0, sta: .2, gk: .8 },
};
const TRAIN = { attack: 'att', defense: 'def', stamina: 'sta', gk: 'gk' };
const rnd = n => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const club = (D, id) => D.clubs.find(c => c.id === id);
const strength = (D, id) => STR[club(D, id).slug] ?? 58;
const teamStr = (D, g) => strength(D, g.club) - (g.youth ? 24 : 0); // 유스팀은 1군보다 약함
const ovr = g => Object.entries(POS_W[g.pos]).reduce((s, [k, w]) => s + w * g.st[k], 0);
// 나이가 어릴수록 성장 빠름
const ageMul = a => a <= 18 ? 1.3 : a <= 21 ? 1.15 : a <= 25 ? 1 : a <= 29 ? .6 : a <= 32 ? .25 : .1;
const fatigueMul = g => 1 - .6 * g.fatigue / 100;

// 확률 없는 점진 성장: 능력치가 잠재력에 가까울수록, 피로할수록 증가폭이 줄어든다
function gain(g, key, rate) {
  const d = rate * ageMul(g.age) * (1 - g.st[key] / g.pot) * fatigueMul(g);
  g.st[key] += d;
  return d;
}

function newGame(D, { name, nat, pos, clubId }) {
  const gk = pos === 'GK';
  const g = {
    name: name || '무명', nat, pos, club: clubId, age: 15, season: 1, week: 1, youth: true,
    contractLeft: 3, wage: 0, pot: 72 + rnd(24), fatigue: 0,
    st: { att: gk ? 12 : 30, def: gk ? 12 : 30, sta: 30, gk: gk ? 35 : 10 },
    apps: 0, goals: 0, assists: 0, caps: 0, w: 0, d: 0, l: 0, log: [`${club(D, clubId).name} 유스 입단!`],
    offers: null, over: false, last: null, delta: {},
  };
  setFixture(D, g);
  return g;
}

function setFixture(D, g) {
  if (BREAKS.includes(g.week)) { g.fix = { brk: true }; return; }
  const others = D.clubs.filter(c => c.id !== g.club);
  g.fix = { opp: others[rnd(others.length)].id };
}

function calledUp(g) {
  const o = ovr(g);
  return g.age >= 17 && o >= (g.age <= 20 ? 55 : 66);
}

const roster = (D, id) => D.players.filter(p => p.club === id);
const pick = a => a[rnd(a.length)];

function playMatch(D, g, notes) {
  const my = teamStr(D, g), o = ovr(g), diffMe = o - my;
  // 주전(≥-4) 매주 / 로테이션(≥-12) 5주 중 3주 / 그 외 벤치
  const plays = diffMe >= -4 || (diffMe >= -12 && g.week % 5 < 3);
  const opp = club(D, g.fix.opp), oppStr = strength(D, opp.id) - (g.youth ? 24 : 0);
  const power = my + (plays ? diffMe * .3 - (g.fatigue > 80 ? 3 : 0) : 0);
  const p = 1 / (1 + Math.exp(-(power - oppStr) / 8)), r = Math.random();
  let gf, ga, res;
  if (r < p * .8) { res = 'w'; gf = 1 + rnd(3); ga = rnd(gf); }
  else if (r < p * .8 + .2) { res = 'd'; gf = ga = rnd(3); }
  else { res = 'l'; ga = 1 + rnd(3); gf = rnd(ga); }
  g[res]++;
  let mine = 0, ast = 0;
  if (plays) {
    g.apps++; g.fatigue += 8;
    const share = ({ FW: .35, MF: .15, DF: .04, GK: 0 })[g.pos] * (o / 70) ** 2;
    for (let i = 0; i < gf; i++) { if (Math.random() < share) mine++; else if (Math.random() < share / 2) ast++; }
    g.goals += mine; g.assists += ast;
    for (const [k, w] of Object.entries(POS_W[g.pos])) if (w) gain(g, k, .4 * w); // 경기 경험
  }
  const mates = roster(D, g.club).filter(x => x.pos === 'FW' || x.pos === 'MF');
  const others = !g.youth && mates.length ? Array.from({ length: gf - mine }, () => pick(mates).name) : [];
  notes.push(`${plays ? '선발/교체 출전' : '벤치'} · vs ${opp.name}${g.youth ? ' U18' : ''} ${gf}:${ga} (${{ w: '승', d: '무', l: '패' }[res]})` +
    (mine ? ` · ⚽×${mine}` : '') + (ast ? ` · 🅰️×${ast}` : '') + (others.length ? ` · 득점: ${others.join(', ')}` : ''));
}

// 한 주 진행. act: attack | defense | stamina | gk | rest
function doWeek(D, g, act) {
  const notes = [], before = { ...g.st };
  if (act === 'rest') { g.fatigue = clamp(g.fatigue - 40, 0, 100); notes.push('휴식'); }
  else { gain(g, TRAIN[act], 1.6); g.fatigue += 20; }

  if (g.fix.brk) {
    if (calledUp(g)) {
      g.caps++; g.fatigue += 10;
      for (const [k, w] of Object.entries(POS_W[g.pos])) if (w) gain(g, k, .6 * w);
      notes.push(`🇺🇳 ${g.nat} ${g.age <= 20 ? '청소년' : 'A'}대표팀 소집·출전 (A매치 ${g.caps}회)`);
    } else notes.push('A매치 브레이크 (소집 제외)');
  } else playMatch(D, g, notes);

  if (g.age > 30) for (const k in g.st) g.st[k] = Math.max(5, g.st[k] - .02 * (g.age - 30)); // 노화
  g.fatigue = clamp(g.fatigue - 8, 0, 100);
  g.delta = Object.fromEntries(Object.keys(before).map(k => [k, g.st[k] - before[k]]));
  g.log.unshift(`${g.season}시즌 ${g.week}주 | ` + notes.join(' / '));
  g.log = g.log.slice(0, 40);
  if (++g.week > WEEKS) endSeason(D, g); else setFixture(D, g);
  return g;
}

function endSeason(D, g) {
  g.age++; g.season++; g.week = 1; g.fatigue = 0; g.contractLeft--;
  if (g.age >= RETIRE_AGE) { g.over = true; g.log.unshift('은퇴합니다.'); return; }
  const m = makeOffers(D, g);
  g.offers = m.list.length ? m : null; // 제의가 없으면 건너뜀
  g.log.unshift(`${g.age}세 시즌 종료${g.offers ? ' — 제의 도착' : ''}`);
  setFixture(D, g);
}

const wageOf = (D, g, id) => Math.round((Math.max(0, ovr(g) - 30) ** 2) * strength(D, id) / 70 * .04) * 100;

// 성장(종합능력)에 따라 재계약·이적 제의 생성. expired면 반드시 하나를 골라야 함
function makeOffers(D, g) {
  const o = ovr(g), cur = club(D, g.club), curStr = strength(D, cur.id);
  const expired = (g.youth && g.age >= YOUTH_END) || g.contractLeft <= 0;
  const mk = (c, type, years) => ({ type, club: c.id, years, wage: wageOf(D, g, c.id) });
  const offers = [];
  if (expired && (!g.youth || o >= curStr - 12)) offers.push(mk(cur, g.youth ? 'promote' : 'renew', o >= curStr ? 3 : 2));
  const cands = D.clubs.filter(c => c.id !== cur.id && strength(D, c.id) <= o + 6 && (expired || strength(D, c.id) > curStr - 2))
    .sort((a, b) => strength(D, b.id) - strength(D, a.id)).slice(0, 3);
  cands.forEach(c => offers.push(mk(c, 'transfer', 2)));
  if (!offers.length && expired) { // 제의가 하나도 없으면 최하위 구단이 영입
    offers.push(mk(D.clubs.reduce((a, b) => strength(D, a.id) <= strength(D, b.id) ? a : b), 'transfer', 1));
  }
  return { expired, list: offers };
}

function acceptOffer(D, g, i) {
  const f = g.offers.list[i];
  g.club = f.club; g.contractLeft = f.years; g.wage = f.wage; g.youth = false; g.offers = null;
  g.log.unshift(`${club(D, f.club).name}와(과) ${f.years}년 계약 (주급 £${f.wage.toLocaleString()})`);
  setFixture(D, g);
}
function declineOffers(g) { if (!g.offers.expired) g.offers = null; }

if (typeof module !== 'undefined') module.exports = { newGame, doWeek, ovr, makeOffers, acceptOffer, gain, calledUp, WEEKS, STR };
