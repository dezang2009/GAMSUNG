// 아이템 아이콘 (14x14 + 외곽선): Sprites.items
(() => {
  const { build, rect } = Sprites.tools;

  const icon = (draw) => build(14, 14, (ctx, ox, oy) => draw((x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c), ctx, ox, oy));

  const pkg = icon((r) => {
    r(1, 5, 12, 8, '#c9a06a');
    r(1, 10, 12, 3, '#a8824f');
    r(0, 3, 14, 3, '#dbb47c');
    r(0, 5, 14, 1, '#b08955');
    r(6, 3, 2, 10, '#d9534f');
    r(4, 1, 3, 3, '#d9534f');
    r(7, 1, 3, 3, '#d9534f');
    r(6, 2, 2, 2, '#b8403d');
  });

  const club = icon((r) => {
    for (let i = 0; i < 10; i++) {
      const w = i < 5 ? 2 : i < 8 ? 3 : 4;
      r(1 + i, 12 - i - (w - 2), w, w, '#8a5a3c');
      r(1 + i, 12 - i - (w - 2), 1, 1, '#a8744e');
    }
    r(9, 1, 1, 1, '#6d4529');
    r(11, 3, 1, 1, '#6d4529');
    r(2, 11, 2, 2, '#5a3a22');
  });

  const armor = icon((r) => {
    r(3, 3, 8, 10, '#9a6a40');
    r(1, 3, 3, 4, '#9a6a40');
    r(10, 3, 3, 4, '#9a6a40');
    r(3, 2, 2, 2, '#8a5a3c');
    r(9, 2, 2, 2, '#8a5a3c');
    r(3, 9, 8, 1, '#5a3a22');
    r(6, 9, 2, 1, '#d9b24a');
    r(7, 4, 1, 5, '#c99a6a');
    r(3, 12, 8, 1, '#7a5230');
    r(1, 6, 2, 1, '#7a5230');
    r(11, 6, 2, 1, '#7a5230');
  });

  function potion(light, mid, dark) {
    return icon((r) => {
      r(5, 0, 4, 2, '#b08955');
      r(5, 2, 4, 2, '#dff0f7');
      for (let y = 3; y < 14; y++) {
        for (let x = 0; x < 14; x++) {
          const nx = (x + 0.5 - 7) / 5.5, ny = (y + 0.5 - 9) / 4.8;
          if (nx * nx + ny * ny > 1) continue;
          const col = ny < -0.45 ? '#dff0f7' : ny < -0.1 ? light : ny > 0.5 ? dark : mid;
          r(x, y, 1, 1, col);
        }
      }
      r(4, 7, 1, 3, '#ffffff');
    });
  }

  // 강화재료: 푸른 강화석
  const gem = icon((r) => {
    r(5, 1, 4, 1, '#b9e4ff'); r(3, 2, 8, 2, '#8fcaf5'); r(2, 4, 10, 3, '#5aa8e8');
    r(3, 7, 8, 3, '#3f86cc'); r(5, 10, 4, 2, '#2f6aa8'); r(6, 12, 2, 1, '#245487');
    r(4, 3, 2, 1, '#e8f6ff'); r(3, 5, 1, 2, '#d4ecff'); r(8, 5, 2, 1, '#8fcaf5'); r(7, 8, 3, 1, '#2f6aa8');
  });

  // 몬스터 소재 아이콘
  const jelly = icon((r) => {
    r(3, 4, 8, 7, '#5aa8e8'); r(2, 6, 10, 5, '#5aa8e8'); r(4, 3, 6, 1, '#8fcaf5'); r(4, 4, 6, 2, '#8fcaf5');
    r(3, 10, 8, 2, '#3f86cc'); r(5, 5, 2, 1, '#e8f6ff'); r(9, 8, 1, 2, '#3f86cc');
  });
  const tail = icon((r) => {
    r(1, 10, 3, 2, '#d8a0a0'); r(3, 9, 3, 2, '#d8a0a0'); r(5, 8, 3, 2, '#c98f8f');
    r(7, 6, 3, 3, '#c98f8f'); r(9, 4, 3, 3, '#b87f7f'); r(11, 2, 2, 3, '#b87f7f'); r(12, 1, 1, 2, '#9a6666');
  });
  const cap = icon((r) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 14; x++) {
      const nx = (x + 0.5 - 7) / 7, ny = (y + 0.5 - 6) / 6;
      if (nx * nx + ny * ny <= 1) r(x, y + 2, 1, 1, nx + ny < -0.6 ? '#f2705f' : ny > 0.4 ? '#a8332b' : '#d8483c');
    }
    r(3, 4, 2, 2, '#fff7ea'); r(8, 3, 2, 2, '#fff7ea'); r(6, 6, 2, 1, '#fff7ea');
    r(5, 10, 4, 2, '#f2e3c3');
  });
  const horn = icon((r) => {
    r(2, 11, 4, 2, '#e8e2d0'); r(3, 9, 4, 2, '#e8e2d0'); r(4, 7, 4, 2, '#f2ecda');
    r(6, 5, 3, 2, '#e8e2d0'); r(8, 3, 3, 2, '#e8e2d0'); r(10, 1, 2, 2, '#cfc8b4'); r(11, 0, 1, 1, '#b3ab97');
    r(2, 12, 4, 1, '#c9c2ae');
  });

  // 모루 (대장간 장면용, 28x14)
  const anvil = build(28, 14, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    r(1, 2, 22, 4, '#8d939f'); r(23, 3, 4, 2, '#8d939f'); r(24, 4, 3, 1, '#6d7380');
    r(1, 2, 22, 1, '#b8bec9'); r(1, 5, 22, 1, '#5d6371');
    r(8, 6, 8, 3, '#6d7380'); r(6, 9, 12, 2, '#5d6371'); r(4, 11, 16, 3, '#474c58');
    r(4, 11, 16, 1, '#6d7380');
  });
  Sprites.props.anvil = anvil;

  Sprites.items = {
    package: pkg,
    club,
    armor,
    hpPotion: potion('#ef7a74', '#d9534f', '#a8383a'),
    mpPotion: potion('#7ba3ea', '#4f7fd6', '#35589c'),
    gem,
    jelly, tail, cap, horn,
  };
})();
