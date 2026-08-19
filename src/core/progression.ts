import { BLUEPRINT_BY_ID, BLUEPRINT_UPGRADES } from '../data/blueprints';
import { BUSINESSES } from '../data/businesses';
import { MAX_CITY_LEVEL, cityRequirement, cityUnlockText } from '../data/buildings';
import { CONFIG } from '../data/config';
import type { BusinessDef, GameState } from './types';

export { cityRequirement, cityUnlockText };

export function cityProgress(state: GameState): { current: number; need: number; ratio: number } {
  const lo = cityRequirement(state.city.level);
  const hi = cityRequirement(state.city.level + 1);
  const cur = Math.max(0, state.city.taxRun - lo);
  const need = Math.max(1, hi - lo);
  return { current: cur, need, ratio: Math.min(1, cur / need) };
}

/** 세수 누적으로 오를 수 있는 만큼 도시 레벨을 올린다 */
export function applyCityLevelUps(state: GameState): BusinessDef[] {
  const unlocked: BusinessDef[] = [];
  while (state.city.level < MAX_CITY_LEVEL && state.city.taxRun >= cityRequirement(state.city.level + 1)) {
    state.city.level += 1;
    for (const def of BUSINESSES) if (def.unlockCityLevel === state.city.level) unlocked.push(def);
  }
  return unlocked;
}

// ── 재개발 ──────────────────────────────────────────────────
/** 설계도 = floor( sqrt( 누적세수 / 1,000,000 ) ) */
export function blueprintsOnPrestige(state: GameState): number {
  return Math.floor(Math.sqrt(Math.max(0, state.city.taxRun) / CONFIG.prestige.divisor));
}

/** 재개발 해금: 도시 Lv.11 도달분의 누적 세수 (기획서 9장 '1주차 첫 재개발') */
export function prestigeThreshold(): number {
  return Math.max(CONFIG.prestige.minTax, cityRequirement(11));
}

export function canPrestige(state: GameState): boolean {
  return state.city.taxRun >= prestigeThreshold();
}

/** 비용은 구매할 때마다 x1.5 */
export function blueprintUpgradeCost(state: GameState, id: string): number {
  const def = BLUEPRINT_BY_ID[id];
  if (!def) return Infinity;
  const lv = state.prestige.upgrades[id] ?? 0;
  if (lv >= def.maxLevel) return Infinity;
  return Math.ceil(def.baseCost * Math.pow(1.5, lv));
}

export function buyBlueprintUpgrade(state: GameState, id: string): boolean {
  const cost = blueprintUpgradeCost(state, id);
  if (!isFinite(cost) || state.resources.blueprint < cost) return false;
  state.resources.blueprint -= cost;
  state.prestige.upgrades[id] = (state.prestige.upgrades[id] ?? 0) + 1;
  return true;
}

export function visibleBlueprintUpgrades(_state: GameState) {
  return BLUEPRINT_UPGRADES;
}
