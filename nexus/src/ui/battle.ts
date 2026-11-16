/**
 * 전투 화면: 위 적 · 가운데 행동 순서와 기록 · 아래 아군(출전 3 + 대기 2) · 맨 아래 행동 버튼.
 * 로직은 systems/battle.ts 가 하고, 여기서는 사건(Event)을 보기 좋게 차례로 보여 줘요.
 * 자동 전투를 켜면 아군도 자동 행동. 속도 1배·2배. 나가면 포기(패배).
 */
import { Data } from '../core/data';
import { Game } from '../game/game';
import * as Bt from '../systems/battle';
import { h } from './dom';
import { creatureArt } from './art';
import type { App } from './app';

export type BattleHandle = { requestQuit: () => void; state: () => Bt.BattleState };

const BASE_DELAY = 520;

export function openBattle(app: App, stageId: string, initial: Bt.BattleState, onExit: () => void): BattleHandle {
  let b = initial;
  let finished = false;
  let recorded = false;
  let pending: Bt.Action | null = null; // 대상 고르는 중인 행동
  let waiting: ((a: Bt.Action) => void) | null = null; // 아군 행동 입력 대기
  let lastText = '전투 시작!';
  let floats: { id: string; text: string; heal?: boolean }[] = [];
  let acting = '';
  let cutin: { actor: string; name: string } | null = null; // 궁극기 연출
  let alive = true;
  const stage = Data.get('stages', stageId)!;

  const root = h('div', { class: 'battle', 'data-testid': 'battle', role: 'dialog', 'aria-label': `${stage.name} 전투` });
  document.body.append(root);
  document.body.classList.add('in-battle');
  const navEl = document.querySelector<HTMLElement>('.nav');
  if (navEl) navEl.hidden = true;

  const delay = () => BASE_DELAY / (Game.settings.speed || 1);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** 공통: 눌러서 대상 고르기 · 행동 중 · 맞음 · 쓰러짐 상태 */
  function unitShell(u: Bt.Unit, cls: string, ...children: any[]) {
    const cur = Bt.current(b);
    const isTarget = !!pending && targetable(u);
    const isActing = acting ? acting === u.id : !finished && cur?.id === u.id;
    const hit = floats.some((f) => f.id === u.id && !f.heal);
    return h('div', {
      class: `unit ${cls} ${isActing ? 'acting' : ''} ${isTarget ? 'target' : ''} ${u.hp <= 0 ? 'down' : ''} ${hit ? 'hit' : ''}`,
      'data-testid': `unit-${u.id}`,
      role: isTarget ? 'button' : null,
      'aria-label': `${u.name} 체력 ${u.hp}/${u.maxHp}`,
      onclick: isTarget ? () => pickTarget(u) : null,
    }, ...children, buffBadge(u), floats.filter((f) => f.id === u.id).map((f) => h('span', { class: `float ${f.heal ? 'heal' : ''}` }, f.text)));
  }
  function buffBadge(u: Bt.Unit) {
    if (u.buffs.some((x) => x.amount < 0)) return h('span', { class: 'buff debuff' }, '약화');
    if (u.buffs.length) return h('span', { class: 'buff' }, '강화');
    return null;
  }
  const hpBar = (u: Bt.Unit) => h('div', { class: 'bar hp', style: { '--c': u.side === 'ally' ? 'var(--good)' : 'var(--danger)' } }, h('i', { style: { width: `${(u.hp / u.maxHp) * 100}%` } }));
  const full = (u: Bt.Unit) => u.energy >= Data.balance.energy.max;
  const enBar = (u: Bt.Unit) => h('div', { class: `bar en ${full(u) ? 'full' : ''}` }, h('i', { style: { width: `${(u.energy / Data.balance.energy.max) * 100}%` } }));

  /** 적: 카드 없이 전장에 크게 서 있어요 */
  function foe(u: Bt.Unit, n: number) {
    const size = n <= 1 ? 140 : n === 2 ? 112 : 92;
    return unitShell(u, 'foe', h('div', { class: 'stand' }, creatureArt(u.species, 'owned', size)), h('span', { class: 'uname' }, u.name), hpBar(u), h('span', { class: 'hpnum num' }, `${u.hp} / ${u.maxHp}`));
  }
  /** 아군 출전: 세로 초상 카드 (궁극기 준비되면 게이지가 빛나요) */
  function portrait(u: Bt.Unit) {
    const el = Data.get('elements', Data.get('species', u.species)?.element ?? '')?.color ?? '#888';
    return unitShell(u, `portrait ${full(u) && u.hp > 0 ? 'ready' : ''}`, h('div', { class: 'pic', style: { '--el': el } }, creatureArt(u.species, 'owned', 64)), h('span', { class: 'uname' }, u.name), hpBar(u), enBar(u), h('span', { class: 'hpnum num' }, `${u.hp} / ${u.maxHp}`));
  }
  /** 대기: 작은 줄 */
  function mini(u: Bt.Unit) {
    return unitShell(u, 'mini', creatureArt(u.species, 'owned', 32), h('div', { class: 'meta' }, h('span', { class: 'uname' }, u.name), hpBar(u)));
  }

  function targetable(u: Bt.Unit): boolean {
    if (!pending || u.hp <= 0) return false;
    const actor = Bt.current(b)!;
    const kind = Bt.targetKind(b, actor, pending);
    if (kind === 'enemy') return u.side === 'enemy';
    if (kind === 'ally') return u.side === 'ally' && b.active.includes(u.id);
    if (kind === 'reserve') return u.side === 'ally' && b.reserve.includes(u.id);
    return false;
  }

  function pickTarget(u: Bt.Unit) {
    if (!pending || !waiting) return;
    const a = { ...pending };
    if (a.type === 'swap') a.swapWith = u.id;
    else a.target = u.id;
    pending = null;
    const w = waiting;
    waiting = null;
    w(a);
  }

  function choose(a: Bt.Action) {
    const actor = Bt.current(b)!;
    const kind = Bt.targetKind(b, actor, a);
    const pool = kind === 'enemy' ? Bt.livingEnemies(b) : kind === 'ally' ? Bt.livingActive(b) : kind === 'reserve' ? Bt.livingReserve(b) : [];
    if (kind && pool.length > 1) {
      pending = a;
      render();
      return;
    }
    if (kind === 'reserve') a.swapWith = pool[0]?.id;
    else if (kind) a.target = pool[0]?.id;
    const w = waiting;
    waiting = null;
    w?.(a);
  }

  function actionsPanel(): Node {
    const actor = Bt.current(b);
    if (finished) return h('div');
    if (!actor || actor.side !== 'ally' || Game.settings.auto || !waiting) {
      return h('div', { class: 'b-prompt muted' }, Game.settings.auto ? '자동 전투 중이에요' : actor?.side === 'enemy' ? '상대 차례예요' : '');
    }
    if (pending) {
      const kind = Bt.targetKind(b, actor, pending);
      return h('div', { class: 'b-prompt', 'data-testid': 'target-prompt' }, h('span', null, kind === 'enemy' ? '공격할 적을 고르세요' : kind === 'reserve' ? '교체해 나올 개체를 고르세요' : '대상 아군을 고르세요'), h('button', { class: 'btn ghost', style: { minHeight: '44px' }, 'data-testid': 'target-cancel', onclick: () => ((pending = null), render()) }, '취소'));
    }
    const skills = Bt.skillsOf(actor);
    const sk = skills.find((s) => s.kind === 'skill');
    const ult = skills.find((s) => s.kind === 'ultimate');
    const btn = (label: string, sub: string, a: Bt.Action, testid: string, variant = '') => {
      const why = Bt.canUse(b, actor, a);
      return h('button', { class: `cmd ${variant}`, disabled: !!why, 'data-testid': testid, title: why || null, onclick: () => choose(a) }, h('b', null, label), h('small', null, why ? shortWhy(why) : sub));
    };
    return h('div', { class: 'b-actions', 'data-testid': 'actions' },
      h('div', { class: 'turn-of' }, h('b', null, actor.name), ' 의 차례'),
      h('div', { class: 'cmds' },
        btn('공격', `에너지 +${Data.balance.energy.basic_attack}`, { type: 'basic' }, 'act-basic'),
        sk ? btn(sk.name, `에너지 ${sk.cost}`, { type: 'skill', skill: sk.id }, 'act-skill') : h('span'),
        ult ? btn(ult.name, '궁극기', { type: 'ultimate', skill: ult.id }, 'act-ultimate', 'ult') : h('span'),
        btn('교체', `대기 ${Bt.livingReserve(b).length}`, { type: 'swap' }, 'act-swap', 'quiet')));
  }

  /** 버튼 아래 작은 글: 칸이 좁아서 짧게 (전체 이유는 title) */
  function shortWhy(why: string): string {
    const u = Bt.current(b)!;
    if (why.includes('가득')) return `에너지 ${u.energy}/${Data.balance.energy.max}`;
    const cd = why.match(/^(\d+)라운드 뒤/);
    if (cd) return `${cd[1]}라운드 대기`;
    if (why.includes('대기 개체')) return '대기 없음';
    return why;
  }

  function render() {
    if (!alive) return;
    const enemies = b.enemies.map((id) => b.units[id]);
    const order = b.queue.map((id, i) => {
      const u = b.units[id];
      return h('span', { class: `${u.side} ${i === b.turn && !b.result ? 'now' : ''} ${i < b.turn ? 'done' : ''}` }, u.name.replace('개체 ', ''));
    });
    root.replaceChildren(
      h('div', { class: 'b-top' },
        h('span', { class: 'round num', 'data-testid': 'round' }, `라운드 ${b.round}`),
        h('button', { class: `toggle ${Game.settings.auto ? 'on' : ''}`, 'data-testid': 'auto', 'aria-pressed': String(Game.settings.auto), onclick: () => toggleAuto() }, '자동'),
        h('button', { class: `toggle ${Game.settings.speed === 2 ? 'on' : ''}`, 'data-testid': 'speed', onclick: () => (Game.setSettings({ speed: Game.settings.speed === 2 ? 1 : 2 }), render()) }, `${Game.settings.speed}배속`),
        h('button', { class: 'toggle', 'data-testid': 'quit', onclick: () => requestQuit() }, finished ? '닫기' : '나가기')),
      h('div', { class: 'b-field' },
        h('div', { class: 'b-stage', style: { '--n': enemies.length } }, enemies.map((u) => foe(u, enemies.length))),
        h('div', { class: 'order', 'aria-label': '이번 라운드 행동 순서' }, order),
        h('div', { class: 'b-log', 'data-testid': 'log', 'aria-live': 'polite' }, logNodes(lastText))),
      h('div', { class: 'b-dock' },
        h('div', { class: 'b-row allies' }, b.active.map((id) => portrait(b.units[id]))),
        h('div', { class: 'b-row reserve' }, h('span', { class: 'rlabel' }, '대기'), b.reserve.map((id) => mini(b.units[id])), ...Array.from({ length: Math.max(0, Data.balance.party.reserve - b.reserve.length) }, () => h('div', { class: 'unit mini empty' }, h('span', { class: 'uname' }, '비어 있음')))),
        finished ? resultPanel() : actionsPanel()),
      ...(cutin ? [cutinNode(cutin)] : []),
    );
  }

  function cutinNode(c: { actor: string; name: string }) {
    const u = b.units[c.actor];
    return h('div', { class: `cutin ${u.side}`, 'aria-hidden': 'true' }, h('div', { class: 'band' }, creatureArt(u.species, 'owned', 110), h('div', null, h('small', null, `${u.name} · 궁극기`), h('b', null, c.name))));
  }

  function resultPanel() {
    const win = b.result === 'win';
    const end = [...b.log].reverse().find((e) => e.t === 'end') as Extract<Bt.Event, { t: 'end' }> | undefined;
    const allies = Object.values(b.units).filter((u) => u.side === 'ally');
    const hp = allies.reduce((a, u) => a + u.hp, 0) / allies.reduce((a, u) => a + u.maxHp, 0);
    return h('div', { class: `result ${win ? 'win' : 'lose'}`, 'data-testid': 'result' },
      h('div', { class: 'big' }, win ? '승리' : '패배'),
      h('div', { class: 'muted' }, `${end?.reason ?? ''} · ${b.round}라운드 · 아군 남은 체력 ${Math.round(hp * 100)}%`),
      stage.type === 'training' ? h('div', { class: 'small faint' }, '훈련 전투는 보상이 없어요. 보상은 스테이지 단계에서 열려요.') : null,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', 'data-testid': 'result-exit', onclick: () => close() }, '돌아가기'), h('button', { class: 'btn', 'data-testid': 'result-retry', onclick: () => retry() }, '다시 하기')));
  }

  function eventText(e: Bt.Event): string {
    const n = (id: string) => b.units[id]?.name ?? id;
    switch (e.t) {
      case 'act':
        return e.action === 'swap' ? '' : `<b>${n(e.actor)}</b> · ${e.name}`;
      case 'damage':
        return `${n(e.target)}에게 ${e.amount}`;
      case 'heal':
        return `${n(e.target)} 회복 ${e.amount}`;
      case 'faint':
        return `<b>${n(e.target)}</b> 쓰러짐`;
      case 'swap':
        return e.reason === 'faint' ? `${n(e.in)} 출전!` : `<b>${n(e.out)}</b> ↔ <b>${n(e.in)}</b> 교체`;
      case 'buff':
        return `${n(e.target)} ${Data.get('stats', e.stat)?.name} ${e.amount > 0 ? '강화' : '약화'}`;
      case 'round':
        return `라운드 ${e.round}`;
      case 'end':
        return e.result === 'win' ? '<b>승리!</b>' : '<b>패배…</b>';
    }
  }

  /** 사건을 눈에 보이게: 행동 → (데미지·회복 숫자) → 다음 */
  async function play(events: Bt.Event[]) {
    const act = events.find((e) => e.t === 'act') as any;
    acting = act?.actor ?? '';
    if (act?.action === 'ultimate') {
      cutin = { actor: act.actor, name: act.name };
      render();
      await sleep(delay() * 1.5);
      cutin = null;
    }
    floats = events.flatMap((e) => (e.t === 'damage' ? [{ id: e.target, text: `-${e.amount}` }] : e.t === 'heal' ? [{ id: e.target, text: `+${e.amount}`, heal: true }] : []));
    const texts = events.map(eventText).filter(Boolean);
    lastText = texts.slice(0, 3).join(' · ');
    setLog();
    render();
    await sleep(delay());
    floats = [];
    acting = '';
  }
  /** 기록 글: <b>…</b> 부분만 굵게 (글자는 모두 텍스트로 넣어 안전하게) */
  function logNodes(text: string): Node[] {
    return text.split(/(<b>.*?<\/b>)/).filter(Boolean).map((part) => (part.startsWith('<b>') ? h('b', null, part.slice(3, -4)) : document.createTextNode(part)));
  }
  function setLog() {
    /* render() 가 logNodes 로 그려요 */
  }

  async function loop() {
    render();
    setLog();
    await sleep(delay() * 0.6);
    while (alive && !b.result) {
      const u = Bt.current(b)!;
      let action: Bt.Action;
      if (u.side === 'enemy' || Game.settings.auto) {
        action = Bt.autoAction(b, u);
      } else {
        render();
        action = await new Promise<Bt.Action>((res) => {
          waiting = res;
          render();
        });
        if (!alive) return;
      }
      const roundBefore = b.round;
      const evs = Bt.act(b, action);
      await play(evs);
      if (b.round !== roundBefore && !b.result) {
        lastText = `라운드 ${b.round}`;
        setLog();
        render();
        await sleep(delay() * 0.5);
      }
    }
    if (!alive) return;
    finished = true;
    record();
    render();
  }

  function record() {
    if (recorded) return;
    recorded = true;
    Game.finishBattle(stageId, b);
  }

  function toggleAuto() {
    Game.setSettings({ auto: !Game.settings.auto });
    if (Game.settings.auto && waiting) {
      const w = waiting;
      waiting = null;
      pending = null;
      w(Bt.autoAction(b));
    }
    render();
  }

  function requestQuit() {
    if (finished) return close();
    app.confirm('전투를 포기할까요?', '지금 나가면 패배로 기록돼요.', '포기하기', () => {
      b.result = 'lose';
      b.log.push({ t: 'end', result: 'lose', reason: '전투를 포기했어요' });
      alive = true;
      finished = true;
      if (waiting) {
        waiting = null;
      }
      record();
      render();
    });
  }

  function retry() {
    close(false);
    app.startBattle(stageId);
  }

  function close(callExit = true) {
    alive = false;
    root.remove();
    document.body.classList.remove('in-battle');
    if (navEl) navEl.hidden = false;
    if (callExit) onExit();
    else onExit();
  }

  loop();
  return { requestQuit, state: () => b };
}
