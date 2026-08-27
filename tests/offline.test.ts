/**
 * 복귀 보상 (Daily Double) 경로.
 * 앱을 켤 때마다 처음 보는 화면인데 테스트가 없었다.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const store = new MemStore();
(globalThis as unknown as { localStorage: MemStore }).localStorage = store;

const { Game } = await import('../src/core/game');
const { computeOffline, invalidateStats, stats } = await import('../src/core/economy');
const { CONFIG } = await import('../src/data/config');
import type { AdProvider, AdResult } from '../src/core/ads';

const ad = (result: AdResult): AdProvider => ({
  name: 't',
  isReady: () => true,
  showRewarded: () => Promise.resolve(result),
});

beforeEach(() => store.clear());

function ready(g: InstanceType<typeof Game>) {
  const s = g.state;
  s.city.level = 8;
  for (let i = 0; i < 4; i++) {
    s.businesses.mine.units[i] = { unlocked: true, level: 30, progress: 0, running: false, equip: false, manager: true };
  }
  invalidateStats();
  const report = computeOffline(s, 3600, Date.now());
  g.pendingOffline = report;
  return report;
}

test('그냥 받으면 추가 지급이 없다', async () => {
  const g = new Game(ad('completed'));
  const report = ready(g);
  const before = g.state.resources.cash;
  await g.claimOffline(false);
  assert.equal(g.state.resources.cash, before, '2배를 안 골랐는데 더 줬다');
  assert.equal(g.pendingOffline, null, '보상 팝업이 안 닫혔다');
  assert.ok(report.cash > 0);
});

test('광고 보고 2배를 받으면 정확히 한 번 더 준다', async () => {
  const g = new Game(ad('completed'));
  const report = ready(g);
  const before = g.state.resources.cash;
  await g.claimOffline(true);
  const gained = g.state.resources.cash - before;
  assert.ok(Math.abs(gained - report.cash) < 1e-6, `2배 보상이 ${gained}, 기대 ${report.cash}`);
});

test('광고를 건너뛰면 2배가 안 나간다', async () => {
  const g = new Game(ad('skipped'));
  ready(g);
  const before = g.state.resources.cash;
  await g.claimOffline(true);
  assert.equal(g.state.resources.cash, before, '광고를 안 봤는데 2배가 나갔다');
});

test('광고 제거를 샀으면 광고 없이 2배', async () => {
  const g = new Game(ad('failed'));
  const report = ready(g);
  g.state.shop.adFree = true;
  const before = g.state.resources.cash;
  await g.claimOffline(true);
  const gained = g.state.resources.cash - before;
  assert.ok(Math.abs(gained - report.cash) < 1e-6, '광고 제거인데 2배를 못 받았다');
});

test('두 번 받을 수 없다', async () => {
  const g = new Game(ad('completed'));
  ready(g);
  await g.claimOffline(true);
  const after = g.state.resources.cash;
  await g.claimOffline(true);
  assert.equal(g.state.resources.cash, after, '보상을 두 번 받았다');
});

test('2배분 세수도 기본분과 같은 배율로 잡힌다', async () => {
  const g = new Game(ad('completed'));
  const s = g.state;
  s.city.level = 8;
  for (let i = 0; i < 4; i++) {
    s.businesses.mine.units[i] = { unlocked: true, level: 30, progress: 0, running: false, equip: false, manager: true };
  }
  // 세수 배율이 1보다 크도록 상가를 올린다
  s.facilities.shops = { unlocked: true, level: 20 };
  invalidateStats();
  const taxMult = stats(s).taxMult;
  assert.ok(taxMult > 1, `이 테스트는 세수 배율 > 1 이어야 한다 (지금 ${taxMult})`);

  const taxBefore = s.city.taxRun;
  const report = computeOffline(s, 3600, Date.now());
  const taxFromBase = s.city.taxRun - taxBefore;
  g.pendingOffline = report;

  const taxBefore2 = s.city.taxRun;
  await g.claimOffline(true);
  const taxFromDouble = s.city.taxRun - taxBefore2;

  assert.ok(
    Math.abs(taxFromDouble - taxFromBase) < Math.max(1, taxFromBase * 1e-6),
    `2배분 세수 ${taxFromDouble} 가 기본분 ${taxFromBase} 와 다르다 (배율 x${taxMult.toFixed(2)} 누락)`,
  );
});

test('오프라인 보상은 자금을 비정상으로 만들지 않는다', async () => {
  const g = new Game(ad('completed'));
  ready(g);
  await g.claimOffline(true);
  assert.ok(Number.isFinite(g.state.resources.cash));
  assert.ok(Number.isFinite(g.state.city.taxRun));
  assert.ok(Number.isFinite(g.state.city.taxTotal));
  assert.ok(g.state.resources.cash >= 0);
  void CONFIG;
});
