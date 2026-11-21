// Save 시스템 — 세이브 파일 3개 저장/불러오기, 10분마다 자동 저장.
//   수신 'save:request' { slot }   저장 (slot 생략 시 현재 슬롯)
//   수신 'save:new' { slot }       빈 슬롯으로 새 게임 시작 -> 상태 초기화 후 'game:new'
//   수신 'save:load' { slot }      슬롯 불러오기 -> 상태 복원 후 'game:loaded' { data }
//   수신 'game:quit'               타이틀로 돌아감 (자동 저장 중지)
//   발신 'save:collect' payload    월드가 현재 위치/플레이 시간을 payload 에 채운다 (전투 중이면 payload.blocked = true)
//   발신 'save:done' { slot, auto }
// 월드(위치) 정보는 이 시스템이 모르므로 'save:collect' 로 받아 온다.
Game.register('save', {
  init({ Events, GameState }) {
    const AUTOSAVE_MS = 10 * 60 * 1000;
    const RETRY_MS = 5000;     // 전투 중이라 못 저장했을 때 다시 시도하는 간격
    let timer = 0;

    function save(slot, auto) {
      const c = { world: null, playSeconds: 0, blocked: false };
      Events.emit('save:collect', c);
      if (c.blocked || !c.world) return false;
      const ok = SaveStore.write(slot, { savedAt: Date.now(), state: GameState.snapshot(), world: c.world, playSeconds: c.playSeconds });
      if (!ok) {
        Events.emit('toast', { text: '저장에 실패했어요. (저장 공간을 확인해 주세요)' });
        return true;
      }
      SaveStore.current = slot;
      Events.emit('save:done', { slot, auto });
      Events.emit('toast', { text: auto ? `자동 저장했어요. (파일 ${slot})` : `파일 ${slot}에 저장했어요.` });
      return true;
    }

    function startTimer() {
      stopTimer();
      timer = setTimeout(function tick() {
        if (SaveStore.current && !save(SaveStore.current, true)) timer = setTimeout(tick, RETRY_MS);
        else timer = setTimeout(tick, AUTOSAVE_MS);
      }, AUTOSAVE_MS);
    }

    function stopTimer() {
      clearTimeout(timer);
    }

    Events.on('save:request', ({ slot }) => {
      const n = slot || SaveStore.current;
      if (n) save(n, false);
    });

    Events.on('save:new', ({ slot }) => {
      SaveStore.current = slot;
      GameState.reset();
      Events.emit('game:new', { slot });
      startTimer();
    });

    Events.on('save:load', ({ slot }) => {
      const data = SaveStore.read(slot);
      if (!data) return;
      SaveStore.current = slot;
      GameState.restore(data.state);
      Events.emit('game:loaded', { slot, data });
      startTimer();
    });

    Events.on('game:quit', () => {
      stopTimer();
      SaveStore.current = null;
    });
  },
});
