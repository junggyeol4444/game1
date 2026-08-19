import { BUSINESSES, BUSINESS_BY_ID } from '../data/businesses';
import { CONFIG } from '../data/config';
import { cityStats, type CityStats } from './facilities';
import { clamp, geometricCost, maxAffordable } from './num';
import type { BusinessDef, BusinessId, GameState, OfflineReport, ResourceId } from './types';

/** 어떤 사업이 어떤 자원을 만드는가 (사슬 역참조용) */
export const PRODUCER_OF: Partial<Record<ResourceId, BusinessId>> = {
  ore: 'mine',
  goods: 'factory',
  food: 'fishery',
  pop: 'park',
};

// 도시 능력치는 한 틱에 한 번만 계산한다 (유닛마다 다시 계산하면 시뮬레이터가 죽는다)
let statsCache: CityStats | null = null;
let statsOwner: GameState | null = null;

export function invalidateStats(): void {
  statsCache = null;
}

export function stats(state: GameState): CityStats {
  if (!statsCache || statsOwner !== state) {
    statsCache = cityStats(state);
    statsOwner = state;
  }
  return statsCache;
}

export function bpLevel(state: GameState, id: string): number {
  return state.prestige.upgrades[id] ?? 0;
}

/** 인구 노동력 배율 (도시 인구 기반) */
export function laborMultiplier(state: GameState): number {
  return 1 + CONFIG.laborCoef * Math.log10(1 + Math.max(0, state.city.pop));
}

export function milestoneBonus(level: number): { output: number; speed: number } {
  let output = 1;
  let speed = 1;
  for (const m of CONFIG.milestones) {
    if (level >= m.level) {
      if (m.type === 'output') output *= m.factor;
      else speed *= m.factor;
    }
  }
  return { output, speed };
}

export function nextMilestone(level: number): { level: number; type: string; factor: number } | null {
  for (const m of CONFIG.milestones) if (level < m.level) return { ...m };
  return null;
}

export function isBoosted(state: GameState, id: BusinessId, now = Date.now()): boolean {
  return state.businesses[id].boostUntil > now;
}

/** 미니게임 성적 배율 (일정 시간 유지) */
export function minigameMultiplier(state: GameState, id: BusinessId, now = Date.now()): number {
  const m = state.minigames[id];
  if (!m || m.boostUntil <= now) return 1;
  return m.boostMult;
}

/** 화재 중이면 산출이 깎인다 */
export function eventPenalty(state: GameState, id: BusinessId, now = Date.now()): number {
  let p = 1;
  for (const e of state.events) {
    if (e.kind === 'fire' && e.target === id && e.until > now) p *= 1 - e.severity;
  }
  return p;
}

const BLUEPRINT_BOOST_ID: Record<BusinessId, string> = {
  mine: 'boostMine',
  factory: 'boostFactory',
  fishery: 'boostFishery',
  park: 'boostPark',
  corp: 'boostCorp',
};

/** 사업 전체에 걸리는 배율 (마일스톤 제외) */
export function businessMultiplier(state: GameState, def: BusinessDef, now = Date.now()): number {
  const cs = stats(state);
  let m = 1;
  m *= 1 + bpLevel(state, 'allOutput') * 0.25;
  const own = BLUEPRINT_BOOST_ID[def.id];
  if (own) m *= 1 + bpLevel(state, own) * 0.5;
  m *= laborMultiplier(state);
  m *= cs.outputMult;        // 학교
  m *= cs.powerEff;          // 발전소
  m *= cs.laborEff;          // 주거지 + 병원
  m *= minigameMultiplier(state, def.id, now);
  m *= eventPenalty(state, def.id, now);
  if (isBoosted(state, def.id, now)) m *= CONFIG.ads.boostFactor;
  return m;
}

export function outputPerCycle(state: GameState, def: BusinessDef, index: number, now = Date.now()): number {
  const u = state.businesses[def.id].units[index];
  if (u.level <= 0) return 0;
  const d = def.units[index];
  const ms = milestoneBonus(u.level);
  return d.baseOutput * def.outScale * u.level * ms.output * businessMultiplier(state, def, now);
}

export function cycleTime(state: GameState, def: BusinessDef, index: number): number {
  const u = state.businesses[def.id].units[index];
  const ms = milestoneBonus(u.level);
  const bpSpeed = Math.pow(0.95, bpLevel(state, 'cycleSpeed'));
  return Math.max(CONFIG.minCycleTime, (def.units[index].cycleTime * bpSpeed) / ms.speed);
}

export function unitCost(state: GameState, def: BusinessDef, index: number, count = 1): number {
  const u = state.businesses[def.id].units[index];
  const d = def.units[index];
  return geometricCost(d.baseCost * def.costScale, d.costGrowth, u.level, count);
}

export function unitMaxAffordable(state: GameState, def: BusinessDef, index: number): number {
  const u = state.businesses[def.id].units[index];
  const d = def.units[index];
  return maxAffordable(d.baseCost * def.costScale, d.costGrowth, u.level, state.resources.cash);
}

