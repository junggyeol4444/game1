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

// ── 튜토리얼: 지시대로만 눌러서 끝까지 간다 ──
async function tutStep() {
  return page.evaluate(() => window.game.state.tutorial);
}
await shot('01b-tutorial-start');
const tutSeen = [];
for (let guard = 0; guard < 60; guard++) {
  const step = await tutStep();
  if (step < 0) break;
  if (tutSeen[tutSeen.length - 1] !== step) {
    tutSeen.push(step);
    await shot(`01c-tut-${step}`);
  }
  if (step === 0) {
    // 지도 건물은 캔버스라 DOM 타깃이 없다. 튜토리얼 링 한가운데를 누른다
    const r = await page.evaluate(() => {
      const el = document.querySelector('.tut-ring');
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    if (r) await page.mouse.click(r.x, r.y);
  }
  else if (step === 1) for (let k = 0; k < 4; k++) { await page.locator('.floor[data-unit="0"]').click({ force: true }).catch(() => {}); await page.waitForTimeout(700); }
  else if (step === 2) for (let k = 0; k < 3; k++) { await page.locator('.floor[data-unit="0"] .buy').click({ force: true }).catch(() => {}); await page.waitForTimeout(400); }
  else if (step === 3 || step === 4) await page.locator('.floor[data-unit="0"] .auto').click({ force: true }).catch(() => {});
  else if (step === 5) await page.locator('.id-chip.back').click().catch(() => {});
  else if (step === 6) {
    await page.locator('[data-tut="build"]').click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('.scrim button:has-text("건설")').first().click().catch(() => {});
    await dismiss();
  }
  await page.waitForTimeout(600);
}
console.log('튜토리얼 단계 진행:', tutSeen.join(' -> '), '| 최종', await tutStep());
console.log('오디오 컨텍스트:', await page.evaluate(() => window.audioReady()));
await settle();

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
// 미니게임은 30초짜리다. 판이 끝나 오버레이가 사라질 때까지 기다린다
await page.locator('.mg').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(600);
await shot('03b-minigame-result');
console.log('미니게임 성적표:', (await page.locator('.mg-grade').first().textContent().catch(() => '없음')) || '없음');
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
await page.waitForTimeout(250);
await shot('16a-era-dust');   // 전 건물이 동시에 허물어지는 순간 (0.8초 먼지)
await page.waitForTimeout(700);
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

// 글자 크기 '아주 크게'(1.3) — 55+ 코호트 대응. 가로 넘침을 실제로 잰다
await settle();
await page.evaluate(() => {
  window.game.state.settings.textScale = 1.3;
  window.game.emit('structure');
});
await page.waitForTimeout(600);
await shot('18-scale-city');

async function overflow(label) {
  return page.evaluate((lb) => {
    const bad = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) {
      bad.push(`문서 가로 넘침 ${document.documentElement.scrollWidth} > ${vw}`);
    }
    for (const el of document.querySelectorAll('button, .card, .chip, .top-res, .quick, .floor, .sheet')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        bad.push(`${lb}: ${el.className || el.tagName} 이 화면 밖 (left=${Math.round(r.left)} right=${Math.round(r.right)})`);
      }
      // 글자가 잘렸는가
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible') {
        bad.push(`${lb}: ${el.className || el.tagName} 글자 잘림 (${el.scrollWidth} > ${el.clientWidth})`);
      }
    }
    // 한 줄이어야 하는 것이 두 줄로 깨졌는가
    for (const sel of ['.top-rate', '.top-res b', '.floor-lv']) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.getClientRects().length > 1) bad.push(`${lb}: ${sel} 이 두 줄로 깨졌다`);
      }
    }
    // 버튼이 글자를 덮었는가
    const hit = (a, b) => a.right > b.left + 2 && a.left < b.right - 2 && a.bottom > b.top + 2 && a.top < b.bottom - 2;
    for (const row of document.querySelectorAll('.floor')) {
      const info = row.querySelector('.floor-info');
      for (const btn of row.querySelectorAll('button')) {
        const br = btn.getBoundingClientRect();
        if (br.width === 0) continue;
        if (info && hit(info.getBoundingClientRect(), br)) {
          bad.push(`${lb}: ${btn.className} 버튼이 층 정보를 덮는다`);
        }
      }
    }
    return bad.slice(0, 8);
  }, label);
}

