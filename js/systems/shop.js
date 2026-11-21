// Shop 시스템 — NPC 판매소: 몬스터 전리품 등을 골드로 바꾼다. (사는 기능은 아직 없다)
//   수신 'shop:sell' { id, count }          아이템 판매
//   발신 'inventory:consume' { id, count }  판 아이템 소모
//   발신 'gold:gain' { amount }             골드 지급 (Economy 가 처리)
//   발신 'shop:sold' { id, count, amount }  판매 결과
// 판매 가격은 data/items.js 의 sell(개당 골드). sell 이 없는 아이템은 팔 수 없다.
Game.register('shop', {
  init({ Events, GameState }) {
    Events.on('shop:sell', ({ id, count }) => {
      const def = ItemData[id];
      const held = GameState.get('inventory').items.find((it) => it.id === id);
      if (!def || !def.sell || !held) return;
      const n = Math.max(1, Math.min(count || 1, held.count));
      const amount = def.sell * n;
      Events.emit('inventory:consume', { id, count: n });
      Events.emit('gold:gain', { amount });
      Events.emit('shop:sold', { id, count: n, amount });
    });
  },
});
