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
        r(x + 1, wy + 14, 1, 1, '#9fbf86');
        r(x + 4, wy + 14, 1, 1, '#c9d49a');
        r(x + 7, wy + 14, 1, 1, '#9fbf86');
      }
    });
  }

  const roofs = (base, mid, lt, dk) => ({ roof: base, roofMid: mid, roofLt: lt, roofDk: dk });
  const walls = { wall: '#efe3cc', wallLn: '#e3d4b6', wallDk: '#d5c4a2', trim: '#f8f1e2', door: '#8a5f3e', doorDk: '#6d4a2f' };

  const buildings = {
    shop: makeBuilding({ ...roofs('#b9604e', '#ad5645', '#cf806d', '#8a4335'), ...walls, awning: '#c0705f', awningDk: '#9d5446' }),
    inn: makeBuilding({ ...roofs('#5b78a8', '#506c9b', '#7d96c0', '#3d557f'), ...walls, wall: '#f1e8d4', door: '#6d5a80', doorDk: '#54446a' }),
    forge: makeBuilding({ ...roofs('#7a8191', '#6f7686', '#98a0ae', '#555c6a'), ...walls, wall: '#ece6da', wallLn: '#ddd5c6', wallDk: '#cfc6b4', door: '#6b4a34', doorDk: '#4e3524', chimney: true }),
    hall: makeBuilding({ ...roofs('#7f6a9e', '#74608f', '#9d89b8', '#5b4a75'), ...walls, wall: '#efe6ee', wallLn: '#e1d4e0', wallDk: '#d2c1d0', flag: '#c9a03a' }),
    home: makeBuilding({ ...roofs('#5f9370', '#558866', '#7fae8e', '#3f6b50'), ...walls, chimney: true }),
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

  // ---- 인물 (플레이어와 같은 12x16 몸. 색과 모자/수염/치마 같은 옵션으로 구분) ----
  const base = { skin: '#f4c99b', skinSh: '#d9a074', eye: '#231c2e', shoe: '#2d211b' };
  const looks = {
    // 마을 사람
    merchant: { ...base, hat: 'none', hair: '#7a5a3a', hairLt: '#9a7a54', shirt: '#c98a3f', shirtSh: '#a66f2c', pants: '#5a4a7a', apron: '#8a5a3c' },
    shopF: { ...base, hat: 'none', longHair: true, hair: '#6b4226', hairLt: '#8c5a35', shirt: '#8a68b8', shirtSh: '#6b4d98', dress: '#8a68b8', pants: '#8a68b8' },
    innkeeper: { ...base, hat: 'none', longHair: true, hair: '#8a4b2d', hairLt: '#a8643f', shirt: '#5f9a7a', shirtSh: '#487a5e', dress: '#5f9a7a', pants: '#5f9a7a', apron: '#f4efe2' },
    maid: { ...base, hat: 'kerchief', hair: '#6b4a2e', shirt: '#5f9aa0', shirtSh: '#487a80', dress: '#5f9aa0', pants: '#5f9aa0', apron: '#ffffff' },
    smith: { ...base, hat: 'none', hair: '#2f2a33', hairLt: '#4a4450', beard: '#3a3030', shirt: '#8a5a3c', shirtSh: '#6d4529', pants: '#3b3f63', apron: '#4a4a52' },
    elder: { ...base, hat: 'none', hair: '#e8e8ea', hairLt: '#ffffff', beard: '#e8e8ea', shirt: '#7a7f90', shirtSh: '#5d6272', dress: '#7a7f90', pants: '#7a7f90' },
    kid: { ...base, hat: 'cap', hair: '#b3702f', cap: '#d4b04a', capSh: '#aa8a30', shirt: '#c26a58', shirtSh: '#9d5042', pants: '#506c9b' },
    // 의뢰/관리
    guard: { ...base, hat: 'cap', hair: '#4a3a2e', cap: '#2f4f8a', capSh: '#223a68', shirt: '#3a5fa0', shirtSh: '#2b4879', pants: '#2f333c' },
    clerk: { ...base, hat: 'none', hair: '#3d2a55', hairLt: '#5a4478', shirt: '#e3dae9', shirtSh: '#c7bad2', pants: '#4a4466' },
    witch: { ...base, hat: 'witch', cap: '#6b4a8a', longHair: true, hair: '#2a2236', shirt: '#6b4a8a', shirtSh: '#523870', dress: '#6b4a8a', pants: '#6b4a8a' },
    king: { ...base, hat: 'crown', hair: '#8a6a3a', beard: '#8a6a3a', shirt: '#b03a3a', shirtSh: '#8a2a2a', dress: '#b03a3a', pants: '#b03a3a' },
    // 동료 후보 (추후 동료 시스템에서 사용)
    mage: { ...base, hat: 'witch', cap: '#4f6fc0', longHair: true, hair: '#c9c2f0', shirt: '#4f6fc0', shirtSh: '#3b559a', dress: '#4f6fc0', pants: '#4f6fc0' },
    rogue: { ...base, hat: 'cap', hair: '#2a2a30', cap: '#3a3f4a', capSh: '#2a2e36', shirt: '#454b58', shirtSh: '#343944', pants: '#2f333c' },
    priestess: { ...base, hat: 'kerchief', hair: '#c9a46a', shirt: '#f4f1ea', shirtSh: '#d8d2c4', dress: '#f4f1ea', pants: '#f4f1ea' },
    heroF: { ...base, hat: 'none', longHair: true, hair: '#b0503a', hairLt: '#d0705a', shirt: '#b0463a', shirtSh: '#8a342a', pants: '#5a4a3a', shield: '#c24a4a', shieldRim: '#d9b24a', blade: '#d6dce6' },
  };
  const npcs = {};
  for (const [name, pal] of Object.entries(looks)) npcs[name] = Sprites.makePerson(pal);

  Sprites.buildings = buildings;
  Sprites.props = { fountain, lamp, gate };
  Sprites.npcs = npcs;
})();
