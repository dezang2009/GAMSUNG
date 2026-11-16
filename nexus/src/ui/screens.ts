/** 화면 내용. 모두 지금 데이터·진행 상태만 보여 줘요 (작동하지 않는 버튼은 만들지 않아요). */
import { Data, type Item } from '../core/data';
import { Game } from '../game/game';
import * as C from '../systems/collection';
import * as X from '../systems/exploration';
import { h, icon, ago } from './dom';
import { creatureArt, planetView } from './art';
import type { App } from './app';

type Screen = (app: App, args: any) => Node;
const S = () => Game.state;
const STATUS_TEXT = { locked: '잠김', open: '열림', cleared: '개척 완료' };
const STATUS_COLOR = { locked: 'var(--faint)', open: 'var(--accent)', cleared: 'var(--teal)' };
const METHOD_TEXT: Record<string, string> = { start: '함께 출발', egg: '알 발견', wild: '야생 목격', battle: '전투', boss: '보스', research: '연구', evolution: '진화' };

const chip = (text: string, color = 'var(--muted)') => h('span', { class: 'chip', style: { '--c': color } }, text);
const tempChip = () => h('span', { class: 'chip warn' }, '임시');
const bar = (v: number, color = 'var(--accent)', hgt = 8) => h('div', { class: 'bar', style: { height: `${hgt}px`, '--c': color } }, h('i', { style: { width: `${Math.max(0, Math.min(1, v)) * 100}%` } }));
const sec = (title: string, aside: string | null, ...body: any[]) => h('section', { class: 'sec' }, h('div', { class: 'sec-head' }, h('h2', null, title), aside ? h('span', { class: 'aside' }, aside) : null), ...body);
const elChip = (sp: Item) => {
  const e = Data.get('elements', sp.element)!;
  return chip(e.name, e.color);
};
const rarityChip = (sp: Item) => {
  const r = Data.get('rarities', sp.rarity)!;
  return chip(r.name, r.color);
};

export function unlockText(r: Item): string {
  const mode = Object.keys(r.unlock)[0];
  const parts: string[] = [];
  for (const c of r.unlock[mode]) {
    if (c.type === 'start') return '처음부터 열려 있어요';
    if (c.type === 'region_cleared') parts.push(`${Data.get('regions', c.region)?.name ?? c.region} 개척`);
  }
  return parts.join(mode === 'any' ? ' 또는 ' : ' 그리고 ') + ' 후 열려요';
}

function logList(n: number) {
  const logs = S().log.slice(0, n);
  return h('div', { class: 'list', 'data-testid': 'log' }, logs.length ? logs.map((e: any) => h('div', { class: 'log-item' }, h('span', null, e.text), h('time', null, ago(e.t)))) : h('p', { class: 'empty' }, '아직 기록이 없어요'));
}

// ── 기지 ──
const base: Screen = (app) => {
  const p = Data.get('planets', S().current_planet)!;
  const regions = Data.regionsOf(p.id);
  const st = regions.map((r) => Game.regionState(r));
  const prog = Game.progress();
  const b = S().battles;
  return h('div', { class: 'page-inner', style: { display: 'grid', gap: '20px' } },
    h('section', { class: 'card', 'data-testid': 'progress' },
      h('div', { class: 'row' }, h('span', { class: 'label grow' }, '개척 진행도'), p.placeholder ? tempChip() : null),
      h('div', { class: 'row' }, h('span', { class: 'big num' }, `${Math.round(prog * 100)}%`), h('div', { class: 'grow' }, h('div', { class: 'title' }, p.name), h('div', { class: 'small muted' }, `지역 ${regions.length}곳 중 ${st.filter((x) => x !== 'locked').length}곳 열림 · ${st.filter((x) => x === 'cleared').length}곳 개척`))),
      bar(prog, 'var(--teal)', 10)),
    h('div', { class: 'grid2' },
      h('section', { class: 'card' }, h('span', { class: 'label' }, '전투 기록'), h('div', { class: 'title num' }, `${b.wins}승 ${b.losses}패`), h('span', { class: 'small faint' }, `${b.played}번 싸웠어요`)),
      h('section', { class: 'card' }, h('span', { class: 'label' }, '시설'), h('div', { class: 'title' }, '0'), h('span', { class: 'small faint' }, '행성 발전 단계에서 열려요'))),
    sec('자원', '획득처는 스테이지 단계에서 열려요',
      h('div', { class: 'card' }, Data.all('resources').map((r) => h('div', { class: 'row' }, h('i', { style: { width: '10px', height: '10px', borderRadius: '3px', background: r.color } }), h('span', { class: 'grow' }, r.name), r.placeholder ? tempChip() : null, h('b', { class: 'num' }, S().resources[r.id] ?? 0))))),
    sec('탐사 기록', null, h('div', { class: 'card' }, logList(5))),
  );
};

