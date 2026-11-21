// 이벤트 버스: 시스템/화면 사이의 유일한 통신 수단.
// 서로를 직접 호출하지 않고 이벤트로만 알려서 의존성이 얽히지 않게 한다.
const Events = (() => {
  const handlers = new Map();

  function on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const set = handlers.get(name);
    if (set) set.delete(fn);
  }

  function emit(name, payload) {
    const set = handlers.get(name);
    if (set) for (const fn of [...set]) fn(payload);
  }

  return { on, off, emit };
})();
