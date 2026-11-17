// PROJECT EDEN — 화면 표시용 설정.
// STEP 01에서는 실제 시스템이 없으므로 HUD에는 고정된 표시용 값만 사용한다.
window.EDEN = window.EDEN || {};

EDEN.config = {
  world: {
    cols: 24,          // 그리드 가로 타일 수 (확장 시 이 값만 변경)
    rows: 32,          // 그리드 세로 타일 수
    seed: 20471,       // 지형 생성 시드
    noiseOffset: { x: 4, y: 0 }, // 지형 노이즈 원점 (기존 지형 배치 유지용)
    tilesAcross: 8,    // 화면 가로에 보이는 타일 수(기준)
    minTile: 40,
    maxTile: 64,
    sector: 'SECTOR A-01'
  },

  // 표시용 초기 값 (자원 계산 로직 없음)
  hud: {
    resources: { metal: 1250, crystal: 320, water: 85, food: 140 },
    energy: { current: 128, max: 200, rate: 4 },
    environment: { state: '황폐', temperature: -63, atmosphere: 12, moisture: 3, habitability: 6 }
  }
};
