// Crafting 시스템 — 대장간 강화(등급 올리기). 제작/분해 같은 다른 기능은 추후 이어서 만든다.
//   수신 'forge:enhance' { uid, materialId }   강화 시도: 재료 1개를 쓰고, 확률에 따라 성공하면 등급 +1
//   발신 'inventory:consume' { id }            재료 소모
//   발신 'gear:upgrade' { uid }                성공 시 (Equipment 가 등급을 올린다)
//   발신 'forge:result' { success, uid, from, to, chance, materialId }
// 성공 확률: Forge.successRate[현재 등급] + 재료의 chanceBonus
Game.register('crafting', {
  init({ Events, GameState }) {
    Events.on('forge:enhance', ({ uid, materialId }) => {
      const inst = GameState.get('gear').list.find((g) => g.uid === uid);
      const mat = ItemData[materialId];
      const held = GameState.get('inventory').items.find((it) => it.id === materialId);
      if (!inst || !mat || !mat.forge || !held) return;
      if (inst.grade >= Forge.maxGrade) return;

      const chance = Forge.chance(inst.grade, mat);
      const from = inst.grade;
      Events.emit('inventory:consume', { id: materialId });
      const success = Math.random() < chance;
      if (success) Events.emit('gear:upgrade', { uid });
      Events.emit('forge:result', { success, uid, from, to: success ? from + 1 : from, chance, materialId });
    });
  },
});
