// 알림(토스트): Events.emit('toast', { text }) 로 짧은 안내를 잠깐 보여 준다. 조작은 받지 않는다.
const Toast = (() => {
  const el = document.getElementById('toast');
  let timer = 0;

  function show(text) {
    el.textContent = text;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(timer);
    timer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  Events.on('toast', ({ text }) => show(text));
  return { show };
})();
