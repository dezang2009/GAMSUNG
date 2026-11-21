// 필드 몬스터 스프라이트 (Sprites.monsters 에 추가). 슬라임/버섯/여우는 sprites.js 에 있다.
(() => {
  const { build, rect, flip } = Sprites.tools;

  const set = (make) => {
    const right = [make(0), make(1)];
    return { right, left: right.map(flip) };
  };

  // 타원을 채우되 빛(위쪽)과 그림자(아래쪽)로 입체감을 준다
  function blob(ctx, ox, oy, cx, cy, rx, ry, light, mid, dark) {
    for (let y = 0; y < Math.ceil(cy + ry + 1); y++) {
      for (let x = 0; x < Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        rect(ctx, ox + x, oy + y, 1, 1, ny < -0.35 ? light : ny > 0.4 ? dark : mid);
      }
    }
  }

  // 들쥐 (16x9, 오른쪽을 봄)
  const rat = set((step) => build(16, 9, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    r(0, 5, 1, 1, '#d8a0a0'); r(1, 6, 2, 1, '#d8a0a0'); r(3, 6, 1, 1, '#d8a0a0');
    blob(ctx, ox, oy, 8, 5, 5.5, 3, '#c4b5a2', '#9a8a78', '#6f6256');
    blob(ctx, ox, oy, 13, 5, 2.8, 2.2, '#c4b5a2', '#a89886', '#7d6f60');
    r(12, 2, 2, 2, '#d8a8a8');
    r(15, 5, 1, 1, '#e08a8a');
    r(13, 4, 1, 1, '#1b1b1b');
    r(5 + step, 8, 2, 1, '#6f6256');
    r(10 - step, 8, 2, 1, '#6f6256');
  }));

  // 박쥐 (18x12): 날개를 퍼덕인다
  const bat = set((step) => build(18, 12, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    for (let c = 0; c < 7; c++) {
      const y0 = step ? 6 + Math.round(c * 0.5) : 5 - Math.round(c * 0.8);
      const h = step ? 3 : 4 + (c % 2 ? 0 : 1);
      r(6 - c + 0, y0, 1, h, c === 6 ? '#3b2e4a' : '#5c4a72');
      r(11 + c, y0, 1, h, c === 6 ? '#3b2e4a' : '#5c4a72');
    }
    blob(ctx, ox, oy, 9, 6, 2.6, 3.2, '#7a6894', '#55456c', '#3b2e4a');
    r(7, 2, 1, 2, '#55456c'); r(10, 2, 1, 2, '#55456c');
    r(8, 4, 1, 1, '#ff6b6b'); r(10, 4, 1, 1, '#ff6b6b');
    r(8, 7, 2, 1, '#e8e0f0');
  }));

  // 고블린 (14x16)
  const makeGoblin = (step, chief) => build(14, 16, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    const g1 = '#9ad665', g2 = '#7fbf4a', g3 = '#5d9a36';
    r(0, 3, 3, 1, g2); r(11, 3, 3, 1, g2);
    blob(ctx, ox, oy, 7, 4, 3.4, 3.1, g1, g2, g3);
    r(5, 4, 1, 1, '#ffd24a'); r(8, 4, 1, 1, '#ffd24a');
    r(6, 6, 2, 1, '#3b2a20'); r(6, 6, 1, 1, '#ffffff');
    r(4, 7, 6, 5, chief ? '#8a3a34' : '#8a5a3c'); r(4, 10, 6, 1, chief ? '#d9b24a' : '#5a3a22'); r(4, 7, 6, 1, chief ? '#a8504a' : '#a8744e');
    if (chief) {  // 뿔 달린 투구
      r(4, 0, 6, 2, '#8d939f'); r(3, 0, 1, 2, '#e8e2d0'); r(10, 0, 1, 2, '#e8e2d0'); r(6, 0, 2, 1, '#b8bec9');
    }
    r(3, 7, 1, 4, g2); r(10, 7, 1, 4, g2);
    r(11, 7, 1, 5, '#c9ced6'); r(10, 11, 3, 1, '#8a5a3c');
    r(5, 12, 2, step ? 3 : 4, g3); r(8, 12, 2, step ? 4 : 3, g3);
    r(5, step ? 15 : 16 - 1, 2, 1, '#4a3322'); r(8, step ? 15 : 14, 2, 1, '#4a3322');
  });
  const goblin = set((step) => makeGoblin(step, false));
  const goblinChief = set((step) => makeGoblin(step, true));

  // 늑대 (20x12, 오른쪽을 봄)
  const wolf = set((step) => build(20, 12, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    r(0, 3, 4, 2, '#8a8f9c'); r(0, 2, 2, 2, '#a8adb8');
    blob(ctx, ox, oy, 9, 6, 6.5, 3.2, '#b5bac6', '#8a8f9c', '#5d616e');
    blob(ctx, ox, oy, 16, 5, 3, 2.6, '#b5bac6', '#8a8f9c', '#6d7180');
    r(18, 5, 2, 2, '#c9ced8'); r(19, 5, 1, 1, '#1b1b1b');
    r(15, 1, 2, 3, '#6d7180'); r(16, 2, 1, 1, '#d8a0a0');
    r(16, 4, 1, 1, '#ffd24a');
    r(4, 9, 2, step ? 2 : 3, '#5d616e'); r(7, 9, 2, step ? 3 : 2, '#5d616e');
    r(12, 9, 2, step ? 3 : 2, '#5d616e'); r(15, 9, 2, step ? 2 : 3, '#5d616e');
  }));

  // 거미 (14x10)
  const spider = set((step) => build(14, 10, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    for (let i = 0; i < 4; i++) {
      r(2 + i * 2, step ? 1 : 2, 1, 3, '#2a2236');
      r(2 + i * 2, step ? 6 : 7, 1, 3, '#2a2236');
    }
    blob(ctx, ox, oy, 5, 5, 3.2, 2.8, '#52456a', '#2f2740', '#1f1a2c');
    r(5, 4, 1, 2, '#c0392b');
    blob(ctx, ox, oy, 9.5, 5, 2, 2, '#62547c', '#4a3d5e', '#2f2740');
    r(10, 4, 1, 1, '#ff5a5a'); r(10, 6, 1, 1, '#ff5a5a');
  }));

  Object.assign(Sprites.monsters, { rat, bat, goblin, goblinChief, wolf, spider });
})();
