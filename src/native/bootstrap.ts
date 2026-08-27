import { Capacitor } from '@capacitor/core';
import type { Game } from '../core/game';
import { IAP_PRODUCTS } from '../core/iap';
import { AdMobProvider } from './ads-admob';
import { RevenueCatProvider } from './purchases';

type NativeEnv = {
  VITE_ADMOB_REWARDED_ID?: string;
  VITE_REVENUECAT_ANDROID_KEY?: string;
  VITE_REVENUECAT_IOS_KEY?: string;
};

/**
 * 웹은 개발용 스텁을 유지하고, Android/iOS에서만 실제 스토어 SDK로 교체한다.
 * 광고 단위와 RevenueCat 공개 SDK 키는 빌드 시 Vite 환경 변수로 주입한다.
 */
export async function configureNativeServices(
  game: Game,
  env: NativeEnv = (import.meta as ImportMeta & { env: NativeEnv }).env,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const adId = env.VITE_ADMOB_REWARDED_ID?.trim();
  if (adId) {
    const ads = new AdMobProvider({ rewarded: adId });
    if (await ads.init()) {
      game.ads.setProvider(ads);
      // 플러그인은 보상형 광고 한 개를 캐시한다. 모든 배치가 같은 단위를 공유한다.
      await ads.preload('dailyDouble');
    }
  } else {
    console.warn('VITE_ADMOB_REWARDED_ID가 없어 실제 광고를 시작하지 않았습니다.');
  }

  const key = (Capacitor.getPlatform() === 'ios'
    ? env.VITE_REVENUECAT_IOS_KEY
    : env.VITE_REVENUECAT_ANDROID_KEY)?.trim();
  if (!key) {
    console.warn('현재 플랫폼의 RevenueCat SDK 키가 없어 실제 결제를 시작하지 않았습니다.');
    return;
  }

  const purchases = new RevenueCatProvider(key);
  if (!(await purchases.init())) return;
  game.purchases = purchases;

  // 소비성 팩은 복원하면 중복 지급되므로 복원하지 않는다. 영구 상품만 복구한다.
  const restored = await purchases.restore();
  const adFreeSku = IAP_PRODUCTS.find((p) => p.id === 'adFree')?.sku;
  if (adFreeSku && restored.includes(adFreeSku) && !game.state.shop.adFree) {
    game.state.shop.adFree = true;
    if (!game.state.shop.purchases.includes('adFree')) game.state.shop.purchases.push('adFree');
    game.persist();
    game.emit('structure');
  }
}
