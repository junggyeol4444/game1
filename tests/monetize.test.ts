/**
 * 광고 · 결제 흐름.
 * 웹 빌드는 전부 스텁이라 한 번도 검증된 적이 없었다. 여기가 매출 경로다 —
 * 쿨다운이 새면 광고가 무한 보상이 되고, 결제가 실패해도 물건이 나가면 손해다.
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

const { AdService } = await import('../src/core/ads');
const { PIGGY_GOAL, piggyReady } = await import('../src/core/iap');
const { createInitialState } = await import('../src/core/state');
const { setTimeSource, deviceTime } = await import('../src/core/save');
const { CONFIG } = await import('../src/data/config');
import type { AdPlacement, AdProvider, AdResult } from '../src/core/ads';

let clock = 1_000_000;
beforeEach(() => {
  store.clear();
  clock = 1_000_000;
  setTimeSource({ now: () => clock });
});

function provider(result: AdResult = 'completed', ready = true): AdProvider & { calls: number } {
  return {
    name: 'test',
    calls: 0,
    isReady: () => ready,
    showRewarded(_p: AdPlacement) {
      (this as { calls: number }).calls += 1;
      return Promise.resolve(result);
    },
  };
}

test('완주하면 보상, 쿨다운이 걸린다', async () => {
  const s = createInitialState(clock);
  const ads = new AdService(provider(), () => s);
  assert.equal(await ads.watch('tabBoost'), true);
  assert.equal(s.stats.adsWatched, 1);
  assert.ok(ads.cooldownRemaining('tabBoost') > 0, '쿨다운이 안 걸렸다');
  assert.equal(ads.isAvailable('tabBoost'), false);
});

test('쿨다운 중에는 광고 자체를 안 부른다 (무한 보상 방지)', async () => {
  const s = createInitialState(clock);
  const p = provider();
  const ads = new AdService(p, () => s);
  await ads.watch('tabBoost');
  for (let i = 0; i < 5; i++) assert.equal(await ads.watch('tabBoost'), false);
  assert.equal(p.calls, 1, `쿨다운 중에 ${p.calls}번 호출됐다`);
  assert.equal(s.stats.adsWatched, 1);
});

test('쿨다운이 지나면 다시 된다', async () => {
  const s = createInitialState(clock);
  const ads = new AdService(provider(), () => s);
  await ads.watch('tabBoost');
  clock += (CONFIG.ads.cooldowns.tabBoost + 1) * 1000;
  assert.equal(ads.isAvailable('tabBoost'), true);
  assert.equal(await ads.watch('tabBoost'), true);
});

test('건너뛰거나 실패하면 보상도 쿨다운도 없다', async () => {
  for (const res of ['skipped', 'failed'] as AdResult[]) {
    const s = createInitialState(clock);
    const ads = new AdService(provider(res), () => s);
    assert.equal(await ads.watch('cashDrop'), false, `${res} 인데 보상이 나갔다`);
    assert.equal(s.stats.adsWatched, 0);
    assert.equal(ads.isAvailable('cashDrop'), true, `${res} 인데 쿨다운이 걸렸다`);
  }
});

test('제공자가 준비 안 됐으면 안 부른다', async () => {
  const s = createInitialState(clock);
  const p = provider('completed', false);
  const ads = new AdService(p, () => s);
  assert.equal(await ads.watch('cashDrop'), false);
  assert.equal(p.calls, 0);
});

test('쿨다운 0인 배치는 연속으로 된다', async () => {
  const s = createInitialState(clock);
  const ads = new AdService(provider(), () => s);
  assert.equal(CONFIG.ads.cooldowns.dailyDouble, 0);
  for (let i = 0; i < 3; i++) assert.equal(await ads.watch('dailyDouble'), true);
  assert.equal(s.stats.adsWatched, 3);
});

test('기기 시간을 되돌려도 쿨다운이 안 풀리고, 늘어나지도 않는다', async () => {
  const s = createInitialState(clock);
  const ads = new AdService(provider(), () => s);
  await ads.watch('trialManager');
  clock -= 3600 * 1000; // 시계를 한 시간 뒤로
  const left = ads.cooldownRemaining('trialManager');
  assert.ok(left > 0, '시간 조작으로 쿨다운이 풀렸다');
  assert.ok(
    left <= CONFIG.ads.cooldowns.trialManager,
    `쿨다운이 ${left}초로 늘었다 — 유저가 광고를 못 본다`,
  );
  // 자가 복구: 다시 물어보면 정상 범위
  clock += CONFIG.ads.cooldowns.trialManager * 1000 + 1000;
  assert.equal(ads.cooldownRemaining('trialManager'), 0, '복구 후에도 안 풀린다');
});

// ── 결제 ──
test('저금통은 목표를 채워야 열린다', () => {
  const s = createInitialState(clock);
  s.city.level = 10;
  s.shop.piggyValue = PIGGY_GOAL - 1;
  assert.equal(piggyReady(s), false);
  s.shop.piggyValue = PIGGY_GOAL;
  assert.equal(piggyReady(s), true);
});

test('저금통은 초반에 아예 안 보인다', () => {
  const s = createInitialState(clock);
  s.city.level = 1;
  s.shop.piggyValue = PIGGY_GOAL * 10;
  assert.equal(piggyReady(s), false, '레벨이 낮은데 저금통이 열렸다');
});

test('결제 실패하면 아무것도 안 준다', async () => {
  const { Game } = await import('../src/core/game');
  const g = new Game(provider());
  g.purchases = { name: 'test', purchase: () => Promise.resolve(false), restore: async () => [] };
  const before = { cash: g.state.resources.cash, bp: g.state.resources.blueprint };
  assert.equal(await g.purchase('starter'), false);
  assert.equal(g.state.resources.cash, before.cash, '결제 실패인데 자금이 나갔다');
  assert.equal(g.state.resources.blueprint, before.bp);
  assert.equal(g.state.shop.purchases.length, 0);
  setTimeSource(deviceTime);
});

test('결제 성공하면 지급되고 기록된다', async () => {
  const { Game } = await import('../src/core/game');
  const g = new Game(provider());
  g.purchases = { name: 'test', purchase: () => Promise.resolve(true), restore: async () => [] };
  const bp = g.state.resources.blueprint;
  assert.equal(await g.purchase('starter'), true);
  assert.ok(g.state.resources.blueprint > bp, '유산이 안 들어왔다');
  assert.ok(g.state.shop.purchases.includes('starter'));
  assert.equal(g.state.shop.firstPurchaseDone, true);
  setTimeSource(deviceTime);
});

test('상점에 등록된 실제 SKU로 결제를 요청한다', async () => {
  const { Game } = await import('../src/core/game');
  const g = new Game(provider());
  let requested = '';
  g.purchases = { name: 'test', purchase: async (sku) => { requested = sku; return true; }, restore: async () => [] };
  assert.equal(await g.purchase('starter'), true);
  assert.equal(requested, 'city_idle_starter_199');
  setTimeSource(deviceTime);
});

test('일회성 상품은 두 번 결제하지 않는다', async () => {
  const { Game } = await import('../src/core/game');
  const g = new Game(provider());
  let calls = 0;
  g.purchases = { name: 'test', purchase: async () => { calls += 1; return true; }, restore: async () => [] };
  assert.equal(await g.purchase('adFree'), true);
  assert.equal(await g.purchase('adFree'), false);
  assert.equal(calls, 1);
  setTimeSource(deviceTime);
});

test('광고 제거를 사면 광고 없이도 2배를 받는다', async () => {
  const { Game } = await import('../src/core/game');
  const g = new Game(provider('failed'));
  g.purchases = { name: 'test', purchase: () => Promise.resolve(true), restore: async () => [] };
  await g.purchase('adFree');
  assert.equal(g.state.shop.adFree, true);
  setTimeSource(deviceTime);
});

// ── 상품별 지급 ──
async function buy(id: string) {
  const { Game } = await import('../src/core/game');
  const g = new Game(provider());
  g.purchases = { name: 'test', purchase: () => Promise.resolve(true), restore: async () => [] };
  g.state.city.level = 10;
  const before = {
    cash: g.state.resources.cash,
    bp: g.state.resources.blueprint,
    total: g.state.prestige.blueprints,
    piggy: g.state.shop.piggyValue,
  };
  const okBuy = await g.purchase(id as never);
  return { g, before, okBuy };
}

test('스타터 팩: 자금 + 유산 + 부스터', async () => {
  const { g, before, okBuy } = await buy('starter');
  assert.equal(okBuy, true);
  assert.ok(g.state.resources.cash > before.cash, '자금이 안 늘었다');
  assert.ok(g.state.resources.blueprint > before.bp, '유산이 안 늘었다');
  assert.ok(g.state.businesses.mine.boostUntil > clock, '부스터가 안 붙었다');
});

test('저금통: 지급하고 포인트를 비운다', async () => {
  const { Game } = await import('../src/core/game');
  const g = new Game(provider());
  g.purchases = { name: 'test', purchase: () => Promise.resolve(true), restore: async () => [] };
  g.state.city.level = 10;
  g.state.shop.piggyValue = 500;
  const bought = g.state.shop.piggyBought;
  await g.purchase('piggy');
  assert.equal(g.state.shop.piggyValue, 0, '저금통이 안 비워졌다');
  assert.equal(g.state.shop.piggyBought, bought + 1);
});

test('광고 제거는 재구매 목록에 안 남는다', async () => {
  const { g } = await buy('adFree');
  assert.equal(g.state.shop.adFree, true);
  assert.ok(g.state.shop.purchases.includes('adFree'));
});

test('유산 팩도 누적 획득량에 잡힌다', async () => {
  const { g, before } = await buy('redevelop');
  assert.ok(g.state.resources.blueprint > before.bp, '유산이 안 들어왔다');
  assert.ok(
    g.state.prestige.blueprints > before.total,
    '보유는 늘었는데 누적 획득량(total_blueprint_earned)이 그대로다',
  );
});

test('유산을 주는 상품은 보유와 누적이 같은 폭으로 오른다', async () => {
  for (const id of ['starter', 'piggy', 'redevelop']) {
    const { g, before } = await buy(id);
    const dHave = g.state.resources.blueprint - before.bp;
    const dTotal = g.state.prestige.blueprints - before.total;
    assert.equal(dTotal, dHave, `${id}: 보유 +${dHave} 인데 누적은 +${dTotal}`);
  }
});
