import { BUSINESSES, BUSINESS_BY_ID } from '../data/businesses';
import { CONFIG } from '../data/config';
import { AdService, type AdPlacement, type AdProvider } from './ads';
import {
  computeOffline,
  isAutomated,
  isUnlocked,
  managerCost,
  produce,
  tickBusinesses,
  totalCashPerSecond,
  unitCost,
  unitMaxAffordable,
} from './economy';
import { PIGGY_GOAL, piggyReady, type IapId, type PurchaseProvider } from './iap';
import {
  allMissionsClaimed,
  bumpMission,
  missionComplete,
  missionDef,
  refreshMissions,
  type MissionEvent,
} from './missions';
import { applyCityLevelUps, buyBlueprintUpgrade, blueprintsOnPrestige, canPrestige, logisticsCost, storageCost } from './progression';
import { load, now, save } from './save';
import { applyPrestigeReset, todayKey } from './state';
import type { BusinessDef, BusinessId, GameState, OfflineReport } from './types';

type GameEvent =
  | 'structure' // 뷰를 다시 그려야 하는 변화 (구매/해금/재개발)
  | 'toast'
  | 'unlock'
  | 'cityLevel'
  | 'offline';

type Listener = (payload?: unknown) => void;

export type BuyMode = 1 | 10 | 100 | 'max';

export class Game {
  state: GameState;
  ads: AdService;
  purchases: PurchaseProvider | null = null;
  buyMode: BuyMode = 1;
  pendingOffline: OfflineReport | null = null;

  private listeners = new Map<GameEvent, Set<Listener>>();
  private lastFrame = 0;
  private saveTimer = 0;
  private dayTimer = 0;
  private running = false;

  constructor(adProvider: AdProvider) {
    const loaded = load();
    this.state = loaded.state;
    this.ads = new AdService(adProvider, () => this.state);

    refreshMissions(this.state, now());
    this.refreshAttendance();

    if (!loaded.fresh && loaded.elapsedSeconds >= CONFIG.offline.minReportSeconds) {
      const report = computeOffline(this.state, loaded.elapsedSeconds, now());
      if (report.cash > 0) this.pendingOffline = report;
      applyCityLevelUps(this.state);
    }
  }

