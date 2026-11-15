/**
 * 네 화면: 홈 · 성장 · 소식 · 기록.
 * 각 화면은 { el, update(s, now) } 를 돌려준다. update 는 0.1초마다 숫자만 바꾸고,
 * 구조가 바뀌는 일(구매·출시·선택)은 app.js 가 화면을 다시 그린다.
 */
import { h } from './dom.js';
import * as E from '../game/engine.js';
import { UPGRADES, STAFF, OFFICES, ACHIEVEMENTS, BALANCE, totalUsers, staffCount } from '../game/data.js';
import { eventDef, eventText } from '../game/events.js';
import { won, lines, people, perSec, shortNum, duration } from '../game/format.js';

const set = (el, text) => el.textContent !== text && (el.textContent = text);
const ago = (t, now) => {
  const m = Math.floor((now - t) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
};

/* ── 홈 ── */
export function homeView(s, ctx) {
  const money = h('div', { class: 'hero__money num', 'data-testid': 'money' });
  const rev = h('b', {});
  const lps = h('b', { class: 'code' });
  const hero = h('section', { class: 'card hero' }, h('span', { class: 'label' }, '보유 자금'), money, h('div', { class: 'hero__rates num' }, h('span', {}, '수익 ', rev), h('span', {}, '코드 ', lps)));

  const projName = h('div', { class: 'proj__name' });
  const projNum = h('span', { class: 'card__sub num' });
  const bar = h('i');
  const progress = h('div', { class: 'progress' }, bar);
  const btnText = h('span', {});
  const btnSub = h('small', { class: 'num' });
  const codeBtn = h('button', { type: 'button', class: 'btn btn--primary btn--block code-btn', 'data-testid': 'code-btn' }, h('span', { style: 'display:grid;gap:2px' }, btnText, btnSub));
  const buffs = h('div', { class: 'chips' });
  // 한 번 누르면 pointerdown → click 순서로 온다. 진행을 꽉 채운 그 손가락이 곧바로 ‘출시’까지 누르지 않게,
  // pointerdown 에서 코드를 쓴 동작의 click 은 무시한다. (키보드 Enter/Space 는 click 만 온다)
  let tapped = false;
  const writeCode = () => {
    const v = E.tap(s);
    const f = h('span', { class: 'floater num', style: `left:${30 + Math.random() * 40}%` }, `+${shortNum(v)}줄`);
    codeBtn.append(f);
    setTimeout(() => f.remove(), 800);
    ctx.after();
    update(null, Date.now());
  };
  codeBtn.addEventListener('pointerdown', (e) => {
    if (E.projectReady(s)) return;
    e.preventDefault();
    tapped = true;
    writeCode();
  });
  codeBtn.addEventListener('click', () => {
    if (tapped) return void (tapped = false);
    if (!E.projectReady(s)) return writeCode();
    ctx.act(() => {
      const app = E.launch(s);
      if (app) {
        E.addLog(s, `‘${app.name}’을(를) 출시했어요! 첫 평점 ★${app.rating.toFixed(1)}`, 'launch');
        ctx.toast(`‘${app.name}’ 출시! 사용자가 모이기 시작해요`);
      }
    });
  });
  const proj = h('section', { class: 'card', 'data-testid': 'project' }, h('div', { class: 'proj' }, h('span', { class: 'label' }, '만드는 중'), projNum), projName, progress, codeBtn, buffs);

  const appRows = h('div', { class: 'rows' });
  const appsTitle = h('h2', { class: 'card__title' });
  const appsTotal = h('span', { class: 'card__sub num' });
  const apps = h('section', { class: 'card', 'data-testid': 'apps' }, h('div', { class: 'card__head' }, appsTitle, appsTotal), appRows);
  const appEls = [];
  const buildApps = () => {
    appRows.replaceChildren();
    appEls.length = 0;
    if (!s.apps.length) return appRows.append(h('p', { class: 'empty' }, '첫 앱을 출시하면 사용자와 수익이 생겨요.'));
    [...s.apps].reverse().forEach((a) => {
      const sub = h('span', { class: 'row__desc num' });
      const end = h('span', { class: 'row__end num' });
      appEls.push({ a, sub, end });
      appRows.append(h('div', { class: 'row' }, h('span', { class: 'row__icon' }, a.name.slice(0, 1)), h('div', { class: 'row__body' }, h('span', { class: 'row__name' }, a.name), sub), end));
    });
  };

  const news = h('button', { type: 'button', class: 'card btn--block', style: 'text-align:left;cursor:pointer;font:inherit;color:inherit', 'data-testid': 'news-preview', onclick: () => ctx.go('news') });

  let appsCount = -1;
  let ready = null;
  const update = (st, now) => {
    set(money, won(s.money));
    set(rev, perSec(E.revenuePerSec(s, now), '원'));
    set(lps, perSec(E.linesPerSec(s, now), '줄'));
    const need = E.projectLines(s);
    set(projName, E.appName(s.project.index));
    set(projNum, `${shortNum(Math.floor(s.project.progress))} / ${shortNum(need)}줄`);
    bar.style.width = `${Math.min(100, (s.project.progress / need) * 100)}%`;
    const r = E.projectReady(s);
    if (r !== ready) {
      ready = r;
      progress.classList.toggle('is-full', r);
      codeBtn.dataset.mode = r ? 'launch' : 'code';
    }
    set(btnText, r ? '출시하기' : '코드 쓰기');
    set(btnSub, r ? '사용자를 모으러 가요' : `한 번에 +${shortNum(E.tapValue(s, now))}줄`);
    const active = s.buffs.filter((b) => b.until > now);
    const key = active.map((b) => `${b.label}${Math.ceil((b.until - now) / 1000)}`).join('|');
    if (buffs.dataset.key !== key) {
      buffs.dataset.key = key;
      buffs.replaceChildren(...active.map((b) => h('span', { class: `chip ${b.mult < 1 ? 'chip--down' : ''}` }, `${b.label} ${Math.ceil((b.until - now) / 1000)}초`)));
    }
    if (s.apps.length !== appsCount) (appsCount = s.apps.length), buildApps();
    set(appsTitle, `출시한 앱 ${s.apps.length}개`);
    set(appsTotal, s.apps.length ? `사용자 ${people(totalUsers(s))}` : '');
    for (const { a, sub, end } of appEls) {
      set(sub, `★ ${a.rating.toFixed(1)} · 사용자 ${people(a.users)}`);
      set(end, perSec(a.users * E.appArpu(a.index) * (1 + 0.15 * (s.upgrades.server ?? 0)) * E.insightMult(s), '원'));
    }
    news.hidden = !s.pending.length;
    const first = s.pending[0];
    const nkey = s.pending.map((p) => p.key).join();
    if (first && news.dataset.key !== nkey) {
      news.dataset.key = nkey;
      news.replaceChildren(h('span', { class: 'chip event__tag' }, `새 소식 ${s.pending.length}개`), h('b', {}, eventDef(first.id)?.title ?? ''), h('span', { class: 'card__sub' }, eventText(s, first)));
    }
  };
  return { el: h('div', { class: 'view' }, hero, news, proj, apps), update };
}

/* ── 성장 ── */
let growTab = 'gear';
export function growView(s, ctx) {
  const tabs = [
    ['gear', '장비'],
    ['staff', '직원'],
    ['office', '사무실'],
    ['sell', '매각'],
  ];
  const seg = h('div', { class: 'segmented', role: 'tablist' }, tabs.map(([id, label]) => h('button', { type: 'button', role: 'tab', class: id === growTab ? 'is-on' : '', 'aria-selected': String(id === growTab), onclick: () => ((growTab = id), ctx.rerender()) }, label)));
  const priced = []; // { btn, price: () => n, can: () => bool }
  const buyBtn = (price, can, onBuy, testid) => {
    const small = h('small', { class: 'num' });
    const btn = h('button', { type: 'button', class: 'btn btn--primary btn--price', 'data-testid': testid, onclick: () => ctx.act(onBuy) }, h('span', {}, '구매'), small);
    priced.push({ btn, small, price, can });
    return btn;
  };
  let body;
  if (growTab === 'gear') {
    body = h('section', { class: 'card' }, h('div', { class: 'rows' }, UPGRADES.map((u) => {
      const lv = s.upgrades[u.id] ?? 0;
      const maxed = u.max && lv >= u.max;
      return h('div', { class: 'row' }, h('div', { class: 'row__body' }, h('span', { class: 'row__name' }, u.name, lv ? h('span', { class: 'lvl num' }, `Lv.${lv}`) : null), h('span', { class: 'row__desc' }, u.desc)), maxed ? h('span', { class: 'row__end' }, '최대') : buyBtn(() => E.upgradeCost(s, u.id), () => s.money >= E.upgradeCost(s, u.id), () => E.buyUpgrade(s, u.id) && ctx.toast(`${u.name}을(를) 들였어요`), `buy-${u.id}`));
    })));
  } else if (growTab === 'staff') {
    const full = staffCount(s) >= E.officeSlots(s);
    body = h('div', { style: 'display:grid;gap:12px' },
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title' }, `팀원 ${staffCount(s)} / ${E.officeSlots(s)}명`), h('span', { class: 'card__sub' }, OFFICES[s.office].name)), full ? h('p', { class: 'card__sub' }, '자리가 꽉 찼어요. 사무실을 넓히면 더 뽑을 수 있어요.') : null),
      h('section', { class: 'card' }, h('div', { class: 'rows' }, STAFF.map((u) => {
        const n = s.staff[u.id] ?? 0;
        return h('div', { class: 'row' }, h('div', { class: 'row__body' }, h('span', { class: 'row__name' }, u.name, n ? h('span', { class: 'lvl num' }, `${n}명`) : null), h('span', { class: 'row__desc' }, u.desc)), buyBtn(() => E.staffCost(s, u.id), () => !full && s.money >= E.staffCost(s, u.id), () => E.hire(s, u.id) && ctx.toast(`${u.name}이(가) 합류했어요`), `hire-${u.id}`));
      }))));
  } else if (growTab === 'office') {
    const next = E.nextOffice(s);
    body = h('div', { style: 'display:grid;gap:12px' },
      h('section', { class: 'card' }, h('span', { class: 'label' }, '지금 사무실'), h('div', { class: 'proj__name' }, OFFICES[s.office].name), h('span', { class: 'card__sub' }, `자리 ${OFFICES[s.office].slots}개`)),
      next
        ? h('section', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'row__body' }, h('span', { class: 'row__name' }, next.name), h('span', { class: 'row__desc' }, `자리 ${next.slots}개로 늘어나요`)), buyBtn(() => next.cost, () => s.money >= next.cost, () => E.moveOffice(s) && ctx.toast(`${next.name}(으)로 이사했어요!`), 'move-office')))
        : h('section', { class: 'card' }, h('p', { class: 'empty' }, '가장 큰 사무실이에요.')));
  } else {
    const gain = E.insightGain(s);
    const can = gain >= 1;
    body = h('section', { class: 'card', 'data-testid': 'sell' },
      h('h2', { class: 'card__title' }, '회사 매각'),
      h('p', { class: 'card__sub' }, `회사를 팔고 처음부터 다시 시작해요. 얻은 ‘통찰’ 하나마다 코드·수익이 영원히 ${BALANCE.insightPerLevel * 100}%씩 늘어요. 업적과 기록은 남아요.`),
      h('div', { class: 'kv' }, h('span', {}, '지금 통찰'), h('b', { class: 'num' }, `${s.insight} (×${E.insightMult(s).toFixed(2)})`)),
      h('div', { class: 'kv' }, h('span', {}, '매각하면 얻는 통찰'), h('b', { class: 'num' }, `+${gain}`)),
      s.apps.length < BALANCE.sellMinApps ? h('p', { class: 'card__sub' }, `앱을 ${BALANCE.sellMinApps}개 출시하면 매각할 수 있어요. (지금 ${s.apps.length}개)`) : null,
      h('button', { type: 'button', class: 'btn btn--danger btn--block', disabled: !can, 'data-testid': 'sell-btn', onclick: async () => {
        const ok = await ctx.confirm('회사를 매각할까요?', `돈·직원·장비·앱이 모두 사라지고 통찰 ${gain}을(를) 얻어요. 되돌릴 수 없어요.`, '매각하기');
        if (ok) ctx.act(() => {
          const g = E.sellCompany(s);
          E.addLog(s, `회사를 매각했어요. 통찰 +${g}. 새 출발!`, 'achievement');
          ctx.toast(`통찰 +${g}! 다시 시작해요`);
        });
      } }, '매각하기'));
  }
  const update = () => {
    for (const p of priced) {
      const c = p.can();
      if (p.btn.disabled === c) p.btn.disabled = !c;
      set(p.small, won(p.price()));
    }
  };
  return { el: h('div', { class: 'view' }, seg, body), update };
}

