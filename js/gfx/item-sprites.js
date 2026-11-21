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

  Sprites.items = {
    package: pkg,
    club,
    armor,
    hpPotion: potion('#ef7a74', '#d9534f', '#a8383a'),
    mpPotion: potion('#7ba3ea', '#4f7fd6', '#35589c'),
  };
})();
