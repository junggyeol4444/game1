/**
 * 네이티브 어댑터 (AdMob · RevenueCat).
 * 스토어 빌드에서만 도는 코드라 아무도 안 굴려 봤다. 여기가 매출 경로다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdMobProvider } from '../src/native/ads-admob';
import { RevenueCatProvider } from '../src/native/purchases';

function admobMod(show: () => Promise<{ type?: string; amount?: number }>) {
  const calls = { prepare: 0, show: 0 };
  return {
    calls,
    mod: {
      AdMob: {
        initialize: async () => undefined,
        prepareRewardVideoAd: async () => {
          calls.prepare += 1;
        },
        showRewardVideoAd: async () => {
          calls.show += 1;
          return show();
        },
      },
    },
  };
}

const ids = { rewarded: 'ca-app-pub-test/rewarded' };

test('보상을 실제로 받아야 completed 다', async () => {
  const { mod } = admobMod(async () => ({ type: 'coins', amount: 1 }));
  const p = new AdMobProvider(ids, mod);
  await p.preload('tabBoost');
  assert.equal(await p.showRewarded('tabBoost'), 'completed');
});

test('광고를 닫으면 보상이 안 나간다', async () => {
  // AdMob 은 보상 없이 닫으면 amount 없이/0 으로 돌아온다
  for (const res of [{}, { amount: 0 }, { type: 'coins', amount: 0 }]) {
    const { mod } = admobMod(async () => res);
    const p = new AdMobProvider(ids, mod);
    await p.preload('cashDrop');
    assert.equal(
      await p.showRewarded('cashDrop'),
      'skipped',
      `${JSON.stringify(res)} 인데 보상이 나갔다`,
    );
  }
});

test('광고 표시가 터지면 failed', async () => {
  const { mod } = admobMod(async () => {
    throw new Error('no fill');
  });
  const p = new AdMobProvider(ids, mod);
  await p.preload('minigame');
  assert.equal(await p.showRewarded('minigame'), 'failed');
});

test('한 번 보여준 광고는 다시 준비될 때까지 isReady 가 false 다', async () => {
  const { mod } = admobMod(async () => ({ amount: 1 }));
  const p = new AdMobProvider(ids, mod);
  assert.equal(p.isReady('tabBoost'), false, '로드 전인데 준비됐다고 한다');
  await p.preload('tabBoost');
  assert.equal(p.isReady('tabBoost'), true);
  await p.showRewarded('tabBoost');
  // 표시 직후 자동 재로드가 걸린다 — 그 사이에도 두 번 보여지면 안 된다
  await new Promise((r) => setTimeout(r, 0));
});

test('모듈이 없으면(초기화 실패) 광고가 failed 이고 준비도 안 된다', async () => {
  const p = new AdMobProvider(ids);
  assert.equal(p.isReady('tabBoost'), false);
  assert.equal(await p.showRewarded('tabBoost'), 'failed');
});

test('배치별 광고 단위를 따로 줄 수 있다', async () => {
  const seen: string[] = [];
  const mod = {
    AdMob: {
      initialize: async () => undefined,
      prepareRewardVideoAd: async (o: unknown) => {
        seen.push((o as { adId: string }).adId);
      },
      showRewardVideoAd: async () => ({ amount: 1 }),
    },
  };
  const p = new AdMobProvider({ rewarded: 'base', perPlacement: { cashDrop: 'special' } }, mod);
  await p.preload('tabBoost');
  await p.preload('cashDrop');
  assert.deepEqual(seen, ['base', 'special']);
});

// ── 결제 ──
function rcMod(purchase: () => Promise<unknown>, restore?: () => Promise<unknown>) {
  return {
    Purchases: {
      configure: async () => undefined,
      getOfferings: async () => ({}),
      purchaseStoreProduct: purchase,
      restorePurchases: (restore ?? (async () => ({ customerInfo: { allPurchasedProductIdentifiers: [] } }))) as never,
    },
  };
}

test('결제가 성공하면 true', async () => {
  const p = new RevenueCatProvider('key', rcMod(async () => ({})) as never);
  assert.equal(await p.purchase('city_idle_starter_199'), true);
});

test('결제 취소/실패는 false 이고 안 던진다', async () => {
  const p = new RevenueCatProvider('key', rcMod(async () => {
    throw new Error('user cancelled');
  }) as never);
  assert.equal(await p.purchase('city_idle_starter_199'), false);
});

test('모듈이 없으면 결제가 false', async () => {
  const p = new RevenueCatProvider('key');
  assert.equal(await p.purchase('x'), false);
  assert.deepEqual(await p.restore(), []);
});

test('복원이 터져도 앱이 안 죽는다', async () => {
  const p = new RevenueCatProvider('key', rcMod(
    async () => ({}),
    async () => {
      throw new Error('network');
    },
  ) as never);
  assert.deepEqual(await p.restore(), [], '복원 실패가 예외로 새어 나왔다');
});

test('복원 응답이 이상해도 빈 목록', async () => {
  const p = new RevenueCatProvider('key', rcMod(async () => ({}), async () => ({})) as never);
  assert.deepEqual(await p.restore(), []);
});

test('복원 목록을 그대로 돌려준다', async () => {
  const p = new RevenueCatProvider('key', rcMod(
    async () => ({}),
    async () => ({ customerInfo: { allPurchasedProductIdentifiers: ['a', 'b'] } }),
  ) as never);
  assert.deepEqual(await p.restore(), ['a', 'b']);
});
