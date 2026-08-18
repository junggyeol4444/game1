import { CONFIG } from '../data/config';
import type { GameState } from './types';
import { now } from './save';

export type AdPlacement =
  | 'dailyDouble'
  | 'tabBoost'
  | 'trialManager'
  | 'cashDrop'
  | 'prestigeBonus'
  | 'missionReroll';

export type AdResult = 'completed' | 'skipped' | 'failed';

/**
 * 광고 제공자 인터페이스.
 * 웹/개발 빌드는 WebStubAdProvider, 네이티브 빌드는 Capacitor AdMob/AppLovin MAX 구현을 주입한다.
 * (native/ads-admob.ts 참고 — 스토어 빌드 시 이 인터페이스만 구현하면 된다)
 */
export interface AdProvider {
  readonly name: string;
  isReady(placement: AdPlacement): boolean;
  showRewarded(placement: AdPlacement): Promise<AdResult>;
}

export class WebStubAdProvider implements AdProvider {
  readonly name = 'web-stub';
  constructor(private render: (seconds: number, placement: AdPlacement) => Promise<AdResult>) {}
  isReady(): boolean {
    return true;
  }
  showRewarded(placement: AdPlacement): Promise<AdResult> {
    return this.render(CONFIG.ads.stubSeconds, placement);
  }
}

export class AdService {
  constructor(
    private provider: AdProvider,
    private state: () => GameState,
  ) {}

  setProvider(p: AdProvider): void {
    this.provider = p;
  }

  cooldownRemaining(placement: AdPlacement): number {
    const cd = CONFIG.ads.cooldowns[placement] ?? 0;
    if (cd <= 0) return 0;
    const last = this.state().adCooldowns[placement] ?? 0;
    return Math.max(0, cd - (now() - last) / 1000);
  }

  isAvailable(placement: AdPlacement): boolean {
    return this.cooldownRemaining(placement) === 0 && this.provider.isReady(placement);
  }

  /** 보상형 광고. 시청 완료 시 true */
  async watch(placement: AdPlacement): Promise<boolean> {
    if (!this.isAvailable(placement)) return false;
    const res = await this.provider.showRewarded(placement);
    if (res !== 'completed') return false;
    const s = this.state();
    s.adCooldowns[placement] = now();
    s.stats.adsWatched += 1;
    return true;
  }
}
