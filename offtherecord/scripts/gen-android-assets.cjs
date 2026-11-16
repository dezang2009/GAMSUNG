// Android 아이콘(일반·원형·적응형 전경)과 시작 화면을 scripts/icon-art.cjs 로 만들어요. (npx cap add android 이후)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const RES = path.join(__dirname, '../android/app/src/main/res');
const { iconSvg, BG } = require('./icon-art.cjs');
const art = (o) => iconSvg(o).replace('<svg ', '<svg width="100%" height="100%" ');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const shot = async (file, w, h, html) => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent">${html}</body></html>`);
    await p.screenshot({ path: file, omitBackground: true });
  };
  const tile = (s, o) => `<div style="width:${s}px;height:${s}px">${art(o)}</div>`;
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(RES, `mipmap-${d}`);
    const s = Math.round(48 * k);
    await shot(path.join(dir, 'ic_launcher.png'), s, s, tile(s, { radius: 112 }));
    await shot(path.join(dir, 'ic_launcher_round.png'), s, s, tile(s, { radius: 256, scale: 0.92 }));
    const f = Math.round(108 * k);
    await shot(path.join(dir, 'ic_launcher_foreground.png'), f, f, `<div style="width:${f}px;height:${f}px;background:${BG}">${art({ bg: false, scale: 0.6 })}</div>`);
  }
  let n = 0;
  for (const dir of fs.readdirSync(RES)) {
    const file = path.join(RES, dir, 'splash.png');
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const s = Math.round(Math.min(w, h) * 0.22);
    await shot(file, w, h, `<div style="width:${w}px;height:${h}px;background:#f6f7fb;display:grid;place-items:center"><div style="width:${s}px;height:${s}px">${art({ radius: 120 })}</div></div>`);
    n++;
  }
  await b.close();
  fs.rmSync(path.join(RES, 'drawable-v24/ic_launcher_foreground.xml'), { force: true });
  const bgx = path.join(RES, 'values/ic_launcher_background.xml');
  fs.writeFileSync(bgx, fs.readFileSync(bgx, 'utf8').replace(/#[0-9A-Fa-f]{6}/, BG.toUpperCase()));
  console.log(`아이콘 15개, 시작 화면 ${n}개`);
})();
