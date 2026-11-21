// 외부 이미지 없이 Canvas 픽셀 단위로 그리는 스프라이트 모음
const Sprites = (() => {
  const OUTLINE = '#2a2233';

  const C = {
    skin: '#f4c99b', skinSh: '#d9a074', hair: '#4a2f22',
    cap: '#e0503c', capSh: '#b33b2c',
    shirt: '#3f83d6', shirtSh: '#2c5fa6', pants: '#3b3f63',
    shoe: '#2d211b', eye: '#231c2e',
    trunk: '#7b4f2e', trunkSh: '#5c3a22',
    leafL: '#72cc5e', leafM: '#42a04a', leafD: '#2b7535', leafRim: '#1f5427',
    rockL: '#c3c7cf', rockM: '#8f95a1', rockD: '#5d6371',
    bushL: '#5cc053', bushM: '#3a9040', bushD: '#276a2f', berry: '#e4505c',
  };

  // 발 모양 프레임: [왼쪽 다리 바닥 행, 오른쪽 다리 바닥 행]
  const LEGS = [[15, 14], [14, 15], [15, 15]]; // 걷기1, 걷기2, 정지

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // 투명 픽셀 중 색 있는 픽셀과 맞닿은 곳에 외곽선을 그린다
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function addOutline(canvas, color) {
    const rgb = hexToRgb(color || OUTLINE);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const s = ctx.getImageData(0, 0, w, h).data;
    const out = new Uint8ClampedArray(s);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (s[i + 3]) continue;
        const near = (x > 0 && s[i - 1]) || (x < w - 1 && s[i + 7]) ||
                     (y > 0 && s[i - w * 4 + 3]) || (y < h - 1 && s[i + w * 4 + 3]);
        if (near) {
          out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2]; out[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(new ImageData(out, w, h), 0, 0);
  }

  // 내용 영역 w x h 에 draw 를 실행하고, 외곽선용 1px 여백을 더해 반환
  function build(w, h, draw, outlineColor) {
    const c = document.createElement('canvas');
    c.width = w + 2;
    c.height = h + 2;
    draw(c.getContext('2d'), 1, 1);
    addOutline(c, outlineColor);
    return c;
  }

  function flip(src) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
  }

  // ---- 플레이어 (12x16) ----
  function drawPlayer(ctx, ox, oy, dir, legs, pal) {
    const P = pal || C; // 색상표: 생략하면 플레이어, NPC 는 자기 색상표를 넘긴다
    const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
    const leg = (x, bottom) => {
      r(x, 13, 2, bottom - 13, P.pants);
      r(x, bottom, 2, 1, P.shoe);
    };

    if (dir === 'side') {
      r(3, 2, 2, 6, P.hair);            // 뒤통수
      r(3, 0, 7, 3, P.cap);             // 모자
      r(4, 3, 5, 5, P.skin);            // 얼굴
      r(7, 5, 1, 2, P.eye);             // 눈
      r(4, 8, 5, 5, P.shirt);           // 몸통
      r(4, 9, 1, 4, P.shirtSh);         // 뒤팔
      leg(4, legs[0]);
      leg(6, legs[1]);
      r(6, 9, 2, 4, P.shirt);           // 앞팔
      r(6, 12, 2, 1, P.skin);           // 손
      return;
    }

    r(3, 0, 6, 3, P.cap);               // 모자
    r(3, 3, 6, 5, dir === 'up' ? P.hair : P.skin);
    if (dir === 'down') {
      r(4, 5, 1, 2, P.eye);
      r(7, 5, 1, 2, P.eye);
    }
    r(3, 8, 6, 5, P.shirt);             // 몸통
    r(2, 8, 1, 4, P.shirt);             // 왼팔
    r(9, 8, 1, 4, P.shirt);             // 오른팔
    r(2, 12, 1, 1, P.skin);
    r(9, 12, 1, 1, P.skin);
    leg(3, legs[0]);
    leg(7, legs[1]);
  }

  // ---- 나무 (18x26 + 외곽선) ----
  function makeTree(radius) {
    return build(18, 26, (ctx, ox, oy) => {
      rect(ctx, ox + 7, oy + 16, 4, 10, C.trunk);
      rect(ctx, ox + 10, oy + 16, 1, 10, C.trunkSh);
      for (let y = 0; y < 18; y++) {
        for (let x = 0; x < 18; x++) {
          const dx = x + 0.5 - 9, dy = y + 0.5 - 9;
          const d = Math.hypot(dx, dy);
          if (d > radius + 0.5) continue;
          let col;
          if (d > radius - 0.9) {
            col = C.leafRim;
          } else {
            const l = (-dx - dy) / (radius * 1.4); // 왼쪽 위에서 빛이 온다고 가정
            col = l > 0.35 ? C.leafL : l < -0.4 ? C.leafD : C.leafM;
          }
          rect(ctx, ox + x, oy + y, 1, 1, col);
        }
      }
      // 잎 질감
      for (let y = 2; y < 16; y++) {
        for (let x = 2; x < 16; x++) {
          if ((x * 5 + y * 3) % 13 === 0 && Math.hypot(x - 9, y - 9) < radius - 2) {
            rect(ctx, ox + x, oy + y, 1, 1, C.leafL);
          }
        }
      }
    });
  }

  // ---- 바위 (14x10) ----
  function makeRock(seed) {
    return build(14, 10, (ctx, ox, oy) => {
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 14; x++) {
          const nx = (x + 0.5 - 7) / 7, ny = (y + 0.5 - 5) / 5;
          if (nx * nx + ny * ny > 1) continue;
          let col;
          if (ny < -0.35) col = C.rockL;
          else if (ny > 0.35 && nx > -0.5) col = C.rockD;
          else col = C.rockM;
          if ((x * 3 + y * 7 + seed) % 11 === 0 && ny < 0) col = C.rockL;
          rect(ctx, ox + x, oy + y, 1, 1, col);
        }
      }
    });
  }

  // ---- 덤불 (14x11) ----
  function makeBush(seed) {
    const blobs = [[4, 6, 3.2], [9.5, 6, 3.2], [7, 4, 3.5]];
    return build(14, 11, (ctx, ox, oy) => {
      for (let y = 0; y < 11; y++) {
        for (let x = 0; x < 14; x++) {
          const inside = blobs.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);
          if (!inside) continue;
          let col = y < 4 ? C.bushL : y > 7 ? C.bushD : C.bushM;
          if ((x * 3 + y * 5 + seed) % 17 === 0 && y > 2) col = C.berry;
          rect(ctx, ox + x, oy + y, 1, 1, col);
        }
      }
    });
  }

  // ---- 몬스터 ----
  // 푸른 슬라임 (14x11): squash 프레임으로 통통 튀는 느낌
  function makeSlime(squash) {
    return build(14, 11, (ctx, ox, oy) => {
      const cx = 7, cy = squash ? 7 : 6, rx = squash ? 6.8 : 6.2, ry = squash ? 3.6 : 4.6;
      for (let y = 0; y < 11; y++) {
        for (let x = 0; x < 14; x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
          if (nx * nx + ny * ny > 1) continue;
          const col = ny < -0.35 ? '#a6d8ff' : ny > 0.45 ? '#3a74d0' : '#5aa8ff';
          rect(ctx, ox + x, oy + y, 1, 1, col);
        }
      }
      rect(ctx, ox + 3, oy + Math.round(cy - ry + 1.2), 2, 1, '#e8f6ff');
      rect(ctx, ox + 4, oy + cy - 1, 1, 2, '#1b1b2f');
      rect(ctx, ox + 9, oy + cy - 1, 1, 2, '#1b1b2f');
      rect(ctx, ox + 6, oy + cy + 1, 2, 1, '#1b1b2f');
    });
  }

  // 버섯돌이 (14x16)
  function makeMushroom(step) {
    return build(14, 16, (ctx, ox, oy) => {
      const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
      r(4, 9, 6, 5, '#f2e3c3');
      r(8, 9, 2, 5, '#d9c49d');
      r(5, 10, 1, 2, '#231c2e');
      r(8, 10, 1, 2, '#231c2e');
      r(6, 12, 2, 1, '#b5523b');
      r(3, step ? 14 : 15, 3, step ? 2 : 1, '#c9a77a');
      r(8, step ? 15 : 14, 3, step ? 1 : 2, '#c9a77a');
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 14; x++) {
          const nx = (x + 0.5 - 7) / 7, ny = (y + 0.5 - 5) / 5;
          if (nx * nx + ny * ny > 1) continue;
          const col = nx + ny < -0.6 ? '#f2705f' : ny > 0.4 ? '#a8332b' : '#d8483c';
          r(x, y, 1, 1, col);
        }
      }
      r(3, 2, 2, 2, '#fff7ea');
      r(9, 1, 2, 2, '#fff7ea');
      r(6, 5, 2, 1, '#fff7ea');
    });
  }

  // 달빛 여우 (희귀, 20x14, 오른쪽을 봄): 금색 외곽선으로 일반 몬스터와 구분
  function makeFox(step) {
    return build(20, 14, (ctx, ox, oy) => {
      const r = (x, y, w, h, c) => rect(ctx, ox + x, oy + y, w, h, c);
      const body = '#d9d4ff', shade = '#b4abf0', light = '#efeaff';
      r(1, 3, 3, 6, body);
      r(0, 2, 3, 3, '#ffffff');
      r(3, 6, 10, 4, body);
      r(3, 9, 10, 1, shade);
      r(4, 6, 8, 1, light);
      r(12, 3, 6, 5, body);
      r(17, 5, 3, 3, light);
      r(19, 5, 1, 1, '#231c2e');
      r(15, 5, 1, 1, '#231c2e');
      r(12, 1, 2, 3, body);
      r(16, 1, 2, 3, body);
      r(13, 2, 1, 1, '#ff9fc0');
      r(17, 2, 1, 1, '#ff9fc0');
      r(4, 10, 2, step ? 3 : 4, shade);
      r(6, 10, 2, step ? 4 : 3, shade);
      r(10, 10, 2, step ? 4 : 3, shade);
      r(12, 10, 2, step ? 3 : 4, shade);
    }, '#f2b632');
  }

  // 플레이어를 감지했을 때 머리 위에 뜨는 느낌표
  function makeAlert() {
    return build(3, 8, (ctx, ox, oy) => {
      rect(ctx, ox, oy, 3, 5, '#ff4d4d');
      rect(ctx, ox, oy + 6, 3, 2, '#ff4d4d');
    });
  }

  function monsterSet(make) {
    const right = [make(0), make(1)];
    return { right, left: right.map(flip) };
  }

  // 잔디 무늬 타일 (메뉴 배경, 썸네일용)
  function makeGrassPattern(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const cols = ['#6cbb48', '#62ae40', '#78c755', '#58a23a'];
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        rect(ctx, x, y, 2, 2, n < 0.55 ? cols[0] : n < 0.8 ? cols[1] : n < 0.93 ? cols[2] : cols[3]);
      }
    }
    return c;
  }

  // 색상표(pal)로 사람 스프라이트 세트를 만든다 (플레이어/NPC 공용)
  function makePerson(pal) {
    const mk = (dir) => LEGS.map((legs) => build(12, 16, (ctx, ox, oy) => drawPlayer(ctx, ox, oy, dir, legs, pal)));
    const side = mk('side');
    return { down: mk('down'), up: mk('up'), right: side, left: side.map(flip) };
  }

  const playerFront = LEGS.map((legs) => build(12, 16, (ctx, ox, oy) => drawPlayer(ctx, ox, oy, 'down', legs)));
  const playerBack = LEGS.map((legs) => build(12, 16, (ctx, ox, oy) => drawPlayer(ctx, ox, oy, 'up', legs)));
  const playerSide = LEGS.map((legs) => build(12, 16, (ctx, ox, oy) => drawPlayer(ctx, ox, oy, 'side', legs)));

  return {
    // player.dir 별 [걷기1, 걷기2, 정지] 프레임
    player: {
      down: playerFront,
      up: playerBack,
      right: playerSide,
      left: playerSide.map(flip),
    },
    trees: [makeTree(8.5), makeTree(7.4)],
    rocks: [makeRock(0), makeRock(4), makeRock(8)],
    bushes: [makeBush(0), makeBush(7)],
    monsters: {
      slime: monsterSet(makeSlime),
      mushroom: monsterSet(makeMushroom),
      fox: monsterSet(makeFox),
    },
    alert: makeAlert(),
    makeGrassPattern,
    makePerson,
    tools: { build, rect, flip }, // 다른 스프라이트 파일에서 재사용
  };
})();
