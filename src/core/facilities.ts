import { BUSINESSES } from '../data/businesses';
import { FACILITIES, FACILITY_BY_ID, facilityTierOf, type FacilityId } from '../data/buildings';
import { CONFIG } from '../data/config';
import { clamp } from './num';
import type { GameState } from './types';

export function facilityLevel(state: GameState, id: FacilityId): number {
  return state.facilities[id]?.level ?? 0;
}

export function isBuilt(state: GameState, id: FacilityId): boolean {
  return facilityLevel(state, id) > 0;
}

export function facilityUnlocked(state: GameState, id: FacilityId): boolean {
  return state.city.level >= FACILITY_BY_ID[id].unlockCityLevel;
}

export function facilityTier(state: GameState, id: FacilityId): number {
  return facilityTierOf(facilityLevel(state, id));
}

/** 다음 레벨 비용: base x rate^(현재레벨) */
export function facilityCost(state: GameState, id: FacilityId): number {
  const def = FACILITY_BY_ID[id];
  const lv = facilityLevel(state, id);
  if (lv >= def.maxLevel) return Infinity;
  return def.baseCost * Math.pow(def.rate, lv);
}

/** 설계도 '시설 배율' 강화 */
function facilityBonus(state: GameState): number {
  return 1 + (state.prestige.upgrades['facility_bonus'] ?? 0) * 0.15;
}

const lv = (s: GameState, f: FacilityId) => facilityLevel(s, f);

// ── 유닛별 요구치 (기획서 수치표 4장) ─────────────────────
/** 유닛 1개당 필요 인구 = 유닛 번호 x 10 */
export const unitPopCost = (index: number) => (index + 1) * 10;
/** 유닛 1개당 필요 전력 = 유닛 번호 x 5 */
export const unitPowerCost = (index: number) => (index + 1) * 5;

export interface CityStats {
  /** 주거지가 주는 인구 상한 */
  popCap: number;
  /** 실제 노동력 = 인구 x 병원 배율 */
  laborSupply: number;
  /** 전 유닛이 요구하는 인구 합 */
  popDemand: number;
  popGrowthMult: number;
  powerSupply: number;
  powerDemand: number;
  /** 전력 부족 비율 (초당 산출에 곱함) */
  powerEff: number;
  taxMult: number;
  outputMult: number;
  /** 자원 이동 지연(초). 도로가 줄인다 */
  transferDelay: number;
  /** 사슬 요구량 배수 (지연이 짧을수록 적게 필요) */
  chainDemandMult: number;
  accidentMult: number;
  lossPrevent: number;
}

/** 사업 유닛들이 요구하는 인구/전력 합 */
export function totalDemand(state: GameState): { pop: number; power: number } {
  let pop = 0;
  let power = 0;
  for (const def of BUSINESSES) {
    if (state.city.level < def.unlockCityLevel) continue;
    const units = state.businesses[def.id].units;
    for (let i = 0; i < units.length; i++) {
      if (!units[i].unlocked) continue;
      pop += unitPopCost(i);
      power += unitPowerCost(i);
    }
  }
  return { pop, power };
}

export function cityStats(state: GameState): CityStats {
  const b = facilityBonus(state);
  const demand = totalDemand(state);

  const popCap = CONFIG.facility.popBase + lv(state, 'housing') * 50 * b;
  const hospital = 1 + Math.min(1.5, lv(state, 'hospital') * 0.03) * b;
  const powerSupply = CONFIG.facility.powerBase + lv(state, 'power') * 100 * b;
  const roadCut = Math.min(0.75, lv(state, 'road') * 0.03 * b);
  const transferDelay = Math.max(15, 60 * (1 - roadCut));

  return {
    popCap,
    laborSupply: state.city.pop * hospital,
    popDemand: demand.pop,
    popGrowthMult: 1 + Math.min(1.5, lv(state, 'green') * 0.02) * b,
    powerSupply,
    powerDemand: demand.power,
    powerEff: demand.power <= 0 ? 1 : clamp(powerSupply / demand.power, CONFIG.facility.gateFloor, 1),
    taxMult: 1 + Math.min(2, lv(state, 'shops') * 0.02) * b,
    outputMult: 1 + Math.min(2, lv(state, 'school') * 0.02) * b,
    transferDelay,
    chainDemandMult: transferDelay / 60,
    accidentMult: 1 - Math.min(0.75, lv(state, 'fire') * 0.015) * b,
    lossPrevent: Math.min(0.9, lv(state, 'police') * 0.02 * b),
  };
}

/**
 * 인구가 모자라면 유닛이 앞에서부터만 돌아간다.
 * (기획서: 가동 유닛 수 = 인구 / 요구량)
 * 반환: 사업별로 몇 번 유닛까지 가동되는지
 */
export function staffedUnits(state: GameState, stats: CityStats): Record<string, number> {
  const out: Record<string, number> = {};
  let budget = stats.laborSupply;
  for (const def of BUSINESSES) {
    const units = state.businesses[def.id].units;
    let n = 0;
    for (let i = 0; i < units.length; i++) {
      if (!units[i].unlocked) continue;
      const need = unitPopCost(i);
      if (budget >= need) {
        budget -= need;
        n = i + 1;
      } else break;
    }
    out[def.id] = n;
  }
  return out;
}

export function buyFacility(state: GameState, id: FacilityId): boolean {
  if (!facilityUnlocked(state, id)) return false;
  const def = FACILITY_BY_ID[id];
  if (facilityLevel(state, id) >= def.maxLevel) return false;
  const cost = facilityCost(state, id);
  if (state.resources.cash < cost) return false;
  state.resources.cash -= cost;
  state.facilities[id].level += 1;
  state.facilities[id].unlocked = true;
  return true;
}

export function unlockedFacilities(state: GameState) {
  return FACILITIES.filter((f) => facilityUnlocked(state, f.id));
}

export function buildableFacilities(state: GameState) {
  return FACILITIES.filter((f) => facilityUnlocked(state, f.id) && !isBuilt(state, f.id));
}

export function builtFacilities(state: GameState) {
  return FACILITIES.filter((f) => isBuilt(state, f.id));
}
