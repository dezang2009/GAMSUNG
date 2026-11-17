// ABYSS — 정적 게임 데이터 (규칙/화면 코드와 분리)
window.ABYSS = window.ABYSS || {};

ABYSS.data = {
  // 지형: cost = 진입 시 소모 전력, passable = 통행 가능 여부
  terrain: {
    floor:  { name: '평지',   cost: 1, passable: true,  desc: '이동이 쉬운 단단한 암반.' },
    rubble: { name: '잔해',   cost: 2, passable: true,  desc: '무너진 암석 더미. 이동이 느리다.' },
    water:  { name: '침수 지대', cost: 3, passable: true,  desc: '물이 고인 저지대. 전력 소모가 크다.' },
    wall:   { name: '암벽',   cost: 0, passable: false, desc: '통과할 수 없는 암반.' },
    chasm:  { name: '균열',   cost: 0, passable: false, desc: '깊이를 알 수 없는 틈. 현재 장비로는 건널 수 없다.' },
  },

  // 자원: id 순서가 보유량 표시 순서
  resources: {
    iron:    { name: '철광석',     sym: 'Fe', use: '기본 장비 제작' },
    copper:  { name: '구리광석',   sym: 'Cu', use: '전력 및 전자 장비' },
    crystal: { name: '결정 광물',  sym: 'Cr', use: '고급 연구' },
    rare:    { name: '희귀 원소',  sym: 'Re', use: '특수 장비 개발' },
    unknown: { name: '미확인 물질', sym: '??', use: '신규 기술 연구' },
  },

  // 위험 요소
  hazards: {
    gas:      { name: '가스 누출', desc: '진입 시 전력 4 추가 소모.', extraCost: 4 },
    unstable: { name: '불안정 지반', desc: '진입 시 35% 확률로 붕괴. 전력 5 손실, 지형이 잔해로 변한다.', collapseChance: 0.35, collapseLoss: 5 },
  },

  // 통로: 다른 탐사 지역/구역으로 이어지는 지점 (이번 단계에서는 발견·기록만)
  passages: {
    shaft:    { name: '수직 갱도', desc: '더 깊은 구역으로 이어지는 갱도. 하강 장비가 필요하다.' },
    facility: { name: '폐쇄된 격벽', desc: '오래된 시설의 출입구. 전력 공급 장치가 필요하다.' },
  },

  // 탐사 규칙 수치
  rules: {
    maxEnergy: 60,
    cargoCapacity: 12,
    scanCost: 6,
    scanRadius: 2,
    mineCost: 4,
    mineYield: [1, 2],      // 채굴 1회당 최소~최대 획득량
    emergencyCargoLoss: 0.5 // 긴급 회수 시 적재물 손실 비율
  },

  // 깊이 구역 > 탐사 지역. 지도는 seed 로 생성된다.
  zones: [
    {
      id: 'z1', name: '제1구역 · 상층 동굴대', depth: '0 ~ 120m',
      areas: [
        {
          id: 'z1a1', name: '진입 갱도', seed: 20261117,
          width: 10, height: 14,
          desc: '지상 승강기와 연결된 첫 탐사 지역. 자연 동굴과 붕괴 구간이 섞여 있다.',
          deposits: { iron: 7, copper: 4, crystal: 2, rare: 1, unknown: 1 },
          hazards: { gas: 4, unstable: 5 },
          passages: ['shaft', 'facility'],
        },
      ],
    },
  ],
};
