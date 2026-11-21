// Shop 시스템 — NPC 상점: 사고 팔기.
//   수신 'shop:buy' { id, count }           구매: 골드가 충분하면 가격만큼 쓰고 아이템을 받는다
//   수신 'shop:sell' { id, count }          아이템 판매
//   발신 'inventory:consume' { id, count }  판 아이템 소모
//   발신 'gold:gain' { amount }             골드 지급 (Economy 가 처리)
//   발신 'item:gain' { id, count }          구매한 아이템
//   발신 'shop:sold' { id, count, amount }  판매 결과
//   발신 'shop:bought' { id, count, amount } 구매 결과 / 'shop:failed' { reason } 실패(골드 부족 등)
// 파는 가격은 data/items.js 의 sell(개당 골드), 사는 가격은 data/shop.js 의 ShopStock. sell 이 없는 아이템은 팔 수 없다.
Game.register('shop', {
  init({ Events, GameState }) {
    Events.on('shop:buy', ({ id, count }) => {
      const stock = ShopStock.shop.find((x) => x.id === id);
      if (!stock || !ItemData[id]) return;
      const n = Math.max(1, Math.min(count || 1, 99));
      const amount = stock.price * n;
      if (GameState.get('wallet').gold < amount) {
        Events.emit('shop:failed', { reason: 'gold' });
        return;
      }
      Events.emit('gold:gain', { amount: -amount });
      Events.emit('item:gain', { id, count: n });
      Events.emit('shop:bought', { id, count: n, amount });
    });

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