export function managerCost(def: BusinessDef, index: number): number {
  return def.units[index].managerCost * def.costScale;
}

/** 설비(반자동)는 매니저보다 훨씬 싸다 */
export function equipCost(def: BusinessDef, index: number): number {
  return def.units[index].managerCost * def.costScale * 0.15;
}

// ───────────────────────── 자동화 4단계 ─────────────────────────
// 0 = 수동(미니게임/탭) · 0.5 = 설비 · 1.0 = 매니저 · 1.0+ = 고효율

export function autoFactor(state: GameState, id: BusinessId, index: number, now = Date.now()): number {
  const bs = state.businesses[id];
  const u = bs.units[index];
  if (u.manager || bs.trialUntil > now) return 1 + bpLevel(state, 'overclock') * 0.05;
  if (u.equip) return 0.5;
  return 0;
}

export function isAutomated(state: GameState, id: BusinessId, index: number, now = Date.now()): boolean {
  return autoFactor(state, id, index, now) > 0;
}

export function automationStage(state: GameState, id: BusinessId, index: number): 1 | 2 | 3 | 4 {
  const u = state.businesses[id].units[index];
  if (u.manager) return bpLevel(state, 'overclock') > 0 ? 4 : 3;
  if (u.equip) return 2;
  return 1;
}

// ───────────────────────── 자원 사슬 ─────────────────────────

export function chainActive(state: GameState): boolean {
  return state.city.level >= CONFIG.chainStartLevel;
}

export function chainFloor(state: GameState): number {
  return clamp(
    CONFIG.chainIdleFloor + bpLevel(state, 'chainFloor') * 0.05 + stats(state).chainFloorBonus,
    0,
    1,
  );
}

function consumeInput(state: GameState, def: BusinessDef, producedPoints: number): number {
  if (!def.input || !chainActive(state)) return 1;
  const upstreamId = PRODUCER_OF[def.input.resource];
  if (!upstreamId) return 1;
  const upstream = BUSINESS_BY_ID[upstreamId];
  const need = def.input.ratio * producedPoints * upstream.outScale * stats(state).chainDemandMult;
  if (need <= 0) return 1;
  const have = state.resources[def.input.resource];
  const take = Math.min(have, need);
  state.resources[def.input.resource] = have - take;
  return Math.max(take / need, chainFloor(state));
}

export function projectedEfficiency(state: GameState, def: BusinessDef, now = Date.now()): number {
  if (!def.input || !chainActive(state)) return 1;
  const upstreamId = PRODUCER_OF[def.input.resource];
  if (!upstreamId) return 1;
  const upstream = BUSINESS_BY_ID[upstreamId];
  const demand =
    pointsPerSecond(state, def, now) * def.input.ratio * upstream.outScale * stats(state).chainDemandMult;
  if (demand <= 0) return 1;
  const supply = businessRatePerSecond(state, upstream, now).amount;
  const stock = state.resources[def.input.resource];
  const covered = stock > demand * 5 ? 1 : supply / demand;
  return clamp(Math.max(covered, chainFloor(state)), 0, 1);
}

export function businessRatePerSecond(
  state: GameState,
  def: BusinessDef,
  now = Date.now(),
  onlyAutomated = false,
): { amount: number; cash: number } {
  let amount = 0;
  const bs = state.businesses[def.id];
  for (let i = 0; i < def.units.length; i++) {
    const u = bs.units[i];
    if (u.level <= 0) continue;
    const af = autoFactor(state, def.id, i, now);
    if (onlyAutomated && af <= 0) continue;
    const rate = onlyAutomated ? af : Math.max(af, 1);
    amount += (outputPerCycle(state, def, i, now) / cycleTime(state, def, i)) * rate;
  }
  return { amount, cash: amount * def.price };
}

export function pointsPerSecond(state: GameState, def: BusinessDef, now = Date.now()): number {
  return businessRatePerSecond(state, def, now).amount / def.outScale;
}

export function totalCashPerSecond(state: GameState, now = Date.now(), onlyAutomated = false): number {
  let sum = 0;
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    const eff = projectedEfficiency(state, def, now);
    sum += businessRatePerSecond(state, def, now, onlyAutomated).cash * eff;
  }
  return sum;
}

export function isUnlocked(state: GameState, def: BusinessDef): boolean {
  return state.city.level >= def.unlockCityLevel;
}

export interface ProduceResult {
  cash: number;
  amount: number;
  efficiency: number;
}

