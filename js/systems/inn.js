// Inn 시스템 — 여관: 골드를 내고 쉬면 HP/MP 가 모두 회복된다.
//   수신 'inn:rest'              휴식 요청
//   발신 'gold:gain' { amount }  요금 (음수)
//   발신 'inn:rested'            휴식 완료 / 'inn:failed' { reason: 'gold' | 'full' }
Game.register('inn', {
  init({ Events, GameState }) {
    Events.on('inn:rest', () => {
      const p = GameState.get('player');
      if (p.hp >= p.maxHp && p.mp >= p.maxMp) { Events.emit('inn:failed', { reason: 'full' }); return; }
      if (GameState.get('wallet').gold < Services.innCost) { Events.emit('inn:failed', { reason: 'gold' }); return; }
      Events.emit('gold:gain', { amount: -Services.innCost });
      GameState.patch('player', { hp: p.maxHp, mp: p.maxMp });
      Events.emit('inn:rested');
    });
  },
});
