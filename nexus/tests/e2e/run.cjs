// NEXUS 화면 통합 테스트: 실제 빌드를 휴대폰 화면(터치)으로 눌러 봐요.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4301;
const URL = `http://localhost:${PORT}/`;
let pass = 0;
const fails = [];
const check = (name, ok, extra = '') => {
  ok ? pass++ : fails.push(`${name} ${extra}`);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${extra}`}`);
};

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '../..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  let p = await ctx.newPage();
  const watch = (pg) => {
    pg.on('pageerror', (e) => errors.push(e.message));
    pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  };
  watch(p);
  const T = (id) => `[data-testid="${id}"]`;
  try {
    await p.goto(URL);
    await p.tap(T('new-game'));
    await p.waitForSelector('[data-screen=base]');
    check('새 게임 → 기지', true);
    for (const tab of ['planet', 'explore', 'creatures', 'research', 'base']) {
      await p.tap(`.nav [data-tab=${tab}]`);
      check(`탭 ${tab}`, await p.isVisible(`[data-screen=${tab}]`));
    }

    // 지도 팝업 · 조사
    await p.tap('.nav [data-tab=planet]');
    await p.tap('[data-region=region_04]');
    check('지도에서 잠긴 지역 → 정보 창 (조사 버튼 없음)', (await p.isVisible(T('region-popup'))) && !(await p.isVisible(T('popup-survey'))));
    await p.tap('.overlay', { position: { x: 20, y: 20 } });
    await p.tap('[data-region=region_01]');
    await p.tap(T('popup-survey'));
    check('정보 창에서 바로 조사 → 결과', await p.isVisible(T('survey-result')));
    await p.tap(T('survey-ok'));
    // 지역 카드 겹침
    const rects = await p.$$eval(`${T('region-list')} > *`, (els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.bottom]));
    check('지역 카드가 겹치지 않음', rects.every((r, i) => i === 0 || r[0] >= rects[i - 1][1] - 0.5), JSON.stringify(rects));

    // 편성
    await p.evaluate(() => {
      const G = window.__nexus.Game;
      G.state.collection.owned.push({ uid: 'c90', species: 'sp_04', level: 1, exp: 0, nickname: '', obtained_at: Date.now(), method: 'egg', region: '' });
      G.state.collection.seen.sp_04 = Date.now();
    });
    await p.tap('.nav [data-tab=explore]');
    await p.tap(T('party-strip'));
    await p.tap(T('slot-3'));
    await p.tap(T('pick-c90'));
    const party = await p.evaluate(() => window.__nexus.Game.state.collection.party);
    check('대기 1 자리에 개체 편성', party[3] === 'c90', JSON.stringify(party));
    await p.tap(T('back'));

    // 전투 (직접 조작)
    await p.tap(T('fight-training_01'));
    await p.waitForSelector(T('actions'), { timeout: 10000 });
    check('전투 화면 · 출전 3 + 대기 1', (await p.locator('.b-row.allies .unit').count()) === 3 && (await p.isVisible(T('unit-a3'))));
    await p.tap(T('act-basic'));
    check('기본 공격 → 대상 고르기', await p.isVisible(T('target-prompt')));
    const before = await p.evaluate(() => window.__nexus.app.battle.state().units.e1.hp);
    await p.tap(T('unit-e1'));
    await p.waitForTimeout(150);
    const after = await p.evaluate(() => window.__nexus.app.battle.state().units.e1.hp);
    check('고른 적에게 데미지', after < before, `${before} → ${after}`);
    await p.waitForSelector(T('actions'), { timeout: 10000 });
    await p.tap(T('act-swap'));
    await p.waitForTimeout(150);
    const st = await p.evaluate(() => window.__nexus.app.battle.state());
    check('교체 (대기 개체가 출전)', st.active.includes('a3'), JSON.stringify(st.active));
    // 자동 · 2배속 → 결과
    await p.tap(T('auto'));
    await p.tap(T('speed'));
    await p.waitForSelector(T('result'), { timeout: 60000 });
    const res = await p.textContent(T('result'));
    check('자동 전투로 결과까지', /승리|패배/.test(res), res);
    await p.tap(T('result-exit'));
    const battles = await p.evaluate(() => window.__nexus.Game.state.battles);
    check('전투 기록 저장', battles.played === 1, JSON.stringify(battles));
    // 포기
    await p.tap(T('fight-training_01'));
    await p.waitForSelector(T('battle'));
    await p.tap(T('quit'));
    await p.tap(T('confirm-ok'));
    check('나가기 → 포기 = 패배', (await p.textContent(T('result'))).includes('포기'));
    await p.tap(T('result-exit'));
    check('전투 끝나면 하단 메뉴 다시 보임', await p.isVisible('.nav'));

    // 저장 유지
    await p.waitForTimeout(700);
    await p.reload();
    await p.waitForSelector('[data-screen=base]');
    const b2 = await p.evaluate(() => window.__nexus.Game.state.battles);
    check('다시 열어도 기록 유지', b2.played === 2 && b2.losses >= 1, JSON.stringify(b2));

    // 도감 · 개체 상세
    await p.tap('.nav [data-tab=creatures]');
    await p.tap(T('dex-card'));
    check('도감 20칸', (await p.locator(`${T('dex')} > *`).count()) === 20);
    await p.tap(T('back'));
    await p.tap(T('owned-c1'));
    check('개체 상세 (스킬 표시)', (await p.textContent('[data-screen=creature]')).includes('스킬 A'));

    // 밝게
    await p.tap(T('settings'));
    await p.tap(T('theme-light'));
    check('밝게 모드', (await p.getAttribute('html', 'data-theme')) === 'light');
    await p.tap(T('theme-dark'));

    // 화면 크기 · 터치 영역
    for (const vp of [{ width: 360, height: 740 }, { width: 412, height: 915 }, { width: 768, height: 1024 }]) {
      await p.setViewportSize(vp);
      for (const tab of ['base', 'planet', 'explore', 'creatures', 'research']) {
        await p.tap(`.nav [data-tab=${tab}]`);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const small = await p.$$eval('button', (bs) => bs.filter((b) => b.offsetParent && (b.getBoundingClientRect().height < 43.5 || b.getBoundingClientRect().width < 43.5)).map((b) => `${b.textContent.trim().slice(0, 10)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`));
        check(`${vp.width}px ${tab}: 넘침 없음 · 버튼 44px+`, over <= 1 && small.length === 0, `넘침 ${over} 작은 버튼 ${small.slice(0, 4)}`);
      }
    }
    check('콘솔 오류 없음', errors.length === 0, errors.join(' | '));
  } catch (e) {
    fails.push(String(e));
    console.error(e);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`\n${pass} 통과, ${fails.length} 실패`);
  process.exit(fails.length ? 1 : 0);
})();
