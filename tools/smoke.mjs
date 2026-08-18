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
const tab = (i) => page.locator('.tabbar button').nth(i);

async function dismiss() {
  for (let i = 0; i < 8; i++) {
    if (!(await page.locator('.scrim').count())) return;
    const top = page.locator('.scrim').last();
    const ok = top.locator('button:has-text("확인")');
    if (await ok.count()) await ok.first().click({ timeout: 2000 }).catch(() => {});
    else await top.click({ position: { x: 10, y: 10 }, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(600);
await shot('01-start');

// 광산 탭에서 수동 가동
await tab(1).click();
await page.waitForTimeout(300);
for (let i = 0; i < 8; i++) {
  await page.locator('.u-icon.tappable').first().click({ force: true, timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(150);
}
await shot('02-mine-manual');

// 자금 지급 후 광산 전개
await page.evaluate(() => window.game.devGrant(1e12));
await page.evaluate(() => {
  const g = window.game;
  g.buyMode = 100;
  for (let i = 0; i < 6; i++) { g.buyUnit('mine', i); g.buyManager('mine', i); }
});
await page.waitForTimeout(1000);
await dismiss();
await shot('03-mine-built');

// 도시 성장
await page.evaluate(() => {
  const g = window.game;
  g.state.city.taxRun = 5e10;
  g.state.resources.cash = 1e16;
  g.emit('structure');
});
await page.waitForTimeout(800);
await dismiss();
await tab(0).click();
await page.waitForTimeout(600);
await shot('04-city-grown');

// 공장 탭 (자원 사슬 표시 확인)
await tab(2).click();
await page.waitForTimeout(500);
await shot('05-factory');

// 놀이공원 탭
await tab(4).click();
await page.waitForTimeout(500);
await shot('06-park');

// 재개발 시트
await tab(0).click();
await page.waitForTimeout(400);
await page.locator('button:has-text("재개발")').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(500);
await shot('07-prestige');
await dismiss();

// 상점
await page.locator('button:has-text("상점")').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(500);
await shot('08-shop');
await dismiss();

// 미션
await page.locator('button:has-text("일일 미션")').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(400);
await shot('09-missions');
await dismiss();

// 설정 (글자 크게)
await page.locator('button:has-text("설정")').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(400);
await page.locator('.sheet button:has-text("아주 크게")').first().click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(400);
await shot('10-settings-large');
await dismiss();
await tab(1).click();
await page.waitForTimeout(400);
await shot('11-large-text');

// 오프라인 복귀 모달 (세이브 시각을 3시간 전으로 되돌리고 리로드)
await page.evaluate(() => {
  const g = window.game;
  g.state.settings.textScale = 1;
  g.persist();
  g.persist = () => {};   // 리로드 시 pagehide 저장이 lastSeen 을 덮어쓰지 않도록
  const key = 'city-idle-save-v1';
  const s = JSON.parse(localStorage.getItem(key));
  s.lastSeen = Date.now() - 3 * 3600 * 1000;
  localStorage.setItem(key, JSON.stringify(s));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(900);
await shot('12-offline');

console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
