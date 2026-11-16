// OFF THE RECORD — PHASE 1 완료 기준 10가지를 실제 빌드 화면에서 사람처럼 눌러 확인해요.
// 실행: npm run test:e2e
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4191;
const URL = `http://localhost:${PORT}/`;
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
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const errors = [];
  const watch = (pg) => {
    pg.on('pageerror', (e) => errors.push(e.message));
    pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  };
  let p = await ctx.newPage();
  watch(p);
  const text = (sel) => p.textContent(sel);
  const gauge = async (key) => Number(await p.textContent(`.strip__cell[data-key=${key}] .strip__val`));
  const clock = () => text('[data-testid=clock]');
  const doAct = async (cat, id) => {
    await p.click(`.tab[data-cat=${cat}]`);
    await p.click(`[data-testid=do-${id}]`);
    await p.waitForTimeout(80);
  };
  const noOverflow = () => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

  try {
    /* 1. 캐릭터 생성 */
    await p.goto(URL);
    await p.waitForSelector('[data-screen=create]');
    await p.click('[data-testid=start]');
    check(1, '이름 없이 시작하면 오류 문구', (await text('[data-error=name]')).includes('이름'));
    await p.fill('#name', '정다온');
    await p.click('.origin[data-value=graduate]');
    check(1, '대학 졸업자는 고졸을 고를 수 없음', await p.isDisabled('.choice[data-value=highschool]'));
    await p.click('.choice[data-value=female]');
    await p.click('.choice[data-value=busan]');
    await p.click('[aria-label="한 살 많게"]');
    await p.click('[data-testid=start]');
    await p.waitForSelector('[data-screen=today]');
    check(1, '캐릭터 생성 → 메인 화면', (await text('[data-testid=who]')) === '정다온');
    check(1, '나이 25세 (기본 24 + 1)', (await text('.masthead__who')).includes('25세'));
    const cash0 = won(await text('[data-testid=cash]'));
    check(1, '배경에 따른 시작 자금 2,500,000원', cash0 === 2500000, String(cash0));
    await p.click('.nav__item[data-tab=me]');
    const profile = await text('[data-testid=profile]');
    check(1, '프로필에 성별·지역·학력·배경·일', ['여성', '부산', '대학교 졸업', '대학 졸업자', '과외'].every((w) => profile.includes(w)), profile);
    await p.click('.nav__item[data-tab=today]');

    /* 2. 저장 확인 (IndexedDB, 버전 포함) */
    await p.waitForTimeout(300);
    const rec = await p.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('off-the-record');
      r.onsuccess = () => {
        const g = r.result.transaction('saves').objectStore('saves').get('main');
        g.onsuccess = () => res(g.result ? { v: g.result.version, name: g.result.data.character.name } : null);
      };
    }));
    check(2, '캐릭터가 IndexedDB 에 버전과 함께 저장', rec?.name === '정다온' && rec?.v === 1, JSON.stringify(rec));

    /* 3·4. 24시간과 시간 소모 */
    check(3, '첫날 07:00 시작, 남은 시간 17시간', (await clock()) === '07:00' && (await text('.masthead__meta')).includes('17시간'));
    await doAct('growth', 'reading');
    check(4, '독서 2시간 → 09:00', (await clock()) === '09:00', await clock());
    await doAct('meal', 'convenience_meal');
    check(4, '편의점 20분 → 09:20', (await clock()) === '09:20', await clock());
    await p.click('.tab[data-cat=rest]');
    check(5, '낮잠은 11시 전엔 막힘 + 이유 (09:20)', (await p.isDisabled('[data-testid=do-nap]')) && (await text('[data-act=nap] [data-testid=blocked]')).includes('11:00부터'));
    check(4, '오늘의 일정·띠에 한 일이 표시', (await p.locator('.ribbon__block:not(.is-duty)').count()) === 2);

    /* 5. 상태 변화 */
    const hungerBefore = await gauge('hunger');
    await doAct('meal', 'home_meal');
    const hungerAfter = await gauge('hunger');
    check(5, '집밥 → 배고픔 감소', hungerAfter < hungerBefore, `${hungerBefore} → ${hungerAfter}`);
    const stressBefore = await gauge('stress');
    await doAct('rest', 'walk');
    check(5, '산책 → 스트레스 감소', (await gauge('stress')) < stressBefore);
    await p.click('.nav__item[data-tab=me]');
    const intNow = Number(await text('.stat[data-stat=intelligence] .stat__val').then((t) => t.split(/[+-]/)[0]));
    check(5, '독서 → 지능 성장 (63 → 더 높게)', intNow > 63, String(intNow));
    await p.click('.nav__item[data-tab=today]');

    /* 6. 경제 */
    const c1 = won(await text('[data-testid=cash]'));
    await doAct('meal', 'eat_out');
    const c2 = won(await text('[data-testid=cash]'));
    check(6, '외식 12,000원 지출', c1 - c2 === 12000, `${c1} → ${c2}`);
    // 과외는 16시부터: 그때까지 쉬기
    while ((await clock()) < '16:00') await doAct('rest', 'rest');
    await doAct('work', 'work'); // 1시간 (기본)
    check(6, '과외 1시간 → 25,000원 수입', won(await text('[data-testid=cash]')) - c2 === 25000);
    await p.click('.nav__item[data-tab=money]');
    const ledger = await text('[data-testid=ledger]');
    check(6, '가계 화면 기록에 수입·지출', ledger.includes('밖에서 사 먹기') && ledger.includes('과외') && ledger.includes('+25,000원'), ledger.slice(0, 200));
    check(6, '하루 생활비 내역 (부산)', (await text('[data-testid=living]')).includes('월세'));
    await p.click('.nav__item[data-tab=today]');

    /* 3. 자정을 넘기는 활동은 막힘 */
    while ((await clock()) < '23:00') await doAct('rest', 'rest');
    await doAct('meal', 'convenience_meal');
    await p.click('.tab[data-cat=growth]');
    const blocked = await text('[data-act=reading] [data-testid=blocked]');
    check(3, '23:20에 2시간 독서는 막힘(남은 시간 부족)', (await p.isDisabled('[data-testid=do-reading]')) && blocked.includes('남은 시간'), blocked);

    /* 7. 다음 날 */
    const cashBeforeSleep = won(await text('[data-testid=cash]'));
    await p.click('[data-testid=sleep-btn]');
    await p.click('.wake button[data-wake="420"]');
    await p.click('[data-testid=sleep-confirm]');
    await p.waitForSelector('[data-testid=morning]');
    check(7, '아침 보고서', (await text('[data-testid=morning]')).includes('3월 3일 화요일 아침'));
    await p.click('[data-testid=morning-ok]');
    await p.waitForTimeout(250);
    check(7, '날짜가 3월 3일, 시각 07:00', (await text('[data-testid=date]')).includes('3월 3일') && (await clock()) === '07:00');
    const living = await p.evaluate(() => __otr.engine.state.economy.ledger.filter((t) => t.category === 'living').length);
    check(7, '자정에 하루 생활비가 빠져나감', living === 1 && won(await text('[data-testid=cash]')) < cashBeforeSleep);
    check(7, '새 날은 한 일이 비어 있음', (await p.locator('.ribbon__block:not(.is-duty)').count()) === 0);
    await p.click('.nav__item[data-tab=journal]');
    check(7, '일지에 지난 날 기록', (await text('[data-testid=reports]')).includes('3월 2일 월요일'));

    /* 8. 껐다 켜도 유지 */
    await doActLater();
    async function doActLater() {
      await p.click('.nav__item[data-tab=today]');
      await doAct('growth', 'reading');
    }
    await p.waitForTimeout(400);
    const before = { date: await text('[data-testid=date]'), clock: await clock(), cash: await text('[data-testid=cash]') };
    await p.close();
    p = await ctx.newPage();
    watch(p);
    await p.goto(URL);
    await p.waitForSelector('[data-screen=today]');
    const after = { date: await text('[data-testid=date]'), clock: await clock(), cash: await text('[data-testid=cash]') };
    check(8, '다시 열어도 날짜·시각·돈 그대로', JSON.stringify(before) === JSON.stringify(after), `${JSON.stringify(before)} / ${JSON.stringify(after)}`);
    check(8, '다시 열면 캐릭터 생성이 아닌 게임 화면', (await text('[data-testid=who]')) === '정다온');

    /* 9. 모바일 화면 (Pixel 7 + 작은 폰 360px) */
    for (const tab of ['today', 'me', 'money', 'journal']) {
      await p.click(`.nav__item[data-tab=${tab}]`);
      check(9, `가로 넘침 없음: ${tab} (Pixel 7)`, await noOverflow());
    }
    await p.setViewportSize({ width: 360, height: 740 });
    for (const tab of ['today', 'me', 'money', 'journal']) {
      await p.click(`.nav__item[data-tab=${tab}]`);
      check(9, `가로 넘침 없음: ${tab} (360px)`, await noOverflow());
    }
    await p.click('.nav__item[data-tab=today]');
    const navBox = await p.locator('.nav').boundingBox();
    check(9, '하단 메뉴가 화면 아래에 고정', navBox && Math.round(navBox.y + navBox.height) === 740, JSON.stringify(navBox));

    /* 새 인생 (기록 지우기) */
    await p.click('.nav__item[data-tab=journal]');
    await p.click('[data-testid=abandon]');
    await p.click('[data-testid=confirm-ok]');
    await p.waitForSelector('[data-screen=create]');
    await p.reload();
    await p.waitForSelector('[data-screen=create]');
    check(8, '기록을 지우면 다시 열어도 캐릭터 생성부터', true);

    /* 10. 콘솔 오류 */
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
