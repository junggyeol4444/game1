import { Capacitor } from '@capacitor/core';
import type { AdPlacement } from '../core/ads';
import type { Game } from '../core/game';
import { AdMobProvider } from './ads-admob';
import { RevenueCatProvider } from './purchases';

const AD_PLACEMENTS: AdPlacement[] = ['dailyDouble', 'tabBoost', 'trialManager', 'cashDrop', 'prestigeBonus'];

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
      // 배치마다 광고 단위를 나눌 수 있으므로(AdUnitIds.perPlacement) 전 배치를 예열한다.
      // 지금처럼 한 단위를 공유하면 마지막 것만 남지만 isReady 가 단위로 비교해 전부 true 다.
      for (const p of AD_PLACEMENTS) await ads.preload(p);
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
  // 복원은 여기서 하지 않는다 — 상점의 '구매 복원' 버튼이 game.restorePurchases() 를 부른다.
  // iOS 는 앱 실행마다 복원하면 App Store 로그인 창이 떠서 심사에 걸린다.
}
