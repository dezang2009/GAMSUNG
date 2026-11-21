// Inventory 시스템 — 아이템 보유, 꾸러미 열기, 장비 인스턴스 생성.
// 쌓이는 아이템(꾸러미/물약)은 GameState.inventory, 장비(무기/방어구)는 한 개씩 레벨·등급을 가지므로 GameState.gear 에 둔다.
//   수신 'item:gain'      { id, count }  아이템 획득 (장비는 count 개의 새 장비가 만들어진다)
//   수신 'inventory:use'  { id }         꾸러미 열기
//   수신 'inventory:consume' { id }      한 개 소모 (전투 중 물약 사용)
//   발신 'inventory:changed'              가방 내용이 바뀜
//   발신 'gear:added' { uid }             새 장비가 생김 (장착 여부는 Equipment 가 정한다)
//   발신 'inventory:opened' { id, gained } 꾸러미를 열어 gained 를 얻음
Game.register('inventory', {
  init({ Events, GameState }) {
    let uidSeq = 1;
    const isGear = (id) => ItemData[id].type === 'weapon' || ItemData[id].type === 'armor';
    const sorted = (items) => items.sort((a, b) =>
      ItemTypes[ItemData[a.id].type].order - ItemTypes[ItemData[b.id].type].order);

    function add(list, id, count) {
      const found = list.find((it) => it.id === id);
      if (found) found.count += count;
      else list.push({ id, count });
    }

    function gain(entries) {
      const list = GameState.get('inventory').items.map((it) => ({ ...it }));
      const gear = GameState.get('gear').list;
      const added = [];
      for (const { id, count } of entries) {
        if (!ItemData[id]) continue;
        if (isGear(id)) {
          for (let i = 0; i < count; i++) {
            const inst = { uid: 'g' + uidSeq++, id, level: 1, exp: 0, grade: 1, offered: [] };
            gear.push(inst);
            added.push(inst.uid);
          }
        } else {
          add(list, id, count);
        }
      }
      GameState.patch('inventory', { items: sorted(list) });
      GameState.patch('gear', { list: gear });
      Events.emit('inventory:changed');
      for (const uid of added) Events.emit('gear:added', { uid });
    }

    Events.on('item:gain', ({ id, count }) => gain([{ id, count: count || 1 }]));

    function consume(id) {
      const items = GameState.get('inventory').items;
      const held = items.find((it) => it.id === id);
      if (!held) return false;
      const list = items.map((it) => ({ ...it })).filter((it) => it.id !== id || it.count > 1);
      const left = list.find((it) => it.id === id);
      if (left) left.count -= 1;
      GameState.patch('inventory', { items: list });
      return true;
    }

    Events.on('inventory:consume', ({ id }) => {
      if (consume(id)) Events.emit('inventory:changed');
    });

    Events.on('inventory:use', ({ id }) => {
      const def = ItemData[id];
      if (!def || def.type !== 'package' || !consume(id)) return;
      gain(def.contents);
      Events.emit('inventory:opened', { id, gained: def.contents.map((c) => ({ ...c })) });
    });
  },
});