// ── 행성 ──
function regionRow(app: App, r: Item) {
  const st = Game.regionState(r);
  let sub = st === 'locked' ? unlockText(r) : st === 'open' ? '탐사할 수 있어요' : '개척을 마쳤어요';
  if (st !== 'locked' && r.surveys) sub += ` · 조사 ${X.done(S(), r.id)}/${r.surveys}`;
  return h('button', { class: 'card tap', style: { textAlign: 'left', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', display: 'grid', gap: '14px', width: '100%' }, 'data-testid': `region-${r.id}`, onclick: () => app.push('region', { id: r.id }, r.name) },
    h('span', { style: { color: STATUS_COLOR[st], display: 'grid' } }, icon(st === 'locked' ? 'lock' : st === 'open' ? 'explore' : 'check')),
    h('span', null, h('div', { class: 'title' }, r.name), h('div', { class: 'small muted' }, sub)),
    r.placeholder ? tempChip() : h('span'),
    icon('chev', 'chev'));
}

export function regionPopup(app: App, id: string) {
  const r = Data.get('regions', id);
  if (!r) return;
  const st = Game.regionState(r);
  const done = X.done(S(), r.id);
  app.sheet((box, close) => {
    box.dataset.testid = 'region-popup';
    const why = X.blockedReason(S(), r, Game.isUnlocked(r));
    const shown = (r.encounters ?? []).filter((e: any) => e.from_survey <= Math.max(done, 1));
    const parts: (Node | null)[] = [
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, r.name), chip(STATUS_TEXT[st], STATUS_COLOR[st]), r.placeholder ? tempChip() : null),
      st === 'locked' ? h('p', { class: 'lead' }, `여는 조건: ${unlockText(r)}`) : null,
      r.surveys ? h('div', { class: 'row small' }, h('span', { class: 'muted' }, '조사'), h('div', { class: 'grow' }, bar(done / r.surveys, 'var(--teal)')), h('b', { class: 'num' }, `${done} / ${r.surveys}`)) : null,
      shown.length ? h('div', null, h('div', { class: 'label', style: { marginBottom: '6px' } }, '이곳에서 만나는 개체'), h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, shown.map((e: any) => creatureArt(e.species, C.status(S(), e.species), 60)))) : null,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', 'data-testid': 'popup-detail', onclick: () => (close(), app.push('region', { id: r.id }, r.name)) }, '자세히 보기'),
        why ? null : h('button', { class: 'btn', 'data-testid': 'popup-survey', onclick: () => (close(), doSurvey(app, r.id)) }, `조사하기 (${done + 1}차)`)),
    ];
    box.append(...(parts.filter(Boolean) as Node[]));
  });
}

const planet: Screen = (app) => {
  const p = Data.get('planets', S().current_planet)!;
  const regions = Data.regionsOf(p.id);
  const states = Object.fromEntries(regions.map((r) => [r.id, Game.regionState(r)]));
  return h('div', { style: { display: 'grid', gap: '18px' } },
    h('div', { class: 'row' }, h('h1', { class: 'h1 grow' }, p.name), p.placeholder ? tempChip() : null),
    h('div', { 'data-testid': 'planet-map' }, planetView(p, regions, states, (id) => regionPopup(app, id))),
    h('div', { class: 'row small muted', style: { justifyContent: 'center', gap: '16px' } }, ...[['열림', 'var(--accent)'], ['개척 완료', 'var(--teal)'], ['잠김', 'var(--faint)']].map(([t, c]) => h('span', { class: 'row', style: { gap: '6px' } }, h('i', { style: { width: '9px', height: '9px', borderRadius: '3px', background: c } }), t))),
    sec('환경 지표', null, h('div', { class: 'card' }, h('p', { class: 'empty' }, '환경 지표 종류는 아직 정해지지 않았어요. 행성 발전 단계에서 설정 파일로 추가돼요.'))),
    sec('지역', `${regions.length}곳`, h('div', { class: 'list', 'data-testid': 'region-list' }, regions.map((r) => regionRow(app, r)))),
  );
};

