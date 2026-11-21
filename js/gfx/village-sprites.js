// 마을 전용 스프라이트: 건물, 소품, NPC. Sprites 객체에 buildings / props / npcs 로 붙는다.
(() => {
  const { build, rect } = Sprites.tools;

  // ---- 건물 (48x56): 지붕 + 벽 + 문 + 창문. 옵션으로 개성을 준다 ----
  function makeBuilding(o) {
    return build(48, 56, (ctx, ox, oy) => {
      const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
      const top = 8; // 지붕 위로 굴뚝/깃발이 올라올 여유

      if (o.chimney) {
        r(34, 0, 6, 16, '#b4ada2');
        r(33, 0, 8, 3, '#8d867b');
        r(34, 4, 2, 12, '#c9c3b8');
      }
      if (o.flag) {
        r(23, 0, 2, 14, '#8a5a3c');
        r(25, 1, 10, 6, o.flag);
        r(25, 5, 10, 2, 'rgba(0,0,0,0.12)');
      }

      // 지붕: 가장자리가 비스듬하고 띠 모양 기와가 있다
      for (let row = 0; row < 20; row++) {
        const inset = Math.floor((19 - row) * 0.55);
        const band = Math.floor(row / 4) % 2 === 0 ? o.roof : o.roofMid;
        r(inset, top + row, 48 - inset * 2, 1, row % 4 === 0 ? o.roofLt : band);
        for (let x = inset + (Math.floor(row / 4) % 2 ? 3 : 0); x < 48 - inset; x += 6) {
          r(x, top + row, 1, 1, o.roofDk);
        }
      }
      r(0, top + 19, 48, 2, o.roofDk);

      // 벽
      const wy = top + 21;
      r(3, wy, 42, 27, o.wall);
      for (let x = 3 + 7; x < 45; x += 7) r(x, wy + 2, 1, 23, o.wallLn);
      r(3, wy + 23, 42, 4, o.wallDk);
      r(3, wy, 42, 2, o.trim);

      // 차양 (상점)
      if (o.awning) {
        for (let i = 0; i < 7; i++) {
          r(3 + i * 6, wy + 2, 6, 5, i % 2 ? '#fffaf0' : o.awning);
          r(3 + i * 6, wy + 7, 6, 1, i % 2 ? '#e8dcc4' : o.awningDk);
        }
      }

      // 문
      r(19, wy + 10, 12, 17, o.trim);
      r(20, wy + 11, 10, 16, o.door);
      r(20, wy + 11, 10, 2, o.doorDk);
      r(24, wy + 13, 1, 14, o.doorDk);
      r(27, wy + 19, 2, 2, '#ffd36a');

      // 창문 + 꽃 화분
      for (const x of [7, 32]) {
        r(x, wy + 6, 9, 9, o.trim);
        r(x + 1, wy + 7, 7, 7, '#bfe6ff');
        r(x + 1, wy + 7, 7, 2, '#e4f4ff');
        r(x + 4, wy + 7, 1, 7, o.trim);
        r(x + 1, wy + 10, 7, 1, o.trim);
        r(x, wy + 15, 9, 3, '#9b6a44');
        r(x + 1, wy + 14, 1, 1, '#ff8fb1');
        r(x + 4, wy + 14, 1, 1, '#ffd24a');
        r(x + 7, wy + 14, 1, 1, '#ff8fb1');
      }
    });
  }

  const roofs = (base, mid, lt, dk) => ({ roof: base, roofMid: mid, roofLt: lt, roofDk: dk });
  const walls = { wall: '#fff1d6', wallLn: '#f3e2bd', wallDk: '#e8d3a8', trim: '#fffaf0', door: '#9b6a44', doorDk: '#7a4e2e' };

  const buildings = {
    shop: makeBuilding({ ...roofs('#f2705c', '#e8604c', '#ff9a86', '#bf4533'), ...walls, awning: '#ff7a6b', awningDk: '#d9604f' }),
    inn: makeBuilding({ ...roofs('#5a8cf0', '#4f86e8', '#86aef7', '#3562c0'), ...walls, wall: '#fff6e3', door: '#8b5a9e', doorDk: '#6d4380' }),
    forge: makeBuilding({ ...roofs('#8a93a6', '#7b8494', '#aab2c2', '#5a6272'), ...walls, wall: '#ece6da', wallLn: '#ddd5c6', wallDk: '#cfc6b4', door: '#6b4a34', doorDk: '#4e3524', chimney: true }),
    hall: makeBuilding({ ...roofs('#a77be8', '#9b6fe0', '#c4a3f3', '#7650b8'), ...walls, wall: '#fdf3ff', wallLn: '#efdcf7', wallDk: '#e0c8ee', flag: '#ffd24a' }),
    home: makeBuilding({ ...roofs('#52c47f', '#47b873', '#85dca6', '#2f8f57'), ...walls, chimney: true }),
  };

  // ---- 소품 ----
  const fountain = build(32, 32, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const nx = (x + 0.5 - 16) / 16, ny = (y + 0.5 - 21) / 10;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        let c = ny > 0.35 ? '#b9b2a2' : '#d9d3c4';
        if (d < 0.62) c = ny > 0.1 ? '#5fb8ee' : '#8fd6f8';
        r(x, y, 1, 1, c);
      }
    }
    r(14, 5, 4, 15, '#cfc9ba');
    r(13, 3, 6, 4, '#e4dfd2');
    r(15, 0, 2, 3, '#8fd6f8');
    r(10, 8, 1, 3, '#8fd6f8');
    r(21, 8, 1, 3, '#8fd6f8');
    r(12, 18, 2, 1, '#e8f7ff');
    r(19, 20, 3, 1, '#e8f7ff');
  });

  const lamp = build(6, 22, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    r(2, 7, 2, 14, '#5b5f73');
    r(0, 20, 6, 2, '#474a5c');
    r(0, 0, 6, 7, '#5b5f73');
    r(1, 1, 4, 5, '#ffe58a');
    r(1, 1, 2, 2, '#fff6c4');
  });

  // 탐험 게이트: 두 기둥 + 위쪽 들보. 가운데는 지나갈 수 있다 (64x48)
  const gate = build(64, 48, (ctx, ox, oy) => {
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    for (const x of [0, 48]) {
      r(x, 8, 16, 40, '#cfc9ba');
      r(x, 8, 4, 40, '#e4dfd2');
      r(x + 12, 8, 4, 40, '#aaa393');
      r(x - 1, 4, 18, 6, '#e4dfd2');
      r(x - 1, 8, 18, 2, '#aaa393');
      r(x + 2, 24, 3, 3, '#7ccf6a');
      r(x + 9, 32, 3, 3, '#7ccf6a');
      r(x + 6, 44, 6, 4, '#8a5a3c');
    }
    r(10, 2, 44, 8, '#9b6a44');
    r(10, 2, 44, 2, '#b8825a');
    r(10, 8, 44, 2, '#7a4e2e');
    for (let x = 12; x < 52; x += 6) {
      r(x, 10, 3, 3, '#52c47f');
      r(x + 1, 13, 1, 2, '#3a9d63');
    }
    r(29, 3, 6, 5, '#ffd24a');
  });

  // ---- NPC (플레이어와 같은 12x16 몸, 색만 다름) ----
  const base = { skin: '#f4c99b', skinSh: '#d9a074', eye: '#231c2e', shoe: '#2d211b' };
  const looks = {
    merchant: { ...base, hair: '#6b4a2e', cap: '#ff9f43', capSh: '#d9802a', shirt: '#3fc9b5', shirtSh: '#2a9e8d', pants: '#5a4a7a' },
    innkeeper: { ...base, hair: '#8a4b2d', cap: '#ff8fb1', capSh: '#d96b8f', shirt: '#fffaf0', shirtSh: '#e6dccb', pants: '#7a6cc4' },
    smith: { ...base, hair: '#2f2a33', cap: '#6b7385', capSh: '#4e5565', shirt: '#c25b3a', shirtSh: '#9c4529', pants: '#3b3f63' },
    clerk: { ...base, hair: '#3d2a55', cap: '#a77be8', capSh: '#7f57c0', shirt: '#eadcf8', shirtSh: '#cbb6e8', pants: '#4a4466' },
    kid: { ...base, hair: '#b3702f', cap: '#ffd24a', capSh: '#d9a92a', shirt: '#ff7a6b', shirtSh: '#d9594a', pants: '#4f86e8' },
    guard: { ...base, hair: '#4a3a2e', cap: '#9aa3b8', capSh: '#747d92', shirt: '#4f86e8', shirtSh: '#3562c0', pants: '#3b3f63' },
  };
  const npcs = {};
  for (const [name, pal] of Object.entries(looks)) npcs[name] = Sprites.makePerson(pal);

  Sprites.buildings = buildings;
  Sprites.props = { fountain, lamp, gate };
  Sprites.npcs = npcs;
})();
