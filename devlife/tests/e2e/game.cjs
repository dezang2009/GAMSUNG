// DEVLIFE 화면 통합 테스트: 실제 빌드(dist)를 띄우고 사람처럼 눌러 본다.
// 실행: npm run test:e2e
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4184;
const URL = `http://localhost:${PORT}/`;
let pass = 0;
const fails = [];
const check = (name, ok, extra = '') => (ok ? pass++ : fails.push(`${name} ${extra}`), console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ' ' + extra}`));

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '../..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const st = () => p.evaluate(() => JSON.parse(JSON.stringify(__devlife.state)));
  try {
    await p.goto(URL);
    await p.waitForSelector('[data-testid=code-btn]');
    let s = await st();
    check('새 게임: 돈 0, 앱 0', s.money === 0 && s.apps.length === 0);
    check('홈에서는 상단 금액 알약 숨김', await p.isHidden('[data-testid=money-pill]'));

    // 1. 코드 쓰기 → 진행
    for (let i = 0; i < 10; i++) await p.click('[data-testid=code-btn]');
    s = await st();
    check('코드 쓰기 10번 → 진행 10줄', s.project.progress === 10 && s.taps === 10, JSON.stringify(s.project));
    check('업적 ‘첫 커밋’', !!s.achievements.first_code);

    // 2. 출시
    for (let i = 0; i < 110; i++) await p.click('[data-testid=code-btn]');
    check('진행을 채운 탭이 바로 출시하지 않음', (await st()).apps.length === 0);
    check('다 차면 버튼이 ‘출시하기’', (await p.getAttribute('[data-testid=code-btn]', 'data-mode')) === 'launch');
    await p.click('[data-testid=code-btn]');
    s = await st();
    check('출시 → 앱 1개, 다음 프로젝트', s.apps.length === 1 && s.project.index === 1 && s.apps[0].name === '할 일 앱');
    check('홈 앱 목록에 표시', (await p.textContent('[data-testid=apps]')).includes('할 일 앱'));

    // 3. 시간이 흐르면 수익
    await p.waitForTimeout(1500);
    s = await st();
    check('시간이 흐르면 돈이 늘어남', s.money > 0, String(s.money));

    // 4. 장비 구매
    await p.evaluate(() => (__devlife.state.money = 1000));
    await p.click('[data-tab=grow]');
    await p.click('[data-testid=buy-keyboard]');
    s = await st();
    check('키보드 구매: Lv.1, 15원 차감', s.upgrades.keyboard === 1 && s.money < 1000 && s.money >= 985 - 1);
    await p.evaluate(() => (__devlife.state.money = 0));
    await p.waitForTimeout(250);
    check('돈이 없으면 구매 버튼 비활성', await p.isDisabled('[data-testid=buy-monitor]'));

    // 5. 직원 고용 + 자리 제한
    await p.evaluate(() => (__devlife.state.money = 1e6));
    await p.click('.segmented button:nth-child(2)');
    for (let i = 0; i < 3; i++) await p.click('[data-testid=hire-intern]');
    s = await st();
    check('인턴 3명 고용', s.staff.intern === 3);
    await p.waitForTimeout(250);
    check('자리 3개가 차면 더 못 뽑음', await p.isDisabled('[data-testid=hire-junior]'));
    check('꽉 참 안내', (await p.textContent('.view')).includes('자리가 꽉 찼어요'));

    // 6. 사무실 이사
    await p.click('.segmented button:nth-child(3)');
    await p.click('[data-testid=move-office]');
    s = await st();
    check('공유 오피스로 이사', s.office === 1);

    // 7. 매각: 앱 5개 전에는 막힘
    await p.click('.segmented button:nth-child(4)');
    check('앱 5개 전에는 매각 불가', await p.isDisabled('[data-testid=sell-btn]'));

    // 8. 소식(사건) 선택
    await p.evaluate(() => (__devlife.state.nextEventAt = 0));
    await p.waitForTimeout(400);
    s = await st();
    check('사건 발생 → 소식 배지', s.pending.length >= 1 && (await p.isVisible('.nav-badge')));
    await p.click('[data-tab=news]');
    const before = s.pending.length;
    await p.click('[data-testid=event] .choice >> nth=0');
    s = await st();
    check('선택하면 사건이 사라지고 기록에 남음', s.pending.length === before - 1 && s.log.some((l) => l.kind === 'event'));

    // 9. 저장 → 새로고침 후 이어하기
    await p.evaluate(() => (__devlife.state.money = 12345));
    await p.waitForTimeout(3300); // 3초마다 / 10초마다 저장
    await p.click('[data-tab=records]');
    await p.reload();
    await p.waitForSelector('[data-testid=code-btn]');
    s = await st();
    check('새로고침 후 이어하기 (앱·직원·사무실 유지)', s.apps.length === 1 && s.staff.intern >= 3 && s.office === 1, JSON.stringify({ a: s.apps.length, st: s.staff, o: s.office }));

    // 10. 자리 비운 사이 (2시간 전 저장으로 바꿔서 다시 열기)
    // 게임이 없는 같은 주소의 빈 페이지에서 저장본을 고친다 (게임 페이지는 닫힐 때 다시 저장하므로)
    await ctx.route('**/blank.html', (r) => r.fulfill({ contentType: 'text/html', body: '<p>blank</p>' }));
    await p.close();
    const p2 = await ctx.newPage();
    p2.on('pageerror', (e) => errors.push(e.message));
    await p2.goto(URL + 'blank.html');
    await p2.evaluate(() => {
      const k = 'devlife:save';
      const x = JSON.parse(localStorage.getItem(k));
      x.lastTick = Date.now() - 2 * 3600 * 1000;
      localStorage.setItem(k, JSON.stringify(x));
    });
    await p2.goto(URL);
    await p2.waitForSelector('.dialog');
    const dlg = await p2.textContent('.dialog');
    check('자리 비운 사이 대화상자', dlg.includes('자리를 비운 사이') && dlg.includes('2시간'), dlg);
    await p2.click('.dialog .btn--primary');
    check('대화상자 닫힘', (await p2.$('.dialog')) === null);

    // 11. 화면 모드
    await p2.click('[data-tab=records]');
    await p2.click('.segmented button:nth-child(3)');
    check('어둡게 모드', (await p2.getAttribute('html', 'data-mode')) === 'dark');

    // 12. 처음부터 다시 (취소 → 유지, 확인 → 초기화)
    await p2.click('[data-testid=reset]');
    await p2.click('.dialog .btn--ghost');
    let s2 = await p2.evaluate(() => __devlife.state.apps.length);
    check('취소하면 그대로', s2 === 1);
    await p2.click('[data-testid=reset]');
    await p2.click('.dialog .btn--danger');
    s2 = await p2.evaluate(() => JSON.parse(JSON.stringify(__devlife.state)));
    check('초기화하면 새 게임', s2.apps.length === 0 && s2.money === 0);

    // 13. 깨진 저장 파일: 지우지 않고 보관
    await p2.goto(URL + 'blank.html');
    await p2.evaluate(() => localStorage.setItem('devlife:save', '{깨짐'));
    await p2.goto(URL);
    await p2.waitForSelector('[data-testid=code-btn]');
    const keys = await p2.evaluate(() => Object.keys(localStorage));
    check('깨진 저장본은 -broken 으로 보관', keys.some((k) => k.startsWith('devlife:save-broken-')));

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
