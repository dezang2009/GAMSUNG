// Battle(턴제 전투) 시스템 — 아직 구현하지 않음 (구조만 마련).
// 담당: 전투 진행, 턴 처리, 결과 계산
// 통신(예정): 수신 'battle:start' / 발신 'battle:end' { result, rewards }
Game.register('battle', {
  init(ctx) {
    // 실제 기능을 구현할 때 ctx.Events / ctx.GameState 로만 다른 시스템과 연결한다.
  },
});
