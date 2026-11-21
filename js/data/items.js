// 아이템 데이터. 새 아이템은 ItemData 에 항목만 추가한다.
//   type     : 'package'(열면 다른 아이템이 나옴) | 'weapon' | 'armor' | 'potion'
//   icon     : Sprites.items 의 키
//   contents : 꾸러미(package)를 열었을 때 나오는 아이템 목록
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
  },
  old_leather_armor: {
    id: 'old_leather_armor', name: '낡은 가죽갑옷', type: 'armor', icon: 'armor',
    desc: '곳곳을 기워 입은 가죽갑옷. 가벼워서 움직이기 편하다.',
  },
  hp_potion: {
    id: 'hp_potion', name: 'HP 회복물약', type: 'potion', icon: 'hpPotion',
    desc: '붉은 약초를 달인 물약. 마시면 체력이 회복된다. (HP +50)',
    use: { hp: 50 },
  },
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
};
