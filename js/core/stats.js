// 능력치 합산: 캐릭터 기본 능력치 + 장착한 장비(무기 숙련 레벨, 등급 배율 반영)
const Stats = {
  // 장착 중인 장비 인스턴스 (없으면 null)
  equipped(slot) {
    const uid = GameState.get('equipment')[slot];
    return GameState.get('gear').list.find((g) => g.uid === uid) || null;
  },

  weaponAtk(inst) {
    if (!inst) return 0;
    const w = ItemData[inst.id].weapon;
    return (w.atk + w.atkPerLevel * (inst.level - 1)) * Progression.gradeMult(inst.grade);
  },

  armorDef(inst) {
    if (!inst) return 0;
    return ItemData[inst.id].armor.def * Progression.gradeMult(inst.grade);
  },

  total() {
    const p = GameState.get('player');
    const weapon = Stats.equipped('weapon'), armor = Stats.equipped('armor');
    return {
      atk: p.atk + Stats.weaponAtk(weapon),
      def: p.def + Stats.armorDef(armor),
      spd: p.spd,
      weapon, armor,
    };
  },
};
