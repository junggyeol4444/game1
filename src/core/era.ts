/**
 * 문명 시대 진행.
 *
 * 이 게임의 장기 루프는 "재개발"이 아니라 **문명 전환**이다.
 * 빈 들판 + 움집에서 시작해 목표 세수에 닿으면 도시를 전부 허물고 다음 문명으로 넘어간다.
 * 넘어갈 때마다 전 사업에 붙는 영구 배율(outputMult)과 유산(영구 재화)이 남는다.
 */
import { cityRequirement, terrainStage, type FacilityId } from '../data/buildings';
import { CONFIG } from '../data/config';
import { ERAS, MAX_ERA, eraDef, settlementNameOf, type EraDef, type EraPalette } from '../data/eras';
import type { BusinessId, GameState } from './types';

export { LEGACY } from '../data/eras';
export { MAX_ERA } from '../data/eras';

export function eraIndex(state: GameState): number {
  return Math.max(0, Math.min(MAX_ERA, state.era ?? 0));
}

export function currentEra(state: GameState): EraDef {
  return eraDef(eraIndex(state));
}

/** 다음 문명. 마지막 시대에서는 자기 자신 (같은 시대를 다시 세운다) */
export function nextEra(state: GameState): EraDef {
  return eraDef(Math.min(MAX_ERA, eraIndex(state) + 1));
}

export function isFinalEra(state: GameState): boolean {
  return eraIndex(state) >= MAX_ERA;
}

export function eraPalette(state: GameState): EraPalette {
  return currentEra(state).palette;
}

/** 이 시대에 전 사업에 붙는 영구 배율 */
export function eraOutputMult(state: GameState): number {
  return currentEra(state).outputMult;
}

// ── 이름 ────────────────────────────────────────────────────
export function bizName(state: GameState, id: BusinessId): string {
  return currentEra(state).business[id].name;
}
export function bizIcon(state: GameState, id: BusinessId): string {
  return currentEra(state).business[id].icon;
}
export function bizUnitLabel(state: GameState, id: BusinessId): string {
  return currentEra(state).business[id].unitLabel;
}
export function bizHoistName(state: GameState, id: BusinessId): string {
  return currentEra(state).hoist[id];
}
/**
 * 유닛(광산의 '층') 표시 이름.
 * businesses.ts 에 적힌 '3층 철광 갱도' 같은 이름은 근대 이후 도시를 전제로 쓴 것이라,
 * 그 이전 문명에서는 시대 단위 이름으로 부른다 ('3번 채취터').
 */
const NAMED_FROM_ERA = 6; // 근대

export function unitDisplayName(state: GameState, id: BusinessId, index: number, written: string): string {
  if (eraIndex(state) >= NAMED_FROM_ERA) return written;
  return `${index + 1}번 ${bizUnitLabel(state, id)}`;
}

export function facName(state: GameState, id: FacilityId): string {
  return currentEra(state).facility[id].name;
}
export function facIcon(state: GameState, id: FacilityId): string {
  return currentEra(state).facility[id].icon;
}
/** 도시 규모 이름 — 석기 시대의 '큰 부족' ~ 우주 시대의 '성간 도시' */
export function settlementName(state: GameState): string {
  return settlementNameOf(eraIndex(state), terrainStage(state.city.level));
}
export function leaderTitle(state: GameState): string {
  return currentEra(state).leader;
}

// ── 전환 조건 ───────────────────────────────────────────────
/** 지금 문명을 졸업하려면 도달해야 하는 도시 레벨 */
export function eraTargetLevel(state: GameState): number {
  const i = eraIndex(state);
  // 마지막 시대 이후로는 같은 시대를 더 크게 다시 세운다 — 목표 레벨만 계속 오른다
  const repeats = i >= MAX_ERA ? Math.max(0, state.prestige.count - MAX_ERA) : 0;
  return ERAS[i].advanceLevel + repeats * CONFIG.era.repeatLevels;
}

/** 지금 문명을 졸업하는 데 필요한 이번 회차 누적 세수 */
export function eraThreshold(state: GameState): number {
  return cityRequirement(eraTargetLevel(state));
}

export function eraProgress(state: GameState): { current: number; need: number; ratio: number } {
  const need = eraThreshold(state);
  const current = Math.max(0, state.city.taxRun);
  return { current, need, ratio: Math.min(1, current / need) };
}

export function canAdvanceEra(state: GameState): boolean {
  return state.city.taxRun >= eraThreshold(state);
}

/**
 * 전환으로 얻는 유산.
 * 시대가 오를수록 한 회차가 길어지므로 획득량도 시대마다 x2 로 커진다
 * (유산 강화 비용이 구매마다 x1.5 라, 이래야 강화 레벨이 계속 올라간다).
 * 목표를 넘겨서 더 키운 뒤 넘어가면 sqrt 만큼 더 받는다 — 이득이지만 완만하다.
 */
export function legacyOnAdvance(state: GameState): number {
  const need = eraThreshold(state);
  if (need <= 0) return 0;
  const ratio = Math.max(0, state.city.taxRun) / need;
  if (ratio < 1) return 0;
  const steps = (eraTargetLevel(state) - ERAS[0].advanceLevel) / CONFIG.era.repeatLevels;
  const base = CONFIG.era.baseGain * Math.pow(CONFIG.era.gainGrowth, Math.max(0, steps));
  return Math.floor(base * Math.sqrt(ratio));
}
