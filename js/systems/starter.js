// Starter 시스템 — 처음 입장했을 때 받는 보상(초보자 패키지).
// NPC 데이터의 gift 설정을 보고, 그 NPC 와 처음 대화를 마치면 한 번만 지급한다.
//   수신 'dialog:end' { npc, reachedEnd }
//   발신 'item:gain', 'toast'
Game.register('starter', {
  init({ Events, GameState }) {
    Events.on('dialog:end', ({ npc, reachedEnd }) => {
      const gift = npc && npc.gift;
      if (!gift || !reachedEnd) return;
      if (GameState.get('flags')[gift.flag]) return;
      GameState.patch('flags', { [gift.flag]: true });
      for (const item of gift.items) Events.emit('item:gain', item);
      Events.emit('toast', { text: gift.toast });
    });
  },
});
