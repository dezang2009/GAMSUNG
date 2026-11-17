// PROJECT EDEN — 그리드 기반 월드 데이터와 배경 렌더러.
// STEP 01: 황폐한 행성 지형 배경만 그린다. 건물 배치/상호작용은 없다.
(function () {
  'use strict';

  window.EDEN = window.EDEN || {};

  var TILE = { BASIN: 0, PLAIN: 1, RIDGE: 2, PLATEAU: 3 };
  var FEATURE = { NONE: 0, CRATER: 1, ROCK: 2, CRYSTAL: 3, CRACK: 4 };

  // ---------- 시드 기반 노이즈 ----------
  function hash(ix, iy, seed) {
    var h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function valueNoise(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    var c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  // 타일 좌표(실수) 기준 고도 0..1
  function elevationAt(x, y, seed) {
    var f = 0.16, amp = 1, sum = 0, norm = 0;
    for (var o = 0; o < 4; o++) {
      sum += valueNoise(x * f, y * f, seed + o * 101) * amp;
      norm += amp;
      f *= 2.1; amp *= 0.5;
    }
    return sum / norm;
  }

  // ---------- 월드 데이터 ----------
  function createWorld(cfg) {
    var cols = cfg.cols, rows = cfg.rows, seed = cfg.seed;
    var tiles = new Array(cols * rows);

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var e = elevationAt(x + 0.5, y + 0.5, seed);
        var type = e < 0.4 ? TILE.BASIN : e < 0.56 ? TILE.PLAIN : e < 0.68 ? TILE.RIDGE : TILE.PLATEAU;

        var r = hash(x, y, seed + 7);
        var feature = FEATURE.NONE;
        if (r < 0.035 && type <= TILE.PLAIN) feature = FEATURE.CRATER;
        else if (r < 0.13) feature = FEATURE.ROCK;
        else if (r < 0.15) feature = FEATURE.CRYSTAL;
        else if (r < 0.21) feature = FEATURE.CRACK;

        tiles[y * cols + x] = {
          x: x, y: y,
          elevation: e,
          type: type,
          feature: feature,
          building: null // 이후 단계에서 사용할 자리
        };
      }
    }

    return {
      cols: cols, rows: rows, seed: seed, tiles: tiles,
      getTile: function (tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return null;
        return tiles[ty * cols + tx];
      }
    };
  }

  // ---------- 렌더러 ----------
  // 고도 → 색상 (어두운 분지 → 녹슨 평원 → 밝은 고원)
  var RAMP = [
    [0.00, 30, 22, 34],
    [0.36, 62, 38, 44],
    [0.50, 112, 66, 52],
    [0.62, 146, 92, 64],
    [0.74, 176, 124, 86],
    [1.00, 206, 164, 120]
  ];

  function rampColor(e, out) {
    for (var i = 1; i < RAMP.length; i++) {
      if (e <= RAMP[i][0]) {
        var a = RAMP[i - 1], b = RAMP[i];
        var t = (e - a[0]) / (b[0] - a[0]);
        out[0] = a[1] + (b[1] - a[1]) * t;
        out[1] = a[2] + (b[2] - a[2]) * t;
        out[2] = a[3] + (b[3] - a[3]) * t;
        return;
      }
    }
    var l = RAMP[RAMP.length - 1];
    out[0] = l[1]; out[1] = l[2]; out[2] = l[3];
  }

  var SAMPLES = 8; // 타일당 지형 샘플 수 (한 변)

  function WorldRenderer(canvas, world, cfg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.cfg = cfg;
    this.tile = 48;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    // 카메라: 화면 중앙에 놓일 월드 좌표(타일 단위)
    this.camera = { x: world.cols / 2, y: world.rows / 2 };
    this.buffer = document.createElement('canvas');
  }

  WorldRenderer.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    var t = Math.round(this.width / this.cfg.tilesAcross);
    this.tile = Math.max(this.cfg.minTile, Math.min(this.cfg.maxTile, t));
  };

  // 타일 좌표 → 화면 좌표(CSS px)
  WorldRenderer.prototype.tileToScreen = function (tx, ty) {
    return {
      x: Math.round(this.width / 2 + (tx - this.camera.x) * this.tile),
      y: Math.round(this.height / 2 + (ty - this.camera.y) * this.tile)
    };
  };

  // 화면 좌표 → 타일 좌표 (이후 단계의 입력 처리용)
  WorldRenderer.prototype.screenToTile = function (sx, sy) {
    return {
      x: Math.floor(this.camera.x + (sx - this.width / 2) / this.tile),
      y: Math.floor(this.camera.y + (sy - this.height / 2) / this.tile)
    };
  };

  WorldRenderer.prototype.visibleRange = function () {
    var a = this.screenToTile(0, 0), b = this.screenToTile(this.width, this.height);
    return {
      x0: Math.max(0, a.x), y0: Math.max(0, a.y),
      x1: Math.min(this.world.cols - 1, b.x), y1: Math.min(this.world.rows - 1, b.y)
    };
  };

  WorldRenderer.prototype.render = function () {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b1017';
    ctx.fillRect(0, 0, this.width, this.height);

    var range = this.visibleRange();
    if (range.x1 < range.x0 || range.y1 < range.y0) return;

    this.drawTerrain(range);
    this.drawFeatures(range);
    this.drawGrid(range);
  };

  // 연속 고도장을 저해상도로 샘플링한 뒤 부드럽게 확대해 지면을 그린다.
  WorldRenderer.prototype.drawTerrain = function (range) {
    var seed = this.world.seed;
    var tw = range.x1 - range.x0 + 1, th = range.y1 - range.y0 + 1;
    var w = tw * SAMPLES, h = th * SAMPLES;
    var buf = this.buffer;
    buf.width = w; buf.height = h;
    var bctx = buf.getContext('2d');
    var img = bctx.createImageData(w, h);
    var data = img.data, rgb = [0, 0, 0], d = 0.35;

    for (var py = 0; py < h; py++) {
      for (var px = 0; px < w; px++) {
        var wx = range.x0 + (px + 0.5) / SAMPLES;
        var wy = range.y0 + (py + 0.5) / SAMPLES;
        var e = elevationAt(wx, wy, seed);
        // 북서쪽 광원 기준 음영
        var shade = (elevationAt(wx - d, wy - d, seed) - elevationAt(wx + d, wy + d, seed)) * 4.2;
        var grain = (hash(px + range.x0 * SAMPLES, py + range.y0 * SAMPLES, seed + 31) - 0.5) * 0.07;
        var light = 1 + Math.max(-0.4, Math.min(0.4, shade)) + grain;
        rampColor(e, rgb);
        var i = (py * w + px) * 4;
        data[i] = rgb[0] * light;
        data[i + 1] = rgb[1] * light;
        data[i + 2] = rgb[2] * light;
        data[i + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);

    var o = this.tileToScreen(range.x0, range.y0);
    var ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(buf, o.x, o.y, tw * this.tile, th * this.tile);
  };

  WorldRenderer.prototype.drawFeatures = function (range) {
    var ctx = this.ctx, ts = this.tile, seed = this.world.seed;
    for (var y = range.y0; y <= range.y1; y++) {
      for (var x = range.x0; x <= range.x1; x++) {
        var tile = this.world.getTile(x, y);
        if (tile.feature === FEATURE.NONE) continue;
        var p = this.tileToScreen(x, y);
        var r1 = hash(x, y, seed + 11), r2 = hash(x, y, seed + 12), r3 = hash(x, y, seed + 13);
        ctx.save();
        ctx.translate(p.x, p.y);
        if (tile.feature === FEATURE.CRATER) drawCrater(ctx, ts, r1, r2);
        else if (tile.feature === FEATURE.ROCK) drawRocks(ctx, ts, r1, r2, r3);
        else if (tile.feature === FEATURE.CRYSTAL) drawCrystal(ctx, ts, r1, r2);
        else drawCrack(ctx, ts, r1, r2, r3);
        ctx.restore();
      }
    }
  };

  function drawCrater(ctx, ts, r1, r2) {
    var cx = ts * (0.45 + r1 * 0.1), cy = ts * (0.45 + r2 * 0.1);
    var r = ts * (0.26 + r1 * 0.12);
    var g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(10, 6, 12, 0.5)');
    g.addColorStop(0.75, 'rgba(10, 6, 12, 0.32)');
    g.addColorStop(1, 'rgba(10, 6, 12, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1.5, ts * 0.045);
    ctx.lineCap = 'round';
    // 빛을 받는 남동쪽 안벽
    ctx.strokeStyle = 'rgba(255, 214, 170, 0.3)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, -0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    // 그늘진 북서쪽 안벽
    ctx.strokeStyle = 'rgba(8, 4, 10, 0.4)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0.75 * Math.PI, 1.75 * Math.PI); ctx.stroke();
  }

  function drawRocks(ctx, ts, r1, r2, r3) {
    var n = 1 + Math.floor(r3 * 3);
    for (var i = 0; i < n; i++) {
      var a = r1 * 6.283 + i * 2.2;
      var cx = ts * (0.5 + Math.cos(a) * 0.2 * (i ? 1 : r2));
      var cy = ts * (0.5 + Math.sin(a) * 0.2 * (i ? 1 : r2));
      var s = ts * (0.07 + ((r2 * 7 + i * 0.37) % 1) * 0.07);
      ctx.fillStyle = 'rgba(8, 5, 10, 0.4)';
      rockPath(ctx, cx + s * 0.35, cy + s * 0.35, s, a);
      ctx.fill();
      ctx.fillStyle = '#5d4640';
      rockPath(ctx, cx, cy, s, a);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 222, 190, 0.26)';
      rockPath(ctx, cx - s * 0.2, cy - s * 0.22, s * 0.55, a);
      ctx.fill();
    }
  }

  function rockPath(ctx, cx, cy, s, rot) {
    ctx.beginPath();
    for (var k = 0; k < 6; k++) {
      var ang = rot + k * 1.0472;
      var rr = s * (0.75 + ((k * 0.61 + rot) % 1) * 0.4);
      var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function drawCrystal(ctx, ts, r1, r2) {
    var cx = ts * (0.42 + r1 * 0.16), cy = ts * (0.46 + r2 * 0.14);
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 0.42);
    glow.addColorStop(0, 'rgba(95, 227, 255, 0.24)');
    glow.addColorStop(1, 'rgba(95, 227, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, ts, ts);
    var shards = [[0, 0, 0.2], [-0.15, 0.06, 0.13], [0.14, 0.07, 0.11]];
    for (var i = 0; i < shards.length; i++) {
      var sx = cx + shards[i][0] * ts, sy = cy + shards[i][1] * ts, h = shards[i][2] * ts, w = h * 0.45;
      ctx.fillStyle = '#3fb9d9';
      ctx.beginPath();
      ctx.moveTo(sx, sy - h); ctx.lineTo(sx + w, sy); ctx.lineTo(sx, sy + h * 0.45); ctx.lineTo(sx - w, sy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b5f3ff';
      ctx.beginPath();
      ctx.moveTo(sx, sy - h); ctx.lineTo(sx, sy + h * 0.45); ctx.lineTo(sx - w, sy);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawCrack(ctx, ts, r1, r2, r3) {
    var x = ts * (0.15 + r1 * 0.2), y = ts * (0.2 + r2 * 0.6);
    var ang = (r3 - 0.5) * 1.2;
    ctx.strokeStyle = 'rgba(12, 7, 14, 0.42)';
    ctx.lineWidth = Math.max(1, ts * 0.028);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    for (var i = 0; i < 4; i++) {
      ang += (((r1 * 13 + i * 0.77) % 1) - 0.5) * 1.3;
      x += Math.cos(ang) * ts * 0.17; y += Math.sin(ang) * ts * 0.17;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  WorldRenderer.prototype.drawGrid = function (range) {
    var ctx = this.ctx, ts = this.tile;
    var a = this.tileToScreen(range.x0, range.y0);
    var b = this.tileToScreen(range.x1 + 1, range.y1 + 1);
    var x, y, p;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(210, 235, 255, 0.07)';
    ctx.beginPath();
    for (x = range.x0; x <= range.x1 + 1; x++) {
      p = a.x + (x - range.x0) * ts + 0.5;
      ctx.moveTo(p, a.y); ctx.lineTo(p, b.y);
    }
    for (y = range.y0; y <= range.y1 + 1; y++) {
      p = a.y + (y - range.y0) * ts + 0.5;
      ctx.moveTo(a.x, p); ctx.lineTo(b.x, p);
    }
    ctx.stroke();

    // 4타일마다 교차점 표시
    ctx.strokeStyle = 'rgba(150, 225, 255, 0.3)';
    ctx.beginPath();
    var m = Math.max(3, ts * 0.09);
    for (y = range.y0; y <= range.y1 + 1; y++) {
      if (y % 4) continue;
      for (x = range.x0; x <= range.x1 + 1; x++) {
        if (x % 4) continue;
        var cx = a.x + (x - range.x0) * ts + 0.5, cy = a.y + (y - range.y0) * ts + 0.5;
        ctx.moveTo(cx - m, cy); ctx.lineTo(cx + m, cy);
        ctx.moveTo(cx, cy - m); ctx.lineTo(cx, cy + m);
      }
    }
    ctx.stroke();
  };

  EDEN.TILE = TILE;
  EDEN.FEATURE = FEATURE;
  EDEN.createWorld = createWorld;
  EDEN.WorldRenderer = WorldRenderer;
})();
