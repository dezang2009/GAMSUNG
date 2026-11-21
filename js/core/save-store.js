// 세이브 파일 저장소 (localStorage). 슬롯은 3개.
// 저장 형식: { version, savedAt, state(GameState.snapshot), world: { region, x, y }, playSeconds }
const SaveStore = (() => {
  const SLOTS = 3;
  const VERSION = 1;
  const key = (n) => `pixelrpg:save:${n}`;

  function read(n) {
    try {
      const raw = localStorage.getItem(key(n));
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.version === VERSION && data.state ? data : null;
    } catch (e) {
      return null;
    }
  }

  function write(n, data) {
    try {
      localStorage.setItem(key(n), JSON.stringify({ ...data, version: VERSION }));
      return true;
    } catch (e) {
      return false;   // 저장 공간 부족, 사생활 보호 모드 등
    }
  }

  function remove(n) {
    try { localStorage.removeItem(key(n)); } catch (e) { /* 무시 */ }
  }

  const two = (v) => String(v).padStart(2, '0');

  // 슬롯 목록 화면에 보여 줄 요약
  function summary(n) {
    const d = read(n);
    if (!d) return null;
    const p = d.state.player;
    const loc = typeof Regions !== 'undefined' ? Regions.find((r) => r.id === (d.world && d.world.region)) : null;
    const t = new Date(d.savedAt);
    const mins = Math.floor((d.playSeconds || 0) / 60);
    return {
      level: p.level,
      gold: d.state.wallet.gold,
      place: loc ? loc.name : '',
      savedAt: `${t.getMonth() + 1}/${t.getDate()} ${two(t.getHours())}:${two(t.getMinutes())}`,
      play: mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`,
    };
  }

  return { SLOTS, read, write, remove, summary };
})();
