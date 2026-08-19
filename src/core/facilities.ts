import { BUSINESSES } from '../data/businesses';
import { FACILITIES, FACILITY_BY_ID, tierOf, type FacilityId } from '../data/buildings';
import { CONFIG } from '../data/config';
import { clamp } from './num';
import type { GameState } from './types';

/** 유닛 1개가 만드는 수요 포인트. 레벨의 로그 — 숫자가 읽히는 범위에 머문다 */
export function demandPoints(level: number): number {
  if (level <= 0) return 0;
  return 1 + Math.floor(Math.log10(level) * 3);
}

export function totalDemandPoints(state: GameState): number {
  let sum = 0;
  for (const def of BUSINESSES) {
    if (state.city.level < def.unlockCityLevel) continue;
    for (const u of state.businesses[def.id].units) sum += demandPoints(u.level);
  }
  return sum;
}

export function trackLevel(state: GameState, id: FacilityId, trackId: string): number {
  return state.facilities[id]?.tracks[trackId] ?? 0;
}

export function isBuilt(state: GameState, id: FacilityId): boolean {
  return state.facilities[id]?.built === true;
}

export function facilityUnlocked(state: GameState, id: FacilityId): boolean {
  return state.city.level >= FACILITY_BY_ID[id].unlockCityLevel;
}

export function facilityTotalLevel(state: GameState, id: FacilityId): number {
  const f = state.facilities[id];
  if (!f?.built) return 0;
  return Object.values(f.tracks).reduce((a, b) => a + b, 0);
}

export function facilityTier(state: GameState, id: FacilityId): number {
  if (!isBuilt(state, id)) return 0;
  return Math.max(1, tierOf(facilityTotalLevel(state, id)));
}

const lv = (s: GameState, f: FacilityId, t: string) => (isBuilt(s, f) ? trackLevel(s, f, t) : 0);

export interface CityStats {
  popCap: number;
  popGrowthPerSec: number;
  laborSupply: number;
  laborDemand: number;
  laborEff: number;
  powerSupply: number;
  powerDemand: number;
  powerEff: number;
  taxMult: number;
  outputMult: number;
  chainFloorBonus: number;
  chainDemandMult: number;
  offlineBonus: number;
  fireChanceMult: number;
  fireDurationMult: number;
  fireDamageMult: number;
  theftChanceMult: number;
  theftLossMult: number;
  theftBlockChance: number;
}

/** 시설 상태 -> 도시 전체 능력치. 화면 여러 곳에서 쓰므로 한 번에 계산한다. */
export function cityStats(state: GameState): CityStats {
  const C = CONFIG.facility;

  const popCap =
    C.popBase *
    Math.pow(1.22, lv(state, 'housing', 'floors')) *
    Math.pow(1.34, lv(state, 'housing', 'blocks')) *
    Math.pow(1.1, lv(state, 'housing', 'interior'));

  const greenMult =
    1 +
    lv(state, 'green', 'area') * 0.25 +
    lv(state, 'green', 'deco') * 0.18 +
    lv(state, 'green', 'amenity') * 0.12;

  const hospitalMult =
    1 +
    lv(state, 'hospital', 'beds') * 0.06 +
    lv(state, 'hospital', 'equip') * 0.08 +
    lv(state, 'hospital', 'ambulance') * 0.04;

  const powerSupply =
    C.powerBase *
    Math.pow(1.3, lv(state, 'power', 'gens')) *
    Math.pow(1.7, lv(state, 'power', 'method')) *
    Math.pow(1.14, lv(state, 'power', 'grid'));

  const demand = totalDemandPoints(state);
  const powerDemand = demand * C.powerPerPoint;
  const laborDemand = demand * C.laborPerPoint;
  const laborSupply = state.city.pop * hospitalMult;

  const powerEff = powerDemand <= 0 ? 1 : clamp(powerSupply / powerDemand, C.gateFloor, 1);
  const laborEff = laborDemand <= 0 ? 1 : clamp(laborSupply / laborDemand, C.gateFloor, 1);

  return {
    popCap,
    popGrowthPerSec: C.popGrowthBase * greenMult,
    laborSupply,
    laborDemand,
    laborEff,
    powerSupply,
    powerDemand,
    powerEff,
    taxMult:
      1 +
      lv(state, 'shops', 'stores') * 0.035 +
      lv(state, 'shops', 'grade') * 0.05 +
      lv(state, 'shops', 'signs') * 0.02,
    outputMult:
      1 +
      lv(state, 'school', 'rooms') * 0.04 +
      lv(state, 'school', 'labs') * 0.03 +
      lv(state, 'school', 'teachers') * 0.05,
    chainFloorBonus: lv(state, 'road', 'lanes') * 0.02,
    chainDemandMult: Math.pow(0.97, lv(state, 'road', 'cross')),
    offlineBonus: lv(state, 'road', 'signal') * 0.02,
    fireChanceMult: Math.pow(0.92, lv(state, 'fire', 'trucks')),
    fireDurationMult: Math.pow(0.94, lv(state, 'fire', 'gear')),
    fireDamageMult: Math.pow(0.95, lv(state, 'fire', 'crew')),
    theftChanceMult: Math.pow(0.92, lv(state, 'police', 'cars')),
    theftLossMult: Math.pow(0.94, lv(state, 'police', 'officers')),
    theftBlockChance: Math.min(0.9, lv(state, 'police', 'cctv') * 0.07),
  };
}

// ───────────────────────── 건설 / 업그레이드 ─────────────────────────

export interface Price {
  cash: number;
  material: number;
}

export function buildPrice(id: FacilityId): Price {
  const def = FACILITY_BY_ID[id];
  return { cash: def.buildCash, material: def.buildMat };
}

export function trackPrice(state: GameState, id: FacilityId, trackId: string): Price {
  const def = FACILITY_BY_ID[id];
  const t = def.tracks.find((x) => x.id === trackId)!;
  const n = trackLevel(state, id, trackId);
  const g = Math.pow(t.growth, n);
  return { cash: t.baseCash * g, material: t.baseMat * g };
}

export function canAfford(state: GameState, p: Price): boolean {
  return state.resources.cash >= p.cash && state.resources.material >= p.material;
}

function pay(state: GameState, p: Price): void {
  state.resources.cash -= p.cash;
  state.resources.material -= p.material;
}

export function buildFacility(state: GameState, id: FacilityId): boolean {
  if (isBuilt(state, id) || !facilityUnlocked(state, id)) return false;
  const p = buildPrice(id);
  if (!canAfford(state, p)) return false;
  pay(state, p);
  state.facilities[id].built = true;
  return true;
}

export function buyTrack(state: GameState, id: FacilityId, trackId: string): boolean {
  if (!isBuilt(state, id)) return false;
  const def = FACILITY_BY_ID[id];
  const t = def.tracks.find((x) => x.id === trackId);
  if (!t) return false;
  if (trackLevel(state, id, trackId) >= t.maxLevel) return false;
  const p = trackPrice(state, id, trackId);
  if (!canAfford(state, p)) return false;
  pay(state, p);
  state.facilities[id].tracks[trackId] += 1;
  return true;
}

/** 아직 안 지은, 지을 수 있는 시설 목록 (건설 시트용) */
export function buildableFacilities(state: GameState) {
  return FACILITIES.filter((f) => facilityUnlocked(state, f.id) && !isBuilt(state, f.id));
}

export function builtFacilities(state: GameState) {
  return FACILITIES.filter((f) => isBuilt(state, f.id));
}
