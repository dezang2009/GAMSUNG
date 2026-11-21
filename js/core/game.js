// 시스템 등록소. 각 시스템은 독립 파일에서 Game.register 로 자신을 등록한다.
//
// 의존 규칙 (ARCHITECTURE.md 참고)
//   - 시스템은 core(Events, GameState)와 data 만 참조한다. 다른 시스템을 직접 참조하지 않는다.
//   - 시스템끼리의 협력은 Events 로만 한다. (예: 전투 종료 -> 'battle:end' -> 인벤토리가 보상 처리)
//   - 화면(ui)은 시스템의 이벤트를 듣고 GameState 를 읽어 그린다.
const Game = (() => {
  const systems = new Map();

  function register(name, def) {
    systems.set(name, def);
  }

  // 모든 시스템을 등록된 순서대로 초기화
  function init() {
    for (const [name, def] of systems) {
      if (def.init) def.init({ Events, GameState, name });
    }
  }

  return { register, init, systems };
})();
