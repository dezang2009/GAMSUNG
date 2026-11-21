// 몬스터 데이터. 새 몬스터는 MonsterData 에 항목만 추가하면 된다.
//   rarity       : MonsterRarities 의 키
//   regions      : 등장 지역 id 목록
//   spawnChance  : 출현 가중치 (클수록 자주, 지역 내 후보끼리 비교)
//   maxCount     : 동시에 필드에 존재할 수 있는 최대 수
//   stats        : 기본 능력치 (전투 구현 시 사용)
//   moveSpeed    : 이동 속도 (px/s)
//   detectRange  : 플레이어 감지 거리 (px)
//   sprite       : Sprites.monsters 의 키
//   wanderRadius : 배회 반경 (px, 생략 시 40)
//   lifetime     : [최소, 최대] 초 (생략 시 지역 규칙 사용)

// 등급 정의. 엘리트/필드 보스는 여기에 항목을 추가하는 방식으로 확장한다.
const MonsterRarities = {
  normal: { label: '일반', nameColor: '#ffffff', mark: '' },
  rare: { label: '희귀', nameColor: '#ffd84a', mark: '★', sparkle: true },
  // elite: { label: '엘리트', ... },
  // boss:  { label: '필드 보스', ... },
};

const MonsterData = [
  {
    id: 'blue_slime',
    name: '푸른 슬라임',
    rarity: 'normal',
    regions: ['greenforest'],
    spawnChance: 50,
    maxCount: 4,
    stats: { hp: 20, atk: 4, def: 2, spd: 3 },
    moveSpeed: 16,
    detectRange: 56,
    sprite: 'slime',
    wanderRadius: 36,
  },
  {
    id: 'mushroom_kid',
    name: '버섯돌이',
    rarity: 'normal',
    regions: ['greenforest'],
    spawnChance: 35,
    maxCount: 3,
    stats: { hp: 28, atk: 6, def: 3, spd: 2 },
    moveSpeed: 13,
    detectRange: 48,
    sprite: 'mushroom',
    wanderRadius: 44,
  },
  {
    id: 'moon_fox',
    name: '달빛 여우',
    rarity: 'rare',
    regions: ['greenforest'],
    spawnChance: 4,
    maxCount: 1,
    stats: { hp: 45, atk: 9, def: 4, spd: 9 },
    moveSpeed: 26,
    detectRange: 72,
    sprite: 'fox',
    wanderRadius: 60,
    lifetime: [30, 50],
  },
];
