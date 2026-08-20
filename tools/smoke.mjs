/**
 * 실기기 해상도 스모크 테스트 + 스크린샷.
 *   npm run build && npm run preview &
 *   node tools/smoke.mjs http://localhost:4173/
 */
import { chromium } from 'playwright';

const OUT = process.env.OUT || '/tmp/shots';
const url = process.argv[2] || 'http://localhost:4173/';
const CHROME = process.env.CHROME_PATH || undefined;

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const menu = (i) => page.locator('.menubar button').nth(i);

async function dismiss() {
  for (let i = 0; i < 10; i++) {
    if (!(await page.locator('.scrim').count())) return;
    const top = page.locator('.scrim').last();
    const ok = top.locator('button:has-text("확인"), button:has-text("시작하기")');
    if (await ok.count()) await ok.first().click({ timeout: 2000 }).catch(() => {});
    else await top.click({ position: { x: 10, y: 10 }, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
}
async function settle() {
  let clean = 0;
  for (let i = 0; i < 30 && clean < 3; i++) {
    if (await page.locator('.scrim').count()) { await dismiss(); clean = 0; }
    else clean++;
    await page.waitForTimeout(200);
  }
}
const goto = (id) => page.evaluate((i) => window.goto(i), id);
async function back() {
  await settle();
  await page.locator('.id-chip.back').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
}

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(800);
await shot('01-city-empty');

// 광산 진입 후 수동 가동
await goto('mine');
await page.waitForTimeout(400);
for (let i = 0; i < 6; i++) {
  await page.locator('.floor.tappable').first().click({ force: true, timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(150);
}
await shot('02-mine');

// 미니게임 1판
await page.locator('button:has-text("미니게임")').first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1200);
await shot('03-minigame-mine');
for (let i = 0; i < 24; i++) {
  await page.locator('.mg-canvas').click({ position: { x: 180, y: 260 }, timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(280);
}
await page.waitForTimeout(2500);
await dismiss();

// 자금/진행 치트로 도시를 키운다
// 1) 도시 레벨을 먼저 올린다 (해금 조건)
await page.evaluate(() => {
  const g = window.game;
  g.state.resources.cash = 1e26;
  g.state.resources.material = 1e20;
  g.state.resources.gem = 200;
  g.state.city.taxRun = 4e15;
});
await page.waitForTimeout(900);
await settle();
// 2) 해금된 뒤에 사업/시설을 채운다
await page.evaluate(() => {
  const g = window.game;
  g.state.resources.cash = 1e26;
  g.state.resources.material = 1e20;
  g.buyMode = 100;
  for (const id of ['mine', 'factory', 'fishery', 'park', 'corp']) {
    for (let i = 0; i < 12; i++) { g.unlockUnit(id, i); g.buyUnit(id, i); g.buyEquip(id, i); g.buyManager(id, i); }
    for (let k = 0; k < 4; k++) g.buyHoist(id);
  }
  for (const f of ['housing', 'shops', 'power', 'school', 'hospital', 'road', 'green', 'fire', 'police']) {
    for (let k = 0; k < 22; k++) g.buyFacility(f);
  }
  g.emit('structure');
});
await page.waitForTimeout(1500);
await settle();
await back();
await page.waitForTimeout(900);
await shot('04-city-grown');

// 지도 드래그
await page.mouse.move(300, 400);
await page.mouse.down();
await page.mouse.move(80, 400, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(500);
await shot('05-city-pan');

// 시설: 주거지
await goto('housing');
await page.waitForTimeout(600);
await shot('06-housing');
await page.locator('button:has-text("현황")').first().click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(400);
await shot('07-housing-status');
await back();

// 시설: 발전소
await goto('power');
await page.waitForTimeout(600);
await shot('08-power');
await back();

// 놀이공원
await goto('park');
await page.waitForTimeout(600);
await shot('09-park');
await back();

// 하단 메뉴: 도감 / 레벨 / 건설 / 미션
await settle(); await menu(0).click(); await page.waitForTimeout(500); await shot('10-collection'); await dismiss();
await settle(); await menu(2).click(); await page.waitForTimeout(500); await shot('11-level'); await dismiss();
await settle(); await menu(3).click(); await page.waitForTimeout(500); await shot('12-build'); await dismiss();
await settle(); await menu(1).click(); await page.waitForTimeout(500); await shot('13-menu'); await dismiss();

// 문명 전환: 시트 -> 전환 -> 새 문명 도시
await settle();
await page.locator('.quick.era').click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(500);
await shot('15-era-sheet');
await page.locator('button:has-text("그냥 전환")').first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(900);
await shot('16-era-arrival');
const eraName = await page.locator('.scrim h2').last().textContent().catch(() => '');
await dismiss();
await settle();
await page.waitForTimeout(700);
await shot('17-city-new-era');
const afterEra = await page.evaluate(() => ({
  era: window.game.state.era,
  level: window.game.state.city.level,
  cash: window.game.state.resources.cash,
  legacy: window.game.state.resources.blueprint,
  mine: window.game.era().business.mine.name,
}));
console.log('문명 전환 후:', JSON.stringify(afterEra), '| 도착 시트:', (eraName || '').trim());

// 오프라인 복귀
await page.evaluate(() => {
  const g = window.game;
  g.devSetLastSeen(3 * 3600);
  g.persist = () => {};
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1100);
await shot('14-offline');

console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
