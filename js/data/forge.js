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
