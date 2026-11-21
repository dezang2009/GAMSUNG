// 성장 규칙: 레벨/경험치 곡선, 능력치 성장, 무기 숙련도, 등급.
// 숫자만 바꿔서 밸런스를 조정할 수 있다.
const Progression = {
  MAX_LEVEL: 30,
  MAX_SKILLS: 4,                                   // 한 번에 가질 수 있는 기술 수

  // 캐릭터: 현재 레벨에서 다음 레벨까지 필요한 경험치
  charExpToNext: (lv) => 20 + (lv - 1) * 15,
  // 레벨이 오를 때마다 늘어나는 능력치
  charGrowth: { maxHp: 10, maxMp: 3, atk: 2, def: 1, spd: 1 },

  // 무기: 현재 숙련 레벨에서 다음 레벨까지 필요한 경험치
  weaponExpToNext: (lv) => 12 + (lv - 1) * 10,
  // 무기 등급이 높을수록 올릴 수 있는 숙련 레벨 한계가 커진다 (등급 올리기는 대장장이 몫)
  weaponMaxLevel: (grade) => 5 + 5 * grade,
  // 등급에 따른 능력치 배율 (장비 능력치에 곱한다)
  gradeMult: (grade) => 1 + 0.25 * (grade - 1),
};