/* ── 소식 ── */
export function newsView(s, ctx) {
  const pend = s.pending.map((p) => {
    const def = eventDef(p.id);
    if (!def) return null;
    return h('section', { class: 'card event', 'data-testid': 'event' },
      h('span', { class: 'chip event__tag' }, def.title),
      h('p', { class: 'event__text' }, eventText(s, p)),
      h('div', { class: 'choices' }, def.choices.map((c, i) => h('button', { type: 'button', class: `btn ${i === 0 ? 'btn--primary' : 'btn--ghost'} choice`, onclick: () => ctx.act(() => {
        const r = ctx.choose(p.key, i);
        if (r) ctx.toast(r);
      }) }, h('span', {}, c.label), c.hint ? h('small', {}, c.hint) : null))));
  });
  const logEl = h('div', { class: 'log', 'data-testid': 'log' });
  const fillLog = (now) => logEl.replaceChildren(...(s.log.length ? s.log.slice(0, 40).map((l) => h('div', { class: 'log__item', dataset: { kind: l.kind } }, h('span', { class: 'log__time' }, ago(l.t, now)), h('span', { class: 'log__text' }, l.text))) : [h('p', { class: 'empty' }, '아직 소식이 없어요. 코드를 써 보세요.')]));
  fillLog(Date.now());
  let n = s.log.length;
  let first = s.log[0]?.t;
  const update = (st, now) => {
    if (s.log.length !== n || s.log[0]?.t !== first) (n = s.log.length), (first = s.log[0]?.t), fillLog(now);
  };
  return {
    el: h('div', { class: 'view' }, pend.length ? pend : h('section', { class: 'card' }, h('p', { class: 'empty' }, '지금은 새 소식이 없어요. 조금 있으면 무슨 일이 생길 거예요.')), h('section', { class: 'card' }, h('h2', { class: 'card__title' }, '기록'), logEl)),
    update,
    key: () => s.pending.map((p) => p.key).join(),
  };
}

