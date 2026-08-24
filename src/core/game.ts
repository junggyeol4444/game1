import { BUSINESSES, BUSINESS_BY_ID } from '../data/businesses';
import { CONFIG } from '../data/config';
import { HOIST_LEVELS } from '../data/units';
import type { FacilityId } from '../data/buildings';
import { AdService, type AdPlacement, type AdProvider } from './ads';
import { setSoundEnabled, sfx } from './audio';
import {
  businessRatePerSecond,
  computeOffline,
  equipCost,
  hoistCost,
  hoistGemCost,
  invalidateStats,
  isUnlocked,
  managerCost,
  offlineUpgradeCost,
  projectedEfficiency,
  tickBusinesses,
  totalCashPerSecond,
  unitCost,
  unitMaxAffordable,
  unitUnlockCost,
} from './economy';
import { buyFacility as doBuyFacility, facilityCost, facilityUnlocked, isBuilt } from './facilities';
import { tickEvents } from './events';
import { PIGGY_GOAL, piggyReady, type IapId, type PurchaseProvider } from './iap';
import {
  allMissionsClaimed,
  bumpMission,
  missionComplete,
  missionDef,
  refreshMissions,
  type MissionEvent,
} from './missions';
import {
  advanceEra,
  applyCityLevelUps,
  buyLegacyUpgrade,
  canAdvanceEra,
  currentEra,
  eraProgress,
  eraThreshold,
  isFinalEra,
  legacyOnAdvance,
  nextEra,
} from './progression';
import { deviceTime, load, now, save, setTimeSource } from './save';
import { todayKey } from './state';
import type { BusinessDef, BusinessId, GameState, OfflineReport } from './types';
import type { EraDef } from '../data/eras';
import { LEGACY, bizName, bizUnitLabel, bizHoistName, unitManagerName } from './era';
import { MINIGAMES, MINIGAME_SPOILS } from '../ui/minigames/games';
import { playMinigame, type MinigameResult } from '../ui/minigames/host';

