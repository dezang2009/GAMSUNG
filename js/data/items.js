// 아이템 데이터. 새 아이템은 ItemData 에 항목만 추가한다.
//   type     : 'package'(열면 다른 아이템이 나옴) | 'weapon' | 'armor' | 'potion' | 'material'(강화재료) | 'loot'(몬스터 소재)
//   rarity   : 'common' | 'uncommon' | 'rare' (소재/재료의 희귀도)
//   icon     : Sprites.items 의 키
//   contents : 꾸러미(package)를 열었을 때 나오는 아이템 목록
//   weapon   : 무기 설정 { atk, atkPerLevel, skills: [{ level, skill }] }
//   armor    : 방어구 설정 { def }
//   use      : 물약을 쓸 때의 효과 { hp, mp } (현재는 전투 중에만 사용)
// 장비 능력치 같은 효과는 장비 기능을 만들 때 추가한다.
const ItemData = {
  starter_package: {
    id: 'starter_package', name: '초보자 패키지', type: 'package', icon: 'package',
    desc: '모험을 시작하는 이를 위한 꾸러미. 열어 보면 쓸 만한 물건이 들어 있다.',
    contents: [
      { id: 'old_club', count: 1 },
      { id: 'old_leather_armor', count: 1 },
      { id: 'hp_potion', count: 3 },
      { id: 'mp_potion', count: 3 },
    ],
  },
  old_club: {
    id: 'old_club', name: '낡은 나무몽둥이', type: 'weapon', icon: 'club',
    desc: '오래 써서 여기저기 닳은 나무 몽둥이. 그래도 맨손보다는 든든하다.',
    // 무기: 공격력(숙련 레벨마다 atkPerLevel 증가)과, 숙련 레벨에 도달하면 배울 수 있는 기술
    weapon: {
      atk: 3, atkPerLevel: 0.5,
      skills: [
        { level: 1, skill: 'swing' }, { level: 3, skill: 'throw' }, { level: 5, skill: 'thrust' },
        { level: 7, skill: 'smash' }, { level: 9, skill: 'whirl' },
      ],
    },
  },
  old_leather_armor: {
    id: 'old_leather_armor', name: '낡은 가죽갑옷', type: 'armor', icon: 'armor',
    desc: '곳곳을 기워 입은 가죽갑옷. 가벼워서 움직이기 편하다.',
    armor: { def: 2 },
  },
  hp_potion: {
    id: 'hp_potion', name: 'HP 회복물약', type: 'potion', icon: 'hpPotion',
    desc: '붉은 약초를 달인 물약. 마시면 체력이 회복된다. (HP +50)',
    use: { hp: 50 },
  },
  upgrade_stone: {
    id: 'upgrade_stone', name: '강화석', type: 'material', icon: 'gem',
    desc: '대장간에서 장비의 등급을 올릴 때 쓰는 기본 강화재료. 몬스터가 가끔 떨어뜨린다.',
    // 강화재료: chanceBonus 는 대장간 기본 성공 확률에 더해진다 (더 희귀한 재료는 보너스가 크다)
    forge: { rarity: 'common', chanceBonus: 0 },
  },
  // ---- 몬스터 소재(전리품): 아직 쓸 곳은 없고, 상점 판매/제작이 생기면 쓰인다 ----
  slime_jelly: { id: 'slime_jelly', name: '슬라임 젤리', type: 'loot', icon: 'jelly', rarity: 'common', desc: '푸른 슬라임의 몸에서 나온 말랑한 젤리.' },
  rat_tail: { id: 'rat_tail', name: '들쥐 꼬리', type: 'loot', icon: 'tail', rarity: 'common', desc: '들쥐의 가늘고 긴 꼬리.' },
  mushroom_cap: { id: 'mushroom_cap', name: '버섯 갓', type: 'loot', icon: 'cap', rarity: 'common', desc: '버섯돌이의 머리에서 떨어진 붉은 갓.' },
  goblin_horn: { id: 'goblin_horn', name: '고블린 대장의 뿔', type: 'loot', icon: 'horn', rarity: 'rare', desc: '고블린 대장의 투구에 달려 있던 단단한 뿔.' },
  mp_potion: {
    id: 'mp_potion', name: 'MP 회복물약', type: 'potion', icon: 'mpPotion',
    desc: '푸른 이슬을 모아 만든 물약. 마시면 마력이 회복된다. (MP +20)',
    use: { mp: 20 },
  },
};

// 가방 정렬 순서와 종류 이름
const ItemTypes = {
  package: { label: '꾸러미', order: 0 },
  weapon: { label: '무기', order: 1 },
  armor: { label: '방어구', order: 2 },
  potion: { label: '물약', order: 3 },
  material: { label: '재료', order: 4 },      // 강화재료
  loot: { label: '소재', order: 5 },          // 몬스터 전리품
};