function doSurvey(app: App, id: string) {
  const res = Game.survey(id);
  if (res.error) return app.toast(res.error, true);
  const r = Data.get('regions', id)!;
  app.sheet((box, close) => {
    box.dataset.testid = 'survey-result';
    box.append(h('h2', null, `${r.name} · ${res.survey}차 조사`));
    if (!res.results!.length) box.append(h('p', { class: 'lead' }, '이번에는 아무것도 만나지 못했어요.'));
    for (const x of res.results!) {
      const sp = Data.get('species', x.species)!;
      const egg = x.type === 'egg';
      const isNew = egg ? x.acquire!.kind === 'new' : x.new;
      const head = egg ? (isNew ? '알을 찾았어요!' : '이미 가진 개체의 알') : x.new ? '새 개체 목격!' : '다시 목격';
      const sub = egg ? (isNew ? `${sp.name} 확보 · 연구 데이터 +${x.acquire!.research}` : `${sp.name} · 중복이라 연구 데이터 +${x.acquire!.research}`) : `${sp.name}${x.new ? ' · 도감 등록' : ''} · 연구 데이터 +${Data.research().sighting}`;
      box.append(h('div', { class: 'row' }, creatureArt(x.species, C.status(S(), x.species), 64), h('div', { class: 'grow' }, h('b', { style: { color: isNew ? 'var(--accent)' : 'var(--text)' } }, head), h('div', { class: 'small muted' }, sub))));
    }
    box.append(h('button', { class: 'btn block', 'data-testid': 'survey-ok', 'data-autofocus': true, onclick: close }, '확인'));
  });
}

const region: Screen = (app, args) => {
  const r = Data.get('regions', args.id);
  if (!r) return h('p', { class: 'empty' }, '지역 정보를 찾을 수 없어요');
  const st = Game.regionState(r);
  const done = X.done(S(), r.id);
  const why = X.blockedReason(S(), r, Game.isUnlocked(r));
  const visible = (r.encounters ?? []).filter((e: any) => e.from_survey <= Math.max(done, 1));
  const hidden = (r.encounters ?? []).length - visible.length;
  return h('div', { style: { display: 'grid', gap: '18px' } },
    h('div', { class: 'chips' }, chip(STATUS_TEXT[st], STATUS_COLOR[st]), r.placeholder ? tempChip() : null),
    st === 'locked' ? h('div', { class: 'card' }, h('span', { class: 'label' }, '여는 조건'), h('span', null, unlockText(r))) : null,
    h('section', { class: 'card', 'data-testid': 'survey-card' },
      h('div', { class: 'row' }, h('span', { class: 'title grow' }, '지역 조사'), h('b', { class: 'num' }, `${done} / ${r.surveys ?? 0}`)),
      bar(done / Math.max(1, r.surveys ?? 1), 'var(--teal)'),
      h('p', { class: 'small muted', style: { margin: 0 } }, '조사할 때마다 야생 개체를 목격하거나 알을 찾아요. 깊이 조사할수록 새로운 서식지가 드러나요.'),
      h('button', { class: `btn block ${why ? 'ghost' : ''}`, disabled: !!why, 'data-testid': 'survey', onclick: () => doSurvey(app, r.id) }, why || `조사하기 (${done + 1}차)`)),
    sec('이곳의 개체', '목격 전에는 ???', h('div', { class: 'card' },
      h('div', { class: 'grid4' }, visible.map((e: any) => {
        const s = C.status(S(), e.species);
        return h('div', { style: { display: 'grid', justifyItems: 'center', gap: '2px', textAlign: 'center' } }, creatureArt(e.species, s, 64), h('span', { class: 'small', style: { fontWeight: 700 } }, s === 'unknown' ? '???' : Data.get('species', e.species)!.name), h('span', { class: 'small faint' }, e.method === 'egg' ? '알' : '야생'));
      })),
      hidden > 0 ? h('p', { class: 'small muted', style: { margin: 0 } }, `더 조사하면 드러나는 서식지 ${hidden}곳이 있어요`) : null)),
    h('div', { class: 'card' }, h('span', { class: 'label' }, '이곳의 스테이지'), h('span', { class: 'muted' }, '일반 스테이지는 스테이지 단계(B4)에서 추가돼요. 야생 개체 확보도 그때 전투로 해요.')),
  );
};

