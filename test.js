// node test.js — 훈련 점진 성장(비확률)·제의·A매치 자가 점검
const assert = require('assert');
const vm = require('vm'), fs = require('fs');
const ctx = {}; vm.runInNewContext(fs.readFileSync(__dirname + '/data/EPL.js', 'utf8') + ';this.DATA=DATA', ctx);
const D = ctx.DATA, E = require('./engine.js');
const fresh = pos => E.newGame(D, { name: 't', nat: 'South Korea', pos, clubId: D.clubs[0].id });

// 1. 같은 조건이면 훈련 증가량이 항상 같고(확률 아님), 피로하면 줄어든다
let a = fresh('FW'), b = fresh('FW'); b.pot = a.pot; b.fatigue = 80;
const da = E.gain(a, 'att', 1.6), db = E.gain(b, 'att', 1.6);
assert(da > 0 && db < da, 'fatigue reduces gain');
let c = fresh('FW'); c.pot = a.pot; assert.strictEqual(E.gain(c, 'att', 1.6), da);

// 2. 훈련할수록 단조 증가, 잠재력 초과 없음
const g = fresh('FW'); let prev = g.st.att;
for (let i = 0; i < 19; i++) { E.doWeek(D, g, 'attack'); g.fatigue = 0; assert(g.st.att >= prev && g.st.att <= g.pot); prev = g.st.att; }

// 3. 시즌 종료 시 18세 유스는 프로 승격/이적 제의를 받고, 수락하면 유스 탈출
const y = fresh('MF'); y.age = 17; y.st = { att: 60, def: 60, sta: 60, gk: 5 }; y.week = 20;
E.doWeek(D, y, 'rest');
assert(y.offers && y.offers.expired && y.offers.list.length > 0);
E.acceptOffer(D, y, 0); assert(!y.youth && !y.offers);

// 4. A매치: 실력이 높으면 소집(caps 증가)
const s = fresh('FW'); s.age = 22; s.st = { att: 90, def: 60, sta: 80, gk: 5 }; s.week = 7; s.fix = { brk: true };
E.doWeek(D, s, 'rest'); assert.strictEqual(s.caps, 1);
console.log('ok');
