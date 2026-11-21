// 게임 상태 저장소. 화면(HUD 등)은 여기서 읽고, 변경은 patch 로만 하며 변경 시 이벤트가 발생한다.
//   Events: 'state:player' | 'state:wallet' | 'state:location'
// 아직 실제 성장/경제 기능이 없으므로 값은 임시 초기값이다.
const GameState = (() => {
  const data = {
    player: { level: 1, hp: 100, maxHp: 100, mp: 30, maxMp: 30 },
    wallet: { gold: 0 },
    location: { id: null, name: '', type: 'village' },
  };

  function get(slice) {
    return data[slice];
  }

  function patch(slice, values) {
    Object.assign(data[slice], values);
    Events.emit('state:' + slice, data[slice]);
  }

  return { get, patch };
})();