// ── 탐사 (전투 · 조사) ──
const explore: Screen = (app) => {
  const regions = Data.regionsOf(S().current_planet);
  const open = regions.filter((r) => Game.regionState(r) !== 'locked');
  const training = Data.all('stages').filter((s) => s.type === 'training');
  return h('div', { style: { display: 'grid', gap: '20px' } },
    h('div', null, h('h1', { class: 'h1' }, '탐사'), h('p', { class: 'lead' }, '전투로 실력을 확인하고, 열린 지역을 조사해 개체를 찾아요.')),
    sec('전투', '3개체 출전 · 2개체 대기',
      partyStrip(app),
      ...training.map((st) => h('section', { class: 'card', 'data-testid': `stage-${st.id}` },
        h('div', { class: 'row' }, h('span', { class: 'title grow' }, st.name), chip('보상 없음'), st.placeholder ? tempChip() : null),
        h('div', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'small muted grow' }, '상대'), st.enemies.map((e: any) => creatureArt(e.species, C.status(S(), e.species) === 'unknown' ? 'seen' : C.status(S(), e.species), 44))),
        h('button', { class: 'btn block', 'data-testid': `fight-${st.id}`, onclick: () => app.startBattle(st.id) }, icon('swords'), '전투 시작'))),
      h('p', { class: 'small muted', style: { margin: 0 } }, '일반 스테이지·보스는 다음 단계에서 열려요.')),
    sec('조사할 수 있는 지역', `잠긴 지역 ${regions.length - open.length}곳`, h('div', { class: 'list' }, open.length ? open.map((r) => regionRow(app, r)) : h('p', { class: 'empty' }, '열린 지역이 없어요'))),
  );
};

/** 편성 미리보기 (누르면 편성 화면) */
function partyStrip(app: App) {
  const party: string[] = S().collection.party;
  return h('button', { class: 'card tap', style: { textAlign: 'left', width: '100%' }, 'data-testid': 'party-strip', onclick: () => app.push('party', {}, '전투 편성') },
    h('div', { class: 'row' }, h('span', { class: 'label grow' }, '편성'), h('span', { class: 'small', style: { color: 'var(--accent)', fontWeight: 700 } }, '바꾸기'), icon('chev', 'chev')),
    h('div', { class: 'row', style: { gap: '6px' } }, party.map((uid, i) => {
      const c = uid ? C.creature(S(), uid) : undefined;
      return h('div', { style: { display: 'grid', justifyItems: 'center', gap: '2px', opacity: i >= Data.balance.party.active ? 0.6 : 1 } }, c ? creatureArt(c.species, 'owned', 48) : h('div', { style: { width: '48px', height: '48px', borderRadius: '50%', border: '1px dashed var(--line)' } }), h('span', { class: 'small faint' }, i < Data.balance.party.active ? '출전' : '대기'));
    })));
}

// ── 편성 ──
const party: Screen = (app) => {
  const p: string[] = S().collection.party;
  const nA = Data.balance.party.active;
  const sel: number = app.ui.partySlot ?? 0;
  const owned = C.ownedList(S(), '', 'rarity');
  return h('div', { style: { display: 'grid', gap: '18px' } },
    h('p', { class: 'lead' }, `앞 ${nA}자리가 먼저 싸우고, 뒤 자리는 대기해요. 전투 중 교체하거나 쓰러지면 대기 개체가 나와요. 자리를 고른 뒤 아래에서 개체를 누르세요.`),
    h('div', { class: 'party', 'data-testid': 'party' }, p.map((uid, i) => {
      const c = uid ? C.creature(S(), uid) : undefined;
      return h('button', { class: `slot ${i >= nA ? 'reserve' : ''} ${c ? '' : 'empty'}`, style: { borderColor: i === sel ? 'var(--accent)' : '', borderStyle: i === sel ? 'solid' : '' }, 'data-testid': `slot-${i}`, onclick: () => ((app.ui.partySlot = i), app.render(true)) },
        h('span', { class: 'tag' }, i < nA ? `출전 ${i + 1}` : `대기 ${i - nA + 1}`), c ? creatureArt(c.species, 'owned', 52) : '비어 있음', c ? h('span', null, C.displayName(c)) : null);
    })),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn ghost', disabled: !p[sel], 'data-testid': 'slot-clear', onclick: () => Game.setPartySlot(sel, '') }, `${sel < nA ? '출전' : '대기'} ${sel < nA ? sel + 1 : sel - nA + 1} 비우기`)),
    sec('보유 개체', `${owned.length}`, h('div', { class: 'grid3' }, owned.map((c) => {
      const at = p.indexOf(c.uid);
      return h('button', { class: 'dex-cell tap', style: { border: at === sel ? '2px solid var(--accent)' : '2px solid transparent' }, 'data-testid': `pick-${c.uid}`, onclick: () => Game.setPartySlot(sel, c.uid) },
        creatureArt(c.species, 'owned', 64), h('span', { class: 'name' }, C.displayName(c)), h('span', { class: 'small faint' }, at < 0 ? `Lv ${c.level}` : at < nA ? `출전 ${at + 1}` : `대기 ${at - nA + 1}`));
    }))),
  );
};