/* ── 기록 ── */
export function recordsView(s, ctx) {
  const vals = {};
  const kv = (k, label) => h('div', { class: 'kv' }, h('span', {}, label), (vals[k] = h('b', { class: 'num' })));
  const stats = h('section', { class: 'card' }, h('h2', { class: 'card__title' }, '회사 기록'), h('div', {}, kv('earned', '누적 수익'), kv('lines', '누적 코드'), kv('apps', '출시한 앱'), kv('users', '전체 사용자'), kv('taps', '코드 쓰기'), kv('team', '팀원'), kv('insight', '통찰'), kv('sold', '매각 횟수'), kv('play', '플레이 시간')));
  const got = Object.keys(s.achievements).length;
  const badges = h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { class: 'card__title' }, '업적'), h('span', { class: 'card__sub num' }, `${got} / ${ACHIEVEMENTS.length}`)), h('div', { class: 'badges' }, ACHIEVEMENTS.map((a) => h('div', { class: `badge ${s.achievements[a.id] ? 'is-got' : 'is-locked'}` }, h('b', {}, a.name), h('small', {}, a.desc)))));
  const modes = [
    ['auto', '자동'],
    ['light', '밝게'],
    ['dark', '어둡게'],
  ];
  const settings = h('section', { class: 'card' }, h('h2', { class: 'card__title' }, '설정'),
    h('span', { class: 'label' }, '화면 모드'),
    h('div', { class: 'segmented' }, modes.map(([m, label]) => h('button', { type: 'button', class: s.settings.mode === m ? 'is-on' : '', onclick: () => ctx.act(() => ((s.settings.mode = m), ctx.applyMode())) }, label))),
    h('p', { class: 'card__sub' }, '게임 기록은 이 휴대폰에만 저장돼요. 인터넷·광고·회원가입이 없어요.'),
    h('button', { type: 'button', class: 'btn btn--ghost btn--block', 'data-testid': 'reset', onclick: async () => {
      if (await ctx.confirm('처음부터 다시 할까요?', '모든 진행 상황과 업적이 지워져요. 되돌릴 수 없어요.', '모두 지우기')) ctx.resetGame();
    } }, '처음부터 다시'),
    h('p', { class: 'card__sub', style: 'text-align:center' }, `DEVLIFE ${__APP_VERSION__}`));
  const update = (st, now) => {
    set(vals.earned, won(s.totalEarned));
    set(vals.lines, lines(s.totalLines));
    set(vals.apps, `${s.apps.length}개`);
    set(vals.users, people(totalUsers(s)));
    set(vals.taps, `${shortNum(s.taps)}번`);
    set(vals.team, `${staffCount(s)}명`);
    set(vals.insight, String(s.insight));
    set(vals.sold, `${s.stats.sold}번`);
    set(vals.play, duration(s.stats.playSecs));
  };
  return { el: h('div', { class: 'view' }, stats, badges, settings), update };
}