  // ---------- 이벤트 ----------
  on(event: GameEvent, cb: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)!.delete(cb);
  }
  emit(event: GameEvent, payload?: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }
  toast(message: string): void {
    this.emit('toast', message);
  }

  // ---------- 루프 ----------
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = now();
    const loop = () => {
      if (!this.running) return;
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.lastFrame = now();
      else this.persist();
    });
    window.addEventListener('pagehide', () => this.persist());
  }

  private frame(): void {
    const t = now();
    let dt = (t - this.lastFrame) / 1000;
    this.lastFrame = t;
    if (dt <= 0) return;
    // 백그라운드에서 오래 머물다 돌아온 경우: 나머지는 오프라인 계산으로 처리
    if (dt > CONFIG.backgroundThreshold) {
      const report = computeOffline(this.state, dt, t);
      if (report.cash > 0) this.emit('structure');
      dt = 0;
    }
    if (dt > 0) {
      const gained = tickBusinesses(this.state, Math.min(dt, CONFIG.maxFrameDelta * 4), t);
      if (gained > 0) this.bump('cashEarned', gained);
      this.state.stats.playSeconds += dt;
    }
    const unlocked = applyCityLevelUps(this.state);
    for (const def of unlocked) {
      this.state.shop.piggyValue += 20;
      this.emit('unlock', def);
    }
    if (unlocked.length > 0) this.emit('structure');

    this.saveTimer += dt;
    if (this.saveTimer >= CONFIG.autosaveInterval) {
      this.saveTimer = 0;
      this.persist();
    }

    // 앱을 켜 둔 채 자정을 넘기는 경우
    this.dayTimer += dt;
    if (this.dayTimer >= 30) {
      this.dayTimer = 0;
      const before = this.state.missions.day;
      refreshMissions(this.state, now());
      this.refreshAttendance();
      if (before !== this.state.missions.day) this.emit('structure');
    }
  }

  persist(): void {
    save(this.state);
  }

  private bump(event: MissionEvent, amount: number): void {
    bumpMission(this.state, event, amount);
  }

  // ---------- 사업 액션 ----------
  def(id: BusinessId): BusinessDef {
    return BUSINESS_BY_ID[id];
  }

  /** 수동 가동 (탭) */
  tapUnit(id: BusinessId, index: number): boolean {
    const u = this.state.businesses[id].units[index];
    if (u.level <= 0 || u.running) return false;
    if (isAutomated(this.state, id, index, now())) return false;
    u.running = true;
    u.progress = 0;
    this.state.stats.taps += 1;
    this.bump('manualCycle', 1);
    return true;
  }

  buyCount(id: BusinessId, index: number): number {
    if (this.buyMode === 'max') return Math.max(1, unitMaxAffordable(this.state, this.def(id), index));
    return this.buyMode;
  }

  buyUnit(id: BusinessId, index: number): boolean {
    const def = this.def(id);
    const count =
      this.buyMode === 'max' ? unitMaxAffordable(this.state, def, index) : this.buyMode;
    if (count <= 0) return false;
    const cost = unitCost(this.state, def, index, count);
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    this.state.businesses[id].units[index].level += count;
    this.state.shop.piggyValue += 1;
    this.bump('levelBought', count);
    this.emit('structure');
    return true;
  }

  buyManager(id: BusinessId, index: number): boolean {
    const def = this.def(id);
    const u = this.state.businesses[id].units[index];
    if (u.manager || u.level <= 0) return false;
    const cost = managerCost(def, index);
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    u.manager = true;
    this.state.shop.piggyValue += 2;
    this.emit('structure');
    this.toast(`${def.units[index].managerName} 고용 완료`);
    return true;
  }

  // ---------- 도시 시설 ----------
  buyStorage(): boolean {
    const cost = storageCost(this.state);
    if (this.state.city.storageLevel >= CONFIG.offline.maxStorageLevel) return false;
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    this.state.city.storageLevel += 1;
    this.emit('structure');
    return true;
  }

  buyLogistics(): boolean {
    const cost = logisticsCost(this.state);
    if (this.state.city.logisticsLevel >= CONFIG.offline.maxLogisticsLevel) return false;
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    this.state.city.logisticsLevel += 1;
    this.emit('structure');
    return true;
  }

  // ---------- 광고 ----------
  async watchAd(placement: AdPlacement): Promise<boolean> {
    const ok = await this.ads.watch(placement);
    if (ok) {
      this.state.shop.piggyValue += 5;
      this.bump('adWatched', 1);
    }
    return ok;
  }

  async adBoost(id: BusinessId): Promise<boolean> {
    if (!(await this.watchAd('tabBoost'))) return false;
    const bs = this.state.businesses[id];
    bs.boostUntil = Math.max(bs.boostUntil, now()) + CONFIG.ads.boostSeconds * 1000;
    this.emit('structure');
    this.toast(`${this.def(id).name} ${CONFIG.ads.boostFactor}배 가동!`);
    return true;
  }

  async adTrialManager(id: BusinessId): Promise<boolean> {
    if (!(await this.watchAd('trialManager'))) return false;
    const bs = this.state.businesses[id];
    bs.trialUntil = Math.max(bs.trialUntil, now()) + CONFIG.ads.trialManagerSeconds * 1000;
    this.emit('structure');
    this.toast('임시 매니저 출근! 10분간 자동 가동');
    return true;
  }

  async adCashDrop(): Promise<boolean> {
    if (!(await this.watchAd('cashDrop'))) return false;
    const amount = Math.max(100, totalCashPerSecond(this.state) * CONFIG.ads.cashDropSeconds);
    this.state.resources.cash += amount;
    this.emit('structure');
    return true;
  }

  /** 복귀 보상 수령. double=true 면 광고 시청 후 2배 */
  async claimOffline(double: boolean): Promise<void> {
    const report = this.pendingOffline;
    if (!report) return;
    if (double) {
      const ok = this.state.shop.adFree ? true : await this.watchAd('dailyDouble');
      if (ok) {
        this.state.resources.cash += report.cash;
        this.state.stats.cashEarnedRun += report.cash;
        this.state.stats.cashEarnedTotal += report.cash;
        this.state.city.taxRun += report.cash * CONFIG.taxRate;
        this.state.city.taxTotal += report.cash * CONFIG.taxRate;
      }
    }
    this.pendingOffline = null;
    applyCityLevelUps(this.state);
    this.emit('structure');
  }

  // ---------- 미션 / 출석 ----------
  claimMission(index: number): boolean {
    const s = this.state;
    if (!missionComplete(s, index) || s.missions.claimed[index]) return false;
    const def = missionDef(s.missions.ids[index]);
    if (!def) return false;
    const reward = def.reward(s);
    this.grantReward(reward.kind, reward.amount, reward.business);
    s.missions.claimed[index] = true;
    s.shop.piggyValue += 3;
    if (allMissionsClaimed(s)) this.toast('오늘 미션 전부 완료!');
    this.emit('structure');
    return true;
  }

  private grantReward(kind: 'cash' | 'boost' | 'blueprint', amount: number, business?: BusinessId): void {
    const s = this.state;
    if (kind === 'cash') {
      s.resources.cash += amount;
      this.toast(`자금 +${amount.toExponential(2)}`);
    } else if (kind === 'blueprint') {
      s.resources.blueprint += amount;
      s.prestige.blueprints += amount;
      this.toast(`설계도 +${amount}`);
    } else {
      const targets = business ? [business] : BUSINESSES.filter((b) => isUnlocked(s, b)).map((b) => b.id);
      for (const id of targets) {
        const bs = s.businesses[id];
        bs.boostUntil = Math.max(bs.boostUntil, now()) + amount * 1000;
      }
      this.toast(`${Math.round(amount / 60)}분간 ${CONFIG.ads.boostFactor}배 가동!`);
    }
  }

  refreshAttendance(): void {
    const day = todayKey(now());
    if (this.state.attendance.day !== day) {
      this.state.attendance.day = day;
      this.state.attendance.claimedToday = false;
    }
  }

  claimAttendance(): boolean {
    this.refreshAttendance();
    const a = this.state.attendance;
    if (a.claimedToday) return false;
    const reward = CONFIG.attendance.rewards[a.streak % 7];
    if (reward.type === 'cashSeconds') {
      this.grantReward('cash', Math.max(500, totalCashPerSecond(this.state) * reward.amount));
    } else if (reward.type === 'boost') {
      this.grantReward('boost', reward.amount);
    } else {
      this.grantReward('blueprint', reward.amount);
    }
    a.claimedToday = true;
    a.streak = (a.streak + 1) % 7;
    this.emit('structure');
    return true;
  }

  // ---------- 재개발 ----------
  canPrestige(): boolean {
    return canPrestige(this.state);
  }

  prestigeGain(): number {
    return blueprintsOnPrestige(this.state);
  }

  async doPrestige(withAd: boolean): Promise<boolean> {
    if (!this.canPrestige()) return false;
    let gain = this.prestigeGain();
    if (gain <= 0) return false;
    if (withAd && (await this.watchAd('prestigeBonus'))) {
      gain = Math.floor(gain * (1 + CONFIG.prestige.adBonus));
    }
    applyPrestigeReset(this.state, gain, now());
    this.persist();
    this.emit('structure');
    this.toast(`재개발 완료. 설계도 ${gain} 획득`);
    return true;
  }

  buyBlueprint(id: string): boolean {
    const ok = buyBlueprintUpgrade(this.state, id);
    if (ok) this.emit('structure');
    return ok;
  }

  // ---------- 상점 ----------
  async purchase(id: IapId): Promise<boolean> {
    if (!this.purchases) return false;
    const sku = `city_idle_${id}`;
    const ok = await this.purchases.purchase(sku);
    if (!ok) return false;
    this.applyPurchase(id);
    this.state.shop.purchases.push(id);
    this.state.shop.firstPurchaseDone = true;
    this.persist();
    this.emit('structure');
    return true;
  }

  private applyPurchase(id: IapId): void {
    const s = this.state;
    const rate = totalCashPerSecond(s);
    switch (id) {
      case 'starter':
        s.resources.cash += Math.max(5000, rate * 7200);
        s.resources.blueprint += 5;
        s.prestige.blueprints += 5;
        this.grantReward('boost', 1800);
        break;
      case 'piggy':
        s.resources.cash += Math.max(10000, rate * 28800);
        s.resources.blueprint += 3;
        s.prestige.blueprints += 3;
        s.shop.piggyValue = 0;
        s.shop.piggyBought += 1;
        break;
      case 'tabBoost':
        this.grantReward('boost', 86400);
        break;
      case 'adFree':
        s.shop.adFree = true;
        break;
      case 'redevelop':
        s.resources.blueprint += Math.max(10, Math.floor(this.prestigeGain() * 0.5));
        break;
    }
  }

  piggyState(): { visible: boolean; ready: boolean; progress: number; goal: number } {
    return {
      visible: this.state.city.level >= 8,
      ready: piggyReady(this.state),
      progress: Math.min(1, this.state.shop.piggyValue / PIGGY_GOAL),
      goal: PIGGY_GOAL,
    };
  }

  /** 디버그/테스트용 */
  devGrant(cash: number): void {
    this.state.resources.cash += cash;
    this.emit('structure');
  }

  forceProduce(id: BusinessId, index: number): void {
    produce(this.state, this.def(id), index, 1, now());
  }
}