// ── 개체 ──
const creatures: Screen = (app) => {
  const cnt = C.counts(S());
  const filt: string = app.ui.el ?? '';
  const sort: 'recent' | 'rarity' | 'name' = app.ui.sort ?? 'recent';
  const list = C.ownedList(S(), filt, sort);
  const sortName = { recent: '최근', rarity: '희귀도', name: '이름' }[sort];
  const nextSort = { recent: 'rarity', rarity: 'name', name: 'recent' }[sort];
  return h('div', { style: { display: 'grid', gap: '20px' } },
    h('button', { class: 'card tap', style: { textAlign: 'left', width: '100%' }, 'data-testid': 'dex-card', onclick: () => app.push('dex', {}, '도감') },
      h('div', { class: 'row' }, h('div', { style: { display: 'flex' } }, Data.all('species').slice(0, 3).map((sp, i) => h('span', { style: { marginLeft: i ? '-18px' : '0' } }, creatureArt(sp.id, C.status(S(), sp.id), 56)))), h('div', { class: 'grow' }, h('span', { class: 'label' }, '도감'), h('div', { class: 'big num', style: { fontSize: '30px' } }, `${cnt.seen} / ${cnt.total}`), h('span', { class: 'small muted' }, `확보 ${cnt.ownedSpecies}종`)), icon('chev', 'chev'))),
    sec('전투 편성', null, partyStrip(app)),
    h('section', { class: 'sec' },
      h('div', { class: 'sec-head' }, h('h2', null, `보유 개체 ${list.length}`), h('button', { class: 'btn ghost', style: { minHeight: '40px' }, 'data-testid': 'sort', onclick: () => ((app.ui.sort = nextSort), app.render(true)) }, `정렬: ${sortName}`)),
      h('div', { class: 'seg', 'data-testid': 'filter' }, [['', '전체'], ...Data.all('elements').map((e) => [e.id, e.name])].map(([id, name]) => h('button', { class: filt === id ? 'on' : '', 'data-testid': `filter-${id || 'all'}`, onclick: () => ((app.ui.el = id), app.render(true)) }, name))),
      list.length
        ? h('div', { class: 'grid2', 'data-testid': 'owned' }, list.map((c) => {
            const sp = C.speciesOf(c);
            return h('button', { class: 'card tap', style: { justifyItems: 'center', textAlign: 'center' }, 'data-testid': `owned-${c.uid}`, onclick: () => app.push('creature', { uid: c.uid }, C.displayName(c)) }, creatureArt(c.species, 'owned', 104), h('div', { class: 'title' }, C.displayName(c)), h('div', { class: 'row', style: { gap: '6px' } }, elChip(sp), h('span', { class: 'small muted' }, `Lv ${c.level}`)));
          }))
        : h('div', { class: 'card' }, h('p', { class: 'empty' }, filt ? '이 속성의 개체가 없어요' : '아직 확보한 개체가 없어요'))),
  );
};

const dots = (lv: number) => h('div', { class: 'dots' }, Array.from({ length: C.researchMax() }, (_, i) => h('i', { class: i < lv ? 'on' : '' })));

const dex: Screen = (app) => {
  const cnt = C.counts(S());
  return h('div', { style: { display: 'grid', gap: '14px' } },
    h('p', { class: 'lead' }, `목격 ${cnt.seen} · 확보 ${cnt.ownedSpecies}종 · 전체 ${cnt.total}종. 목격하거나 확보하면 연구 데이터가 쌓여 정보가 열려요.`),
    h('div', { class: 'grid3', 'data-testid': 'dex' }, Data.all('species').map((sp) => {
      const st = C.status(S(), sp.id);
      const no = sp.id.replace('sp_', '');
      const inner = [creatureArt(sp.id, st, 76), h('span', { class: 'name', style: { color: st === 'unknown' ? 'var(--faint)' : '' } }, `No.${no} ${st === 'unknown' ? '???' : sp.name}`), dots(C.researchLevel(S(), sp.id))];
      return st === 'unknown' ? h('div', { class: 'dex-cell', 'data-testid': `dex-${sp.id}` }, inner) : h('button', { class: 'dex-cell tap', style: { border: 0 }, 'data-testid': `dex-${sp.id}`, onclick: () => app.push('species', { id: sp.id }, sp.name) }, inner);
    })),
  );
};