const scaleIssues = [];
scaleIssues.push(...(await overflow('도시')));
await goto('mine');
await page.waitForTimeout(600);
await shot('19-scale-mine');
scaleIssues.push(...(await overflow('광산')));
await back();
await settle(); await menu(2).click(); await page.waitForTimeout(500);
await shot('20-scale-level');
scaleIssues.push(...(await overflow('레벨 시트')));
await dismiss();
console.log(scaleIssues.length ? '글자 1.3 문제:\n  ' + scaleIssues.join('\n  ') : '글자 1.3: 넘침 없음');
await page.evaluate(() => {
  window.game.state.settings.textScale = 1;
  window.game.emit('structure');
});
await settle();

// 프레임 시간 — 저사양 안드로이드가 대상이라 여유가 필요하다
async function frameStats(label, seconds = 3) {
  return page.evaluate(
    ([lb, secs]) =>
      new Promise((resolve) => {
        const d = [];
        let last = performance.now();
        const t0 = last;
        const tick = (now) => {
          d.push(now - last);
          last = now;
          if (now - t0 < secs * 1000) requestAnimationFrame(tick);
          else {
            d.shift(); // 첫 프레임은 측정 시작 오차
            d.sort((a, b) => a - b);
            const avg = d.reduce((a, b) => a + b, 0) / d.length;
            resolve({ label: lb, n: d.length, avg, p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1] });
          }
        };
        requestAnimationFrame(tick);
      }),
    [label, seconds],
  );
}

await settle();
const perf = [];
perf.push(await frameStats('도시 지도'));
await goto('mine');
await page.waitForTimeout(500);
perf.push(await frameStats('광산 12층'));
await back();
await settle();
const slow = perf.filter((p) => p.p95 > 33);
for (const p of perf) {
  console.log(`프레임 ${p.label}: 평균 ${p.avg.toFixed(1)}ms · p95 ${p.p95.toFixed(1)}ms · 최대 ${p.max.toFixed(1)}ms (${p.n}프레임)`);
}
if (slow.length) console.log('  ⚠ p95 가 33ms(30fps) 를 넘는 화면: ' + slow.map((p) => p.label).join(', '));

// 메모리 누수: DOM 노드가 계속 쌓이는가
await settle();
const nodeCount = () => page.evaluate(() => document.querySelectorAll('*').length);
const base = await nodeCount();

// 시트를 20번 열고 닫는다 (매번 새 DOM 을 만든다)
for (let i = 0; i < 20; i++) {
  await menu(2).click().catch(() => {});
  await page.waitForTimeout(90);
  await dismiss();
}
await settle();
const afterSheets = await nodeCount();

// 건물을 20번 드나든다 (뷰는 캐시된다)
for (let i = 0; i < 20; i++) {
  await goto(i % 2 ? 'mine' : 'housing');
  await page.waitForTimeout(70);
}
await back();
await settle();
const afterViews = await nodeCount();

// 코인 연출을 20번 터뜨린다 (DOM 을 만들고 타이머로 지운다)
await page.evaluate(() => { for (let i = 0; i < 20; i++) window.game.grantCash(1000); });
await page.waitForTimeout(1800);
const afterCoins = await nodeCount();

const leak = [];
if (afterSheets > base + 30) leak.push(`시트 20회: ${base} -> ${afterSheets}`);
if (afterViews > afterSheets + 400) leak.push(`건물 20회: ${afterSheets} -> ${afterViews}`);
if (afterCoins > afterViews + 30) leak.push(`코인 20회: ${afterViews} -> ${afterCoins}`);
console.log(leak.length
  ? '누수 의심:\n  ' + leak.join('\n  ')
  : `누수 없음 (노드 ${base} -> ${afterSheets} -> ${afterViews} -> ${afterCoins})`);

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
