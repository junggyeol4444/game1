import { BUSINESSES, BUSINESS_BY_ID } from '../data/businesses';
import { CONFIG } from '../data/config';
import { clamp, geometricCost, maxAffordable } from './num';
import type {
  BusinessDef,
  BusinessId,
  GameState,
  OfflineReport,
  ResourceId,
} from './types';

/** 어떤 사업이 어떤 자원을 만드는가 (사슬 역참조용) */
export const PRODUCER_OF: Partial<Record<ResourceId, BusinessId>> = {
  ore: 'mine',
  goods: 'factory',
  food: 'fishery',
  pop: 'park',
};

export function bpLevel(state: GameState, id: string): number {
  return state.prestige.upgrades[id] ?? 0;
}

/** 인구 노동력 배율 */
export function laborMultiplier(state: GameState): number {
  return 1 + CONFIG.laborCoef * Math.log10(1 + Math.max(0, state.resources.pop));
}

/** 유닛 레벨로 달성한 마일스톤 보너스 */
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

/** 자동 가동 여부 (매니저 또는 광고 체험) */
export function isAutomated(state: GameState, id: BusinessId, index: number, now = Date.now()): boolean {
  const bs = state.businesses[id];
  return bs.units[index].manager || bs.trialUntil > now;
}

export function isBoosted(state: GameState, id: BusinessId, now = Date.now()): boolean {
  return state.businesses[id].boostUntil > now;
}

/** 사업 전체에 걸리는 배율 (마일스톤 제외) */
export function businessMultiplier(state: GameState, def: BusinessDef, now = Date.now()): number {
  let m = 1;
  m *= 1 + bpLevel(state, 'allOutput') * 0.25;
  const own = BLUEPRINT_BOOST_ID[def.id];
  if (own) m *= 1 + bpLevel(state, own) * 0.5;
  m *= laborMultiplier(state);
  if (isBoosted(state, def.id, now)) m *= CONFIG.ads.boostFactor;
  return m;
}

const BLUEPRINT_BOOST_ID: Record<BusinessId, string> = {
  mine: 'boostMine',
  factory: 'boostFactory',
  fishery: 'boostFishery',
  park: 'boostPark',
  corp: 'boostCorp',
};

/** 유닛 1사이클 산출량(자원 단위) */
export function outputPerCycle(
  state: GameState,
  def: BusinessDef,
  index: number,
  now = Date.now(),
): number {
  const u = state.businesses[def.id].units[index];
  if (u.level <= 0) return 0;
  const d = def.units[index];
  const ms = milestoneBonus(u.level);
  return d.baseOutput * def.outScale * u.level * ms.output * businessMultiplier(state, def, now);
}

/** 유닛 사이클 시간(초) */
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

/** 사슬이 실제로 작동 중인가 */
export function chainActive(state: GameState): boolean {
  return state.city.level >= CONFIG.chainStartLevel;
}

export function chainFloor(state: GameState): number {
  return clamp(CONFIG.chainIdleFloor + bpLevel(state, 'chainFloor') * 0.05, 0, 1);
}

/**
 * 상위 자원을 소비하고 실제 가동률을 돌려준다.
 * 자원이 모자라도 chainFloor 만큼은 돌아간다 (기획: 느슨한 병목).
 */
function consumeInput(state: GameState, def: BusinessDef, producedPoints: number): number {
  if (!def.input || !chainActive(state)) return 1;
  const upstreamId = PRODUCER_OF[def.input.resource];
  if (!upstreamId) return 1;
  const upstream = BUSINESS_BY_ID[upstreamId];
  const need = def.input.ratio * producedPoints * upstream.outScale;
  if (need <= 0) return 1;
  const have = state.resources[def.input.resource];
  const take = Math.min(have, need);
  state.resources[def.input.resource] = have - take;
  return Math.max(take / need, chainFloor(state));
}

/** 현재 상위 자원 상황에서 예상되는 가동률 (표시용, 소비 없음) */
export function projectedEfficiency(state: GameState, def: BusinessDef, now = Date.now()): number {
  if (!def.input || !chainActive(state)) return 1;
  const upstreamId = PRODUCER_OF[def.input.resource];
  if (!upstreamId) return 1;
  const upstream = BUSINESS_BY_ID[upstreamId];
  const demand = pointsPerSecond(state, def, now) * def.input.ratio * upstream.outScale;
  if (demand <= 0) return 1;
  const supply = businessRatePerSecond(state, upstream, now).amount;
  const stock = state.resources[def.input.resource];
  const covered = stock > demand * 5 ? 1 : supply / demand;
  return clamp(Math.max(covered, chainFloor(state)), 0, 1);
}

/** 자동화된(매니저 있는) 유닛 기준 초당 자원 산출 + 초당 현금 */
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
    if (onlyAutomated && !u.manager) continue;
    amount += outputPerCycle(state, def, i, now) / cycleTime(state, def, i);
  }
  return { amount, cash: amount * def.price };
}

/** 스케일 정규화된 생산 포인트(초당) — 사슬 비교용 */
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

/** 사이클 n회 완료 처리 */
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

  if (def.output === 'cash') {
    state.resources.cash += cash;
  } else {
    state.resources[def.output] += amount;
    state.resources.cash += cash;
  }
  state.businesses[def.id].totalProduced += amount;
  state.stats.cashEarnedRun += cash;
  state.stats.cashEarnedTotal += cash;
  const tax = cash * CONFIG.taxRate;
  state.city.taxRun += tax;
  state.city.taxTotal += tax;
  return { cash, amount, efficiency: eff };
}

/** 프레임 진행. dt는 초. */
export function tickBusinesses(state: GameState, dt: number, now = Date.now()): number {
  const cashBefore = state.resources.cash;
  for (const def of BUSINESSES) {
    if (!isUnlocked(state, def)) continue;
    const bs = state.businesses[def.id];
    for (let i = 0; i < def.units.length; i++) {
      const u = bs.units[i];
      if (u.level <= 0) continue;
      const auto = isAutomated(state, def.id, i, now);
      if (!u.running && auto) u.running = true;
      if (!u.running) continue;
      const ct = cycleTime(state, def, i);
      u.progress += dt;
      if (u.progress < ct) continue;
      if (auto) {
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
      bpLevel(state, 'offlineRate') * 0.05,
    0,
    1,
  );
}

/**
 * 오프라인 수익. 자동화(매니저)된 유닛만 계산한다.
 * 사업 배열이 이미 위상 순서(광산->공장->어항->놀이공원->기업)이므로
 * 앞에서부터 처리하면 상위 자원이 먼저 쌓인 뒤 하위가 소비한다.
 */
export function computeOffline(state: GameState, seconds: number, now = Date.now()): OfflineReport {
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
      if (u.level <= 0 || !u.manager) continue;
      gross += (outputPerCycle(state, def, i, now) / cycleTime(state, def, i)) * capped;
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
    state.businesses[def.id].totalProduced += amount;
    total += cash;
    perBusiness.push({ id: def.id, cash });
  }

  state.stats.cashEarnedRun += total;
  state.stats.cashEarnedTotal += total;
  const tax = total * CONFIG.taxRate;
  state.city.taxRun += tax;
  state.city.taxTotal += tax;

  return { seconds, cappedSeconds: capped, cash: total, perBusiness };
}