function gated(title: string, need: number, lv: number, body: Node) {
  return h('section', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'label grow' }, title), lv < need ? icon('lock', 'chev') : null), lv < need ? h('span', { class: 'faint' }, `연구 ${need}단계에서 공개돼요`) : body);
}

function statRows(stats: Record<string, number>) {
  return h('div', { class: 'list', style: { gap: '8px' }, 'data-testid': 'stats' }, Data.all('stats').map((st) => h('div', { class: 'stat-row' }, h('span', { class: 'muted' }, st.name), bar((stats[st.id] ?? 0) / 100), h('b', { class: 'num' }, stats[st.id] ?? 0))));
}

function skillList(sp: Item) {
  return h('div', { class: 'list', style: { gap: '8px' } }, sp.skills.map((id: string) => {
    const k = Data.get('skills', id)!;
    const eff = k.effect === 'damage' ? `공격력 ×${k.power}` : k.effect === 'heal' ? `회복 (공격력 ×${k.power})` : `${Data.get('stats', k.stat)?.name} ${k.effect === 'buff' ? '+' : '-'}${Math.round(k.amount * 100)}% · ${k.turns}라운드`;
    const tgt = { enemy: '적 하나', enemy_all: '적 모두', ally: '아군 하나', ally_all: '아군 모두', self: '자신' }[k.target as string];
    const use = k.kind === 'ultimate' ? '에너지 가득' : `에너지 ${k.cost} · 대기 ${k.cooldown}라운드`;
    return h('div', null, h('div', { class: 'row' }, h('b', { class: 'grow' }, k.name), chip(k.kind === 'ultimate' ? '궁극기' : '스킬', k.kind === 'ultimate' ? 'var(--warn)' : 'var(--accent)')), h('div', { class: 'small muted' }, `${tgt} · ${eff} · ${use}`));
  }));
}

function evolutionView(sid: string) {
  const line = C.evolutionLine(sid);
  const byStage: Record<number, Item[]> = {};
  for (const s of line) (byStage[s.evolution.stage] ??= []).push(s);
  const sp = Data.get('species', sid)!;
  const nexts = sp.evolution.next ?? [];
  return h('div', { class: 'list', style: { gap: '8px' } },
    Object.keys(byStage).sort().map((stg) => h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small faint', style: { width: '36px' } }, `${stg}단계`), byStage[+stg].map((s) => {
      const st = C.status(S(), s.id);
      return h('div', { style: { display: 'grid', justifyItems: 'center' } }, creatureArt(s.id, st, 52), h('span', { class: 'small', style: { fontWeight: s.id === sid ? 700 : 500 } }, st === 'unknown' ? '???' : s.name));
    }))),
    h('span', { class: 'small', style: { color: nexts.length > 1 ? 'var(--warn)' : 'var(--muted)' } }, nexts.length > 1 ? `${nexts.length}갈래로 진화할 수 있어요 (분기 진화는 나중에 열려요)` : nexts.length ? '다음 단계로 진화할 수 있어요. 조건은 육성 단계에서 정해져요.' : '마지막 단계예요.'));
}

const species: Screen = (app, args) => {
  const sp = Data.get('species', args.id);
  if (!sp) return h('p', { class: 'empty' }, '개체 정보를 찾을 수 없어요');
  const st = C.status(S(), sp.id);
  const lv = C.researchLevel(S(), sp.id);
  const pts = C.researchPoints(S(), sp.id);
  const need = C.nextLevelNeed(S(), sp.id);
  const cfg = Data.research();
  const hs = C.habitats(sp.id);
  return h('div', { style: { display: 'grid', gap: '14px' } },
    h('div', { style: { display: 'grid', justifyItems: 'center' } }, creatureArt(sp.id, st, 180, true)),
    h('div', { class: 'chips' }, chip({ seen: '목격', owned: '확보', unknown: '모름' }[st], st === 'owned' ? 'var(--accent)' : 'var(--muted)'), elChip(sp), rarityChip(sp), sp.placeholder ? tempChip() : null),
    h('section', { class: 'card', 'data-testid': 'research' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, `연구 ${lv}단계`), h('span', { class: 'small muted' }, `${pts}점${need > 0 ? ` · 다음 단계 ${need}점` : ' · 최고 단계'}`)), bar(pts / cfg.levels.at(-1)!, 'var(--teal)'), h('span', { class: 'small faint' }, `목격 +${cfg.sighting} · 확보 +${cfg.owned} · 중복 확보 +${cfg.duplicate}`)),
    gated('서식지', 1, lv, h('div', { class: 'list', style: { gap: '4px' } }, C.evolutionOnly(sp.id) ? h('span', null, '야생에서는 만날 수 없어요. 진화로 얻어요.') : null, hs.map((x) => h('span', null, `${Data.get('regions', x.region)!.name} · ${x.method === 'egg' ? '알 발견' : '야생 목격'} · ${x.from_survey}차 조사부터`)), (Data.meta.starting_creatures ?? []).includes(sp.id) ? h('span', null, '탐사를 시작할 때 함께 출발해요') : null)),
    gated('기본 능력치', 2, lv, statRows(sp.base_stats)),
    gated('스킬', 2, lv, skillList(sp)),
    gated('생태 능력', 3, lv, h('div', null, sp.eco_abilities.map((id: string) => {
      const e = Data.get('eco_abilities', id)!;
      return h('div', null, `${e.name} — ${e.desc}`);
    }))),
    gated('진화', 3, lv, evolutionView(sp.id)),
  );
};

