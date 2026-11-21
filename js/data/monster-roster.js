// 몬스터 로스터(기획 목록): 앞으로 지역별로 추가할 몬스터 후보. 아직 스프라이트/능력치가 없는 항목은 implemented:false.
// 구현할 때는 monster-data.js 에 MonsterData 항목을 만들고 여기서 implemented 를 true 로 바꾼다.
// tier: normal(일반) | rare(희귀) | elite(엘리트) | boss(필드/던전 보스)
const MonsterRoster = [
  // 구현됨 (초록숲)
  { id: 'blue_slime', name: '푸른 슬라임', family: '슬라임', tier: 'normal', habitat: '초록숲', implemented: true },
  { id: 'forest_rat', name: '들쥐', family: '짐승', tier: 'normal', habitat: '초록숲', implemented: true },
  { id: 'mushroom_kid', name: '버섯돌이', family: '식물', tier: 'normal', habitat: '초록숲', implemented: true },
  { id: 'cave_bat', name: '박쥐', family: '짐승', tier: 'normal', habitat: '초록숲', implemented: true },
  { id: 'black_spider', name: '독거미', family: '벌레', tier: 'normal', habitat: '초록숲', implemented: true },
  { id: 'goblin', name: '고블린', family: '고블린', tier: 'normal', habitat: '초록숲', implemented: true },
  { id: 'gray_wolf', name: '회색 늑대', family: '짐승', tier: 'normal', habitat: '초록숲', implemented: true },
  { id: 'moon_fox', name: '달빛 여우', family: '짐승', tier: 'rare', habitat: '초록숲', implemented: true },
  // 기획: 늪지 / 동굴 / 바위산 / 던전 / 화산 / 설원
  { id: 'skeleton', name: '스켈레톤', family: '언데드', tier: 'normal', habitat: '던전', implemented: false },
  { id: 'zombie', name: '좀비', family: '언데드', tier: 'normal', habitat: '안개 늪지', implemented: false },
  { id: 'treant', name: '숲의 정령', family: '식물', tier: 'elite', habitat: '초록숲', implemented: false },
  { id: 'bandit', name: '산적', family: '인간', tier: 'normal', habitat: '붉은 바위산', implemented: false },
  { id: 'orc', name: '오크', family: '오크', tier: 'elite', habitat: '붉은 바위산', implemented: false },
  { id: 'ogre', name: '오거', family: '거인', tier: 'elite', habitat: '붉은 바위산', implemented: false },
  { id: 'harpy', name: '하피', family: '비행', tier: 'normal', habitat: '붉은 바위산', implemented: false },
  { id: 'fire_elemental', name: '불의 정령', family: '정령', tier: 'normal', habitat: '화산', implemented: false },
  { id: 'stone_golem', name: '돌 골렘', family: '골렘', tier: 'elite', habitat: '동굴', implemented: false },
  { id: 'lich', name: '리치', family: '언데드', tier: 'elite', habitat: '던전', implemented: false },
  { id: 'minotaur', name: '미노타우로스', family: '야수', tier: 'boss', habitat: '던전', implemented: false },
  { id: 'serpent', name: '독사', family: '뱀', tier: 'normal', habitat: '안개 늪지', implemented: false },
  { id: 'naga', name: '나가', family: '뱀', tier: 'elite', habitat: '안개 늪지', implemented: false },
  { id: 'dragon', name: '드래곤', family: '용', tier: 'boss', habitat: '화산', implemented: false },
  { id: 'demon_lord', name: '마왕', family: '악마', tier: 'boss', habitat: '던전', implemented: false },
  { id: 'beholder', name: '비홀더', family: '마안', tier: 'elite', habitat: '던전', implemented: false },
  { id: 'dark_knight', name: '암흑 기사', family: '인간', tier: 'elite', habitat: '던전', implemented: false },
  { id: 'griffin', name: '그리핀', family: '비행', tier: 'rare', habitat: '붉은 바위산', implemented: false },
  { id: 'hydra', name: '히드라', family: '용', tier: 'boss', habitat: '안개 늪지', implemented: false },
  { id: 'vampire', name: '뱀파이어', family: '언데드', tier: 'elite', habitat: '던전', implemented: false },
  { id: 'ancient_mage', name: '고대 마법사', family: '인간', tier: 'boss', habitat: '던전', implemented: false },
  { id: 'ice_golem', name: '얼음 결정체', family: '골렘', tier: 'elite', habitat: '설원', implemented: false },
  { id: 'lava_golem', name: '용암 골렘', family: '골렘', tier: 'elite', habitat: '화산', implemented: false },
];
