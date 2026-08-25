import { BUSINESSES, BUSINESS_BY_ID } from '../data/businesses';
import { CONFIG } from '../data/config';
import { HOIST_LEVELS } from '../data/units';
import { eraCostMult, eraCycleMult } from './era';
import { cityStats, staffedUnits, type CityStats } from './facilities';
import { clamp, geometricCost, maxAffordable } from './num';
import type { BusinessDef, BusinessId, GameState, OfflineReport, ResourceId } from './types';

export const PRODUCER_OF: Partial<Record<ResourceId, BusinessId>> = {
  ore: 'mine',
  goods: 'factory',
  food: 'fishery',
  pop: 'park',
};

// 도시 능력치는 한 틱에 한 번만 계산한다
let statsCache: CityStats | null = null;
let staffCache: Record<string, number> | null = null;
let statsOwner: GameState | null = null;

export function invalidateStats(): void {
  statsCache = null;
  staffCache = null;
}

export function stats(state: GameState): CityStats {
  if (!statsCache || statsOwner !== state) {
    statsCache = cityStats(state);
    staffCache = staffedUnits(state, statsCache);
    statsOwner = state;
  }
  return statsCache;
}

/** 인구가 감당하는 유닛 수 (사업별) */
export function staffed(state: GameState, id: BusinessId): number {
  stats(state);
  return staffCache?.[id] ?? 0;
}

export function bpLevel(state: GameState, id: string): number {
  return state.prestige.upgrades[id] ?? 0;
}

// ── 마일스톤 ────────────────────────────────────────────────
export function milestoneBonus(level: number): { output: number; speed: number } {
  let out = 0;
  for (const m of CONFIG.milestones) if (level >= m) out++;
  let half = 0;
  for (const m of CONFIG.cycleHalfLevels) if (level >= m) half++;
  return { output: Math.pow(2, out), speed: Math.pow(2, half) };
}

export function nextMilestone(level: number): number | null {
  for (const m of CONFIG.milestones) if (level < m) return m;
  return null;
}

// ── 배율 ────────────────────────────────────────────────────
export function hoistMult(state: GameState, id: BusinessId): number {
  const lv = clamp(state.businesses[id].hoistLevel, 1, HOIST_LEVELS.length);
  return HOIST_LEVELS[lv - 1].mult;
}

/** 보석 요구량 (광산 상세: 보석은 엘리베이터 업그레이드 재료) */
export function hoistGemCost(state: GameState, id: BusinessId): number {
  const lv = state.businesses[id].hoistLevel;
  if (lv >= HOIST_LEVELS.length) return 0;
  return Math.max(0, (lv - 2) * 2);
}

export function hoistCost(state: GameState, id: BusinessId): number {
  const def = BUSINESS_BY_ID[id];
  const lv = state.businesses[id].hoistLevel;
  if (lv >= HOIST_LEVELS.length) return Infinity;
  return HOIST_LEVELS[lv].cost * def.costScale * eraCostMult(state);
}

export function isBoosted(state: GameState, id: BusinessId, now = Date.now()): boolean {
  return state.businesses[id].boostUntil > now;
}

export function minigameMultiplier(state: GameState, id: BusinessId, now = Date.now()): number {
  const m = state.minigames[id];
  if (!m || m.boostUntil <= now) return 1;
  return m.boostMult;
}

export function eventPenalty(state: GameState, id: BusinessId, now = Date.now()): number {
  let p = 1;
  for (const e of state.events) {
    if (e.kind === 'fire' && e.target === id && e.until > now) p *= 1 - e.severity;
  }
  return p;
}

const BP_BOOST: Record<BusinessId, string> = {
  mine: 'boostMine',
  factory: 'boostFactory',
  fishery: 'boostFishery',
  park: 'boostPark',
  corp: 'boostCorp',
};

export function businessMultiplier(state: GameState, def: BusinessDef, now = Date.now()): number {
  const cs = stats(state);
  let m = 1;
  m *= 1 + bpLevel(state, 'output_bonus') * 0.1;
  const own = BP_BOOST[def.id];
  if (own) m *= 1 + bpLevel(state, own) * 0.5;
  m *= cs.outputMult; // 학교
  m *= cs.powerEff; // 발전소
  m *= hoistMult(state, def.id); // 엘리베이터 등 공통 배율
  m *= minigameMultiplier(state, def.id, now);
  m *= eventPenalty(state, def.id, now);
  if (isBoosted(state, def.id, now)) m *= CONFIG.ads.boostFactor;
  return m;
}

export function outputPerCycle(state: GameState, def: BusinessDef, index: number, now = Date.now()): number {
  const u = state.businesses[def.id].units[index];
  if (!u.unlocked || u.level <= 0) return 0;
  const d = def.units[index];
  const ms = milestoneBonus(u.level);
  return d.baseOutput * u.level * ms.output * businessMultiplier(state, def, now);
}

