import type { AdPlacement, AdProvider, AdResult } from '../core/ads';

/**
 * 네이티브(Capacitor) 보상형 광고 어댑터.
 *
 * 설치:
 *   npm i @capacitor/core @capacitor/android @capacitor/ios @capacitor-community/admob
 *   npx cap add android && npx cap add ios
 *
 * 미디에이션은 AdMob 콘솔 또는 AppLovin MAX 에서 붙인다.
 * 이 파일은 플러그인이 없어도 빌드가 깨지지 않도록 동적 import 를 쓴다.
 */
export interface AdUnitIds {
  rewarded: string;
  /** 배치별로 다른 광고 단위를 쓰고 싶으면 지정 */
  perPlacement?: Partial<Record<AdPlacement, string>>;
}

type AdMobModule = {
  AdMob: {
    initialize(opts: unknown): Promise<void>;
    prepareRewardVideoAd(opts: unknown): Promise<void>;
    showRewardVideoAd(): Promise<{ type?: string; amount?: number }>;
  };
};

export class AdMobProvider implements AdProvider {
  readonly name = 'admob';
  private mod: AdMobModule | null = null;
  private ready = new Set<AdPlacement>();

  constructor(private ids: AdUnitIds) {}

  async init(): Promise<boolean> {
    try {
      const spec = '@capacitor-community/admob';
      this.mod = (await import(/* @vite-ignore */ spec)) as unknown as AdMobModule;
      await this.mod.AdMob.initialize({ initializeForTesting: false });
      return true;
    } catch (e) {
      console.warn('AdMob 초기화 실패 — 스텁으로 대체', e);
      return false;
    }
  }

  private unitId(placement: AdPlacement): string {
    return this.ids.perPlacement?.[placement] ?? this.ids.rewarded;
  }

  async preload(placement: AdPlacement): Promise<void> {
    if (!this.mod) return;
    try {
      await this.mod.AdMob.prepareRewardVideoAd({ adId: this.unitId(placement) });
      this.ready.add(placement);
    } catch (e) {
      console.warn('광고 로드 실패', placement, e);
    }
  }

  isReady(placement: AdPlacement): boolean {
    return this.ready.has(placement);
  }

  async showRewarded(placement: AdPlacement): Promise<AdResult> {
    if (!this.mod) return 'failed';
    try {
      const res = await this.mod.AdMob.showRewardVideoAd();
      this.ready.delete(placement);
      void this.preload(placement);
      return res && (res.amount ?? 0) >= 0 ? 'completed' : 'skipped';
    } catch (e) {
      console.warn('광고 표시 실패', e);
      this.ready.delete(placement);
      void this.preload(placement);
      return 'failed';
    }
  }
}
