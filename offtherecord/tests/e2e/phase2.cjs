// OFF THE RECORD 0.2.0 — 개선 지시서 9번 테스트 항목을 실제 빌드 화면에서 확인해요.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 4192;
const URL = `http://localhost:${PORT}/`;
const V1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/save-v1.json'), 'utf8'));
let pass = 0;
const fails = [];
const check = (no, name, ok, extra = '') => {
  ok ? pass++ : fails.push(`[${no}] ${name} ${extra}`);
  console.log(`${ok ? '✓' : '✗'} [${no}] ${name}${ok ? '' : ` — ${extra}`}`);
};
const won = (t) => Number(String(t).replace(/[^0-9-]/g, ''));

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '../..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const errors = [];
  const newCtx = async (vp = { width: 390, height: 844 }) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await ctx.route('**/blank.html', (r) => r.fulfill({ contentType: 'text/html', body: '<p>blank</p>' }));
    return ctx;
  };
  const watch = (pg) => {
    pg.on('pageerror', (e) => errors.push(e.message));
    pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    return pg;
  };
  const create = async (p, { name = '테스트', bg = 'graduate' } = {}) => {
    await p.goto(URL);
    await p.waitForSelector('[data-screen=create]');
    await p.fill('#name', name);
    await p.click(`.origin[data-value=${bg}]`);
    await p.click('[data-testid=start]');
    await p.waitForSelector('[data-screen=today]');
  };

  try {
    /* 1. 기존(0.1.0) 저장 데이터 불러오기 */
    {
      const ctx = await newCtx();
      const p = watch(await ctx.newPage());
      await p.goto(URL + 'blank.html');
      await p.evaluate((rec) => new Promise((res) => {
        const r = indexedDB.open('off-the-record', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('saves', { keyPath: 'slot' });
        r.onsuccess = () => {
          const t = r.result.transaction('saves', 'readwrite');
          t.objectStore('saves').put(rec);
          t.oncomplete = () => (r.result.close(), res());
        };
      }), V1);
      await p.goto(URL);
      await p.waitForSelector('[data-screen=today]');
      check(1, '0.1.0 저장본이 캐릭터 생성 없이 바로 열림', (await p.textContent('[data-testid=who]')) === '옛저장');
      check(1, '날짜·시각·돈이 0.1.0 저장본 그대로', (await p.textContent('[data-testid=date]')).includes('3월 3일') && (await p.textContent('[data-testid=clock]')) === '19:10' && won(await p.textContent('[data-testid=cash]')) === V1.data.economy.cash);
      await p.click('.nav__item[data-tab=me]');
      check(1, '직업이 새 구조(경력)로 옮겨져 표시', (await p.textContent('[data-testid=job]')).includes('중견기업 마케팅팀 대리'));
      await p.click('.nav__item[data-tab=today]');
      await p.click('.tab[data-cat=meal]');
      await p.click('[data-testid=do-home_meal]');
      await p.waitForTimeout(400);
      check(1, '불러온 기록으로 이어서 활동 가능', (await p.textContent('[data-testid=clock]')) === '20:10');
      const saved = await p.evaluate(() => new Promise((res) => {
        const r = indexedDB.open('off-the-record');
        r.onsuccess = () => {
          const g = r.result.transaction('saves').objectStore('saves').getAll();
          g.onsuccess = () => res(g.result.map((x) => ({ slot: x.slot, v: x.version })));
        };
      }));
      check(1, '새 버전(2)으로 저장, 직전 0.1.0 저장본은 보관', saved.some((x) => x.slot === 'main' && x.v === 2) && saved.some((x) => x.slot === 'main-prev'), JSON.stringify(saved));
      await ctx.close();
    }

    /* 2·4. 신규 캐릭터 + 이름 길이 */
    const ctx = await newCtx();
    let p = watch(await ctx.newPage());
    await p.goto(URL);
    await p.waitForSelector('[data-screen=create]');
    check(4, '이름 입력창 maxlength = 12', (await p.getAttribute('#name', 'maxlength')) === '12');
    await p.fill('#name', '');
    await p.type('#name', '가나다라마바사아자차카타파하');
    check(4, '13자 넘게 입력해도 12자까지만 들어감', (await p.inputValue('#name')).length === 12);
    await p.click('[data-testid=start]');
    await p.waitForSelector('[data-screen=today]');
    check(2, '12자 이름으로 생성 성공', (await p.textContent('[data-testid=who]')) === '가나다라마바사아자차카타');

    /* 5. 활동 미리보기·결과·추천 */
    await p.click('.tab[data-cat=growth]');
    const chipsBefore = await p.locator('[data-act=reading] .act__chips .chip').allTextContents();
    await p.click('[data-testid=do-reading]');
    await p.waitForSelector('[data-testid=result]');
    const chipsAfter = await p.locator('[data-testid=result] .chip').allTextContents();
    check(5, '활동 전 예상 변화 표시', chipsBefore.length >= 3, chipsBefore.join(','));
    check(5, '결과 카드: 시간·변화 표시', (await p.textContent('[data-testid=result]')).includes('07:00 → 09:00') && chipsAfter.some((c) => c.startsWith('지능 +')));
    check(5, '예상과 결과가 같음 (예상 칩 ⊂ 결과 칩)', chipsBefore.every((c) => chipsAfter.includes(c)), `${chipsBefore} | ${chipsAfter}`);
    check(5, '추천 활동과 이유 표시', (await p.locator('[data-testid=recs] [data-rec]').count()) >= 1 && (await p.locator('[data-testid=recs] .act__reason').count()) >= 1);
    await p.evaluate(() => (__otr.engine.state.life.hunger = 85));
    await p.click('.nav__item[data-tab=me]');
    await p.click('.nav__item[data-tab=today]');
    check(5, '배고프면 추천 맨 위가 식사', ['home_meal', 'eat_out', 'convenience_meal'].includes(await p.getAttribute('[data-testid=recs] .act >> nth=0', 'data-act')));

    /* 6. 경제 */
    await p.click('[data-testid=recs] .act >> nth=0 >> .act__go');
    await p.waitForTimeout(300);
    await p.click('.nav__item[data-tab=money]');
    const month = await p.textContent('[data-testid=month]');
    check(6, '월간 결산·저축액·예상 잔액', month.includes('저축액') && month.includes('4월 1일 예상 잔액'));
    check(6, '소비 비중 (식비)', (await p.textContent('[data-testid=share]')).includes('식비'));
    check(6, '자산·부채·순자산', (await p.textContent('[data-testid=balance]')).includes('순자산'));

    /* 7. 하루 마무리 → 다음 날, 일지 상세 */
    await p.evaluate(() => (__otr.engine.state.time.minute = 21 * 60));
    await p.click('.nav__item[data-tab=today]');
    check(7, '밤 9시: 하루 마무리 막대 표시', await p.isVisible('[data-testid=sleepbar]'));
    await p.click('[data-testid=sleep-btn]');
    await p.click('[data-testid=sleep-confirm]');
    await p.waitForSelector('[data-testid=morning]');
    await p.click('[data-testid=morning-ok]');
    await p.waitForTimeout(300);
    check(7, '다음 날 아침', (await p.textContent('[data-testid=date]')).includes('3월 3일'));
    await p.click('.nav__item[data-tab=journal]');
    await p.click('button.entry[data-day="1"]');
    await p.waitForSelector('[data-testid=day-detail]');
    const detail = await p.textContent('[data-testid=day-detail]');
    check(7, '날짜별 상세: 시간표·돈·성장·사건', ['시간표', '독서', '하루 생활비', '지능', '기록이 시작됐어요'].every((w) => detail.includes(w)), detail.slice(0, 160));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    await p.click('.nav__item[data-tab=me]');
    check(3, '능력치 그래프 (2개 점 이상)', (await p.locator('[data-testid=stat-chart] circle').count()) >= 2);
    check(3, '성장 기록에 출처 표시', (await p.textContent('[data-testid=growth-log]')).includes('독서'));

    /* 8. 밝게·어둡게 */
    await p.click('.nav__item[data-tab=journal]');
    await p.click('[data-theme=dark]');
    check(8, '어둡게', (await p.getAttribute('html', 'data-theme')) === 'dark' && (await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(15, 17, 21)');
    await p.click('[data-theme=light]');
    check(8, '밝게', (await p.getAttribute('html', 'data-theme')) === 'light' && (await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(246, 247, 251)');

    /* 저장 내보내기 → 가져오기 */
    await p.click('[data-testid=export]');
    const exported = await p.inputValue('[data-testid=export-text]');
    check(10, '내보내기 글자 생성', exported.startsWith('{"app":"off-the-record"'));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    await p.click('[data-testid=import]');
    await p.fill('[data-testid=import-text]', '아무 글자');
    await p.click('[data-testid=import-go]');
    check(10, '잘못된 데이터는 이유와 함께 거절', (await p.textContent('[data-testid=import-status]')).includes('형식'));
    await p.fill('[data-testid=import-text]', exported);
    await p.click('[data-testid=import-go]');
    await p.waitForTimeout(400);
    check(10, '가져오기 성공 → 같은 캐릭터', (await p.textContent('[data-testid=who]')) === '가나다라마바사아자차카타');

    /* 10. 앱 종료 후 다시 열기 */
    const before = await p.evaluate(() => JSON.stringify({ t: __otr.engine.state.time, c: __otr.engine.state.economy.cash }));
    await p.close();
    p = watch(await ctx.newPage());
    await p.goto(URL);
    await p.waitForSelector('[data-screen=today]');
    const after = await p.evaluate(() => JSON.stringify({ t: __otr.engine.state.time, c: __otr.engine.state.economy.cash }));
    check(10, '닫았다 다시 열어도 그대로', before === after, `${before} / ${after}`);
    await ctx.close();

    /* 3. 네 가지 배경 */
    for (const bg of ['rookie', 'graduate', 'veteran', 'founder']) {
      const c2 = await newCtx();
      const q = watch(await c2.newPage());
      await create(q, { name: bg, bg });
      await q.click('.tab[data-cat=work]');
      if (bg === 'graduate') await q.evaluate(() => (__otr.engine.state.time.minute = 16 * 60)), await q.click('.nav__item[data-tab=me]'), await q.click('.nav__item[data-tab=today]'), await q.click('.tab[data-cat=work]');
      const cash = won(await q.textContent('[data-testid=cash]'));
      await q.click('[data-testid=do-work]');
      await q.waitForSelector('[data-testid=result]');
      check(3, `배경 ${bg}: 생성·일·수입`, won(await q.textContent('[data-testid=cash]')) > cash - 10000 && (await q.textContent('[data-testid=result]')).includes('+'));
      await c2.close();
    }

    /* 9. 여러 화면 크기 + 터치 영역 44px */
    for (const vp of [{ width: 320, height: 640 }, { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 768, height: 1024 }]) {
      const c3 = await newCtx(vp);
      const q = watch(await c3.newPage());
      await create(q, { name: '크기', bg: 'veteran' });
      for (const tab of ['today', 'me', 'money', 'journal']) {
        await q.click(`.nav__item[data-tab=${tab}]`);
        await q.waitForTimeout(150);
        const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const small = await q.evaluate(() => [...document.querySelectorAll('button, [role=tab], [role=radio], input')].filter((el) => el.offsetParent && !el.closest('.chips:not(.chips--select)')).map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.height < 43.5 || r.width < 43.5).map(([el, r]) => `${el.className || el.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`));
        check(9, `${vp.width}px ${tab}: 가로 넘침 없음, 버튼 44px 이상`, over <= 1 && small.length === 0, `넘침 ${over}px · 작은 버튼 ${small.slice(0, 4).join(' ')}`);
      }
      await c3.close();
    }

    check(10, '콘솔·페이지 오류 없음', errors.length === 0, errors.join(' | '));
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
