// 몬스터 데이터. 새 몬스터는 MonsterData 에 항목만 추가하면 된다.
//   rarity       : MonsterRarities 의 키
//   regions      : 등장 지역 id 목록 (한 지역에는 일반 몬스터 3종 + 중간보스 1종을 배치한다)
//   (드롭 아이템은 drops.js 의 DropTables 에서 몬스터 id 로 정한다)
//   exp / gold   : 쓰러뜨렸을 때 얻는 경험치와 골드 범위
//   level        : [최소, 최대] 레벨. 스탯은 stats 기준이며 레벨이 오를수록 조금씩 강해진다
//   scale        : 필드에서 그리는 배율(정수, 생략 시 1)
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
  normal: { label: '일반', pillColor: 'rgba(42, 41, 38, 0.82)', mark: '' },
  rare: { label: '희귀', pillColor: 'rgba(176, 120, 20, 0.95)', mark: '★', sparkle: true },
  boss: { label: '중간보스', pillColor: 'rgba(140, 40, 40, 0.92)', mark: '◆' },
  // elite: { label: '엘리트', ... },
  // boss:  { label: '필드 보스', ... },
};

const MonsterData = [
  // ---- 초록숲: 일반 3종 ----
  {
    id: 'blue_slime', exp: 6, gold: [2, 5], name: '푸른 슬라임', rarity: 'normal', regions: ['greenforest'], level: [1, 2],
    spawnChance: 50, maxCount: 3, stats: { hp: 18, atk: 4, def: 1, spd: 3 },
    moveSpeed: 16, detectRange: 56, sprite: 'slime', wanderRadius: 36,
  },
  {
    id: 'forest_rat', exp: 7, gold: [2, 6], name: '들쥐', rarity: 'normal', regions: ['greenforest'], level: [1, 3],
    spawnChance: 40, maxCount: 3, stats: { hp: 14, atk: 5, def: 0, spd: 8 },
    moveSpeed: 24, detectRange: 52, sprite: 'rat', wanderRadius: 48,
  },
  {
    id: 'mushroom_kid', exp: 10, gold: [4, 8], name: '버섯돌이', rarity: 'normal', regions: ['greenforest'], level: [2, 3],
    spawnChance: 35, maxCount: 2, stats: { hp: 26, atk: 6, def: 2, spd: 2 },
    moveSpeed: 13, detectRange: 48, sprite: 'mushroom', wanderRadius: 44,
  },
  // ---- 초록숲: 중간보스 (맵 가장 위쪽에 자리 잡고 있다) ----
  {
    id: 'goblin_chief', exp: 90, gold: [60, 90], name: '고블린 대장', rarity: 'boss', regions: ['greenforest'], level: [6, 6],
    spawnChance: 0, maxCount: 1, stats: { hp: 90, atk: 12, def: 4, spd: 6 },
    moveSpeed: 18, detectRange: 56, sprite: 'goblinChief', wanderRadius: 24, scale: 2,
  },
  // ---- 다른 지역용 (아직 배치하지 않음) ----
  {
    id: 'cave_bat', exp: 9, gold: [3, 7], name: '박쥐', rarity: 'normal', regions: [], level: [2, 4],
    spawnChance: 28, maxCount: 2, stats: { hp: 16, atk: 5, def: 1, spd: 10 },
    moveSpeed: 30, detectRange: 64, sprite: 'bat', wanderRadius: 60,
  },
  {
    id: 'black_spider', exp: 13, gold: [5, 10], name: '독거미', rarity: 'normal', regions: [], level: [3, 5],
    spawnChance: 20, maxCount: 2, stats: { hp: 22, atk: 7, def: 2, spd: 6 },
    moveSpeed: 20, detectRange: 50, sprite: 'spider', wanderRadius: 40,
  },
  {
    id: 'goblin', exp: 15, gold: [6, 12], name: '고블린', rarity: 'normal', regions: [], level: [3, 5],
    spawnChance: 18, maxCount: 2, stats: { hp: 32, atk: 8, def: 3, spd: 5 },
    moveSpeed: 18, detectRange: 60, sprite: 'goblin', wanderRadius: 44,
  },
  {
    id: 'gray_wolf', exp: 22, gold: [9, 16], name: '회색 늑대', rarity: 'normal', regions: [], level: [4, 6],
    spawnChance: 10, maxCount: 1, stats: { hp: 40, atk: 10, def: 4, spd: 9 },
    moveSpeed: 28, detectRange: 78, sprite: 'wolf', wanderRadius: 64,
  },
  {
    id: 'moon_fox', exp: 32, gold: [20, 35], name: '달빛 여우', rarity: 'rare', regions: [], level: [4, 5],
    spawnChance: 4, maxCount: 1, stats: { hp: 45, atk: 9, def: 4, spd: 9 },
    moveSpeed: 26, detectRange: 72, sprite: 'fox', wanderRadius: 60, lifetime: [30, 50],
  },
];
