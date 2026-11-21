// Inventory 시스템 — 아이템 보유와 꾸러미 열기.
// 상태는 GameState.inventory 에 두고, 다른 곳과는 이벤트로만 통신한다.
//   수신 'item:gain'      { id, count }  아이템 획득
//   수신 'inventory:use'  { id }         꾸러미 열기
//   수신 'inventory:consume' { id }      한 개 소모 (전투 중 물약 사용)
//   발신 'inventory:changed'              가방 내용이 바뀜
//   발신 'inventory:opened' { id, gained } 꾸러미를 열어 gained 를 얻음
Game.register('inventory', {
  init({ Events, GameState }) {
    const sorted = (items) => items.sort((a, b) =>
      ItemTypes[ItemData[a.id].type].order - ItemTypes[ItemData[b.id].type].order);

    function add(list, id, count) {
      const found = list.find((it) => it.id === id);
      if (found) found.count += count;
      else list.push({ id, count });
    }

    function gain(entries) {
      const list = GameState.get('inventory').items.map((it) => ({ ...it }));
      for (const { id, count } of entries) if (ItemData[id]) add(list, id, count);
      GameState.patch('inventory', { items: sorted(list) });
      Events.emit('inventory:changed');
    }

    Events.on('item:gain', ({ id, count }) => gain([{ id, count: count || 1 }]));

    // 한 개 소모 (전투 중 물약 사용 등)
    Events.on('inventory:consume', ({ id }) => {
      const items = GameState.get('inventory').items;
      const held = items.find((it) => it.id === id);
      if (!held) return;
      const list = items.map((it) => ({ ...it })).filter((it) => it.id !== id || it.count > 1);
      const left = list.find((it) => it.id === id);
      if (left) left.count -= 1;
      GameState.patch('inventory', { items: list });
      Events.emit('inventory:changed');
    });

    Events.on('inventory:use', ({ id }) => {
      const def = ItemData[id];
      const items = GameState.get('inventory').items;
      const held = items.find((it) => it.id === id);
      if (!def || !held || def.type !== 'package') return;
      const list = items.map((it) => ({ ...it })).filter((it) => it.id !== id || it.count > 1);
      const left = list.find((it) => it.id === id);
      if (left) left.count -= 1;
      GameState.patch('inventory', { items: list });
      gain(def.contents);
      Events.emit('inventory:opened', { id, gained: def.contents.map((c) => ({ ...c })) });
    });
  },
});
