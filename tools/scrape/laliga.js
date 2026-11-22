// 라리가 1/2부 공식 사이트 -> data/LALIGA.json, LALIGA2.json. 실행: NODE_PATH=$(npm root -g) node tools/scrape/laliga.js
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = 'app/src/main/assets'; const wr = (f, b) => fs.writeFileSync(`${OUT}/${f}`, b);
const LEAGUES = { LALIGA: 'laliga-easports', LALIGA2: 'laliga-hypermotion' };
const POS = { GOALKEEPER: 'GK', DEFENDER: 'DF', MIDFIELDER: 'MF', FORWARD: 'FW' };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const go = async (u, scroll) => { for (let t = 0; t < 3; t++) { try { await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 }); break; } catch (e) { if (t == 2) throw e; } }
    await p.waitForTimeout(4500); if (scroll) { await p.evaluate(async () => { for (let i = 0; i < 25; i++) { window.scrollBy(0, 700); await new Promise(r => setTimeout(r, 250)); } }); await p.waitForTimeout(1500); } };
  const img = async (u, f) => { if (fs.existsSync(`${OUT}/${f}`)) return true; try { const r = await ctx.request.get(u); if (!r.ok()) return false; wr(f, await r.body()); return true; } catch { return false; } };
  for (const [L, slug] of Object.entries(LEAGUES)) {
    await go(`https://www.laliga.com/en-GB/${slug}/clubs`);
    const slugs = await p.evaluate(() => [...new Set([...document.querySelectorAll('a')].map(a => (a.href.match(/\/clubs\/([a-z0-9-]+)\/squad/) || [])[1]).filter(Boolean))]);
    const clubs = [], players = [];
    for (const s of slugs) {
      const id = `${L}_${s}`; const c = { id, slug: s, name: s, logo: null };
      try { await go(`https://www.laliga.com/en-GB/clubs/${s}/squad`, true);
        const r = await p.evaluate(() => ({ title: (document.querySelector('h1')?.innerText || '').trim(), logo: [...document.images].map(i => i.src).find(u => /assets\/\d{4}\/\d\d\/\d\d\/small\//.test(u)),
          rows: [...document.querySelectorAll('a[href*="/player/"]')].map(a => { const c = a.parentElement.parentElement, t = [...c.querySelectorAll('p')].map(x => x.innerText.trim()), im = [...c.querySelectorAll('img')].map(i => i.src).find(u => /\/squad\//.test(u));
            return { slug: a.href.split('/player/')[1], no: /^\d+$/.test(t[0]) ? +t[0] : null, name: t[1], pos: t[3], nat: t[4], img: im }; }) }));
        if (r.title) c.name = r.title;
        if (r.logo) { const f = `clubs/${id}.png`; if (await img(r.logo, `img/${f}`)) c.logo = f; }
        const dup = new Set();
        for (const x of r.rows) { if (!x.name || !POS[x.pos] || dup.has(x.slug)) continue; dup.add(x.slug);
          const pid = `${L}_${x.slug}`; const f = `players/${pid}.png`; const ok = x.img ? await img(x.img, `img/${f}`) : false;
          players.push({ id: pid, club: id, name: x.name, no: x.no, nat: x.nat, pos: POS[x.pos], photo: ok ? f : null }); }
        console.log(L, c.name, dup.size);
      } catch (e) { console.log(L, s, 'FAIL', e.message.slice(0, 60)); }
      clubs.push(c);
    }
    wr(`data/${L}.json`, JSON.stringify({ league: L, clubs, players }));
  }
  await b.close();
})();