const CTABS = [['info', '정보'], ['skills', '스킬'], ['evo', '진화']] as const;
const creature: Screen = (app, args) => {
  const c = C.creature(S(), args.uid);
  if (!c) return h('p', { class: 'empty' }, '개체를 찾을 수 없어요');
  const sp = C.speciesOf(c);
  const el = Data.get('elements', sp.element)!;
  const where = c.region ? Data.get('regions', c.region)?.name : '';
  const stats = C.statsOf(c);
  if (app.ui.cuid !== c.uid) Object.assign(app.ui, { cuid: c.uid, ctab: 'info' });
  const tab = app.ui.ctab;
  const body =
    tab === 'skills'
      ? h('section', { class: 'card' }, skillList(sp))
      : tab === 'evo'
        ? h('section', { class: 'card' }, evolutionView(c.species))
        : h('div', { style: { display: 'grid', gap: '12px' } },
            h('section', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, `Lv ${c.level}`), h('span', { class: 'small muted' }, `경험치 ${c.exp}`)), bar(0), h('span', { class: 'small faint' }, '레벨과 경험치는 육성 단계(B3)에서 오르기 시작해요.')),
            h('section', { class: 'card' }, h('span', { class: 'label' }, '고유 특성'), sp.traits.map((id: string) => h('div', null, `${Data.get('traits', id)!.name} — ${Data.get('traits', id)!.desc}`)), h('span', { class: 'label' }, '생태 능력 (행성에 주는 영향)'), sp.eco_abilities.map((id: string) => h('div', null, `${Data.get('eco_abilities', id)!.name} — ${Data.get('eco_abilities', id)!.desc}`))),
            h('section', { class: 'card' }, h('span', { class: 'label' }, '얻은 방법'), h('span', null, `${METHOD_TEXT[c.method] ?? c.method}${where ? ' · ' + where : ''} · ${new Date(c.obtained_at).toLocaleDateString('ko-KR')}`)),
            h('button', { class: 'btn ghost block', 'data-testid': 'open-species', onclick: () => app.push('species', { id: c.species }, sp.name) }, `도감에서 보기 (연구 ${C.researchLevel(S(), c.species)}단계)`));
  return h('div', { style: { display: 'grid', gap: '12px' } },
    h('div', { class: 'hero', style: { '--el': el.color } },
      h('div', { class: 'hero-art' }, creatureArt(c.species, 'owned', 190, true)),
      h('div', { class: 'hero-meta' },
        h('div', { class: 'hero-name' }, h('b', null, C.displayName(c)), h('span', { class: 'num' }, `Lv ${c.level}`)),
        h('div', { class: 'chips' }, elChip(sp), rarityChip(sp), chip(Data.get('roles', sp.role)!.name), sp.placeholder ? tempChip() : null))),
    h('div', { class: 'stat-tiles', 'data-testid': 'stats' }, Data.all('stats').map((st) => h('div', null, h('span', null, st.name), h('b', { class: 'num' }, stats[st.id] ?? 0)))),
    h('div', { class: 'tabs', role: 'tablist' }, CTABS.map(([id, name]) => h('button', { role: 'tab', 'aria-selected': String(tab === id), class: tab === id ? 'on' : '', 'data-testid': `ctab-${id}`, onclick: () => ((app.ui.ctab = id), app.render(true)) }, name))),
    body,
  );
};

