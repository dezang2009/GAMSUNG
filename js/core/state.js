// 게임 상태 저장소. 화면(HUD 등)은 여기서 읽고, 변경은 patch 로만 하며 변경 시 이벤트가 발생한다.
//   Events: 'state:player' | 'state:wallet' | 'state:location' | 'state:inventory' | 'state:gear' | 'state:equipment' | 'state:skills' | 'state:quests' | 'state:flags'
// 아직 실제 성장/경제 기능이 없으므로 값은 임시 초기값이다.
const GameState = (() => {
  const data = {
    // atk/def/spd 는 캐릭터 기본값이며, 장비 능력치는 Stats.total() 로 합산한다
    player: { name: '용사', level: 1, exp: 0, hp: 100, maxHp: 100, mp: 30, maxMp: 30, atk: 10, def: 3, spd: 5 },
    wallet: { gold: 0 },
    location: { id: null, name: '', type: 'village' },
    inventory: { items: [] },   // 쌓이는 아이템 [{ id, count }] — Inventory 시스템이 관리
    gear: { list: [] },         // 장비 한 개 한 개 [{ uid, id, level, exp, grade, offered }] — 레벨/등급이 개별로 있다
    equipment: { weapon: null, armor: null },   // 장착 중인 장비의 uid
    skills: { known: [] },      // 배운 기술 id (최대 4개) — Character 시스템이 관리
    quests: { active: {}, done: [] },   // 진행 중 의뢰 { id: { progress } } / 끝낸 의뢰 id — Quest 시스템이 관리
    flags: {},                  // 한 번만 일어나는 일의 기록 (예: starterPackage)
  };

  const INITIAL = JSON.parse(JSON.stringify(data));
  const SAVED = ['player', 'wallet', 'inventory', 'gear', 'equipment', 'skills', 'quests', 'flags']; // 저장 대상 (location 은 월드가 따로 관리)

  function get(slice) {
    return data[slice];
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));

  // 저장용 복사본 / 저장본으로 되돌리기 / 새 게임 초기화
  function snapshot() {
    const out = {};
    for (const k of SAVED) out[k] = clone(data[k]);
    return out;
  }

  function restore(snap) {
    for (const k of SAVED) {
      data[k] = clone(snap && snap[k] ? snap[k] : INITIAL[k]);
      Events.emit('state:' + k, data[k]);
    }
  }

  function patch(slice, values) {
    Object.assign(data[slice], values);
    Events.emit('state:' + slice, data[slice]);
  }

  return { get, patch, snapshot, restore, reset: () => restore(null) };
})();
