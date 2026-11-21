// 장소 데이터(마을 + 탐험 지역). 새 장소는 이 배열에 항목만 추가하면 탐험 화면에 카드로 나타난다.
//   type             : 'village' 면 마을(village 블록 사용), 생략하면 탐험 필드(gen 블록 사용)
//   id / name / desc : 식별자, 이름, 설명
//   locked           : true 면 "준비 중"으로 표시되고 입장할 수 없다
//   color / thumb    : 카드 썸네일 배경색, 썸네일에 그릴 스프라이트(Sprites 키)
//   cols / rows      : 맵 크기(타일 수)
//   spawn            : 시작 위치(타일 좌표)
//   village          : 마을 배치(길, 광장, 건물, 소품, NPC, 트리거)
//   gen              : 탐험 필드 맵 생성 설정(시드, 길 웨이포인트, 오브젝트 개수)
//   monsters         : 몬스터 출현 규칙(유지 수, 재출현 시간, 최소 출현 거리, 수명)
//                      종류별 출현 확률/최대 수는 monster-data.js 에서 설정
const Regions = [
  {
    id: 'village',
    type: 'village',            // 마을: 건물/NPC 가 있고 몬스터는 나오지 않는다
    name: '솔빛 마을',
    desc: '포근한 햇살이 머무는 모험의 출발점. 상점과 여관이 모여 있어요.',
    color: '#8bd36a',
    thumbSize: 56,
    thumb: [['buildings.shop', 0, 3, 2]],
    cols: 32,
    rows: 36,
    spawn: { tx: 16, ty: 29 },
    palette: { grass: [[118, 184, 88], [110, 176, 82], [130, 194, 98], [96, 164, 72]] },
    village: {
      seed: 777,
      trees: 26,
      bushes: 14,
      flowers: 50,
      // 길과 광장: [x, y, 가로, 세로] (타일)
      roads: [
        [15, 3, 2, 29], [5, 18, 23, 2], [5, 26, 23, 2],
        [6, 13, 2, 5], [25, 13, 2, 5], [6, 24, 2, 2], [25, 24, 2, 2],
        [15, 31, 9, 2],
      ],
      plaza: [12, 16, 8, 6],
      // 건물 (3x2 타일 발판, sprite 는 Sprites.buildings 의 키). 이름표로 표시된다.
      buildings: [
        { id: 'shop', name: '상점', sprite: 'shop', tx: 5, ty: 11 },
        { id: 'inn', name: '여관', sprite: 'inn', tx: 24, ty: 11 },
        { id: 'forge', name: '대장간', sprite: 'forge', tx: 5, ty: 22, enter: 'forge' },   // enter: 들어가면 열리는 화면
        { id: 'hall', name: '의뢰소', sprite: 'hall', tx: 24, ty: 22 },
        { id: 'home', name: '내 집', sprite: 'home', tx: 21, ty: 29 },
      ],
      props: [
        { type: 'fountain', tx: 15, ty: 18 },
        { type: 'gate', tx: 14, ty: 4, name: '탐험 게이트' },
        { type: 'lamp', tx: 14, ty: 12 }, { type: 'lamp', tx: 17, ty: 12 },
        { type: 'lamp', tx: 14, ty: 23 }, { type: 'lamp', tx: 17, ty: 23 },
        { type: 'lamp', tx: 11, ty: 15 }, { type: 'lamp', tx: 20, ty: 15 },
        { type: 'lamp', tx: 11, ty: 22 }, { type: 'lamp', tx: 20, ty: 22 },
      ],
      // NPC: role 은 추후 상호작용 시스템(상점/제작/의뢰 등)이 사용한다. look 은 Sprites.npcs 의 키
      npcs: [
        { id: 'merchant', name: '상인 모모', role: 'shop', look: 'merchant', tx: 9, ty: 14, lines: ['어서 오세요! 솔빛 마을 상점이에요.', '물건은 곧 들여올 예정이니 조금만 기다려 주세요.'] },
        { id: 'shopkeeper', name: '상점 주인 도라', role: 'shop', look: 'shopF', tx: 3, ty: 15, lines: ['남편이 또 물건을 쌓아 두네요.', '필요한 게 있으면 말씀하세요.'] },
        { id: 'innkeeper', name: '여관 주인 하나', role: 'inn', look: 'innkeeper', tx: 22, ty: 14, lines: ['여관에 오신 걸 환영해요. 푹 쉬고 가세요.', '따뜻한 차도 준비해 둘게요.'] },
        { id: 'maid', name: '여관 일꾼 미나', role: 'villager', look: 'maid', tx: 28, ty: 15, lines: ['어서 오세요! 방은 늘 깨끗해요.'] },
        { id: 'smith', name: '대장장이 쿠로', role: 'crafting', look: 'smith', tx: 9, ty: 24, lines: ['쿵쿵! 지금 한창 망치질 중이야.', '나중에 장비 제작과 강화는 나한테 맡겨.'] },
        { id: 'clerk', name: '의뢰소 직원 리코', role: 'quest', look: 'clerk', tx: 22, ty: 24, lines: ['의뢰소에 오셨군요!', '의뢰는 아직 준비 중이에요. 조금만 기다려 주세요.'] },
        { id: 'witch', name: '마녀 루나', role: 'villager', look: 'witch', tx: 28, ty: 25, lines: ['후후, 숲에는 신기한 것이 많단다.', '달빛 여우를 만나면 행운이 따른다지.'] },
        {
          id: 'elder', name: '촌장 할아버지', role: 'villager', look: 'elder', tx: 20, ty: 17,
          lines: ['솔빛 마을에 잘 왔네, 젊은 모험가.', '북쪽 게이트 너머가 초록숲이라네.'],
          // 처음 말을 걸었을 때 한 번만 지급 (flag 로 기록)
          gift: {
            flag: 'starterPackage',
            lines: ['오오, 새로운 모험가로구나! 솔빛 마을에 잘 왔네.', '길을 떠나기 전에 이 초보자 패키지를 받게나.', '가방에서 열어 보면 쓸 만한 물건이 들어 있을 걸세.'],
            items: [{ id: 'starter_package', count: 1 }],
            toast: '초보자 패키지를 받았어요! 가방에서 열어 보세요.',
          },
        },
        { id: 'kid', name: '꼬마 콩이', role: 'villager', look: 'kid', tx: 13, ty: 22, lines: ['안녕! 나는 콩이야.', '게이트 너머 초록숲에는 슬라임이 살아!'] },
        { id: 'guard', name: '문지기 도리', role: 'guard', look: 'guard', tx: 18, ty: 5, lines: ['여기는 탐험 게이트다.', '초록숲으로 가려면 이 문을 지나가라. 조심해서 다녀와!'] },
      ],
      // 밟으면 이벤트가 발생하는 영역. action 'explore' 는 탐험 화면을 연다
      triggers: [{ id: 'gate', tx: 15, ty: 3, w: 2, h: 2, action: 'explore' }],
    },
  },
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
      target: 6,              // 필드에 유지할 일반 몬스터 수 (3종)
      // 중간보스: 맵 가장 위쪽에 자리 잡고, 쓰러뜨리면 respawn 초 뒤에 다시 나타난다
      boss: { id: 'goblin_chief', tx: 17, ty: 6, respawn: 120 },
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
