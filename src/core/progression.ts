import { LEGACY_BY_ID, LEGACY_UPGRADES } from '../data/legacy';
import { BUSINESSES } from '../data/businesses';
import { MAX_CITY_LEVEL, cityRequirement, cityUnlockText } from '../data/buildings';
import type { BusinessDef, GameState } from './types';
import { MAX_ERA } from '../data/eras';
import { applyEraReset } from './state';

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

// ── 문명 전환 ──────────────────────────────────────────────
export {
  canAdvanceEra,
  eraProgress,
  eraThreshold,
  legacyOnAdvance,
  isFinalEra,
  currentEra,
  nextEra,
} from './era';

/**
 * 도시를 전부 허물고 다음 문명으로 넘어간다.
 * 시대는 마지막(우주)까지만 오르고, 그 뒤로는 같은 시대를 목표를 올려가며 다시 세운다.
 */
export function advanceEra(state: GameState, gained: number, now = Date.now()): number {
  const before = state.era;
  state.era = Math.min(MAX_ERA, before + 1);
  applyEraReset(state, gained, now);
  return state.era;
}

/** 비용은 구매할 때마다 x1.5 */
export function legacyUpgradeCost(state: GameState, id: string): number {
  const def = LEGACY_BY_ID[id];
  if (!def) return Infinity;
  const lv = state.prestige.upgrades[id] ?? 0;
  if (lv >= def.maxLevel) return Infinity;
  return Math.ceil(def.baseCost * Math.pow(1.5, lv));
}

export function buyLegacyUpgrade(state: GameState, id: string): boolean {
  const cost = legacyUpgradeCost(state, id);
  if (!isFinite(cost) || state.resources.blueprint < cost) return false;
  state.resources.blueprint -= cost;
  state.prestige.upgrades[id] = (state.prestige.upgrades[id] ?? 0) + 1;
  return true;
}

export function legacyUpgradeList(_state: GameState) {
  return LEGACY_UPGRADES;
}