export function cycleTime(state: GameState, def: BusinessDef, index: number): number {
  const u = state.businesses[def.id].units[index];
  const ms = milestoneBonus(u.level);
  // 문명이 넘어갈수록 한 사이클이 느려진다
  return Math.max(CONFIG.minCycleTime, (def.units[index].cycleTime * eraCycleMult(state)) / ms.speed);
}

export function unitUnlockCost(state: GameState, def: BusinessDef, index: number): number {
  return def.units[index].unlockCost * eraCostMult(state);
}

export function unitCost(state: GameState, def: BusinessDef, index: number, count = 1): number {
  const u = state.businesses[def.id].units[index];
  const d = def.units[index];
  return geometricCost(d.baseCost * eraCostMult(state), d.costGrowth, Math.max(0, u.level - 1), count);
}

export function unitMaxAffordable(state: GameState, def: BusinessDef, index: number): number {
  const u = state.businesses[def.id].units[index];
  const d = def.units[index];
  return maxAffordable(d.baseCost * eraCostMult(state), d.costGrowth, Math.max(0, u.level - 1), state.resources.cash);
}

export function managerCost(state: GameState, def: BusinessDef, index: number): number {
  return def.units[index].managerCost * eraCostMult(state);
}

export function equipCost(state: GameState, def: BusinessDef, index: number): number {
  return managerCost(state, def, index) * 0.15;
}

// ── 자동화 4단계 ────────────────────────────────────────────
export function autoFactor(state: GameState, id: BusinessId, index: number, now = Date.now()): number {
  const bs = state.businesses[id];
  const u = bs.units[index];
  if (u.manager || bs.trialUntil > now) return 1 + bpLevel(state, 'overclock') * 0.05;
  if (u.equip) return 0.5;
  return 0;
}

export function automationStage(state: GameState, id: BusinessId, index: number): 1 | 2 | 3 | 4 {
  const u = state.businesses[id].units[index];
  if (u.manager) return bpLevel(state, 'overclock') > 0 ? 4 : 3;
  if (u.equip) return 2;
  return 1;
}

// ── 자원 사슬 ───────────────────────────────────────────────
export function chainActive(state: GameState): boolean {
  return state.city.level >= CONFIG.chainStartLevel;
}

export function chainFloor(state: GameState): number {
  return clamp(CONFIG.chainIdleFloor + bpLevel(state, 'chainFloor') * 0.05, 0, 1);
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
  const staff = staffed(state, def.id);
  for (let i = 0; i < def.units.length; i++) {
    const u = bs.units[i];
    if (!u.unlocked || u.level <= 0 || i >= staff) continue;
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
    sum += businessRatePerSecond(state, def, now, onlyAutomated).cash * projectedEfficiency(state, def, now);
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
  const target = cs.popCap;
  const speed = CONFIG.facility.popGrowthBase * cs.popGrowthMult * (1 + state.city.level * 0.1);
  if (state.city.pop < target) state.city.pop = Math.min(target, state.city.pop + speed * dt);
  else if (state.city.pop > target) state.city.pop = Math.max(target, state.city.pop - speed * dt);
}

export function tickBusinesses(state: GameState, dt: number, now = Date.now()): number {
  invalidateStats();
  const cashBefore = state.resources.cash;
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    const bs = state.businesses[def.id];
    const staff = staffed(state, def.id);
    for (let i = 0; i < def.units.length; i++) {
      const u = bs.units[i];
      if (!u.unlocked || u.level <= 0) continue;
      if (i >= staff) {
        u.running = false;
        continue;
      }
      const af = autoFactor(state, def.id, i, now);
      if (!u.running && af > 0) u.running = true;
      if (!u.running) continue;
      const ct = cycleTime(state, def, i);
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

// ── 오프라인 ────────────────────────────────────────────────
export function offlineCapSeconds(state: GameState): number {
  const base = CONFIG.offline.baseCapHours;
  const lv = state.city.capLevel;
  const hours = lv > 0 ? CONFIG.offline.capHours[lv - 1] : base;
  return (hours + bpLevel(state, 'offline_cap') * 2) * 3600;
}

export function offlineRate(state: GameState): number {
  const lv = state.city.effLevel;
  return lv > 0 ? CONFIG.offline.effRates[lv - 1] : CONFIG.offline.baseRate;
}

export function offlineUpgradeCost(level: number): number {
  return CONFIG.offline.upgradeCost[level] ?? Infinity;
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
    const staff = staffed(state, def.id);
    for (let i = 0; i < def.units.length; i++) {
      const u = bs.units[i];
      if (!u.unlocked || u.level <= 0 || i >= staff) continue;
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