export function produce(
  state: GameState,
  def: BusinessDef,
  index: number,
  cycles: number,
  now = Date.now(),
): ProduceResult {
  if (cycles <= 0) return { cash: 0, amount: 0, efficiency: 1 };
  const gross = outputPerCycle(state, def, index, now) * cycles;
  if (gross <= 0) return { cash: 0, amount: 0, efficiency: 1 };
  const eff = consumeInput(state, def, gross / def.outScale);
  const amount = gross * eff;
  const cash = amount * def.price;

  if (def.output === 'cash') state.resources.cash += cash;
  else {
    state.resources[def.output] += amount;
    state.resources.cash += cash;
  }
  // 건설 물자 적립 (생산 포인트 기준)
  state.resources.material += (amount / def.outScale) * (CONFIG.materialYield[def.id] ?? 0);

  state.businesses[def.id].totalProduced += amount;
  state.stats.cashEarnedRun += cash;
  state.stats.cashEarnedTotal += cash;
  const tax = cash * CONFIG.taxRate * stats(state).taxMult;
  state.city.taxRun += tax;
  state.city.taxTotal += tax;
  return { cash, amount, efficiency: eff };
}

/** 인구는 주거지 상한까지 서서히 유입된다 (공원이 속도) */
export function tickPopulation(state: GameState, dt: number): void {
  const cs = stats(state);
  const tourists = state.resources.pop;
  const target = Math.min(cs.popCap, CONFIG.facility.popBase + tourists);
  if (state.city.pop < target) {
    state.city.pop = Math.min(target, state.city.pop + cs.popGrowthPerSec * dt * (1 + state.city.level * 0.05));
  } else if (state.city.pop > target) {
    state.city.pop = Math.max(target, state.city.pop - cs.popGrowthPerSec * dt);
  }
}

export function tickBusinesses(state: GameState, dt: number, now = Date.now()): number {
  invalidateStats();
  const cashBefore = state.resources.cash;
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    const bs = state.businesses[def.id];
    for (let i = 0; i < def.units.length; i++) {
      const u = bs.units[i];
      if (u.level <= 0) continue;
      const af = autoFactor(state, def.id, i, now);
      if (!u.running && af > 0) u.running = true;
      if (!u.running) continue;
      const ct = cycleTime(state, def, i);
      // 수동으로 돌린 사이클은 항상 100% 속도, 자동은 자동화 단계 속도
      u.progress += dt * (af > 0 ? af : 1);
      if (u.progress < ct) continue;
      if (af > 0) {
        const n = Math.floor(u.progress / ct);
        u.progress -= n * ct;
        produce(state, def, i, n, now);
      } else {
        u.progress = 0;
        u.running = false;
        produce(state, def, i, 1, now);
      }
    }
  }
  tickPopulation(state, dt);
  return state.resources.cash - cashBefore;
}

export function offlineCapSeconds(state: GameState): number {
  const hours =
    CONFIG.offline.baseCapHours +
    state.city.storageLevel * CONFIG.offline.capPerStorage +
    bpLevel(state, 'offlineCap') * 2;
  return hours * 3600;
}

export function offlineRate(state: GameState): number {
  return clamp(
    CONFIG.offline.baseRate +
      state.city.logisticsLevel * CONFIG.offline.ratePerLogistics +
      bpLevel(state, 'offlineRate') * 0.05 +
      stats(state).offlineBonus,
    0,
    1,
  );
}

export function computeOffline(state: GameState, seconds: number, now = Date.now()): OfflineReport {
  invalidateStats();
  const capped = Math.min(Math.max(0, seconds), offlineCapSeconds(state));
  const rate = offlineRate(state);
  const perBusiness: { id: BusinessId; cash: number }[] = [];
  let total = 0;

  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    let gross = 0;
    const bs = state.businesses[def.id];
    for (let i = 0; i < def.units.length; i++) {
      const u = bs.units[i];
      if (u.level <= 0) continue;
      // 오프라인은 설비/매니저만 (체험 매니저는 이미 만료)
      const af = u.manager ? 1 + bpLevel(state, 'overclock') * 0.05 : u.equip ? 0.5 : 0;
      if (af <= 0) continue;
      gross += (outputPerCycle(state, def, i, now) / cycleTime(state, def, i)) * capped * af;
    }
    gross *= rate;
    if (gross <= 0) {
      perBusiness.push({ id: def.id, cash: 0 });
      continue;
    }
    const eff = consumeInput(state, def, gross / def.outScale);
    const amount = gross * eff;
    const cash = amount * def.price;
    if (def.output === 'cash') state.resources.cash += cash;
    else {
      state.resources[def.output] += amount;
      state.resources.cash += cash;
    }
    state.resources.material += (amount / def.outScale) * (CONFIG.materialYield[def.id] ?? 0);
    state.businesses[def.id].totalProduced += amount;
    total += cash;
    perBusiness.push({ id: def.id, cash });
  }

  state.stats.cashEarnedRun += total;
  state.stats.cashEarnedTotal += total;
  const tax = total * CONFIG.taxRate * stats(state).taxMult;
  state.city.taxRun += tax;
  state.city.taxTotal += tax;

  return { seconds, cappedSeconds: capped, cash: total, perBusiness };
}