// ── 연구 ──
const research: Screen = () =>
  h('div', { style: { display: 'grid', gap: '18px' } },
    h('h1', { class: 'h1' }, '연구'),
    ...[['기술 연구', '시설과 탐사 장비를 개선해요'], ['생태 연구', '개체의 생태 능력과 행성 환경을 연구해요']].map(([t, d]) => h('section', { class: 'card' }, h('div', { class: 'title' }, t), h('span', { class: 'muted' }, d), h('span', { class: 'small faint' }, '연구 항목은 이후 단계에서 설정 파일로 추가돼요.'))),
    sec('기록', `최근 ${Math.min(S().log.length, 20)}개`, h('div', { class: 'card' }, logList(20))));

// ── 설정 ──
const settings: Screen = (app) => {
  const lastSaved = S().meta.updated_at;
  return h('div', { style: { display: 'grid', gap: '20px' } },
    sec('화면 모드', null, h('div', { class: 'btn-row' }, (['dark', 'light'] as const).map((m) => h('button', { class: `btn ${Game.settings.theme === m ? '' : 'ghost'}`, 'data-testid': `theme-${m}`, onclick: () => Game.setSettings({ theme: m }) }, m === 'dark' ? '어둡게' : '밝게')))),
    sec('저장 데이터', null, h('div', { class: 'card' },
      h('span', { class: 'small muted' }, `진행 상황은 바뀔 때마다 이 기기에 자동 저장돼요. 마지막 변경: ${ago(lastSaved)}`),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', 'data-testid': 'export', onclick: () => exportSheet(app) }, '내보내기'), h('button', { class: 'btn ghost', 'data-testid': 'import', onclick: () => importSheet(app) }, '가져오기')),
      h('button', { class: 'btn ghost block', 'data-testid': 'reset', onclick: () => app.confirm('처음부터 다시 할까요?', '모든 탐사 기록이 지워져요. 되돌릴 수 없어요.', '모두 지우기', () => Game.reset()) }, '처음부터 다시'))),
    sec('콘텐츠', null, h('div', { class: 'card', 'data-testid': 'content-info' },
      h('span', null, `게임 버전 ${__APP_VERSION__} · 콘텐츠 버전 ${Data.meta.content_version}`),
      h('span', null, `확정된 설정: 기본 속성 4종 (${Data.all('elements').map((e) => e.name).join(', ')})`),
      h('span', { style: { color: 'var(--warn)' } }, `임시(미확정) 항목 ${Data.placeholderCount()}개 — 이름·수치는 설정 파일에서 바꿔요`))),
  );
};

function exportSheet(app: App) {
  const text = Game.exportText();
  app.sheet((box, close) => {
    const note = h('p', { class: 'small muted' }, `이 글자 전체가 저장 데이터예요. 복사해서 안전한 곳에 보관하세요. (${Math.ceil(text.length / 1024)}KB)`);
    const ta = h('textarea', { class: 'input', readonly: true, 'data-testid': 'export-text' });
    ta.value = text;
    box.append(h('h2', null, '저장 데이터 내보내기'), ta, note, h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: close }, '닫기'), h('button', { class: 'btn', onclick: async () => {
      try {
        await navigator.clipboard.writeText(text);
        note.textContent = '복사했어요. 메모 앱 등에 붙여 넣어 보관하세요.';
      } catch {
        ta.select();
        note.textContent = '자동 복사가 막혀 있어요. 글자를 길게 눌러 전체 선택 후 복사해 주세요.';
      }
    } }, '복사하기')));
  });
}

function importSheet(app: App) {
  app.sheet((box, close) => {
    const ta = h('textarea', { class: 'input', placeholder: '내보낸 글자를 여기에 붙여 넣어 주세요', 'data-testid': 'import-text' });
    const status = h('p', { class: 'small', style: { color: 'var(--warn)' }, 'data-testid': 'import-status' }, '가져오면 지금 기록은 가져온 기록으로 바뀌어요.');
    box.append(h('h2', null, '저장 데이터 가져오기'), ta, status, h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: close }, '취소'), h('button', { class: 'btn danger', 'data-testid': 'import-go', onclick: () => {
      if (!ta.value.trim()) return void (status.textContent = '붙여 넣은 글자가 없어요.');
      const r = Game.importText(ta.value);
      if (r.error) return void (status.textContent = r.error);
      close();
      app.toast('기록을 가져왔어요');
    } }, '가져오기')));
  });
}

export const screens: Record<string, Screen> = { base, planet, region, explore, party, creatures, dex, species, creature, research, settings };
