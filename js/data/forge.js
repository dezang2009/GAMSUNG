// 대장간 규칙: 장비 등급(★) 올리기.
//   successRate[현재 등급] : 그 등급에서 다음 등급으로 올릴 때의 기본 성공 확률
//   재료의 forge.chanceBonus 가 더해진다 (희귀한 재료일수록 확률이 오르도록 추후 재료를 추가한다)
const Forge = {
  maxGrade: 6,
  successRate: { 1: 0.9, 2: 0.75, 3: 0.5, 4: 0.35, 5: 0.1 },

  chance(grade, materialDef) {
    const base = Forge.successRate[grade] || 0;
    const bonus = materialDef && materialDef.forge ? materialDef.forge.chanceBonus : 0;
    return Math.max(0, Math.min(1, base + bonus));
  },
};

// 대장간 제작 도감. 상점에서 파는 같은 무기보다 더 높은 등급(grade)으로 만들어진다.
//   result : 만들어지는 장비, grade : 시작 등급, gold : 제작비, needs : 필요한 재료
// 레시피는 몬스터 소재를 많이 모아야 하고, 보스 소재가 필요한 것이 가장 강하다.
const ForgeRecipes = [
  {
    id: 'craft_iron_dagger', result: 'iron_dagger', grade: 2, gold: 120,
    needs: [{ id: 'upgrade_stone', count: 2 }, { id: 'rat_tail', count: 8 }, { id: 'slime_jelly', count: 8 }],
  },
  {
    id: 'craft_hunter_axe', result: 'hunter_axe', grade: 2, gold: 300,
    needs: [{ id: 'upgrade_stone', count: 4 }, { id: 'mushroom_cap', count: 10 }, { id: 'goblin_horn', count: 1 }],
  },
  {
    id: 'craft_goblin_mace', result: 'goblin_mace', grade: 3, gold: 600,
    needs: [{ id: 'goblin_horn', count: 3 }, { id: 'upgrade_stone', count: 6 }, { id: 'mushroom_cap', count: 10 }],
  },
];
