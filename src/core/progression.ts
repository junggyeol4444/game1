import { BLUEPRINT_BY_ID, BLUEPRINT_UPGRADES } from '../data/blueprints';
import { BUSINESSES } from '../data/businesses';
import { CONFIG } from '../data/config';
import { geometricCost } from './num';
import type { BusinessDef, GameState } from './types';

/** 도시 레벨 L 에 도달하기 위한 누적 세수 */
export function cumulativeTaxForLevel(level: number): number {
  const { base, growth } = CONFIG.cityLevel;
  if (level <= 1) return 0;
  return (base * (Math.pow(growth, level - 1) - 1)) / (growth - 1);
}

export function cityProgress(state: GameState): { current: number; need: number; ratio: number } {
  const lo = cumulativeTaxForLevel(state.city.level);
  const hi = cumulativeTaxForLevel(state.city.level + 1);
  const cur = Math.max(0, state.city.taxRun - lo);
  const need = Math.max(1, hi - lo);
  return { current: cur, need, ratio: Math.min(1, cur / need) };
}

/** 세수 누적으로 오를 수 있는 만큼 도시 레벨을 올리고, 새로 해금된 사업을 돌려준다. */
export function applyCityLevelUps(state: GameState): BusinessDef[] {
  const unlocked: BusinessDef[] = [];
  while (
    state.city.level < CONFIG.cityLevel.max &&
    state.city.taxRun >= cumulativeTaxForLevel(state.city.level + 1)
  ) {
    state.city.level += 1;
    for (const def of BUSINESSES) {
      if (def.unlockCityLevel === state.city.level) unlocked.push(def);
    }
  }
  return unlocked;
}

/** 도시 외관 단계 (0~5). 도시 화면 스카이라인에 반영 */
export function cityTier(level: number): number {
  if (level >= 30) return 5;
  if (level >= 22) return 4;
  if (level >= 16) return 3;
  if (level >= 10) return 2;
  if (level >= 5) return 1;
  return 0;
}

// ---------- 도시 시설 업그레이드 (현금) ----------

export function storageCost(state: GameState): number {
  return geometricCost(
    CONFIG.offline.storageBaseCost,
    CONFIG.offline.storageCostGrowth,
    state.city.storageLevel,
    1,
  );
}

export function logisticsCost(state: GameState): number {
  return geometricCost(
    CONFIG.offline.logisticsBaseCost,
    CONFIG.offline.logisticsCostGrowth,
    state.city.logisticsLevel,
    1,
  );
}

// ---------- 재개발(프레스티지) ----------

export function canPrestige(state: GameState): boolean {
  return state.city.level >= CONFIG.prestige.unlockCityLevel;
}

export function blueprintsOnPrestige(state: GameState): number {
  const { coef, divisor, exponent } = CONFIG.prestige;
  const earned = state.stats.cashEarnedRun;
  if (earned <= divisor) return 0;
  return Math.floor(coef * Math.pow(earned / divisor, exponent));
}

export function blueprintUpgradeCost(state: GameState, id: string): number {
  const def = BLUEPRINT_BY_ID[id];
  if (!def) return Infinity;
  const lv = state.prestige.upgrades[id] ?? 0;
  if (lv >= def.maxLevel) return Infinity;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, lv));
}

export function buyBlueprintUpgrade(state: GameState, id: string): boolean {
  const cost = blueprintUpgradeCost(state, id);
  if (!isFinite(cost) || state.resources.blueprint < cost) return false;
  state.resources.blueprint -= cost;
  state.prestige.upgrades[id] = (state.prestige.upgrades[id] ?? 0) + 1;
  return true;
}

export function visibleBlueprintUpgrades(state: GameState) {
  return BLUEPRINT_UPGRADES.filter((u) => {
    if (!u.business) return true;
    const def = BUSINESSES.find((b) => b.id === u.business)!;
    // 한 번이라도 해금해 본 사업만 노출
    return state.city.taxTotal > 0 && (state.city.level >= def.unlockCityLevel || state.prestige.count > 0);
  });
}
