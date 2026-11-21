// 탐험지 데이터. 새 지역은 이 배열에 항목만 추가하면 메뉴에 카드로 나타난다.
//   id / name / desc : 식별자, 이름, 설명
//   locked           : true 면 "준비 중"으로 표시되고 입장할 수 없다
//   color / thumb    : 카드 썸네일 배경색, 썸네일에 그릴 스프라이트(Sprites 키)
//   cols / rows      : 맵 크기(타일 수)
//   spawn            : 시작 위치(타일 좌표)
//   gen              : 맵 생성 설정(시드, 길 웨이포인트, 오브젝트 개수)
const Regions = [
  {
    id: 'greenforest',
    name: '초록숲',
    desc: '나무와 풀이 우거진 고요한 숲. 길을 따라 걸으며 천천히 둘러보자.',
    color: '#6fbf4a',
    thumb: ['trees', 'trees'],
    cols: 60,
    rows: 60,
    spawn: { tx: 30, ty: 54 },
    gen: {
      seed: 20260,
      path: [[30, 55], [30, 44], [15, 39], [15, 24], [30, 16], [45, 24], [45, 40], [30, 44]],
      forests: 8,
      rockClusters: 10,
      bushes: 90,
      tallGrass: 16,
      flowers: 160,
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
