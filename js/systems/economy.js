// Economy 시스템 — 골드(화폐) 증감. 가격 규칙과 상점 거래는 Shop 이 추가될 때 이어서 만든다.
//   수신 'battle:rewards' payload  전투 보상 골드 지급 (payload.steps 에 메시지를 덧붙인다)
//   수신 'gold:gain' { amount }    골드 획득
Game.register('economy', {
  init({ Events, GameState }) {
    const add = (amount) => GameState.patch('wallet', { gold: Math.max(0, GameState.get('wallet').gold + amount) });

    Events.on('gold:gain', ({ amount }) => add(amount));

    Events.on('battle:rewards', (r) => {
      if (r.gold <= 0) return;
      add(r.gold);
      r.steps.push({ text: `${r.gold} 골드를 획득했다!` });
    });
  },
});
