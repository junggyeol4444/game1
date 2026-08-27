import type { AdPlacement, AdProvider, AdResult } from '../core/ads';

/**
 * 네이티브(Capacitor) 보상형 광고 어댑터.
 *
 * 설치:
 *   npm i @capacitor/core @capacitor/android @capacitor/ios @capacitor-community/admob
 *   npx cap add android && npx cap add ios
 *
 * 미디에이션은 AdMob 콘솔 또는 AppLovin MAX 에서 붙인다.
 *
 * 플러그인은 **동적 import** 로 가져온다. 정적으로 넣으면 웹 번들에 SDK 가 딸려 들어간다
 * (실측 +21.8KB). 웹은 스텁을 쓰고 네이티브에서만 실제로 필요하다.
 * 테스트는 같은 형태의 모듈을 생성자로 주입한다.
 */
export interface AdUnitIds {
  rewarded: string;
  /** 배치별로 다른 광고 단위를 쓰고 싶으면 지정 */
  perPlacement?: Partial<Record<AdPlacement, string>>;
}

type AdMobModule = {
  AdMob: {
    initialize(opts: unknown): Promise<void>;
    prepareRewardVideoAd(opts: unknown): Promise<unknown>;
    showRewardVideoAd(): Promise<{ type?: string; amount?: number }>;
  };
};

export class AdMobProvider implements AdProvider {
  readonly name = 'admob';
  private mod: AdMobModule | null = null;
  private ready = false;
  private preparedFor: AdPlacement | null = null;

  /** mod 를 넣으면 그걸 쓴다 (테스트 · SDK 교체용). 안 넣으면 init() 이 동적 import */
  constructor(
    private ids: AdUnitIds,
    mod: AdMobModule | null = null,
  ) {
    this.mod = mod;
  }

  async init(): Promise<boolean> {
    try {
      if (!this.mod) {
        const spec = '@capacitor-community/admob';
        this.mod = (await import(/* @vite-ignore */ spec)) as unknown as AdMobModule;
      }
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
      this.ready = true;
      this.preparedFor = placement;
    } catch (e) {
      console.warn('광고 로드 실패', placement, e);
    }
  }

  isReady(placement: AdPlacement): boolean {
    if (!this.ready || this.preparedFor === null) return false;
    // 같은 광고 단위를 공유하는 배치들은 준비된 광고 한 개를 함께 쓴다.
    return this.preparedFor === placement || this.unitId(this.preparedFor) === this.unitId(placement);
  }

  async showRewarded(placement: AdPlacement): Promise<AdResult> {
    if (!this.mod) return 'failed';
    try {
      const res = await this.mod.AdMob.showRewardVideoAd();
      this.ready = false;
      this.preparedFor = null;
      void this.preload(placement);
      // 보상을 실제로 받았을 때만 completed 다.
      // `(res.amount ?? 0) >= 0` 은 항상 참이라, 광고를 닫아도 보상이 나갔다.
      return (res?.amount ?? 0) > 0 ? 'completed' : 'skipped';
    } catch (e) {
      console.warn('광고 표시 실패', e);
      this.ready = false;
      this.preparedFor = null;
      void this.preload(placement);
      return 'failed';
    }
  }
}
