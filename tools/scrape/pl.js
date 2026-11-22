// 프리미어리그 공식 사이트(렌더링) -> data/EPL.json + 로고/선수 사진. 실행: NODE_PATH=$(npm root -g) node tools/scrape/pl.js
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = 'app/src/main/assets'; const L = 'EPL';
const wr = (f, b) => fs.writeFileSync(`${OUT}/${f}`, b);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const go = async u => { await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(1500); };
  const img = async (u, f) => { if (fs.existsSync(`${OUT}/${f}`)) return true; try { const r = await ctx.request.get(u); if (!r.ok()) return false; wr(f, await r.body()); return true; } catch { return false; } };
  await go('https://www.premierleague.com/en/clubs');
  const seen = new Set();
  const clubs = (await p.evaluate(() => [...document.querySelectorAll('a[href*="/clubs/"]')].map(a => [a.href, a.innerText.trim()]))).filter(([h, n]) => { const m = h.match(/clubs\/(\d+)\/([^/]+)\/overview/); if (!m || !n || seen.has(m[1])) return false; seen.add(m[1]); return true; }).slice(0, 20)
    .map(([h, n]) => { const m = h.match(/clubs\/(\d+)\/([^/]+)/); return { id: `${L}_${m[1]}`, num: m[1], slug: m[2], name: n }; });
  const players = [];
  for (const c of clubs) {
    c.logo = (await img(`https://resources.premierleague.com/premierleague25/badges-alt/${c.num}.svg`, `img/clubs/${c.id}.svg`)) ? `clubs/${c.id}.svg` : null;
    await go(`https://www.premierleague.com/en/clubs/${c.num}/${c.slug}/squad`);
    const rows = await p.evaluate(() => { const POS = { Goalkeepers: 'GK', Defenders: 'DF', Midfielders: 'MF', Forwards: 'FW' }; let pos = ''; const o = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT); let n;
      while ((n = w.nextNode())) { if (n.children.length === 0 && POS[n.textContent.trim()]) pos = POS[n.textContent.trim()];
        else if (n.tagName === 'A' && /\/players\/\d+/.test(n.href)) { const t = n.innerText.split('\n').map(s => s.trim()).filter(Boolean); o.push({ pid: n.href.match(/players\/(\d+)/)[1], name: t[0], no: /^\d+$/.test(t[1] || '') ? +t[1] : null, nat: t[t.length - 1], pos }); } }
      return o; });
    const dup = new Set();
    for (const r of rows) { if (dup.has(r.pid)) continue; dup.add(r.pid);
      const f = `players/${L}_${r.pid}.png`;
      const ok = await img(`https://resources.premierleague.com/premierleague25/photos/players/110x140/${r.pid}.png`, `img/${f}`);
      players.push({ id: `${L}_${r.pid}`, club: c.id, name: r.name, no: r.no, nat: r.nat, pos: r.pos, photo: ok ? f : null }); }
    console.log(c.name, dup.size);
  }
  wr('data/EPL.json', JSON.stringify({ league: L, clubs, players }));
  await b.close();
})();
