// 몬스터 드롭 테이블. 몬스터 id 마다 "무엇을 / 몇 % 로 / 몇 개" 떨어뜨리는지 한곳에서 정리한다.
//   { id: 아이템 id, chance: 0~1, count: [최소, 최대] (생략 시 1개) }
// 구성 원칙
//   - 강화석(강화재료): 대부분의 몬스터가 낮은 확률로 떨어뜨린다. 강한 몬스터일수록 확률이 높다.
//   - 소재(loot): 그 몬스터만의 전리품. 쉽게 얻는 소재는 50%, 보스/희귀 소재는 확정 또는 높은 확률.
//   - 물약: 낮은 확률의 덤. 보스는 넉넉히 준다.
// 새 몬스터를 만들면 여기에 한 줄만 추가한다.
const DropTables = {
  // ---- 초록숲 ----
  blue_slime: [
    { id: 'slime_jelly', chance: 0.5 },
    { id: 'upgrade_stone', chance: 0.25 },
    { id: 'hp_potion', chance: 0.08 },
  ],
  forest_rat: [
    { id: 'rat_tail', chance: 0.5 },
    { id: 'upgrade_stone', chance: 0.25 },
    { id: 'hp_potion', chance: 0.06 },
  ],
  mushroom_kid: [
    { id: 'mushroom_cap', chance: 0.5 },
    { id: 'upgrade_stone', chance: 0.25 },
    { id: 'mp_potion', chance: 0.08 },
  ],
  goblin_chief: [                                     // 중간보스
    { id: 'goblin_horn', chance: 1 },
    { id: 'upgrade_stone', chance: 1, count: [2, 3] },
    { id: 'hp_potion', chance: 0.5, count: [1, 2] },
    { id: 'mp_potion', chance: 0.5, count: [1, 2] },
  ],

  // ---- 다른 지역용 (아직 배치하지 않은 몬스터: 소재는 지역을 만들 때 추가한다) ----
  cave_bat: [{ id: 'upgrade_stone', chance: 0.25 }, { id: 'mp_potion', chance: 0.08 }],
  black_spider: [{ id: 'upgrade_stone', chance: 0.25 }],
  goblin: [{ id: 'upgrade_stone', chance: 0.3 }, { id: 'hp_potion', chance: 0.1 }],
  gray_wolf: [{ id: 'upgrade_stone', chance: 0.35 }, { id: 'hp_potion', chance: 0.12 }],
  moon_fox: [{ id: 'upgrade_stone', chance: 0.6 }],     // 희귀
};