type GameEvent = 'structure' | 'toast' | 'unlock' | 'cityEvent' | 'coin' | 'offline' | 'quake';
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

    setSoundEnabled(this.state.settings.sound);
    refreshMissions(this.state, now());
    this.refreshAttendance();

    if (!loaded.fresh && loaded.elapsedSeconds >= CONFIG.offline.minReportSeconds) {
      const report = computeOffline(this.state, loaded.elapsedSeconds, now());
      if (report.cash > 0) this.pendingOffline = report;
      applyCityLevelUps(this.state);
    }
  }

  // ── 이벤트 ──
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

  // ── 루프 ──
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
      else this.persist(); // 백그라운드 전환 시 저장
    });
    window.addEventListener('pagehide', () => this.persist());
  }

  private frame(): void {
    const t = now();
    let dt = (t - this.lastFrame) / 1000;
    this.lastFrame = t;
    if (dt <= 0) return;
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
    if (unlocked.length > 0) {
      invalidateStats();
      this.persist();
      this.emit('structure');
    }

    for (const notice of tickEvents(this.state, t)) {
      this.toast(notice.text);
      this.emit('cityEvent', notice);
    }

    this.saveTimer += dt;
    if (this.saveTimer >= CONFIG.autosaveInterval) {
      this.saveTimer = 0;
      this.persist();
    }
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

  def(id: BusinessId): BusinessDef {
    return BUSINESS_BY_ID[id];
  }

  // ── 사업 ──
  tapUnit(id: BusinessId, index: number): boolean {
    const u = this.state.businesses[id].units[index];
    if (!u.unlocked || u.level <= 0 || u.running) return false;
    u.running = true;
    u.progress = 0;
    sfx('tap');
    this.state.stats.taps += 1;
    this.bump('manualCycle', 1);
    return true;
  }

  /** 유닛(층) 해금 */
  unlockUnit(id: BusinessId, index: number): boolean {
    const def = this.def(id);
    const u = this.state.businesses[id].units[index];
    if (u.unlocked) return false;
    const cost = unitUnlockCost(this.state, def, index);
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    u.unlocked = true;
    u.level = 1;
    sfx('unlock');
    this.state.shop.piggyValue += 3;
    invalidateStats();
    this.persist();
    this.emit('structure');
    this.toast(`${def.units[index].name} 해금`);
    return true;
  }

  buyUnit(id: BusinessId, index: number): boolean {
    const def = this.def(id);
    const u = this.state.businesses[id].units[index];
    if (!u.unlocked) return this.unlockUnit(id, index);
    const count = this.buyMode === 'max' ? unitMaxAffordable(this.state, def, index) : this.buyMode;
    if (count <= 0) return false;
    const cost = unitCost(this.state, def, index, count);
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    const before = u.level;
    u.level += count;
    sfx(CONFIG.milestones.some((m) => before < m && u.level >= m) ? 'milestone' : 'buy');
    this.state.shop.piggyValue += 1;
    this.state.stats.taps += 0;
    this.bump('levelBought', count);
    invalidateStats();
    this.persist();
    this.emit('structure');
    return true;
  }

  buyEquip(id: BusinessId, index: number): boolean {
    const def = this.def(id);
    const u = this.state.businesses[id].units[index];
    if (u.equip || u.manager || !u.unlocked) return false;
    const cost = equipCost(this.state, def, index);
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    u.equip = true;
    sfx('equip');
    this.persist();
    this.emit('structure');
    this.toast(`${def.units[index].name} 설비 배치 (효율 50%)`);
    return true;
  }

  buyManager(id: BusinessId, index: number): boolean {
    const def = this.def(id);
    const u = this.state.businesses[id].units[index];
    if (u.manager || !u.unlocked) return false;
    const cost = managerCost(this.state, def, index);
    if (this.state.resources.cash < cost) return false;
    this.state.resources.cash -= cost;
    u.manager = true;
    sfx('manager');
    this.state.shop.piggyValue += 2;
    this.persist();
    this.emit('structure');
    this.toast(`${unitManagerName(this.state, id, index, def.units[index].managerName)} 배치 완료`);
    return true;
  }

  /** 전 유닛 공통 배율 장치 (엘리베이터) */
  buyHoist(id: BusinessId): boolean {
    const bs = this.state.businesses[id];
    if (bs.hoistLevel >= HOIST_LEVELS.length) return false;
    const cost = hoistCost(this.state, id);
    const gems = hoistGemCost(this.state, id);
    if (this.state.resources.cash < cost || this.state.resources.gem < gems) return false;
    this.state.resources.cash -= cost;
    this.state.resources.gem -= gems;
    bs.hoistLevel += 1;
    sfx('milestone');
    this.persist();
    this.emit('structure');
    this.toast(
      `${bizHoistName(this.state, id)} Lv.${bs.hoistLevel} — 전 ${bizUnitLabel(this.state, id)} 배율 x${HOIST_LEVELS[bs.hoistLevel - 1].mult}`,
    );
    return true;
  }

  // ── 시설 ──
  buyFacility(id: FacilityId): boolean {
    const ok = doBuyFacility(this.state, id);
    if (ok) {
      sfx('build');
      invalidateStats();
      this.state.shop.piggyValue += 1;
      this.bump('levelBought', 1);
      this.persist();
      this.emit('structure');
    }
    return ok;
  }
  facilityBuilt(id: FacilityId): boolean {
    return isBuilt(this.state, id);
  }
  facilityPrice(id: FacilityId): number {
    return facilityCost(this.state, id);
  }
  facilityOpen(id: FacilityId): boolean {
    return facilityUnlocked(this.state, id);
  }

  // ── 오프라인 업그레이드 (물자 소비) ──
  buyOfflineCap(): boolean {
    const lv = this.state.city.capLevel;
    const cost = offlineUpgradeCost(lv);
    if (lv >= 5 || this.state.resources.material < cost) return false;
    this.state.resources.material -= cost;
    this.state.city.capLevel += 1;
    this.persist();
    this.emit('structure');
    return true;
  }
  buyOfflineEff(): boolean {
    const lv = this.state.city.effLevel;
    const cost = offlineUpgradeCost(lv);
    if (lv >= 5 || this.state.resources.material < cost) return false;
    this.state.resources.material -= cost;
    this.state.city.effLevel += 1;
    this.persist();
    this.emit('structure');
    return true;
  }

  // ── 광고 ──
  async watchAd(placement: AdPlacement): Promise<boolean> {
    const ok = await this.ads.watch(placement);
    if (ok) {
      this.state.shop.piggyValue += 5;
      this.bump('adWatched', 1);
      this.persist();
    }
    return ok;
  }

  async adBoost(id: BusinessId): Promise<boolean> {
    if (!(await this.watchAd('tabBoost'))) return false;
    const bs = this.state.businesses[id];
    bs.boostUntil = Math.max(bs.boostUntil, now()) + CONFIG.ads.boostSeconds * 1000;
    this.emit('structure');
    this.toast(`${bizName(this.state, id)} ${CONFIG.ads.boostFactor}배 가동!`);
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
    this.grantCash(amount);
    this.emit('structure');
    return true;
  }

  grantCash(amount: number): void {
    sfx('coin');
    this.state.resources.cash += amount;
    this.state.stats.cashEarnedRun += amount;
    this.state.stats.cashEarnedTotal += amount;
    this.emit('coin', amount);
  }

  async claimOffline(double: boolean): Promise<void> {
    const report = this.pendingOffline;
    if (!report) return;
    if (double) {
      const ok = this.state.shop.adFree ? true : await this.watchAd('dailyDouble');
      if (ok) {
        this.grantCash(report.cash);
        this.state.city.taxRun += report.cash * CONFIG.taxRate;
        this.state.city.taxTotal += report.cash * CONFIG.taxRate;
      }
    }
    this.pendingOffline = null;
    applyCityLevelUps(this.state);
    this.persist();
    this.emit('structure');
  }

  // ── 미션 / 출석 ──
  claimMission(index: number): boolean {
    const s = this.state;
    if (!missionComplete(s, index) || s.missions.claimed[index]) return false;
    const def = missionDef(s.missions.ids[index]);
    if (!def) return false;
    const reward = def.reward(s);
    this.grantReward(reward.kind, reward.amount, reward.business);
    s.missions.claimed[index] = true;
    sfx('reward');
    s.shop.piggyValue += 3;
    if (allMissionsClaimed(s)) this.toast('오늘 미션 전부 완료!');
    this.persist();
    this.emit('structure');
    return true;
  }

  private grantReward(kind: 'cash' | 'boost' | 'blueprint', amount: number, business?: BusinessId): void {
    const s = this.state;
    if (kind === 'cash') {
      this.grantCash(amount);
      this.toast('보상 지급');
    } else if (kind === 'blueprint') {
      s.resources.blueprint += amount;
      s.prestige.blueprints += amount;
      this.toast(`${LEGACY.icon} ${LEGACY.name} +${amount}`);
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
    this.persist();
    this.emit('structure');
    return true;
  }

  // ── 미니게임 ──
  private refreshMinigameDay(id: BusinessId): void {
    const m = this.state.minigames[id];
    const day = todayKey(now());
    if (m.day !== day) {
      m.day = day;
      m.plays = 0;
      m.adPlays = 0;
    }
  }

  minigamePlaysLeft(id: BusinessId): number {
    this.refreshMinigameDay(id);
    return Math.max(0, CONFIG.minigame.freePlaysPerDay - this.state.minigames[id].plays);
  }

  minigameAdPlaysLeft(id: BusinessId): number {
    this.refreshMinigameDay(id);
    return Math.max(0, CONFIG.minigame.maxAdPlaysPerDay - this.state.minigames[id].adPlays);
  }

  async playMinigame(id: BusinessId): Promise<MinigameResult | null> {
    this.refreshMinigameDay(id);
    const m = this.state.minigames[id];
    if (this.minigamePlaysLeft(id) <= 0) {
      if (this.minigameAdPlaysLeft(id) <= 0) {
        this.toast('오늘 미니게임 횟수를 다 썼습니다');
        return null;
      }
      if (!(await this.watchAd('minigame'))) return null;
      m.adPlays += 1;
    } else {
      m.plays += 1;
    }
    const def = MINIGAMES[id];
    if (!def) return null;
    const result = await playMinigame(def, { reducedMotion: this.state.settings.reducedMotion });
    if (result) this.applyMinigameResult(id, result);
    this.persist();
    this.emit('structure');
    return result;
  }

  private applyMinigameResult(id: BusinessId, r: MinigameResult): void {
    const s = this.state;
    const def = this.def(id);
    const eff = projectedEfficiency(s, def);
    const rate = businessRatePerSecond(s, def).cash * eff;
    const seconds = CONFIG.minigame.rewardSeconds[id] ?? 3600;
    const bonus = 1 + (s.prestige.upgrades['minigame_bonus'] ?? 0) * 0.25;
    const reward = Math.max(200, rate * seconds * r.mult * bonus);
    r.reward = reward;
    this.grantCash(reward);

    const m = s.minigames[id];
    m.bestRate = Math.max(m.bestRate, r.rate);
    // 성공률 80% 이상 x2, 95% 이상 x3 · 30분
    if (r.rate >= 0.95) {
      m.boostMult = 3;
      m.boostUntil = now() + CONFIG.minigame.boostSeconds * 1000;
    } else if (r.rate >= 0.8) {
      m.boostMult = 2;
      m.boostUntil = now() + CONFIG.minigame.boostSeconds * 1000;
    }

    // 자동화로는 못 얻는 특산물
    const spoil = MINIGAME_SPOILS[id];
    const notes: string[] = [];
    if (spoil.counter === 'gem') {
      // 보석은 개수가 아니라 미니게임 안에서 정타로 캔 만큼만 나온다
      s.resources.gem += r.bonusItems;
      if (r.bonusItems > 0) notes.push(`${spoil.icon} ${spoil.label} +${r.bonusItems}`);
    } else if (spoil.counter) {
      const got = Math.max(1, Math.round(r.rate * 5));
      s.collection[spoil.counter] += got;
      notes.push(`${spoil.icon} ${spoil.label} +${got}`);
    }
    // 성적이 좋을수록 뒤쪽(희귀한) 것이 나온다
    if (spoil.list && spoil.names) {
      const idx = Math.min(spoil.names.length - 1, Math.floor(r.rate * spoil.names.length));
      const name = spoil.names[idx];
      const owned = s.collection[spoil.list];
      if (!owned.includes(name)) {
        owned.push(name);
        notes.push(`${spoil.icon} 새로 발견: ${name}`);
      }
    }
    if (notes.length) r.spoilText = notes.join(' · ');
    s.shop.piggyValue += 4;
    this.bump('minigamePlayed', 1);
    invalidateStats();
  }

  // ── 문명 전환 ──
  era(): EraDef {
    return currentEra(this.state);
  }
  nextEra(): EraDef {
    return nextEra(this.state);
  }
  isFinalEra(): boolean {
    return isFinalEra(this.state);
  }
  eraThreshold(): number {
    return eraThreshold(this.state);
  }
  eraProgress(): { current: number; need: number; ratio: number } {
    return eraProgress(this.state);
  }
  canAdvanceEra(): boolean {
    return canAdvanceEra(this.state);
  }
  legacyGain(): number {
    return legacyOnAdvance(this.state);
  }
  /** 도시를 전부 허물고 다음 문명으로. 성공하면 새 시대 정의를 돌려준다 */
  async doAdvanceEra(withAd: boolean): Promise<EraDef | null> {
    if (!this.canAdvanceEra()) return null;
    let gain = this.legacyGain();
    if (gain <= 0) return null;
    if (withAd && (await this.watchAd('prestigeBonus'))) {
      gain = Math.floor(gain * (1 + CONFIG.era.adBonus));
    }
    advanceEra(this.state, gain, now());
    sfx('era');
    this.emit('quake');
    invalidateStats();
    this.persist();
    this.emit('structure');
    const era = this.era();
    this.toast(`${era.name} 시작 — 유산 ${gain} 획득`);
    return era;
  }
  buyLegacy(id: string): boolean {
    const ok = buyLegacyUpgrade(this.state, id);
    if (ok) {
      invalidateStats();
      this.persist();
      this.emit('structure');
    }
    return ok;
  }

  // ── 상점 ──
  async purchase(id: IapId): Promise<boolean> {
    if (!this.purchases) return false;
    const ok = await this.purchases.purchase(`city_idle_${id}`);
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
        this.grantCash(Math.max(5000, rate * 7200));
        s.resources.blueprint += 5;
        s.prestige.blueprints += 5;
        this.grantReward('boost', 1800);
        break;
      case 'piggy':
        this.grantCash(Math.max(10000, rate * 28800));
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
        s.resources.blueprint += Math.max(10, Math.floor(CONFIG.era.baseGain * 1.5));
        break;
    }
  }

  piggyState(): { visible: boolean; ready: boolean; progress: number; goal: number } {
    return {
      visible: this.state.city.level >= 4,
      ready: piggyReady(this.state),
      progress: Math.min(1, this.state.shop.piggyValue / PIGGY_GOAL),
      goal: PIGGY_GOAL,
    };
  }

  /** 테스트용: 지금 상태를 N초 전에 저장한 것처럼 만든다 */
  devSetLastSeen(secondsAgo: number): void {
    const past = Date.now() - secondsAgo * 1000;
    setTimeSource({ now: () => past });
    save(this.state);
    setTimeSource(deviceTime);
  }

  devGrant(cash: number): void {
    this.state.resources.cash += cash;
    this.emit('structure');
  }
}
