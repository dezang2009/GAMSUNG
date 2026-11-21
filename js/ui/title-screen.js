// 게임 메인(타이틀) 화면: 세이브 파일 3개 중에서 고른다. 빈 파일은 새 게임, 저장된 파일은 이어하기.
const TitleUI = (() => {
  const root = document.getElementById('title');
  const list = document.getElementById('title-slots');
  let armedDelete = 0;   // 삭제 확인 중인 슬롯 (한 번 더 누르면 삭제)
  let armTimer = 0;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function drawArt() {
    const c = document.getElementById('title-art');
    const g = c.getContext('2d');
    g.drawImage(Sprites.makeGrassPattern(112, 44), 0, 0);
    g.drawImage(Sprites.trees[0], 4, 8);
    g.drawImage(Sprites.trees[1], 88, 10);
    g.drawImage(Sprites.monsters.slime.right[0], 40, 28);
    g.drawImage(Sprites.monsters.mushroom.right[0], 68, 22);
    g.drawImage(Sprites.player.down[2], 24, 22);
  }

  function render() {
    list.replaceChildren();
    for (let n = 1; n <= SaveStore.SLOTS; n++) {
      const s = SaveStore.summary(n);
      const li = el('li');
      const card = el('button', 'slot' + (s ? '' : ' is-empty'));
      card.type = 'button';
      card.append(el('span', 'slot-no', '파일 ' + n));
      if (s) {
        card.append(
          el('span', 'slot-main', `Lv.${s.level} · ${s.place || '모험 중'}`),
          el('span', 'slot-sub', `${s.gold.toLocaleString('ko-KR')} 골드 · 플레이 ${s.play} · ${s.savedAt} 저장`),
        );
      } else {
        card.append(el('span', 'slot-main', '새 게임 시작'), el('span', 'slot-sub', '비어 있는 파일'));
      }
      card.addEventListener('click', () => {
        hide();
        Events.emit(s ? 'save:load' : 'save:new', { slot: n });
      });
      li.appendChild(card);
      if (s) {
        const del = el('button', 'slot-del', armedDelete === n ? '한 번 더 누르면 삭제' : '삭제');
        del.type = 'button';
        del.addEventListener('click', () => {
          if (armedDelete === n) {
            SaveStore.remove(n);
            armedDelete = 0;
          } else {
            armedDelete = n;
            clearTimeout(armTimer);
            armTimer = setTimeout(() => { armedDelete = 0; render(); }, 3000);
          }
          render();
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    }
  }

  function show() {
    armedDelete = 0;
    render();
    root.hidden = false;
  }

  function hide() {
    root.hidden = true;
  }

  drawArt();

  return { show, hide };
})();
