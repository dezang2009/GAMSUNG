// 탐험지 데이터. 새 지역은 이 배열에 항목만 추가하면 메뉴에 카드로 나타난다.
//   id / name / desc : 식별자, 이름, 설명
//   locked           : true 면 "준비 중"으로 표시되고 입장할 수 없다
//   color / thumb    : 카드 썸네일 배경색, 썸네일에 그릴 스프라이트(Sprites 키)
//   cols / rows      : 맵 크기(타일 수)
//   spawn            : 시작 위치(타일 좌표)
//   gen              : 맵 생성 설정(시드, 길 웨이포인트, 오브젝트 개수)
//   monsters         : 몬스터 출현 규칙(유지 수, 재출현 시간, 최소 출현 거리, 수명)
//                      종류별 출현 확률/최대 수는 monster-data.js 에서 설정
const Regions = [
  {
    id: 'greenforest',
    name: '초록숲',
    desc: '나무와 풀이 우거진 고요한 숲. 길을 따라 걸으며 천천히 둘러보자.',
    color: '#6fbf4a',
    // 썸네일 장면: [스프라이트 키, 변형 번호, x, y]
    thumb: [['trees', 1, 25, 6], ['trees', 0, 1, 12], ['monsters.slime', 0, 16, 30]],
    cols: 34,
    rows: 42,
    spawn: { tx: 17, ty: 37 },
    gen: {
      seed: 20260,
      path: [[17, 38], [17, 31], [8, 28], [8, 17], [17, 12], [26, 17], [26, 28], [17, 31]],
      forests: 4,
      rockClusters: 5,
      bushes: 40,
      tallGrass: 8,
      flowers: 80,
    },
    monsters: {
      target: 6,              // 필드에 유지할 몬스터 수
      respawn: [5, 9],        // 빈자리가 생긴 뒤 새로 출현하기까지 걸리는 시간(초)
      minSpawnDist: 80,       // 플레이어와 최소 거리(px)
      lifetime: [40, 80],     // 몬스터가 필드에 머무는 시간(초)
    },
  },
  {
    id: 'mistmarsh',
    name: '안개 늪지',
    desc: '짙은 안개가 깔린 늪. 준비 중이에요.',
    locked: true,
    color: '#5f7f7a',
  },
  {
    id: 'redcliff',
    name: '붉은 바위산',
    desc: '붉은 절벽이 이어지는 산악 지대. 준비 중이에요.',
    locked: true,
    color: '#b5654a',
  },
];
