import { CONFIG } from '../data/config';
import type { GameState } from './types';
import { now } from './save';

export type AdPlacement =
  | 'dailyDouble'
  | 'tabBoost'
  | 'trialManager'
  | 'cashDrop'
  | 'prestigeBonus'
  | 'missionReroll'
  | 'minigame';

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
    const s = this.state();
    const t = now();
    const last = s.adCooldowns[placement] ?? 0;
    // 기기 시계를 뒤로 돌리면 last 가 미래가 된다. 그대로 두면 쿨다운이 몇 시간으로
    // 늘어나 광고가 잠긴다(유저 손해). 미래 기록은 지금으로 당겨 스스로 낫게 한다.
    if (last > t) {
      s.adCooldowns[placement] = t;
      return cd;
    }
    return Math.max(0, cd - (t - last) / 1000);
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
