// Quest 시스템 — 의뢰 수락, 진행(처치/수집), 완료와 보상.
//   수신 'quest:accept' { id }        의뢰 수락
//   수신 'quest:turnin' { id }        목표를 채운 의뢰의 보상 받기 (수집 의뢰는 아이템을 가져간다)
//   수신 'monster:defeated' { id }    처치 의뢰 진행
//   발신 'quest:changed'              의뢰 상태가 바뀜
//   발신 'gold:gain' / 'exp:gain' / 'item:gain'  보상 지급
// 상태: GameState.quests = { active: { id: { progress } }, done: [id] }
Game.register('quest', {
  init({ Events, GameState }) {
    const state = () => GameState.get('quests');
    const find = (id) => QuestData.find((q) => q.id === id);
    const held = (item) => (GameState.get('inventory').items.find((it) => it.id === item) || { count: 0 }).count;

    // 현재 진행도 (처치: 기록된 수, 수집: 가방에 있는 수)
    function progressOf(q) {
      if (q.goal.type === 'collect') return Math.min(q.goal.count, held(q.goal.item));
      return Math.min(q.goal.count, (state().active[q.id] || { progress: 0 }).progress);
    }

    Events.on('quest:accept', ({ id }) => {
      const q = find(id);
      const s = state();
      if (!q || s.active[id] || s.done.includes(id)) return;
      if (q.after && !q.after.every((a) => s.done.includes(a))) return;
      GameState.patch('quests', { active: { ...s.active, [id]: { progress: 0 } } });
      Events.emit('quest:changed');
      Events.emit('toast', { text: `의뢰를 수락했어요: ${q.name}` });
    });

    Events.on('monster:defeated', ({ id }) => {
      const s = state();
      const active = { ...s.active };
      let changed = false;
      for (const q of QuestData) {
        if (!active[q.id] || q.goal.type !== 'kill' || q.goal.target !== id) continue;
        if (active[q.id].progress >= q.goal.count) continue;
        active[q.id] = { progress: active[q.id].progress + 1 };
        changed = true;
        const p = active[q.id].progress;
        Events.emit('toast', { text: p >= q.goal.count ? `의뢰 목표 달성! 의뢰소에서 보상을 받으세요. (${q.name})` : `${q.name} (${p}/${q.goal.count})` });
      }
      if (changed) {
        GameState.patch('quests', { active });
        Events.emit('quest:changed');
      }
    });

    // 수집 의뢰는 가방이 바뀔 때 화면만 갱신한다
    Events.on('inventory:changed', () => Events.emit('quest:changed'));

    Events.on('quest:turnin', ({ id }) => {
      const q = find(id);
      const s = state();
      if (!q || !s.active[id] || progressOf(q) < q.goal.count) return;
      if (q.goal.type === 'collect') Events.emit('inventory:consume', { id: q.goal.item, count: q.goal.count });
      const active = { ...s.active };
      delete active[id];
      GameState.patch('quests', { active, done: [...s.done, id] });
      const r = q.reward || {};
      if (r.gold) Events.emit('gold:gain', { amount: r.gold });
      if (r.exp) Events.emit('exp:gain', { amount: r.exp });
      for (const it of r.items || []) Events.emit('item:gain', it);
      Events.emit('quest:changed');
      Events.emit('quest:completed', { id });
      Events.emit('toast', { text: `의뢰 완료! 보상을 받았어요. (${q.name})` });
    });
  },
});
